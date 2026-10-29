import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert, Badge, Button, Card, ConfirmDialog, DataTable, Drawer, EmptyState,
} from '@so360/design-system';
import { useBusinessSettings, useShellBridge } from '@so360/shell-context';
import { vendorService } from '../../services/vendorService';
import { useAuth } from '../../hooks/useAuth';
import { useInventoryFormatters } from '../../utils/formatters';
import {
    PAYMENT_METHOD_LABELS, VENDOR_BANK_PERMS, emptyBankForm, formFromAccount, isVendorBankEnabled,
    toBankPayload, validateBankForm, type BankFormErrors, type BankFormState, type VendorBankAccount,
} from '../../utils/vendorBank';
import { VendorBankAccountFields } from './VendorBankAccountFields';

const REVEAL_TTL_MS = 30_000;

type Pending =
    | { kind: 'deactivate'; account: VendorBankAccount }
    | { kind: 'reveal'; account: VendorBankAccount }
    | { kind: 'verify'; account: VendorBankAccount }
    | null;

const errMsg = (e: any, fallback: string) => (e?.message ? String(e.message) : fallback);

/**
 * Bank Details card on the vendor profile. Gated by the
 * submodule:inventory:vendor_bank_details flag and vendor_bank_accounts.* perms.
 * Numbers are always masked; "Reveal" is a separate audited call.
 */
