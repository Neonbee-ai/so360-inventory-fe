import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { matchService } from '../../services/matchService';
import { useInventoryFormatters } from '../../utils/formatters';
import { useShellBridge } from '@so360/shell-context';
import { CASE_STATUS_LABELS, CASE_STATUS_TONES, OWNER_LABELS } from './MatchWorkbenchPage';
import {
    Alert, Badge, Button, Card, DataTable, DescriptionList, DetailPageTemplate, EmptyState, FieldGrid, FieldGridItem, Modal, Select, Textarea, TextField,
    getErrorMessage, toast, type BadgeTone, type DataTableColumn,
} from '@so360/design-system';

const TYPE_LABELS: Record<string, string> = {
    price: 'Price', discount: 'Discount', quantity: 'Quantity', missing_receipt: 'Missing receipt', tax: 'Tax', currency: 'Currency', freight: 'Freight',
    entity: 'Legal entity', supplier: 'Supplier', duplicate: 'Duplicate invoice', rejected_goods: 'Rejected goods', unapproved_amendment: 'Unapproved PO change',
    missing_service_evidence: 'Service evidence missing',
};
const STATUS_TONES: Record<string, BadgeTone> = { open: 'danger', in_progress: 'warning', escalated: 'danger', resolved: 'success', waived: 'neutral' };
const STATUS_OPTIONS = [
    { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'escalated', label: 'Escalated' },
    { value: 'resolved', label: 'Resolved' }, { value: 'waived', label: 'Waived (accepted as is)' },
];

