import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Checkbox, EmptyState, Modal, SearchInput, Skeleton } from '@so360/design-system';
import { vendorService } from '../../services/vendorService';

export interface InviteResult {
    vendor_id: string;
    status: 'invited' | 'already_invited' | 'ineligible';
    reason?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    /** Vendors already attached to the RFQ — never selectable again. */
    invitedVendorIds: string[];
    /** Sends the invitations; the server re-validates eligibility and reports per-vendor outcomes. */
    onInvite: (vendorIds: string[]) => Promise<void>;
    busy?: boolean;
}

/** Vendor Master onboarding 'draft' is not transactable (same rule as purchase orders). */
const isEligible = (v: any) => (v.vendor_profiles?.[0]?.onboarding_status ?? 'active') !== 'draft';

/**
 * "Send to New Vendors": pick vendors from the Vendor Master who have not yet
 * been invited, review the selection, then send. Eligibility is only a UI
 * convenience here — the API re-checks every vendor on submit.
 */
const RFQInviteVendorsModal: React.FC<Props> = ({ open, onClose, invitedVendorIds, onInvite, busy }) => {
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [reviewing, setReviewing] = useState(false);

    const load = () => {
        setLoading(true);
        setLoadError(null);
        vendorService.getVendors()
            .then((v: any) => setVendors(Array.isArray(v) ? v : (v?.data ?? [])))
            .catch((e: any) => setLoadError(e?.message || 'Could not load vendors'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!open) return;
        setSelected([]);
        setSearch('');
        setReviewing(false);
        load();
    }, [open]);

    const available = useMemo(() => {
        const invited = new Set(invitedVendorIds);
        const q = search.trim().toLowerCase();
        return vendors
            .filter(v => !invited.has(v.id) && isEligible(v))
            .filter(v => !q || [v.name, v.email, v.vendor_profiles?.[0]?.classification]
                .some((f: string | undefined) => f?.toLowerCase().includes(q)));
    }, [vendors, invitedVendorIds, search]);

    const toggle = (id: string) =>
        setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));

    const chosen = vendors.filter(v => selected.includes(v.id));

    const submit = async () => {
        if (busy || chosen.length === 0) return; // repeated clicks must not double-send
        await onInvite(selected);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={reviewing ? 'Review invitations' : 'Send to new vendors'}
            footer={(
                <>
                    <Button variant="secondary" type="button" onClick={reviewing ? () => setReviewing(false) : onClose}>
                        {reviewing ? 'Back' : 'Cancel'}
                    </Button>
                    {reviewing ? (
                        <Button type="button" onClick={submit} disabled={busy || chosen.length === 0}>
                            {busy ? 'Sending...' : `Send to ${chosen.length} vendor${chosen.length === 1 ? '' : 's'}`}
                        </Button>
                    ) : (
                        <Button type="button" onClick={() => setReviewing(true)} disabled={selected.length === 0}>
                            Review ({selected.length})
                        </Button>
                    )}
                </>
            )}
        >
            {loading && <Skeleton className="h-24 w-full" />}
            {!loading && loadError && (
                <Alert variant="danger" title="Could not load vendors" action={{ label: 'Retry', onClick: load }}>
                    {loadError}
                </Alert>
            )}
            {!loading && !loadError && reviewing && (
                <div className="space-y-nb-3">
                    <p className="text-nb-body text-fg-muted">
                        The existing RFQ — same lines, target prices and response due date — will be emailed to:
                    </p>
                    <ul className="space-y-nb-2">
                        {chosen.map(v => (
                            <li key={v.id} className="flex flex-wrap items-center justify-between gap-nb-2 rounded-lg border border-line p-nb-3">
                                <span className="min-w-0 break-words text-fg">{v.name}</span>
                                <span className="text-nb-caption text-fg-subtle">{v.email || 'No email - invitation recorded, nothing emailed'}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {!loading && !loadError && !reviewing && (
                <div className="space-y-nb-3">
                    <SearchInput
                        name="invite-vendor-search"
                        placeholder="Search vendors by name, email or classification"
                        value={search}
                        onChange={(e: any) => setSearch(e?.target ? e.target.value : e)}
                    />
                    <div className="flex items-center justify-between text-nb-caption text-fg-subtle">
                        <span>{available.length} available · {invitedVendorIds.length} already invited</span>
                        <Badge tone={selected.length ? 'primary' : 'neutral'} size="sm">{selected.length} selected</Badge>
                    </div>
                    {available.length === 0 ? (
                        <EmptyState
                            title={vendors.length === 0 ? 'No vendors in the Vendor Master' : search ? 'No vendors match your search' : 'No eligible vendors left to invite'}
                            description="Vendors already on this RFQ and vendors still in onboarding are not listed."
                        />
                    ) : (
                        <ul className="max-h-80 space-y-nb-2 overflow-y-auto">
                            {available.map(v => (
                                <li key={v.id} className="rounded-lg border border-line p-nb-3">
                                    <Checkbox
                                        name={`invite-${v.id}`}
                                        label={v.name}
                                        description={`${v.email || 'No email on file'} · ${v.vendor_profiles?.[0]?.classification || 'supplier'}`}
                                        checked={selected.includes(v.id)}
                                        onChange={() => toggle(v.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default RFQInviteVendorsModal;