export const VendorBankAccountsSection: React.FC<{ vendorId: string }> = ({ vendorId }) => {
    const shell = useShellBridge();
    const { can } = useAuth();
    const { settings } = useBusinessSettings();
    const formatters = useInventoryFormatters();
    const enabled = isVendorBankEnabled(shell);
    const canRead = can(VENDOR_BANK_PERMS.READ);
    const canManage = can(VENDOR_BANK_PERMS.MANAGE);
    const canVerify = can(VENDOR_BANK_PERMS.VERIFY);
    const canReveal = can(VENDOR_BANK_PERMS.REVEAL);

    const [accounts, setAccounts] = useState<VendorBankAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [drawer, setDrawer] = useState<{ mode: 'create' | 'edit'; account?: VendorBankAccount } | null>(null);
    const [form, setForm] = useState<BankFormState>(emptyBankForm());
    const [formErrors, setFormErrors] = useState<BankFormErrors>({});
    const [saving, setSaving] = useState(false);
    const [drawerError, setDrawerError] = useState<string | null>(null);
    const [pending, setPending] = useState<Pending>(null);
    const [revealed, setRevealed] = useState<{ id: string; account_number: string | null; iban: string | null } | null>(null);
    const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await vendorService.listBankAccounts(vendorId);
            setAccounts(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(errMsg(e, 'Could not load bank accounts.'));
        } finally {
            setLoading(false);
        }
    }, [vendorId]);

    useEffect(() => {
        if (enabled && canRead && vendorId) load();
    }, [enabled, canRead, vendorId, load]);

    useEffect(() => () => {
        if (revealTimer.current) clearTimeout(revealTimer.current);
    }, []);

    if (!enabled || !canRead) return null;

    const openCreate = () => {
        const f = emptyBankForm(settings?.base_currency || '');
        f.is_primary = accounts.every((a) => !a.is_active);
        setForm(f);
        setFormErrors({});
        setDrawerError(null);
        setDrawer({ mode: 'create' });
    };
    const openEdit = (account: VendorBankAccount) => {
        setForm(formFromAccount(account));
        setFormErrors({});
        setDrawerError(null);
        setDrawer({ mode: 'edit', account });
    };

    const save = async () => {
        if (!drawer) return;
        const errs = validateBankForm(form, drawer.mode);
        setFormErrors(errs);
        setDrawerError(null);
        if (Object.keys(errs).length) return;
        setSaving(true);
        try {
            if (drawer.mode === 'create') {
                await vendorService.createBankAccount(vendorId, toBankPayload(form, 'create'));
                setNotice('Bank account added.');
            } else {
                await vendorService.updateBankAccount(vendorId, drawer.account!.id, toBankPayload(form, 'edit'));
                setNotice('Bank account updated.');
            }
            setDrawer(null);
            await load();
        } catch (e) {
            setDrawerError(errMsg(e, 'Could not save the bank account.'));
        } finally {
            setSaving(false);
        }
    };

    const runAction = async (account: VendorBankAccount, action: 'deactivate' | 'set-primary' | 'verify', ok: string) => {
        setError(null);
        try {
            await vendorService.bankAccountAction(vendorId, account.id, action);
            setNotice(ok);
            await load();
        } catch (e) {
            setError(errMsg(e, 'The action failed.'));
        }
    };

    const reveal = async (account: VendorBankAccount) => {
        setError(null);
        try {
            const data = await vendorService.bankAccountAction(vendorId, account.id, 'reveal');
            setRevealed({ id: account.id, account_number: data?.account_number ?? null, iban: data?.iban ?? null });
            if (revealTimer.current) clearTimeout(revealTimer.current);
            revealTimer.current = setTimeout(() => setRevealed(null), REVEAL_TTL_MS);
        } catch (e) {
            setError(errMsg(e, 'Could not reveal the account number.'));
        }
    };

    const confirmPending = async () => {
        const p = pending;
        setPending(null);
        if (!p) return;
        if (p.kind === 'deactivate') await runAction(p.account, 'deactivate', 'Bank account deactivated.');
        else if (p.kind === 'verify') await runAction(p.account, 'verify', 'Bank account marked as verified.');
        else await reveal(p.account);
    };

    const columns = [
        {
            key: 'account', header: 'Account',
            render: (a: VendorBankAccount) => (
                <div className="flex flex-col">
                    <span className="font-medium">{a.account_holder}</span>
                    <span className="font-mono text-nb-sm" data-testid={`bank-masked-${a.id}`}>
                        {a.account_number_masked ?? a.iban_masked ?? '—'}
                    </span>
                </div>
            ),
        },
        {
            key: 'bank', header: 'Bank',
            render: (a: VendorBankAccount) => (
                <div className="flex flex-col">
                    <span>{a.bank_name}</span>
                    <span className="text-nb-sm text-fg-muted">
                        {[a.ifsc, a.swift_code, a.branch].filter(Boolean).join(' · ') || '—'}
                    </span>
                </div>
            ),
        },
        {
            key: 'method', header: 'Method',
            render: (a: VendorBankAccount) => `${PAYMENT_METHOD_LABELS[a.payment_method] ?? a.payment_method} · ${a.currency}`,
        },
        {
            key: 'status', header: 'Status',
            render: (a: VendorBankAccount) => (
                <div className="flex flex-wrap gap-nb-1">
                    {a.is_primary && <Badge tone="primary">Primary</Badge>}
                    {!a.is_active && <Badge tone="neutral">Inactive</Badge>}
                    {a.verification_status === 'verified'
                        ? <Badge tone="success" data-testid={`bank-verified-${a.id}`}>Verified</Badge>
                        : <Badge tone="warning">Unverified</Badge>}
                    {a.is_active && a.recently_changed && <Badge tone="warning">Changed recently</Badge>}
                </div>
            ),
        },
        {
            key: 'verified', header: 'Verified by',
            render: (a: VendorBankAccount) => a.verification_status === 'verified' && a.verified_at
                ? (
                    <div className="flex flex-col text-nb-sm">
                        <span title={a.verified_by ?? undefined}>{a.verified_by ? `User ${a.verified_by.slice(0, 8)}` : '—'}</span>
                        <span className="text-fg-muted">{formatters.formatDate(a.verified_at)}</span>
                    </div>
                )
                : '—',
        },
        {
            key: 'actions', header: '',
            render: (a: VendorBankAccount) => (
                <div className="flex flex-wrap justify-end gap-nb-1">
                    {canReveal && (
                        <Button size="sm" variant="secondary" data-testid={`bank-reveal-${a.id}`}
                            onClick={() => setPending({ kind: 'reveal', account: a })}>Reveal</Button>
                    )}
                    {a.is_active && canVerify && a.verification_status !== 'verified' && (
                        <Button size="sm" variant="secondary" data-testid={`bank-verify-${a.id}`}
                            onClick={() => setPending({ kind: 'verify', account: a })}>Verify</Button>
                    )}
                    {a.is_active && canManage && !a.is_primary && (
                        <Button size="sm" variant="secondary" data-testid={`bank-primary-${a.id}`}
                            onClick={() => runAction(a, 'set-primary', 'Primary account updated.')}>Make primary</Button>
                    )}
                    {a.is_active && canManage && (
                        <>
                            <Button size="sm" variant="secondary" data-testid={`bank-edit-${a.id}`}
                                onClick={() => openEdit(a)}>Edit</Button>
                            <Button size="sm" variant="danger" data-testid={`bank-deactivate-${a.id}`}
                                onClick={() => setPending({ kind: 'deactivate', account: a })}>Deactivate</Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    const pendingCopy = pending && {
        deactivate: {
            title: 'Deactivate bank account?',
            message: `${pending.account.bank_name} ${pending.account.account_number_masked ?? ''} will no longer be offered for payments. Payment history is kept.`,
            confirmLabel: 'Deactivate', intent: 'danger' as const,
        },
        verify: {
            title: 'Mark as verified?',
            message: 'Confirm you have checked these details against a bank document or with the vendor. Your name and the time are recorded.',
            confirmLabel: 'Mark verified', intent: 'default' as const,
        },
        reveal: {
            title: 'Reveal full account number?',
            message: 'This is recorded in the audit log. The number is hidden again after 30 seconds.',
            confirmLabel: 'Reveal', intent: 'default' as const,
        },
    }[pending.kind];

    return (
        <Card
            title="Bank details"
            data-testid="vendor-bank-section"
            actions={canManage ? <Button size="sm" onClick={openCreate} data-testid="bank-add">Add bank account</Button> : undefined}
        >
            <div className="flex flex-col gap-nb-3">
                {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
                {notice && <Alert variant="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
                {revealed && (
                    <Alert variant="info" title="Full account details" onDismiss={() => setRevealed(null)}>
                        <span className="font-mono" data-testid="bank-revealed">
                            {[revealed.account_number, revealed.iban].filter(Boolean).join(' · ') || '—'}
                        </span>
                    </Alert>
                )}
                <DataTable
                    data-testid="vendor-bank-table"
                    rowKey={(a: VendorBankAccount) => a.id}
                    rows={accounts}
                    loading={loading}
                    columns={columns}
                    emptyState={<EmptyState title="No bank accounts yet"
                        description="Add the vendor's bank details so payments go to a verified account."
                        action={canManage ? { label: 'Add bank account', onClick: openCreate } : undefined} />}
                />
            </div>

            <Drawer
                isOpen={!!drawer}
                onClose={() => setDrawer(null)}
                title={drawer?.mode === 'edit' ? 'Edit bank account' : 'Add bank account'}
                subtitle={drawer?.mode === 'edit' ? 'Changing the number, IFSC, SWIFT or IBAN resets verification.' : undefined}
                size="md"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setDrawer(null)} disabled={saving}>Cancel</Button>
                        <Button onClick={save} disabled={saving} data-testid="bank-save">{saving ? 'Saving…' : 'Save'}</Button>
                    </div>
                }
            >
                {drawerError && <Alert variant="error" className="mb-nb-3">{drawerError}</Alert>}
                {drawer && (
                    <VendorBankAccountFields value={form} onChange={setForm} errors={formErrors}
                        mode={drawer.mode} maskedNumber={drawer.account?.account_number_masked} />
                )}
            </Drawer>

            <ConfirmDialog
                open={!!pending}
                title={pendingCopy?.title ?? ''}
                message={pendingCopy?.message ?? ''}
                confirmLabel={pendingCopy?.confirmLabel}
                intent={pendingCopy?.intent}
                onConfirm={confirmPending}
                onCancel={() => setPending(null)}
            />
        </Card>
    );
};

export default VendorBankAccountsSection;