const compact = (o: any) => Object.entries(o || {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') || '-' : String(v)}`).join(' · ');

/** One invoice match: lines (PO / accepted / invoiced), exceptions with owner, due date, evidence and history, Finance status read-only. */
const MatchCasePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const shell = useShellBridge() as any;
    const canFinance = shell?.hasPermission?.('match_exceptions.resolve_finance') === true;
    const [kase, setKase] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ status: 'in_progress', resolution_note: '', evidence_name: '', evidence_url: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setKase(await matchService.caseDetail(id!));
        } catch (e) {
            setError(getErrorMessage(e, 'Failed to load the match case'));
        } finally {
            setLoading(false);
        }
    }, [id]);
    useEffect(() => { load(); }, [load]);

    const openEdit = (e: any) => {
        setEditing(e);
        setForm({ status: e.status === 'open' ? 'in_progress' : e.status, resolution_note: e.resolution_note || '', evidence_name: '', evidence_url: '' });
    };

    const save = async () => {
        if ((form.status === 'resolved' || form.status === 'waived') && !form.resolution_note.trim()) {
            toast.warning('Add a resolution note before resolving or waiving.');
            return;
        }
        setSaving(true);
        try {
            await matchService.updateException(editing.id, {
                status: form.status as any,
                resolution_note: form.resolution_note || undefined,
                ...(form.evidence_name || form.evidence_url ? { evidence: [{ type: 'document', name: form.evidence_name || form.evidence_url, url: form.evidence_url || undefined }] } : {}),
            }, editing.owner_module === 'finance');
            toast.success('Exception updated');
            setEditing(null);
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Failed to update the exception'));
        } finally {
            setSaving(false);
        }
    };

    const reevaluate = async () => {
        try {
            await matchService.reevaluate(id!);
            toast.success('Match re-evaluated');
            load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Failed to re-evaluate'));
        }
    };

    if (loading && !kase) return <DetailPageTemplate title="Invoice match" trail={[{ label: 'Invoice Match', to: '/procurement/match-cases' }]} loading />;
    if (error || !kase) {
        return (
            <DetailPageTemplate title="Invoice match" trail={[{ label: 'Invoice Match', to: '/procurement/match-cases' }]}>
                <EmptyState title={error || 'Match case not found'} action={{ label: 'Back to invoice match', onClick: () => navigate('/procurement/match-cases') }} />
            </DetailPageTemplate>
        );
    }

    const lineColumns: DataTableColumn<any>[] = [
        { key: 'line', header: 'PO line', render: (l: any) => l.po_line_id?.slice(0, 8) },
        { key: 'ordered', header: 'Ordered', align: 'right', render: (l: any) => l.ordered },
        { key: 'accepted', header: 'Accepted', align: 'right', render: (l: any) => l.accepted },
        { key: 'invoiced', header: 'Invoiced', align: 'right', render: (l: any) => l.invoiced },
        { key: 'poPrice', header: 'PO price', align: 'right', render: (l: any) => formatters.formatCurrency(l.po_unit_price) },
        { key: 'invPrice', header: 'Invoice price', align: 'right', render: (l: any) => (l.invoice_unit_price != null ? formatters.formatCurrency(l.invoice_unit_price) : '-') },
        { key: 'ok', header: 'Result', render: (l: any) => <Badge tone={l.ok ? 'success' : 'danger'}>{l.ok ? 'Matches' : 'Differs'}</Badge> },
    ];

    const excColumns: DataTableColumn<any>[] = [
        { key: 'type', header: 'Issue', render: (e: any) => TYPE_LABELS[e.type] || e.type },
        { key: 'detail', header: 'Expected / actual', render: (e: any) => <div><div className="text-nb-caption text-fg-subtle">{compact(e.expected)}</div><div>{compact(e.actual)}</div></div> },
        { key: 'owner', header: 'Owner', render: (e: any) => OWNER_LABELS[e.owner_module] || e.owner_module },
        { key: 'due', header: 'Due', render: (e: any) => (e.due_at ? formatters.formatDate(e.due_at) : '-') },
        { key: 'status', header: 'Status', render: (e: any) => <Badge tone={STATUS_TONES[e.status] || 'neutral'}>{String(e.status).replace(/_/g, ' ')}</Badge> },
        {
            key: 'action',
            header: 'Action',
            render: (e: any) => (e.owner_module === 'finance' && !canFinance
                ? <span className="text-nb-caption text-fg-subtle">Finance decides</span>
                : <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>{['resolved', 'waived'].includes(e.status) ? 'View' : 'Work on'}</Button>),
        },
    ];

    const lines = kase.result?.lines ?? [];
    return (
        <>
            <DetailPageTemplate
                title={kase.invoice?.invoice_number ?? 'Invoice match'}
                trail={[{ label: 'Invoice Match', to: '/procurement/match-cases' }]}
                status={(
                    <>
                        <Badge tone={CASE_STATUS_TONES[kase.status] || 'neutral'}>{CASE_STATUS_LABELS[kase.status] || kase.status}</Badge>
                        {kase.finance_hold && <Badge tone="warning">Finance hold</Badge>}
                    </>
                )}
                secondaryActions={[
                    {
                        id: 're-evaluate',
                        label: 'Re-evaluate',
                        onSelect: reevaluate,
                    },
                ]}
                sidePanel={(
                    <Card title="Finance (read-only)">
                        <DescriptionList
                            columns={1}
                            items={[
                                { label: 'Bill status', value: kase.finance_status ? String(kase.finance_status).replace(/_/g, ' ') : 'Not yet reported' },
                                { label: 'Hold', value: kase.finance_hold ? 'On hold - Finance releases it' : 'None' },
                                { label: 'Result sent to Finance', value: kase.last_sent_to_finance_at ? formatters.formatDateTime(kase.last_sent_to_finance_at) : 'Not yet' },
                                { label: 'Tolerance', value: `Version ${kase.tolerance_version ?? 0}` },
                            ]}
                        />
                        <p className="mt-nb-3 text-nb-caption text-fg-subtle">A match is not a payment. Finance owns posting, payables and payment.</p>
                    </Card>
                )}
            >
                <div className="flex flex-col gap-nb-6">
                    {kase.result?.finance_handoff?.ok === false && <Alert variant="warning">The match result could not be delivered to Finance yet. It is retried on the next change.</Alert>}
                    <Card title="Summary">
                        <DescriptionList
                            columns={2}
                            items={[
                                { label: 'Purchase order', value: kase.po ? <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/po/${kase.po.id}`)}>#{kase.po.po_number}</Button> : '-' },
                                { label: 'PO version', value: kase.po_version ?? '-' },
                                { label: 'Invoice total', value: formatters.formatCurrency(kase.result?.invoice_total ?? kase.invoice?.total_amount ?? 0) },
                                { label: 'Expected from PO and receipts', value: formatters.formatCurrency(kase.result?.expected_total ?? 0) },
                            ]}
                        />
                    </Card>
                    <Card title="Lines">
                        <DataTable data-testid="match-lines" columns={lineColumns} rows={lines} rowKey={(l: any) => l.po_line_id} emptyState={<EmptyState title="No invoice lines." />} />
                    </Card>
                    <Card title="Exceptions">
                        <DataTable data-testid="match-exceptions" columns={excColumns} rows={kase.exceptions ?? []} rowKey={(e: any) => e.id} emptyState={<EmptyState title="No exceptions." />} />
                    </Card>
                </div>
            </DetailPageTemplate>

            <Modal
                open={!!editing}
                onClose={() => setEditing(null)}
                title={editing ? `${TYPE_LABELS[editing.type] || editing.type} - ${OWNER_LABELS[editing.owner_module] || ''}` : ''}
                size="2xl"
                footer={(
                    <>
                        <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button type="button" onClick={save} loading={saving} disabled={saving}>Save</Button>
                    </>
                )}
            >
                {editing && (
                    <div className="flex flex-col gap-nb-4">
                        <FieldGrid columns={2}>
                            <FieldGridItem><Select label="Status" name="exception_status" value={form.status} options={STATUS_OPTIONS} onValueChange={(v: string) => setForm({ ...form, status: v })} /></FieldGridItem>
                        </FieldGrid>
                        <Textarea label="Resolution note" name="resolution_note" value={form.resolution_note} onChange={e => setForm({ ...form, resolution_note: e.target.value })} />
                        <FieldGrid columns={2}>
                            <FieldGridItem><TextField label="Evidence name" name="evidence_name" value={form.evidence_name} onChange={e => setForm({ ...form, evidence_name: e.target.value })} /></FieldGridItem>
                            <FieldGridItem><TextField label="Link" name="evidence_url" value={form.evidence_url} onChange={e => setForm({ ...form, evidence_url: e.target.value })} /></FieldGridItem>
                        </FieldGrid>
                        <div className="flex flex-col gap-nb-1">
                            <span className="text-nb-label text-fg">History</span>
                            {(editing.history ?? []).length === 0 && <span className="text-nb-caption text-fg-subtle">No history yet.</span>}
                            {(editing.history ?? []).map((h: any) => (
                                <div key={h.id} className="text-nb-caption text-fg-subtle">
                                    {formatters.formatDateTime(h.created_at)} · {String(h.action).replace(/_/g, ' ')}{h.note ? ` - ${h.note}` : ''}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default MatchCasePage;
