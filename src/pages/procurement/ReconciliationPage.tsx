import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchService } from '../../services/matchService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Badge, Button, DataTable, EmptyState, ListPageTemplate, Modal, Select, Textarea, getErrorMessage, toast, type BadgeTone, type DataTableColumn } from '@so360/design-system';

const KIND_LABELS: Record<string, string> = {
    invoice_without_case: 'Invoice has a Finance bill but no match',
    case_without_finance_status: 'Finance has not reported the bill',
    expected_receipt_overdue: 'Expected delivery is overdue',
    po_status_stuck: 'PO still waiting although fully received',
};
const SEVERITY_TONES: Record<string, BadgeTone> = { low: 'neutral', medium: 'warning', high: 'danger', critical: 'danger' };
const STATUS_OPTIONS = [
    { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed (not a problem)' },
];
const FILTERS = [{ value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }];

/**
 * Cross-module reconciliation issues. They are found automatically each night and only RECORDED: nothing is
 * corrected for you. Someone looks into each one and says what they found before closing it.
 */
const ReconciliationPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('open');
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ status: 'in_progress', note: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        return Promise.resolve()
            .then(() => matchService.reconciliationIssues(status ? { status } : {}))
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch((e: any) => setError(getErrorMessage(e, 'Failed to load reconciliation issues')))
            .finally(() => setLoading(false));
    }, [status]);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (['resolved', 'dismissed'].includes(form.status) && !form.note.trim()) {
            toast.warning('Say what you found before resolving or dismissing.');
            return;
        }
        setSaving(true);
        try {
            await matchService.updateIssue(editing.id, { status: form.status, note: form.note || undefined });
            toast.success('Issue updated');
            setEditing(null);
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Failed to update the issue'));
        } finally {
            setSaving(false);
        }
    };

    const open = (r: any) => {
        const refs = r.refs || {};
        if (refs.po_id) navigate(`/procurement/po/${refs.po_id}`);
    };

    const columns: DataTableColumn<any>[] = [
        { key: 'kind', header: 'Problem', alwaysVisible: true, render: (r: any) => KIND_LABELS[r.kind] || r.kind },
        { key: 'sev', header: 'Severity', render: (r: any) => <Badge tone={SEVERITY_TONES[r.severity] || 'neutral'}>{r.severity}</Badge> },
        { key: 'refs', header: 'Where', render: (r: any) => (r.refs?.po_id ? <Button variant="ghost" size="sm" onClick={() => open(r)}>{r.refs.po_number ? `#${r.refs.po_number}` : 'Open the PO'}</Button> : (r.refs?.invoice_number ?? '-')) },
        { key: 'when', header: 'Found', render: (r: any) => formatters.formatDate(r.detected_at) },
        { key: 'status', header: 'Status', render: (r: any) => String(r.status).replace(/_/g, ' ') },
        { key: 'act', header: 'Action', render: (r: any) => <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setForm({ status: r.status === 'open' ? 'in_progress' : r.status, note: r.note || '' }); }}>Look into it</Button> },
    ];

    return (
        <>
            <ListPageTemplate
                trail={[]}
                title="Reconciliation"
                description="Mismatches found between Procurement, Inventory, Quality and Finance. Nothing is corrected automatically."
                count={rows.length > 0 ? `${rows.length} issue(s)` : undefined}
                loading={loading && rows.length === 0}
                loadingColumns={columns.length}
                isEmpty={!loading && !error && rows.length === 0}
                empty={<EmptyState title="Nothing to reconcile." description="The nightly check found no mismatches." />}
                filters={{
                    fields: [{ key: 'status', label: 'Show', type: 'select', options: FILTERS, default: 'open' }],
                    values: { status },
                    onChange: (v) => setStatus(String(v.status ?? '')),
                    onClear: () => setStatus('open'),
                }}
            >
                <div className="flex flex-col gap-nb-4">
                    {error && <Alert variant="error">{error}</Alert>}
                    <DataTable data-testid="reconciliation-table" columns={columns} rows={rows} rowKey={(r: any) => r.id} loading={loading} />
                </div>
            </ListPageTemplate>
            <Modal
                open={!!editing}
                onClose={() => setEditing(null)}
                title={editing ? KIND_LABELS[editing.kind] || editing.kind : ''}
                size="lg"
                footer={(
                    <>
                        <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button type="button" onClick={save} loading={saving} disabled={saving}>Save</Button>
                    </>
                )}
            >
                <div className="flex flex-col gap-nb-4">
                    <Select label="Status" name="issue_status" value={form.status} options={STATUS_OPTIONS} onValueChange={(v: string) => setForm({ ...form, status: v })} />
                    <Textarea label="What you found or did" name="issue_note" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                </div>
            </Modal>
        </>
    );
};

export default ReconciliationPage;
