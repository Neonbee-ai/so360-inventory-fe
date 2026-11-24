import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, DataTable, EmptyState } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../services/vendorService';
import { useAuth } from '../../hooks/useAuth';
import { FINANCE_PERMS, PAYEE_KIND_LABELS, PAYEE_STATUS_LABELS, PAYEE_STATUS_TONE, diffRows, type PayeeKind } from '../../utils/payeeChange';

export interface PayeeChangeRow {
    id: string; kind: PayeeKind; status: string; reason: string; requested_by: string; created_at: string;
    changed_fields: string[]; decision_note?: string | null; verified?: boolean;
    proposed_masked?: Record<string, any>; current_masked?: Record<string, any> | null;
}

/**
 * Change requests of one vendor with the masked before/after and the Finance outcome
 * (Pulse 5d23afa0). The profile shows only the resulting status and masked summary.
 */
export const VendorPayeeChangesCard: React.FC<{ vendorId: string; refreshKey?: number; onChanged?: () => void }> = ({ vendorId, refreshKey = 0, onChanged }) => {
    const navigate = useNavigate();
    const { user, can } = useAuth() as any;
    const [rows, setRows] = useState<PayeeChangeRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const r: any = await vendorService.listVendorPayeeChanges(vendorId);
            setRows(Array.isArray(r) ? r : r?.data ?? []);
            setError(null);
        } catch {
            setError('Could not load change requests.');
        } finally {
            setLoading(false);
        }
    }, [vendorId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const cancel = async (id: string) => {
        try {
            await vendorService.cancelPayeeChange(id);
            await load();
            onChanged?.();
        } catch (e: any) {
            setError(e?.message ? String(e.message) : 'Could not cancel the request.');
        }
    };

    const columns: DataTableColumn<PayeeChangeRow>[] = [
        { key: 'kind', header: 'Change', alwaysVisible: true, render: (r) => PAYEE_KIND_LABELS[r.kind] ?? r.kind },
        {
            key: 'diff', header: 'Before → after',
            render: (r) => {
                const d = diffRows(r.current_masked, r.proposed_masked);
                return d.length === 0 ? '—' : (
                    <div className="flex flex-col text-nb-sm">
                        {d.map((x) => <span key={x.key}>{x.label}: {x.before} → {x.after}</span>)}
                    </div>
                );
            },
        },
        {
            key: 'status', header: 'Status',
            render: (r) => (
                <div className="flex flex-col gap-nb-1">
                    <Badge tone={PAYEE_STATUS_TONE[r.status] ?? 'neutral'} data-testid={`payee-status-${r.id}`}>{PAYEE_STATUS_LABELS[r.status] ?? r.status}</Badge>
                    {r.status === 'rejected' && r.decision_note && <span className="text-nb-sm text-fg-muted" data-testid={`payee-note-${r.id}`}>{r.decision_note}</span>}
                </div>
            ),
        },
        { key: 'when', header: 'Requested', render: (r) => String(r.created_at ?? '').slice(0, 10) },
        {
            key: 'actions', header: '',
            render: (r) => (
                <div className="flex justify-end gap-nb-1">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/vendors/finance-approvals/${r.id}`)}>Open</Button>
                    {(r.status === 'submitted' || r.status === 'verification_pending') && user?.id === r.requested_by && (
                        <Button size="sm" variant="ghost" data-testid={`payee-cancel-${r.id}`} onClick={() => cancel(r.id)}>Cancel request</Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <Card
            title="Change requests"
            data-testid="vendor-payee-changes"
            actions={can(FINANCE_PERMS.APPROVE) || can(FINANCE_PERMS.VERIFY)
                ? <Button size="sm" variant="secondary" onClick={() => navigate('/vendors/finance-approvals')}>Finance approvals</Button>
                : undefined}
        >
            {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
            {!loading && rows.length === 0 ? (
                <EmptyState title="No change requests" description="Bank and payment-detail changes are approved by Finance before they take effect." />
            ) : (
                <DataTable data-testid="vendor-payee-table" columns={columns} rows={rows} rowKey={(r) => r.id} loading={loading} />
            )}
        </Card>
    );
};

export default VendorPayeeChangesCard;
