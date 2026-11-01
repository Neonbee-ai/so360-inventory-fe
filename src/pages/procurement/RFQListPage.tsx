import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rfqService } from '../../services/rfqService';
import { procurementService } from '../../services/procurementService';
import { vendorService } from '../../services/vendorService';
import ItemSearchSelector from '../../components/ItemSearchSelector';
import { useInventoryFormatters } from '../../utils/formatters';
import { Plus } from 'lucide-react';
import {
    toast, getErrorMessage, ListPageTemplate, Button, DataTable, KpiCard, EmptyState, Alert, StatusBadge,
    Modal, TextField, Select, FieldGrid, Grid,
} from '@so360/design-system';

interface RFQ {
    id: string;
    rfq_number: string;
    title?: string;
    status: string;
    response_due_date?: string;
    required_date?: string;
    created_at: string;
    line_count: number;
    vendor_count: number;
    quotation_count: number;
}

export type RFQTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export const RFQ_STATUS_TONES: Record<string, RFQTone> = {
    draft: 'neutral',
    sent: 'primary',
    closed: 'warning',
    awarded: 'success',
    cancelled: 'danger',
};

/** Legacy class-string map kept for importers; the list itself renders StatusBadge tones. */
export const RFQ_STATUS_STYLES: Record<string, string> = {
    draft: 'bg-surface-high text-fg-muted border-line-strong/20',
    sent: 'bg-primary/10 text-primary border-primary/20',
    closed: 'bg-warning/10 text-warning border-warning/20',
    awarded: 'bg-success/10 text-success border-success/20',
    cancelled: 'bg-danger/10 text-danger border-danger/20',
};

const EMPTY_FORM = {
    title: '',
    description: '',
    pr_id: '',
    response_due_date: '',
    required_date: '',
    payment_terms: '',
    delivery_terms: '',
    incoterms: '',
};

const RFQListPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rfqs, setRfqs] = useState<RFQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [lines, setLines] = useState<any[]>([]);
    const [vendorIds, setVendorIds] = useState<string[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [approvedPRs, setApprovedPRs] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchData(); }, [statusFilter]);

    const fetchData = async () => {
        try {
            setFetchError(null);
            const data = await rfqService.getRFQs(statusFilter ? { status: statusFilter } : {});
            setRfqs(Array.isArray(data) ? data : []);
        } catch (err) {
            setFetchError(getErrorMessage(err, 'Failed to load RFQs'));
        } finally {
            setLoading(false);
        }
    };

    // Vendors and approved requisitions are only needed by the create form.
    useEffect(() => {
        if (!showForm || vendors.length) return;
        Promise.all([
            vendorService.getVendors().catch(() => []),
            procurementService.getPRs().catch(() => []),
        ]).then(([v, prs]) => {
            setVendors(Array.isArray(v) ? v : []);
            const list = Array.isArray(prs) ? prs : ((prs as any)?.data || []);
            setApprovedPRs(list.filter((p: any) => ['approved', 'partially_converted'].includes(p.status)));
        });
    }, [showForm]);

    const addLine = () => setLines([...lines, { item_id: '', _selectedName: '', description: '', quantity: 1, uom: '', target_unit_price: '' }]);

    const updateLine = (idx: number, field: string, value: any) => {
        const next = [...lines];
        next[idx] = { ...next[idx], [field]: value };
        setLines(next);
    };

    const toggleVendor = (id: string) =>
        setVendorIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Lines may come from the linked requisition instead of being typed.
        if (!form.pr_id && lines.length === 0) {
            toast.warning('Add at least one line, or link a requisition to copy its lines.');
            return;
        }
        if (lines.some(l => !(parseFloat(String(l.quantity)) > 0))) {
            toast.warning('Every line needs a quantity greater than 0.');
            return;
        }

        setSaving(true);
        try {
            const created = await rfqService.createRFQ({
                title: form.title || undefined,
                description: form.description || undefined,
                pr_id: form.pr_id || undefined,
                response_due_date: form.response_due_date || undefined,
                required_date: form.required_date || undefined,
                payment_terms: form.payment_terms || undefined,
                delivery_terms: form.delivery_terms || undefined,
                incoterms: form.incoterms || undefined,
                vendor_ids: vendorIds.length ? vendorIds : undefined,
                items: lines.length ? lines.map(l => ({
                    item_id: l.item_id || undefined,
                    description: l.description || undefined,
                    quantity: parseFloat(String(l.quantity)),
                    uom: l.uom || undefined,
                    target_unit_price: l.target_unit_price ? parseFloat(String(l.target_unit_price)) : undefined,
                })) : undefined,
            });
            toast.success(`RFQ ${created?.rfq_number || ''} created`);
            setShowForm(false);
            setForm({ ...EMPTY_FORM });
            setLines([]);
            setVendorIds([]);
            fetchData();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to create RFQ'));
        } finally {
            setSaving(false);
        }
    };

    const kpis = (
        <Grid columns={4} gap="sm">
            <KpiCard label="Total RFQs" value={rfqs.length} />
            <KpiCard label="Awaiting Quotes" value={rfqs.filter(r => r.status === 'sent').length} />
            <KpiCard label="Quotes Received" value={rfqs.reduce((s, r) => s + (r.quotation_count || 0), 0)} />
            <KpiCard label="Awarded" value={rfqs.filter(r => r.status === 'awarded').length} />
        </Grid>
    );

    const closeForm = () => setShowForm(false);

    return (
        <>
            <ListPageTemplate trail={[]}
                title="Requests for Quotation"
                description="Source competitive quotes before committing to a purchase order."
                count={rfqs.length}
                primaryAction={<Button onClick={() => setShowForm(true)}><Plus size={16} aria-hidden="true" /> New RFQ</Button>}
                kpis={kpis}
                filterConfig={{
                    fields: [{
                        key: 'status', label: 'Status', type: 'select',
                        options: [
                            { value: 'draft', label: 'Draft' },
                            { value: 'sent', label: 'Sent' },
                            { value: 'awarded', label: 'Awarded' },
                            { value: 'cancelled', label: 'Cancelled' },
                        ],
                    }],
                    values: { status: statusFilter || null },
                    onChange: (v: any) => setStatusFilter(v?.status || ''),
                    onClear: () => setStatusFilter(''),
                }}
                loading={loading}
                isEmpty={!loading && !fetchError && rfqs.length === 0 && !statusFilter}
                isFilteredEmpty={!loading && !fetchError && rfqs.length === 0 && !!statusFilter}
                onClearFilters={() => setStatusFilter('')}
                empty={<EmptyState title="No RFQs yet. Create one to start sourcing quotes." />}
            >
                {fetchError && <Alert variant="error">{fetchError}</Alert>}
                <DataTable
                    data-testid="rfq-table"
                    columns={[
                        {
                            key: 'rfq', header: 'RFQ',
                            render: (rfq: RFQ) => (
                                <div>
                                    <div className="text-nb-body font-medium text-fg">{rfq.rfq_number}</div>
                                    <div className="text-nb-caption text-fg-subtle truncate max-w-56">{rfq.title || `${rfq.line_count} lines`}</div>
                                </div>
                            ),
                        },
                        {
                            key: 'status', header: 'Status',
                            render: (rfq: RFQ) => <StatusBadge status={rfq.status} map={{ [rfq.status]: RFQ_STATUS_TONES[rfq.status] || 'neutral' }} />,
                        },
                        { key: 'vendors', header: 'Vendors', align: 'right', render: (rfq: RFQ) => rfq.vendor_count },
                        {
                            key: 'quotes', header: 'Quotes', align: 'right',
                            render: (rfq: RFQ) => (
                                <span className={rfq.quotation_count > 0 ? 'text-success font-medium' : 'text-fg-subtle'}>{rfq.quotation_count}</span>
                            ),
                        },
                        { key: 'due', header: 'Response Due', render: (rfq: RFQ) => (rfq.response_due_date ? formatters.formatDate(rfq.response_due_date) : '—') },
                        {
                            key: 'action', header: 'Action',
                            render: (rfq: RFQ) => (
                                <div className="flex items-center gap-nb-2" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/rfq/${rfq.id}`)}>View Details →</Button>
                                    {rfq.quotation_count > 1 && (
                                        <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/rfq/${rfq.id}/compare`)}>Compare</Button>
                                    )}
                                </div>
                            ),
                        },
                    ]}
                    rows={rfqs}
                    rowKey={(rfq: RFQ) => rfq.id}
                />
            </ListPageTemplate>

            <Modal
                open={showForm}
                onClose={closeForm}
                title="New Request for Quotation"
                size="xl"
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
                        <Button type="submit" form="rfq-form" disabled={saving}>{saving ? 'Creating...' : 'Create RFQ'}</Button>
                    </>
                }
            >
                <form id="rfq-form" onSubmit={handleSubmit} className="space-y-nb-4">
                    <FieldGrid columns={2}>
                        <TextField
                            id="rfq-title" name="rfq-title" label="Title" value={form.title} placeholder="e.g. Q4 cement supply"
                            onChange={(e: any) => setForm({ ...form, title: e.target.value })}
                        />
                        <Select
                            id="rfq-pr" name="rfq-pr" label="Source Requisition" value={form.pr_id}
                            onChange={(e: any) => setForm({ ...form, pr_id: e?.target ? e.target.value : e })}
                            options={[
                                { value: '', label: 'Not from a requisition' },
                                ...approvedPRs.map(pr => ({ value: pr.id, label: `${pr.pr_number || pr.id.slice(0, 8)} — ${pr.title || pr.description || 'Requisition'}` })),
                            ]}
                        />
                        <TextField
                            id="rfq-due" name="rfq-due" label="Response Due" type="date" value={form.response_due_date}
                            onChange={(e: any) => setForm({ ...form, response_due_date: e.target.value })}
                        />
                        <TextField
                            id="rfq-required" name="rfq-required" label="Goods Required By" type="date" value={form.required_date}
                            onChange={(e: any) => setForm({ ...form, required_date: e.target.value })}
                        />
                        <TextField
                            id="rfq-payment" name="rfq-payment" label="Payment Terms" value={form.payment_terms} placeholder="e.g. Net 30"
                            onChange={(e: any) => setForm({ ...form, payment_terms: e.target.value })}
                        />
                        <TextField
                            id="rfq-incoterms" name="rfq-incoterms" label="Incoterms" value={form.incoterms} placeholder="e.g. DDP"
                            onChange={(e: any) => setForm({ ...form, incoterms: e.target.value })}
                        />
                    </FieldGrid>

                    <div className="space-y-nb-1">
                        <div className="text-nb-label font-medium text-fg-muted">Invite Vendors</div>
                        <div className="flex flex-wrap gap-nb-2 max-h-40 overflow-y-auto">
                            {vendors.length === 0 && <span className="text-nb-body text-fg-subtle">No vendors found.</span>}
                            {vendors.map(v => (
                                <Button
                                    key={v.id}
                                    type="button"
                                    size="sm"
                                    variant={vendorIds.includes(v.id) ? 'tonal' : 'secondary'}
                                    aria-pressed={vendorIds.includes(v.id)}
                                    onClick={() => toggleVendor(v.id)}
                                >
                                    {v.name}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-nb-3">
                        <div className="flex justify-between items-center">
                            <div className="text-nb-label font-medium text-fg-muted">Requested Lines</div>
                            <Button type="button" variant="ghost" size="sm" onClick={addLine}>+ Add Line</Button>
                        </div>
                        {lines.length === 0 && (
                            <EmptyState
                                title={form.pr_id
                                    ? 'Lines will be copied from the selected requisition.'
                                    : 'No lines yet. Click "+ Add Line" or link a requisition.'}
                            />
                        )}
                        {lines.map((line, idx) => (
                            <div key={idx} className="p-nb-3 border border-line rounded-nb space-y-nb-2">
                                <div className="flex gap-nb-3 items-center">
                                    <div className="flex-1">
                                        <ItemSearchSelector
                                            value={line.item_id}
                                            selectedName={line._selectedName}
                                            onSelect={(selected: any) => {
                                                const next = [...lines];
                                                next[idx] = {
                                                    ...next[idx],
                                                    item_id: selected.id,
                                                    _selectedName: `${selected.name} (${selected.sku})`,
                                                    target_unit_price: selected.price ?? next[idx].target_unit_price,
                                                };
                                                setLines(next);
                                            }}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <TextField name="qty" type="number" aria-label={`Quantity for line ${idx + 1}`} placeholder="Qty" min="1" value={line.quantity}
                                            onChange={(e: any) => updateLine(idx, 'quantity', e.target.value)} />
                                    </div>
                                    <div className="w-24">
                                        <TextField name="uom" aria-label={`Unit of measure for line ${idx + 1}`} placeholder="UOM" value={line.uom}
                                            onChange={(e: any) => updateLine(idx, 'uom', e.target.value)} />
                                    </div>
                                    <div className="w-28">
                                        <TextField name="target" type="number" aria-label={`Target price for line ${idx + 1}`} placeholder="Target" value={line.target_unit_price}
                                            onChange={(e: any) => updateLine(idx, 'target_unit_price', e.target.value)} />
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" title="Remove line" aria-label="Remove line" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>×</Button>
                                </div>
                                <TextField name="description-specification-optional" aria-label={`Description for line ${idx + 1}`} placeholder="Description / specification (optional)" value={line.description}
                                    onChange={(e: any) => updateLine(idx, 'description', e.target.value)} />
                            </div>
                        ))}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default RFQListPage;
