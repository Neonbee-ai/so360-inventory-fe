import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { inventoryService } from '../../services/inventoryService';
import { useInventoryFormatters } from '../../utils/formatters';
import {
    Alert, Badge, Button, DataTable, EmptyState, ListPageTemplate, Modal, PeopleSelector, Select, TextField,
    toast, getErrorMessage, type DataTableColumn,
} from '@so360/design-system';

/**
 * Procurement exceptions - the shared queue for demand intake rejections and
 * failures, source changes after approval, coverage variances and (later)
 * sourcing / eligibility issues. A buyer assigns, retries or resolves each one.
 */
const KIND_LABELS: Record<string, string> = {
    intake_rejected: 'Demand rejected',
    intake_failed: 'Demand failed',
    source_changed: 'Source changed',
    coverage_variance: 'Coverage variance',
    vendor_eligibility_changed: 'Vendor eligibility changed',
    quote_non_comparable: 'Quotes not comparable',
    po_line_rejected: 'Supplier rejected a PO line',
    po_partial_acceptance: 'Supplier accepted part of a PO line',
    po_supplier_proposal: 'Supplier proposed a change',
};
const STATUS_TONES: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'info'> = {
    open: 'warning', assigned: 'info', resolved: 'success', dismissed: 'neutral',
};
const SEVERITY_TONES: Record<string, 'neutral' | 'warning' | 'danger' | 'info'> = {
    low: 'neutral', medium: 'info', high: 'warning', critical: 'danger',
};

const ProcurementExceptionsPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('open');
    const [kind, setKind] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [assigning, setAssigning] = useState<any | null>(null);
    const [resolving, setResolving] = useState<{ row: any; note: string } | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await procurementService.getExceptions({ status: status || undefined, kind: kind || undefined });
            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load exceptions'));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [status, kind]);

    const retry = async (row: any) => {
        setBusy(row.id);
        try {
            const res = await procurementService.retryException(row.id);
            toast.success(res?.pr_number ? `Accepted as ${res.pr_number}` : `Retried: ${res?.status}`);
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Retry failed'));
        } finally {
            setBusy(null);
        }
    };

    const assign = async (personId: string | string[] | null) => {
        const id = Array.isArray(personId) ? personId[0] : personId;
        if (!assigning || !id) return;
        try {
            await procurementService.assignException(assigning.id, id);
            toast.success('Assigned');
            setAssigning(null);
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to assign'));
        }
    };

    const resolve = async () => {
        if (!resolving?.note.trim()) return;
        try {
            await procurementService.resolveException(resolving.row.id, resolving.note.trim());
            toast.success('Resolved');
            setResolving(null);
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to resolve'));
        }
    };

    const summarise = (row: any) => {
        const p = row.payload || {};
        if (p.reason_code) return p.reason_code;
        if (row.kind === 'source_changed') return `Source v${p.old_version ?? '?'} -> v${p.new_version ?? '?'}`;
        if (p.error) return String(p.error).slice(0, 80);
        return row.ref_type ? `${row.ref_type} ${String(row.ref_id || '').slice(0, 8)}` : '-';
    };

    const columns: DataTableColumn<any>[] = [
        { key: 'kind', header: 'Exception', render: (r: any) => KIND_LABELS[r.kind] || r.kind },
        { key: 'detail', header: 'Detail', render: (r: any) => <span>{summarise(r)}{r.payload?.source?.id ? <span className="block text-xs text-fg-subtle">{r.payload.source.module} {r.payload.source.id}</span> : null}</span> },
        { key: 'severity', header: 'Severity', render: (r: any) => <Badge tone={SEVERITY_TONES[r.severity] || 'neutral'}>{r.severity}</Badge> },
        { key: 'status', header: 'Status', render: (r: any) => <Badge tone={STATUS_TONES[r.status] || 'neutral'}>{r.status}</Badge> },
        { key: 'created', header: 'Raised', render: (r: any) => formatters.formatDateTime(r.created_at) },
        {
            key: 'actions', header: 'Actions',
            render: (r: any) => ['open', 'assigned'].includes(r.status) ? (
                <span className="inline-flex flex-wrap gap-2">
                    {r.ref_type === 'purchase_requisition' && <Button size="sm" variant="ghost" onClick={() => navigate(`/procurement/pr/${r.ref_id}`)}>Open PR</Button>}
                    {['intake_rejected', 'intake_failed'].includes(r.kind) && (
                        <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => retry(r)}>{busy === r.id ? 'Retrying...' : 'Retry'}</Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setAssigning(r)}>Assign</Button>
                    <Button size="sm" variant="secondary" onClick={() => setResolving({ row: r, note: '' })}>Resolve</Button>
                </span>
            ) : <span className="text-fg-subtle">{r.resolution || '-'}</span>,
        },
    ];

    return (
        <ListPageTemplate
            trail={[]}
            title="Procurement Exceptions"
            description="Demand that was rejected or changed after approval, and other issues a buyer must review."
            count={rows.length > 0 ? `${rows.length} exception(s)` : undefined}
            loading={loading && rows.length === 0}
            isEmpty={!loading && !error && rows.length === 0}
            empty={<EmptyState title={status === 'open' ? 'No open exceptions.' : 'No exceptions match this filter.'} />}
            filters={(
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        name="exception-status"
                        label="Status"
                        value={status}
                        options={[{ value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'assigned', label: 'Assigned' }, { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' }]}
                        onChange={(e: any) => setStatus(e?.target ? e.target.value : e)}
                    />
                    <Select
                        name="exception-kind"
                        label="Type"
                        value={kind}
                        options={[{ value: '', label: 'All' }, ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))]}
                        onChange={(e: any) => setKind(e?.target ? e.target.value : e)}
                    />
                </div>
            )}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <DataTable data-testid="procurement-exceptions-table" columns={columns} rows={rows} rowKey={(r: any) => r.id} loading={loading} />
            </div>
            <Modal
                open={!!assigning}
                onClose={() => setAssigning(null)}
                size="sm"
                name="exception-assign-dialog"
                title="Assign exception"
                footer={<Button variant="secondary" onClick={() => setAssigning(null)}>Cancel</Button>}
            >
                <PeopleSelector orgId={inventoryService.getOrgId()} onChange={assign} placeholder="Search people..." filters={{ status: 'active' }} />
            </Modal>
            <Modal
                open={!!resolving}
                onClose={() => setResolving(null)}
                size="sm"
                name="exception-resolve-dialog"
                title="Resolve exception"
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setResolving(null)}>Cancel</Button>
                        <Button onClick={resolve} disabled={!resolving?.note.trim()}>Resolve</Button>
                    </>
                )}
            >
                <TextField
                    name="exception-resolution"
                    label="Resolution"
                    type="text"
                    value={resolving?.note ?? ''}
                    onChange={(e: any) => setResolving((d) => (d ? { ...d, note: e.target.value } : d))}
                    autoFocus
                />
            </Modal>
        </ListPageTemplate>
    );
};

export default ProcurementExceptionsPage;
