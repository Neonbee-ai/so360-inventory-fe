import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { qualityService } from '../../services/qualityService';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import {
    toast, getErrorMessage, Alert, Badge, Button, DataTable, DescriptionList, EmptyState, FieldGrid, FieldGridItem,
    Grid, GridItem, KpiCard, ListPageTemplate, Modal, Select, Textarea, TextField,
    type BadgeTone, type DataTableColumn, type FilterValues,
} from '@so360/design-system';

export const QC_STATUS_TONES: Record<string, BadgeTone> = {
    pending: 'warning',
    in_progress: 'primary',
    completed: 'success',
    cancelled: 'neutral',
};

const RESULT_TONES: Record<string, BadgeTone> = {
    passed: 'success',
    partial: 'warning',
    failed: 'danger',
};

const QC_STATUS_FILTER_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Quality inspections queue.
 *
 * A receipt routed to QC holds its stock, so this page is the gate between
 * goods arriving and goods being usable — recording a result is what releases
 * the accepted quantity into inventory.
 */
const QualityInspectionPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [inspections, setInspections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [active, setActive] = useState<any>(null);
    const [resultLines, setResultLines] = useState<any[]>([]);
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    const [showOpenForm, setShowOpenForm] = useState(false);
    const [grns, setGrns] = useState<any[]>([]);
    const [grnId, setGrnId] = useState('');

    useEffect(() => { fetchData(); }, [statusFilter]);

    const fetchData = async () => {
        try {
            setFetchError(null);
            const data = await qualityService.getInspections(statusFilter ? { status: statusFilter } : {});
            setInspections(Array.isArray(data) ? data : []);
        } catch (err) {
            setFetchError(getErrorMessage(err, 'Failed to load inspections'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!showOpenForm || grns.length) return;
        procurementService.getGRNs()
            .then((g: any) => setGrns(Array.isArray(g) ? g : []))
            .catch(() => setGrns([]));
    }, [showOpenForm]);

    const openInspection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grnId) {
            toast.warning('Select the goods receipt to inspect.');
            return;
        }
        setSaving(true);
        try {
            await qualityService.createInspection({ grn_id: grnId });
            toast.success('Inspection opened');
            setShowOpenForm(false);
            setGrnId('');
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to open inspection'));
        } finally {
            setSaving(false);
        }
    };

    const startInspecting = (inspection: any) => {
        setActive(inspection);
        setRemarks('');
        setResultLines((inspection.quality_inspection_lines || []).map((l: any) => ({
            line_id: l.id,
            description: l.description || l.item_id?.slice(0, 8) || 'Line',
            submitted: Number(l.received_quantity) || 0,
            accepted_quantity: String(Number(l.received_quantity) || 0),
            rejected_quantity: '0',
            defect_code: '',
            rejection_reason: '',
        })));
    };

    const updateResult = (idx: number, field: string, value: any) => {
        const next = [...resultLines];
        next[idx] = { ...next[idx], [field]: value };
        setResultLines(next);
    };

    const submitResult = async (e: React.FormEvent) => {
        e.preventDefault();
        const over = resultLines.find(
            l => (parseFloat(l.accepted_quantity) || 0) + (parseFloat(l.rejected_quantity) || 0) > l.submitted,
        );
        if (over) {
            toast.warning(`Accepted + rejected exceeds the ${over.submitted} units submitted for "${over.description}".`);
            return;
        }

        setSaving(true);
        try {
            const res = await qualityService.completeInspection(active.id, {
                remarks: remarks || undefined,
                lines: resultLines.map(l => ({
                    line_id: l.line_id,
                    accepted_quantity: parseFloat(l.accepted_quantity) || 0,
                    rejected_quantity: parseFloat(l.rejected_quantity) || 0,
                    defect_code: l.defect_code || undefined,
                    rejection_reason: l.rejection_reason || undefined,
                })),
            });
            const summary = res?.summary;
            toast.success(
                summary?.stock_released
                    ? `Inspection ${summary.result} — ${summary.accepted} units released to stock`
                    : `Inspection ${summary?.result}`,
            );
            setActive(null);
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to record the inspection'));
        } finally {
            setSaving(false);
        }
    };

    const totals = resultLines.reduce(
        (acc, l) => ({
            accepted: acc.accepted + (parseFloat(l.accepted_quantity) || 0),
            rejected: acc.rejected + (parseFloat(l.rejected_quantity) || 0),
        }),
        { accepted: 0, rejected: 0 },
    );

    const columns: DataTableColumn<any>[] = [
        {
            key: 'inspection',
            header: 'Inspection',
            alwaysVisible: true,
            render: (i) => (
                <div>
                    <div>{i.inspection_number}</div>
                    <div className="text-nb-caption text-fg-subtle">{formatters.formatDate(i.created_at)}</div>
                </div>
            ),
        },
        { key: 'receipt', header: 'Receipt', render: (i) => i.grn?.grn_number || '—' },
        {
            key: 'status',
            header: 'Status',
            render: (i) => <Badge tone={QC_STATUS_TONES[i.status] || 'warning'}>{String(i.status).replace(/_/g, ' ')}</Badge>,
        },
        {
            key: 'result',
            header: 'Result',
            render: (i) => (i.result ? <Badge tone={RESULT_TONES[i.result] || 'neutral'}>{i.result}</Badge> : '—'),
        },
        { key: 'lines', header: 'Lines', align: 'right', render: (i) => i.quality_inspection_lines?.length || 0 },
        {
            key: 'action',
            header: 'Action',
            render: (i) => (i.status === 'pending' ? (
                <Button variant="ghost" size="sm" onClick={() => startInspecting(i)}>Record Result →</Button>
            ) : (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/grn/${i.grn_id}`)}>View Receipt</Button>
            )),
        },
    ];

    const filterValues: FilterValues = { status: statusFilter };

    return (
        <>
            <ListPageTemplate
                title="Quality Inspection"
                description="Receipts held for inspection. Stock is released only for what passes."
                primaryAction={<Button onClick={() => setShowOpenForm(true)}>+ Open Inspection</Button>}
                kpis={
                    <Grid gap="md">
                        <GridItem span={{ md: 4, lg: 3 }}><KpiCard label="Awaiting Inspection" value={inspections.filter(i => i.status === 'pending').length} /></GridItem>
                        <GridItem span={{ md: 4, lg: 3 }}><KpiCard label="Completed" value={inspections.filter(i => i.status === 'completed').length} /></GridItem>
                        <GridItem span={{ md: 4, lg: 3 }}><KpiCard label="Failed" value={inspections.filter(i => i.result === 'failed').length} /></GridItem>
                        <GridItem span={{ md: 4, lg: 3 }}><KpiCard label="Partial" value={inspections.filter(i => i.result === 'partial').length} /></GridItem>
                    </Grid>
                }
                filterConfig={{
                    fields: [{ key: 'status', label: 'Status', type: 'select', options: QC_STATUS_FILTER_OPTIONS }],
                    values: filterValues,
                    onChange: (v) => setStatusFilter(typeof v.status === 'string' ? v.status : ''),
                    onClear: () => setStatusFilter(''),
                }}
                loading={loading}
                isEmpty={!loading && !fetchError && inspections.length === 0}
                empty={
                    <EmptyState
                        title="No inspections yet"
                        description={'Post a receipt with "Required — pending" to route it here.'}
                    />
                }
            >
                {fetchError && <Alert variant="error">{fetchError}</Alert>}
                <DataTable columns={columns} rows={inspections} rowKey={(i) => i.id} />
            </ListPageTemplate>

            <Modal
                open={showOpenForm}
                onClose={() => setShowOpenForm(false)}
                title="Open Inspection"
                size="md"
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setShowOpenForm(false)}>Cancel</Button>
                        <Button type="submit" form="qc-open-form" loading={saving} disabled={saving}>Open Inspection</Button>
                    </>
                }
            >
                <form id="qc-open-form" onSubmit={openInspection}>
                    <Select
                        label="Goods Receipt"
                        name="qc-grn"
                        id="qc-grn"
                        placeholder="Select a receipt"
                        value={grnId}
                        options={grns.map(g => ({ value: g.id, label: `${g.grn_number} — ${g.po?.po_number || 'PO'}` }))}
                        onValueChange={setGrnId}
                    />
                </form>
            </Modal>

            <Modal
                open={!!active}
                onClose={() => setActive(null)}
                title="Record Inspection"
                description={active ? `${active.inspection_number} · ${active.grn?.grn_number ?? ''}` : undefined}
                size="3xl"
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setActive(null)}>Cancel</Button>
                        <Button type="submit" form="qc-result-form" loading={saving} disabled={saving}>Record & Release Stock</Button>
                    </>
                }
            >
                <form id="qc-result-form" onSubmit={submitResult} className="flex flex-col gap-nb-4">
                    <Alert variant="warning">
                        Only the accepted quantity enters stock — rejected units stay off the books and can be sent back to the vendor.
                    </Alert>

                    {resultLines.map((l, idx) => (
                        <div key={l.line_id} className="flex flex-col gap-nb-3 rounded-nb-md border border-line p-nb-4">
                            <div className="flex items-center justify-between">
                                <span className="text-nb-label text-fg">{l.description}</span>
                                <span className="text-nb-caption text-fg-subtle">{l.submitted} submitted</span>
                            </div>
                            <FieldGrid columns={2}>
                                <FieldGridItem>
                                    <TextField
                                        type="number"
                                        min="0"
                                        label="Accepted"
                                        name={`accepted_${idx}`}
                                        aria-label={`Accepted quantity for ${l.description}`}
                                        value={l.accepted_quantity}
                                        onChange={e => updateResult(idx, 'accepted_quantity', e.target.value)}
                                    />
                                </FieldGridItem>
                                <FieldGridItem>
                                    <TextField
                                        type="number"
                                        min="0"
                                        label="Rejected"
                                        name={`rejected_${idx}`}
                                        aria-label={`Rejected quantity for ${l.description}`}
                                        value={l.rejected_quantity}
                                        onChange={e => updateResult(idx, 'rejected_quantity', e.target.value)}
                                    />
                                </FieldGridItem>
                                {(parseFloat(l.rejected_quantity) || 0) > 0 && (
                                    <>
                                        <FieldGridItem>
                                            <TextField
                                                label="Defect code"
                                                name={`defect_${idx}`}
                                                placeholder="Defect code"
                                                aria-label={`Defect code for ${l.description}`}
                                                value={l.defect_code}
                                                onChange={e => updateResult(idx, 'defect_code', e.target.value)}
                                            />
                                        </FieldGridItem>
                                        <FieldGridItem>
                                            <TextField
                                                label="Rejection reason"
                                                name={`reason_${idx}`}
                                                placeholder="Rejection reason"
                                                aria-label={`Rejection reason for ${l.description}`}
                                                value={l.rejection_reason}
                                                onChange={e => updateResult(idx, 'rejection_reason', e.target.value)}
                                            />
                                        </FieldGridItem>
                                    </>
                                )}
                            </FieldGrid>
                        </div>
                    ))}

                    <DescriptionList
                        columns={2}
                        items={[
                            { label: 'Accepted', value: `${totals.accepted} accepted` },
                            { label: 'Rejected', value: `${totals.rejected} rejected` },
                        ]}
                    />

                    <Textarea
                        label="Inspector Remarks"
                        name="qc-remarks"
                        id="qc-remarks"
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                    />
                </form>
            </Modal>
        </>
    );
};

export default QualityInspectionPage;
