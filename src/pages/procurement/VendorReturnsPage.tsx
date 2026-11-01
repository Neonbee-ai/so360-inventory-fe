import React, { useEffect, useState } from 'react';
import { qualityService } from '../../services/qualityService';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import { validateText } from '../../utils/validateText';
import { Alert, Button, Checkbox, DataTable, EmptyState, Grid, GridItem, KpiCard, ListPageTemplate, Modal, Select, StatusBadge, TextField, Textarea, toast, getErrorMessage, type DataTableColumn, FieldGrid } from '@so360/design-system';

const REASONS = [
    { value: 'damaged', label: 'Damaged' },
    { value: 'wrong_item', label: 'Wrong item' },
    { value: 'excess_delivery', label: 'Excess delivery' },
    { value: 'expired', label: 'Expired' },
    { value: 'quality_failure', label: 'Quality failure' },
    { value: 'other', label: 'Other' },
];

const RESOLUTIONS = [
    { value: 'credit_note', label: 'Credit note' },
    { value: 'replacement', label: 'Replacement' },
    { value: 'refund', label: 'Refund' },
    { value: 'none', label: 'No settlement' },
];

/** The next step available for a return, given where it is. */
const NEXT_STEP: Record<string, { status: string; label: string } | undefined> = {
    draft: { status: 'approved', label: 'Approve' },
    approved: { status: 'dispatched', label: 'Mark Dispatched' },
    dispatched: { status: 'settled', label: 'Settle' },
};

