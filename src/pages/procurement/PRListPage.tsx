import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { inventoryService } from '../../services/inventoryService';
import ItemSearchSelector from '../../components/ItemSearchSelector';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { useInventoryFormatters } from '../../utils/formatters';
import { Plus } from 'lucide-react';
import {
    FeatureGate, toast, getErrorMessage, DepartmentSelector, useConfirm,
    ListPageTemplate, Button, DataTable, KpiCard, EmptyState, Alert, Badge, StatusBadge,
    Modal, TextField, Select, Textarea, FieldGrid, Grid,
} from '@so360/design-system';

interface PRLine {
    id: string;
    description: string;
    quantity: number;
    estimated_unit_price: number;
}

interface PR {
    id: string;
    pr_number?: string;
    status: string;
    priority?: string;
    required_date: string;
    description: string;
    title?: string;
    estimated_total?: number;
    created_at: string;
    project_id?: string;
    manufacturing_order_id?: string;
    work_order_id?: string;
    source_type?: string;
    source_ref?: string;
    requester?: { full_name: string };
    pr_lines: PRLine[];
}

/**
 * Where a requisition came from. Manufacturing raises them off MRP shortfalls
 * and projects off site requirements, so the origin is often more useful than
 * the description when triaging the queue.
 */
type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
const sourceChips = (pr: PR) => {
    const chips: Array<{ label: string; tone: Tone }> = [];
    if (pr.manufacturing_order_id || pr.source_type === 'manufacturing_order') {
        chips.push({
            label: pr.source_ref ? `MO ${pr.source_ref}` : 'Manufacturing',
            tone: 'info',
        });
    }
    if (pr.project_id) {
        chips.push({ label: 'Project', tone: 'info' });
    }
    if (pr.work_order_id) {
        chips.push({ label: 'Work Order', tone: 'primary' });
    }
    if (pr.source_type === 'sales_order') {
        chips.push({
            label: pr.source_ref ? `SO ${pr.source_ref}` : 'Sales Order',
            tone: 'success',
        });
    }
    return chips;
};

const PRIORITIES = [
    { value: 'low', label: 'Low', tone: 'neutral' as Tone },
    { value: 'normal', label: 'Normal', tone: 'primary' as Tone },
    { value: 'high', label: 'High', tone: 'warning' as Tone },
    { value: 'urgent', label: 'Urgent', tone: 'danger' as Tone },
];

const EMPTY_FORM = {
    title: '',
    description: '',
    justification: '',
    required_date: '',
    priority: 'normal',
    department_id: '',
    project_id: '',
    warehouse_id: '',
    manufacturing_order_id: '',
    budget_amount: '',
    budget_code: '',
};

const PRListPage = () => {
    const [confirm, confirmDialog] = useConfirm();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = useInventoryFormatters();
    const createPrState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:procurement:create_pr') : 'enabled';
    const canCreatePR = (shell?.effectiveFlagsLoaded !== false) && createPrState === 'enabled';
    const [prs, setPrs] = useState<PR[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [items, setItems] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [workOrders, setWorkOrders] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    // Sourcing context (warehouses, projects, manufacturing orders) is only
    // needed once the requisition form is opened — and every source is
    // best-effort, so a module being down never blocks PR creation.
    useEffect(() => {
        if (!showForm || warehouses.length || projects.length) return;
        let cancelled = false;
        Promise.all([
            inventoryService.getLocations().catch(() => []),
            inventoryService.searchProjects().catch(() => []),
            inventoryService.searchWorkOrders().catch(() => []),
        ]).then(([wh, prj, wo]) => {
            if (cancelled) return;
            setWarehouses(Array.isArray(wh) ? wh : []);
            setProjects(Array.isArray(prj) ? prj : []);
            setWorkOrders(Array.isArray(wo) ? wo : []);
        });
        return () => { cancelled = true; };
    }, [showForm]);

    const fetchData = async () => {
        try {
            const data = await procurementService.getPRs();
            setPrs(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            console.error('Failed to fetch PRs', error);
            setFetchError('Failed to load purchase requisitions. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.required_date) {
            toast.warning('Required Date is mandatory. Please select a date before submitting.');
            return;
        }
        if (items.length === 0) {
            toast.warning('Please add at least one item before submitting.');
            return;
        }
        const unselectedItem = items.find(it => !it.item_id);
        if (unselectedItem) {
            toast.warning('Please select a product for all item rows before submitting.');
            return;
        }
        const invalidQty = items.find(it => !(parseFloat(String(it.quantity)) > 0));
        if (invalidQty) {
            toast.warning('All items must have a quantity greater than 0.');
            return;
        }
        try {
            const createdPR = await procurementService.createPR({
                title: formData.title || undefined,
                description: formData.description || undefined,
                justification: formData.justification || undefined,
                required_date: formData.required_date,
                priority: formData.priority || 'normal',
                department_id: formData.department_id || undefined,
                project_id: formData.project_id || undefined,
                warehouse_id: formData.warehouse_id || undefined,
                manufacturing_order_id: formData.manufacturing_order_id || undefined,
                budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : undefined,
                budget_code: formData.budget_code || undefined,
                items: items.map(it => ({
                    item_id: it.item_id || undefined,
                    quantity: parseFloat(String(it.quantity)),
                    estimated_unit_price: parseFloat(String(it.price)) || undefined,
                    description: it.description || undefined,
                    uom: it.uom || undefined,
                    required_delivery_date: it.required_delivery_date || undefined,
                }))
            });
            recordActivity({ eventType: 'inventory.pr.created', eventCategory: 'financials', description: `Created Purchase Requisition`, resourceType: 'pr', resourceId: createdPR?.id }).catch(() => {});
            setShowForm(false);
            setFormData({ ...EMPTY_FORM });
            setItems([]);
            fetchData();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to create PR'));
        }
    };

    const handleDelete = async (prId: string, status: string) => {
        if (!['draft', 'rejected'].includes(status)) {
            toast.warning('Only draft or rejected PRs can be deleted');
            return;
        }

        if (!(await confirm({ title: 'Delete', message: 'Are you sure you want to delete this Purchase Requisition? This action cannot be undone.', intent: 'danger', confirmLabel: 'Delete' }))) return;

        try {
            await procurementService.deletePR(prId);
            await fetchData();
            toast.success('Purchase Requisition deleted successfully');
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Failed to delete PR'));
        }
    };

    const addItemLine = () => {
        setItems([...items, { item_id: '', _selectedName: '', quantity: 1, price: 0, description: '', uom: '', required_delivery_date: '' }]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const updateItemWithProduct = (index: number, selected: { id: string; name: string; sku: string; price?: number }) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            item_id: selected.id,
            _selectedName: `${selected.name} (${selected.sku})`,
            price: selected.price ?? 0,
        };
        setItems(newItems);
    };

    const statusTone = (status: string): Tone =>
        status === 'approved' ? 'success'
            : status === 'pending_approval' ? 'warning'
                : status === 'rejected' ? 'danger'
                    : ['partially_converted', 'fully_converted', 'converted_to_po'].includes(status) ? 'primary'
                        : 'neutral';

    const kpis = (
        <Grid columns={4} gap="sm">
            <KpiCard label="Total PRs" value={prs.length} />
            <KpiCard label="Pending Approval" value={prs.filter(p => p.status === 'pending_approval').length} />
            <KpiCard label="Approved" value={prs.filter(p => p.status === 'approved').length} />
            <KpiCard label="Converted" value={prs.filter(p => ['converted_to_po', 'partially_converted', 'fully_converted'].includes(p.status)).length} />
        </Grid>
    );

    const closeForm = () => setShowForm(false);

    return (
        <>
            {confirmDialog}
            <ListPageTemplate trail={[]}
                title="Purchase Requisitions"
                description="Manage and track spending requests across the organization."
                count={prs.length}
                primaryAction={
                    <FeatureGate state={createPrState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                        <Button onClick={() => setShowForm(true)}><Plus size={16} aria-hidden="true" /> New Requisition</Button>
                    </FeatureGate>
                }
                kpis={kpis}
                loading={loading}
                isEmpty={!loading && !fetchError && prs.length === 0}
                empty={<EmptyState title="No purchase requisitions found." />}
            >
                {fetchError && <Alert variant="error">{fetchError}</Alert>}
                <DataTable
                    data-testid="pr-table"
                    columns={[
                        {
                            key: 'pr', header: 'PR Details',
                            render: (pr: PR) => (
                                <div>
                                    <div className="flex items-center gap-nb-2">
                                        <span className="text-nb-body font-medium text-fg">{pr.pr_number || `#PR-${pr.id.slice(0, 8).toUpperCase()}`}</span>
                                        {pr.priority && pr.priority !== 'normal' && (
                                            <Badge size="sm" tone={PRIORITIES.find(p => p.value === pr.priority)?.tone || 'neutral'}>{pr.priority}</Badge>
                                        )}
                                    </div>
                                    <div className="text-nb-caption text-fg-subtle truncate max-w-[200px]">{pr.title || pr.description}</div>
                                    {sourceChips(pr).length > 0 && (
                                        <div className="flex flex-wrap gap-nb-1 mt-nb-1">
                                            {sourceChips(pr).map(chip => <Badge key={chip.label} size="sm" tone={chip.tone}>{chip.label}</Badge>)}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        { key: 'status', header: 'Status', render: (pr: PR) => <StatusBadge status={pr.status.replace(/_/g, ' ')} map={{ [pr.status.replace(/_/g, ' ')]: statusTone(pr.status) }} /> },
                        {
                            key: 'requester', header: 'Requester',
                            render: (pr: PR) => (
                                <div>
                                    <div className="text-nb-body text-fg-muted">{pr.requester?.full_name || 'System'}</div>
                                    <div className="text-nb-caption text-fg-subtle">Requested {formatters.formatDate(pr.created_at)}</div>
                                </div>
                            ),
                        },
                        { key: 'required_date', header: 'Required Date', render: (pr: PR) => (pr.required_date ? formatters.formatDate(pr.required_date) : 'N/A') },
                        { key: 'lines', header: 'Lines', align: 'right', render: (pr: PR) => `${pr.pr_lines?.length || 0} items` },
                        {
                            key: 'action', header: 'Action',
                            render: (pr: PR) => (
                                <div className="flex items-center gap-nb-2" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/pr/${pr.id}`)}>View Details →</Button>
                                    {canCreatePR && (pr.status === 'draft' || pr.status === 'rejected') && (
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(pr.id, pr.status)}>Delete</Button>
                                    )}
                                </div>
                            ),
                        },
                    ]}
                    rows={prs}
                    rowKey={(pr: PR) => pr.id}
                />
            </ListPageTemplate>

            <Modal
                open={showForm}
                onClose={closeForm}
                title="Create New Requisition"
                size="lg"
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
                        <Button type="submit" form="pr-form">Submit for Approval</Button>
                    </>
                }
            >
                <form id="pr-form" onSubmit={handleSubmit} className="space-y-nb-4">
                    <FieldGrid columns={2}>
                        <TextField
                            label="Title"
                            name="title"
                            value={formData.title}
                            placeholder="e.g. Site 4 cement top-up"
                            onChange={(e: any) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        />
                        <TextField
                            label="Required Date"
                            name="required_date"
                            type="date"
                            required
                            value={formData.required_date}
                            onChange={(e: any) => setFormData(prev => ({ ...prev, required_date: e.target.value }))}
                        />
                    </FieldGrid>

                    <div className="space-y-nb-1">
                        <div className="text-nb-label font-medium text-fg-muted">Priority</div>
                        <div className="flex gap-nb-2">
                            {PRIORITIES.map(p => (
                                <Button
                                    key={p.value}
                                    type="button"
                                    size="sm"
                                    variant={formData.priority === p.value ? 'tonal' : 'secondary'}
                                    aria-pressed={formData.priority === p.value}
                                    onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                                >
                                    {p.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <FieldGrid columns={2}>
                        <div className="space-y-nb-1">
                            <div className="text-nb-label font-medium text-fg-muted">Department</div>
                            <DepartmentSelector
                                value={formData.department_id || undefined}
                                orgId={inventoryService.getOrgId() || ''}
                                placeholder="Select department"
                                allowClear
                                onChange={(departmentId: string | null) => setFormData(prev => ({ ...prev, department_id: departmentId || '' }))}
                            />
                        </div>
                        <Select
                            label="Deliver To Warehouse"
                            name="warehouse_id"
                            value={formData.warehouse_id}
                            onChange={(e: any) => setFormData(prev => ({ ...prev, warehouse_id: e?.target ? e.target.value : e }))}
                            options={[{ value: '', label: 'Not specified' }, ...warehouses.map(wh => ({ value: wh.id, label: wh.name }))]}
                        />
                        <Select
                            label="Project"
                            name="project_id"
                            value={formData.project_id}
                            onChange={(e: any) => setFormData(prev => ({ ...prev, project_id: e?.target ? e.target.value : e }))}
                            options={[{ value: '', label: 'Not project-linked' }, ...projects.map(p => ({ value: p.id, label: p.name || p.title || p.code }))]}
                        />
                        <Select
                            label="Manufacturing Order"
                            name="manufacturing_order_id"
                            value={formData.manufacturing_order_id}
                            onChange={(e: any) => setFormData(prev => ({ ...prev, manufacturing_order_id: e?.target ? e.target.value : e }))}
                            options={[{ value: '', label: 'Not linked to production' }, ...workOrders.map(w => ({ value: w.id, label: w.order_number || w.mo_number || w.id.slice(0, 8) }))]}
                        />
                        <TextField
                            label="Budget Amount"
                            name="budget_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.budget_amount}
                            placeholder="0.00"
                            onChange={(e: any) => setFormData(prev => ({ ...prev, budget_amount: e.target.value }))}
                        />
                        <TextField
                            label="Budget / Cost Code"
                            name="budget_code"
                            value={formData.budget_code}
                            placeholder="e.g. CC-OPS-2026"
                            onChange={(e: any) => setFormData(prev => ({ ...prev, budget_code: e.target.value }))}
                        />
                    </FieldGrid>

                    <Textarea
                        label="Description"
                        name="description"
                        rows={3}
                        value={formData.description}
                        placeholder="What is being requested..."
                        onChange={(e: any) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <Textarea
                        label="Business Justification"
                        name="justification"
                        rows={3}
                        value={formData.justification}
                        placeholder="Why this spend is needed, and what happens if it is not approved..."
                        onChange={(e: any) => setFormData(prev => ({ ...prev, justification: e.target.value }))}
                    />

                    <div className="space-y-nb-3">
                        <div className="flex justify-between items-center">
                            <div className="text-nb-label font-medium text-fg-muted">Requested Items</div>
                            <Button type="button" variant="ghost" size="sm" onClick={addItemLine}>+ Add Item</Button>
                        </div>
                        {items.length === 0 && (
                            <EmptyState title={'No items added yet. Click "+ Add Item" to begin.'} />
                        )}
                        {items.map((item, idx) => (
                            <div key={idx} className="space-y-nb-2 p-nb-3 border border-line rounded-nb">
                                <div className="flex gap-nb-3 items-center">
                                    <div className="flex-1">
                                        <ItemSearchSelector
                                            value={item.item_id}
                                            selectedName={item._selectedName}
                                            onSelect={(selected) => updateItemWithProduct(idx, selected)}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <TextField name="qty"
                                            type="number"
                                            placeholder="Qty"
                                            aria-label="Quantity"
                                            value={item.quantity}
                                            min="1"
                                            onChange={(e: any) => updateItem(idx, 'quantity', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-32">
                                        <TextField name="est-price"
                                            type="number"
                                            placeholder="Est. Price"
                                            aria-label="Estimated price"
                                            value={item.price}
                                            min="0"
                                            step="0.01"
                                            onChange={(e: any) => updateItem(idx, 'price', e.target.value)}
                                        />
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" title="Remove item" aria-label="Remove item" onClick={() => setItems(items.filter((_, i) => i !== idx))}>×</Button>
                                </div>
                                <div className="flex gap-nb-3">
                                    <div className="flex-1">
                                        <TextField name="description-optional"
                                            placeholder="Description (optional)"
                                            aria-label="Item description"
                                            value={item.description}
                                            onChange={(e: any) => updateItem(idx, 'description', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <TextField name="uom"
                                            placeholder="UOM"
                                            aria-label="Unit of measure"
                                            value={item.uom || ''}
                                            onChange={(e: any) => updateItem(idx, 'uom', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-40">
                                        <TextField name="required-delivery-date"
                                            type="date"
                                            aria-label="Required delivery date"
                                            title="Required delivery date"
                                            value={item.required_delivery_date || ''}
                                            onChange={(e: any) => updateItem(idx, 'required_delivery_date', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default PRListPage;