const VendorReturnsPage = () => {
    const formatters = useInventoryFormatters();
    const [returns, setReturns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [grns, setGrns] = useState<any[]>([]);
    const [selectedGrn, setSelectedGrn] = useState<any>(null);
    const [form, setForm] = useState({ reason: 'damaged', resolution: 'credit_note', remarks: '' });
    const [lines, setLines] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<{ grn?: string; remarks?: string; lines?: string }>({});
    const [settling, setSettling] = useState<any>(null);
    const [creditNote, setCreditNote] = useState({ credit_note_number: '', credit_note_date: '' });

    useEffect(() => { fetchData(); }, [statusFilter]);

    const fetchData = async () => {
        try {
            setFetchError(null);
            const data = await qualityService.getReturns(statusFilter ? { status: statusFilter } : {});
            setReturns(Array.isArray(data) ? data : []);
        } catch (err) {
            setFetchError(getErrorMessage(err, 'Failed to load vendor returns'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!showForm || grns.length) return;
        procurementService.getGRNs()
            .then((g: any) => setGrns(Array.isArray(g) ? g : []))
            .catch(() => setGrns([]));
    }, [showForm]);

    const selectGrn = (id: string) => {
        setErrors(e => ({ ...e, grn: undefined, lines: undefined }));
        const grn = grns.find(g => g.id === id);
        setSelectedGrn(grn || null);
        // Default to the units that were rejected or damaged on receipt — the
        // usual reason a return exists — but let the buyer change it.
        setLines((grn?.goods_receipt_lines || []).map((l: any) => {
            const rejected = (Number(l.rejected_quantity) || 0) + (Number(l.damaged_quantity) || 0);
            return {
                grn_line_id: l.id,
                item_id: l.item_id,
                description: l.description || l.item_id?.slice(0, 8) || 'Line',
                received: Number(l.quantity_received) || 0,
                rejected,
                quantity: String(rejected),
                unit_cost: String(Number(l.unit_cost) || 0),
                batch_number: l.batch_number || '',
                // Rejected units never entered stock; anything else did.
                already_excluded_from_stock: rejected > 0,
            };
        }));
    };

    const updateLine = (idx: number, field: string, value: any) => {
        const next = [...lines];
        next[idx] = { ...next[idx], [field]: value };
        setLines(next);
    };

    const submit = async () => {
        const payloadLines = lines.filter(l => parseFloat(l.quantity) > 0);
        const nextErrors = {
            grn: selectedGrn ? undefined : 'Goods receipt is required.',
            remarks: validateText('Remarks', form.remarks, { required: false, max: 500 }),
            lines: selectedGrn && payloadLines.length === 0 ? 'Enter a quantity on at least one line.' : undefined,
        };
        setErrors(nextErrors);
        if (!selectedGrn) {
            toast.warning('Select the receipt the goods came in on.');
            return;
        }
        if (nextErrors.remarks) return;
        if (payloadLines.length === 0) {
            toast.warning('Enter a quantity on at least one line.');
            return;
        }
        const over = payloadLines.find(l => parseFloat(l.quantity) > l.received);
        if (over) {
            toast.warning(`Cannot return more than the ${over.received} units received for "${over.description}".`);
            return;
        }

        setSaving(true);
        try {
            await qualityService.createReturn({
                vendor_id: selectedGrn.vendor_id || selectedGrn.po?.vendor_id,
                grn_id: selectedGrn.id,
                po_id: selectedGrn.po_id,
                warehouse_id: selectedGrn.warehouse_id,
                reason: form.reason,
                resolution: form.resolution,
                remarks: form.remarks || undefined,
                items: payloadLines.map(l => ({
                    grn_line_id: l.grn_line_id,
                    item_id: l.item_id || undefined,
                    description: l.description,
                    quantity: parseFloat(l.quantity),
                    unit_cost: parseFloat(l.unit_cost) || 0,
                    batch_number: l.batch_number || undefined,
                    already_excluded_from_stock: l.already_excluded_from_stock,
                })),
            });
            toast.success('Vendor return raised');
            setShowForm(false);
            setSelectedGrn(null);
            setLines([]);
            setForm({ reason: 'damaged', resolution: 'credit_note', remarks: '' });
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to raise the return'));
        } finally {
            setSaving(false);
        }
    };

    const advance = async (ret: any) => {
        const step = NEXT_STEP[ret.status];
        if (!step) return;

        // Settling a credit-note return needs the vendor's credit note, so
        // collect it rather than letting the API reject the call.
        if (step.status === 'settled' && ret.resolution === 'credit_note') {
            setSettling(ret);
            return;
        }

        try {
            await qualityService.updateReturnStatus(ret.id, { status: step.status });
            toast.success(`Return ${step.status}`);
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to update the return'));
        }
    };

    const submitSettlement = async () => {
        if (!creditNote.credit_note_number) {
            toast.warning('Enter the vendor credit note number.');
            return;
        }
        try {
            await qualityService.updateReturnStatus(settling.id, {
                status: 'settled',
                credit_note_number: creditNote.credit_note_number,
                credit_note_date: creditNote.credit_note_date || undefined,
            });
            toast.success('Return settled');
            setSettling(null);
            setCreditNote({ credit_note_number: '', credit_note_date: '' });
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to settle the return'));
        }
    };

    const columns: DataTableColumn<any>[] = [
        {
            key: 'return',
            header: 'Return',
            render: (r: any) => (
                <>
                    <div className="font-semibold text-fg">{r.return_number}</div>
                    <div className="text-xs text-fg-subtle">{r.grn?.grn_number || ''}</div>
                </>
            ),
        },
        { key: 'vendor', header: 'Vendor', render: (r: any) => r.vendor_name || '—' },
        { key: 'reason', header: 'Reason', render: (r: any) => r.reason?.replace(/_/g, ' ') },
        {
            key: 'resolution',
            header: 'Resolution',
            render: (r: any) => (
                <>
                    {r.resolution?.replace(/_/g, ' ')}
                    {r.credit_note_number && <div className="font-mono text-xs text-success">{r.credit_note_number}</div>}
                </>
            ),
        },
        { key: 'value', header: 'Value', align: 'right', render: (r: any) => formatters.formatCurrency(r.total_amount || 0) },
        { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
        {
            key: 'action',
            header: 'Action',
            render: (r: any) => NEXT_STEP[r.status] ? (
                <Button variant="ghost" size="sm" onClick={() => advance(r)}>{NEXT_STEP[r.status]!.label} →</Button>
            ) : (
                <span className="text-sm text-fg-subtle">—</span>
            ),
        },
    ];

    return (
        <>
            <ListPageTemplate trail={[]}
                title="Vendor Returns"
                description="Send back damaged, wrong, excess or expired goods and track the credit."
                count={returns.length > 0 ? `${returns.length} return(s)` : undefined}
                primaryAction={<Button onClick={() => { setErrors({}); setShowForm(true); }}>+ New Return</Button>}
                filterConfig={{
                    fields: [{
                        key: 'status',
                        label: 'Status',
                        type: 'select',
                        options: [
                            { value: 'draft', label: 'Draft' },
                            { value: 'approved', label: 'Approved' },
                            { value: 'dispatched', label: 'Dispatched' },
                            { value: 'settled', label: 'Settled' },
                        ],
                    }],
                    values: { status: statusFilter || null },
                    onChange: (v: any) => setStatusFilter(v?.status || ''),
                    onClear: () => setStatusFilter(''),
                }}
                loading={loading}
                isEmpty={!loading && !fetchError && returns.length === 0}
                empty={<EmptyState title="No vendor returns raised." />}
            >
                <div className="flex flex-col gap-nb-4">
                    {fetchError && <Alert variant="error">{fetchError}</Alert>}
                    <Grid columns="auto" data-testid="vendor-returns-kpis">
                        {[
                            { label: 'Open Returns', value: returns.filter(r => ['draft', 'approved', 'dispatched'].includes(r.status)).length },
                            { label: 'Awaiting Credit', value: returns.filter(r => r.status === 'dispatched' && r.resolution === 'credit_note').length },
                            { label: 'Settled', value: returns.filter(r => r.status === 'settled').length },
                            { label: 'Value Returned', value: formatters.formatCurrency(returns.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)) },
                        ].map(s => (
                            <GridItem key={s.label} span={3}>
                                <KpiCard label={s.label} value={s.value} />
                            </GridItem>
                        ))}
                    </Grid>
                    <DataTable
                        data-testid="vendor-returns-table"
                        columns={columns}
                        rows={returns}
                        rowKey={(r: any) => r.id}
                        loading={loading}
                    />
                </div>
            </ListPageTemplate>

            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title="New Vendor Return"
                size="3xl"
                name="new-vendor-return"
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                        <Button onClick={submit} disabled={saving} loading={saving}>{saving ? 'Raising...' : 'Raise Return'}</Button>
                    </>
                )}
            >
                <div className="flex flex-col gap-nb-4">
                    <FieldGrid columns={3}>
                        <Select
                            name="ret-grn"
                            label="Goods Receipt"
                            value={selectedGrn?.id || ''}
                            error={errors.grn}
                            onChange={(e: any) => selectGrn(e.target.value)}
                            options={[{ value: '', label: 'Select a receipt' }, ...grns.map(g => ({ value: g.id, label: g.grn_number }))]}
                        />
                        <Select
                            name="ret-reason"
                            label="Reason"
                            value={form.reason}
                            onChange={(e: any) => setForm({ ...form, reason: e.target.value })}
                            options={REASONS}
                        />
                        <Select
                            name="ret-resolution"
                            label="Resolution"
                            value={form.resolution}
                            onChange={(e: any) => setForm({ ...form, resolution: e.target.value })}
                            options={RESOLUTIONS}
                        />
                    </FieldGrid>

                    {lines.length === 0 ? (
                        <EmptyState title="Select a receipt to choose what goes back." />
                    ) : (
                        <div className="flex flex-col gap-nb-3">
                            <span className="text-xs font-semibold text-fg-subtle">Lines returned</span>
                            {errors.lines && <Alert variant="error">{errors.lines}</Alert>}
                            {lines.map((l, idx) => (
                                <div key={l.grn_line_id} className="flex flex-wrap items-center gap-nb-3 rounded-xl border border-line p-nb-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm text-fg">{l.description}</div>
                                        <div className="text-xs text-fg-subtle">
                                            {l.received} received{l.rejected > 0 ? ` · ${l.rejected} rejected on arrival` : ''}
                                        </div>
                                    </div>
                                    <TextField
                                        name={`ret-qty-${idx}`}
                                        type="number"
                                        min="0"
                                        aria-label={`Return quantity for ${l.description}`}
                                        value={l.quantity}
                                        onChange={(e: any) => updateLine(idx, 'quantity', e.target.value)}
                                    />
                                    <TextField
                                        name={`ret-cost-${idx}`}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        aria-label={`Unit cost for ${l.description}`}
                                        value={l.unit_cost}
                                        onChange={(e: any) => updateLine(idx, 'unit_cost', e.target.value)}
                                    />
                                    <Checkbox
                                        name={`ret-excl-${idx}`}
                                        label="Never stocked"
                                        aria-label={`Already excluded from stock for ${l.description}`}
                                        checked={l.already_excluded_from_stock}
                                        onChange={(e: any) => updateLine(idx, 'already_excluded_from_stock', e.target.checked)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <Textarea
                        name="ret-remarks"
                        label="Remarks"
                        value={form.remarks}
                        error={errors.remarks}
                        onChange={(e: any) => { setForm({ ...form, remarks: e.target.value }); setErrors(er => ({ ...er, remarks: undefined })); }}
                    />
                </div>
            </Modal>

            <Modal
                open={!!settling}
                onClose={() => setSettling(null)}
                title={`Settle ${settling?.return_number ?? ''}`}
                size="sm"
                name="settle-vendor-return"
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setSettling(null)}>Cancel</Button>
                        <Button onClick={submitSettlement}>Settle</Button>
                    </>
                )}
            >
                <div className="flex flex-col gap-nb-4">
                    <TextField
                        name="cn-number"
                        label="Credit Note Number"
                        value={creditNote.credit_note_number}
                        onChange={(e: any) => setCreditNote({ ...creditNote, credit_note_number: e.target.value })}
                    />
                    <TextField
                        name="cn-date"
                        label="Credit Note Date"
                        type="date"
                        value={creditNote.credit_note_date}
                        onChange={(e: any) => setCreditNote({ ...creditNote, credit_note_date: e.target.value })}
                    />
                </div>
            </Modal>
        </>
    );
};

export default VendorReturnsPage;
