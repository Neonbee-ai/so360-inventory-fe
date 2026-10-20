import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { vendorService } from '../../services/vendorService';
import { useBusinessSettings, useActivity, useShellBridge, useQuota } from '@so360/shell-context';
import { Plus, X } from 'lucide-react';
import { useInventoryFormatters } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import ItemSearchSelector from '../../components/ItemSearchSelector';
import {
    QuotaBar, QuotaGate, FeatureGate, toast, getErrorMessage,
    ListPageTemplate, Button, DataTable, EmptyState, Alert, Badge, StatusBadge,
    Modal, TextField, Select, Textarea, Progress, SectionCard, FieldGrid,
} from '@so360/design-system';

/**
 * A 403 from an RBAC guard is an *expected* outcome for a role without the
 * permission — not a system failure. Detect it so the page can explain the
 * restriction instead of claiming the module is broken.
 */
const isForbidden = (error: any): boolean =>
    error?.status === 403 ||
    /\b403\b|forbidden|requires one of these permissions/i.test(String(error?.message || ''));

const VENDOR_PERMISSION_MESSAGE =
    'You do not have permission to view vendor information required for Purchase Orders. Please contact your administrator.';

const PO_STATUS_MAP: Record<string, any> = {
    draft: 'neutral', sent: 'primary', acknowledged: 'info', partially_received: 'warning',
    received: 'success', closed: 'neutral', cancelled: 'danger',
};

const poProgress = (po: any): number => {
    const totalLines = po.po_lines?.length || 0;
    const receivedLines = po.po_lines?.filter((l: any) => l.received_quantity >= l.quantity).length || 0;
    return totalLines > 0 ? (receivedLines / totalLines) * 100 : 0;
};

type PageNotice = { kind: 'permission' | 'error'; message: string } | null;

const POListPage = () => {
    const shell = useShellBridge();
    const { can, isLoading: permissionsLoading } = useAuth();
    const createPoState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:procurement:create_po') : 'enabled';
    const quotaChecks = useMemo(() => [{ module_code: 'inventory', quota_key: 'max_po_per_month' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_po_per_month');
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useBusinessSettings();
    const formatters = useInventoryFormatters();
    const { recordActivity } = useActivity();
    const [pos, setPos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<PageNotice>(null);
    const [vendorNotice, setVendorNotice] = useState<PageNotice>(null);
    const [showForm, setShowForm] = useState(false);
    const [showPrMenu, setShowPrMenu] = useState(false);
    const [vendors, setVendors] = useState<any[]>([]);
    const [approvedPrs, setApprovedPrs] = useState<any[]>([]);
    const [allPrs, setAllPrs] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        vendor_id: '', po_number: '', pr_id: '',
        terms: '', shipping_address: '', currency: settings?.base_currency || 'USD',
    });
    const [items, setItems] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Wait for the Shell to resolve permissions before firing anything: issuing
    // the vendor request first and reading the 403 afterwards is what produced
    // the console noise and the misleading "failed to load" banner.
    useEffect(() => {
        if (permissionsLoading) return;
        fetchData();
    }, [permissionsLoading]);

    // Detect navigation state from PRDetailPage conversion
    useEffect(() => {
        const state = location.state as any;
        if (state?.convertFromPR) {
            const payload = state.convertFromPR;
            setFormData(prev => ({
                ...prev,
                pr_id: payload.pr_id,
                po_number: payload.suggested_po_number || prev.po_number,
            }));
            // Pre-fill items from available lines (only lines with remaining quantity)
            const prefillItems = (payload.available_lines || [])
                .filter((line: any) => line.remaining_quantity > 0)
                .map((line: any) => ({
                    item_id: line.item_id,
                    _selectedName: line.item_name || '',
                    quantity: line.remaining_quantity,
                    unit_price: line.estimated_unit_price,
                    description: line.description || '',
                    pr_line_id: line.pr_line_id,
                    tax_code_id: line.tax_code_id || null,
                    tax_rate: 0,
                    tax_amount: 0,
                }));
            setItems(prefillItems);
            setShowForm(true);
            // Clear navigation state to prevent re-trigger on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const unwrap = (payload: any) => (Array.isArray(payload) ? payload : (payload?.data || []));

    const fetchData = async () => {
        setLoading(true);
        setFetchError(null);

        if (!can('purchase_orders.read')) {
            setPos([]);
            setVendors([]);
            setVendorNotice(null);
            setFetchError({
                kind: 'permission',
                message: 'You do not have permission to view purchase orders. Please contact your administrator.',
            });
            setLoading(false);
            return;
        }

        // Vendors are an *auxiliary* dependency of this page — they populate the
        // vendor column labels and the create-PO form. Skip the call entirely
        // when the role lacks `suppliers.read` rather than firing a request we
        // already know the backend will reject.
        const canReadVendors = can('suppliers.read');
        setVendorNotice(canReadVendors ? null : { kind: 'permission', message: VENDOR_PERMISSION_MESSAGE });

        // Settled (not `all`) so a vendor denial can never discard purchase
        // orders that loaded perfectly well.
        const [poResult, vendorResult] = await Promise.allSettled([
            procurementService.getPOs(),
            canReadVendors ? vendorService.getVendors() : Promise.resolve([]),
        ]);

        if (poResult.status === 'fulfilled') {
            setPos(unwrap(poResult.value));
        } else {
            setPos([]);
            if (isForbidden(poResult.reason)) {
                setFetchError({
                    kind: 'permission',
                    message: 'You do not have permission to view purchase orders. Please contact your administrator.',
                });
            } else {
                console.error('Failed to fetch POs', poResult.reason);
                setFetchError({ kind: 'error', message: 'Failed to load purchase orders. Please try again.' });
            }
        }

        if (vendorResult.status === 'fulfilled') {
            setVendors(unwrap(vendorResult.value));
        } else {
            setVendors([]);
            if (isForbidden(vendorResult.reason)) {
                setVendorNotice({ kind: 'permission', message: VENDOR_PERMISSION_MESSAGE });
            } else {
                console.error('Failed to fetch vendors', vendorResult.reason);
                setVendorNotice({
                    kind: 'error',
                    message: 'Vendor information could not be loaded. Purchase orders are still shown below.',
                });
            }
        }

        setLoading(false);
        // PRs loaded independently so a failure doesn't block the PO list
        loadPRs();
    };

    const loadPRs = async () => {
        // PRs are guarded by the same `purchase_orders.read` code as the PO list.
        if (!can('purchase_orders.read')) {
            setAllPrs([]);
            setApprovedPrs([]);
            return;
        }
        try {
            const prData = await procurementService.getPRs();
            const prArray = Array.isArray(prData) ? prData : (prData?.data || []);
            setAllPrs(prArray);
            setApprovedPrs(prArray.filter((p: any) =>
                ['approved', 'partially_converted', 'converted_to_po'].includes(p.status)
            ));
        } catch (error) {
            setAllPrs([]);
            setApprovedPrs([]);
            // A 403 here is an expected role outcome — the PR shortcuts simply
            // stay hidden. Only surface genuine failures to the console.
            if (!isForbidden(error)) console.error('Failed to fetch PRs', error);
        }
    };

    const generatePONumber = () => {
        const year = new Date().getFullYear();
        const nextNum = String(pos.length + 1).padStart(4, '0');
        return `PO-${year}-${nextNum}`;
    };

    const addItemLine = () => {
        setItems([...items, { item_id: '', _selectedName: '', quantity: 1, unit_price: 0, description: '', tax_code_id: null, tax_rate: 0, tax_amount: 0 }]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const updateItemWithProduct = (index: number, selected: { id: string; name: string; sku: string; price?: number; tax_code_id?: string }) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            item_id: selected.id,
            _selectedName: `${selected.name} (${selected.sku})`,
            unit_price: selected.price ?? 0,
            tax_code_id: selected.tax_code_id || null,
            tax_rate: 0,
            tax_amount: 0,
        };
        setItems(newItems);
    };

    const removeItemLine = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const isTaxInclusive = settings?.is_tax_inclusive_pricing ?? false;

    const calculateTotals = () => {
        const subtotal = items.reduce((sum, item) =>
            sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
        const taxTotal = items.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0);
        const total = isTaxInclusive ? subtotal : subtotal + taxTotal;
        return { subtotal, taxTotal, total };
    };

    const openNewPOForm = () => {
        setFormData({
            vendor_id: '', po_number: generatePONumber(), pr_id: '',
            terms: '', shipping_address: '', currency: settings?.base_currency || 'USD',
        });
        setItems([]);
        loadPRs(); // refresh PRs when form opens so newly-approved PRs appear
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.vendor_id) { toast.warning('Please select a vendor.'); return; }
        if (!formData.po_number.trim()) { toast.warning('PO number is required.'); return; }
        const validItems = items.filter(i => i.item_id && i.quantity > 0 && i.unit_price > 0);
        if (validItems.length === 0) { toast.warning('Add at least one complete item line.'); return; }

        const { total } = calculateTotals();

        setSubmitting(true);
        try {
            const createdPO = await procurementService.createPO({
                vendor_id: formData.vendor_id,
                po_number: formData.po_number,
                pr_id: formData.pr_id || undefined,
                total_amount: total,
                currency: formData.currency,
                terms: formData.terms || undefined,
                shipping_address: formData.shipping_address || undefined,
                items: validItems.map(i => ({
                    item_id: i.item_id,
                    quantity: parseFloat(i.quantity),
                    unit_price: parseFloat(i.unit_price),
                    description: i.description || undefined,
                    pr_line_id: i.pr_line_id || undefined,
                })),
            });
            recordActivity({ eventType: 'inventory.po.created', eventCategory: 'financials', description: `Created Purchase Order #${formData.po_number}`, resourceType: 'po', resourceId: createdPO?.id }).catch(() => {});
            setShowForm(false);
            fetchData();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to create Purchase Order'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateFromPR = async (pr: any) => {
        try {
            const payload = await procurementService.getConversionPayload(pr.id);
            if (payload.is_fully_converted) {
                toast.warning('This PR has been fully converted. All line quantities are already covered by existing Purchase Orders.');
                return;
            }
            setFormData(prev => ({
                ...prev,
                pr_id: payload.pr_id,
                po_number: payload.suggested_po_number || generatePONumber(),
                vendor_id: '',
            }));
            const prefillItems = (payload.available_lines || [])
                .filter((line: any) => line.remaining_quantity > 0)
                .map((line: any) => ({
                    item_id: line.item_id,
                    _selectedName: line.item_name || '',
                    quantity: line.remaining_quantity,
                    unit_price: line.estimated_unit_price,
                    description: line.description || '',
                    pr_line_id: line.pr_line_id,
                    tax_code_id: line.tax_code_id || null,
                    tax_rate: 0,
                    tax_amount: 0,
                }));
            setItems(prefillItems);
            setShowForm(true);
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Conversion failed'));
        }
    };

    const { subtotal, taxTotal, total } = calculateTotals();

    const PR_DONE = ['approved', 'partially_converted', 'converted_to_po'];
    const pendingPrs = allPrs.filter(pr => !PR_DONE.includes(pr.status) && pr.status !== 'rejected' && pr.status !== 'closed');
    const prLabel = (pr: any) => `PR-${pr.id.slice(0, 8).toUpperCase()} — ${pr.pr_lines?.length || 0} items — ${pr.status.replace(/_/g, ' ')}`;
    const prOptions = [
        { value: '', label: 'None (standalone PO)' },
        ...approvedPrs.map(pr => ({ value: pr.id, label: prLabel(pr) })),
        ...pendingPrs.map(pr => ({ value: pr.id, label: `${prLabel(pr)} (not approved)`, disabled: true })),
        ...(approvedPrs.length === 0 && pendingPrs.length === 0
            ? [{ value: '__none', label: 'No purchase requisitions available', disabled: true }]
            : []),
    ];
    const pendingCount = allPrs.filter(pr => ['pending_approval', 'draft'].includes(pr.status)).length;
    const closeForm = () => setShowForm(false);
    const val = (e: any) => (e?.target ? e.target.value : e);

    const renderNotice = (n: PageNotice) => n && (
        <Alert
            variant={n.kind === 'permission' ? 'warning' : 'error'}
            action={n.kind === 'error' ? { label: 'Retry', onClick: fetchData } : undefined}
        >
            {n.message}
        </Alert>
    );

    return (
        <>
            <ListPageTemplate
                title="Purchase Orders"
                description="Official commercial documents issued to sellers."
                count={pos.length}
                primaryAction={
                    <div className="flex flex-wrap items-center gap-nb-2">
                        {approvedPrs.length > 0 && (
                            <Button variant="tonal" onClick={() => setShowPrMenu(v => !v)} aria-expanded={showPrMenu}>
                                <Badge tone="primary">{approvedPrs.length}</Badge> Convert Approved PRs
                            </Button>
                        )}
                        <Button variant="secondary" onClick={() => navigate('/procurement/opening-balance')}>Opening Balance</Button>
                        <FeatureGate state={createPoState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                            <QuotaGate
                                quotaKey="max_po_per_month"
                                moduleCode="inventory"
                                used={quotaData?.current_usage ?? 0}
                                limit={quotaData?.limit ?? 0}
                                isUnlimited={quotaData?.is_unlimited}
                                disableOnExceeded
                            >
                                <Button
                                    onClick={openNewPOForm}
                                    disabled={!!vendorNotice}
                                    title={vendorNotice ? vendorNotice.message : undefined}
                                >
                                    <Plus size={16} aria-hidden="true" /> New PO
                                </Button>
                            </QuotaGate>
                        </FeatureGate>
                    </div>
                }
                loading={loading}
                isEmpty={!loading && !fetchError && pos.length === 0}
                empty={<EmptyState title="No purchase orders found." />}
            >
                {renderNotice(fetchError)}
                {renderNotice(vendorNotice)}
                {quotaData && (
                    <QuotaBar
                        label="Purchase Orders"
                        used={quotaData.current_usage}
                        limit={quotaData.limit}
                        isUnlimited={quotaData.is_unlimited}
                    />
                )}
                {showPrMenu && approvedPrs.length > 0 && (
                    <SectionCard title="Approved Requisitions">
                        <ul className="space-y-nb-2">
                            {approvedPrs.map(pr => (
                                <li key={pr.id} className="flex items-center justify-between gap-nb-3">
                                    <div>
                                        <div className="text-nb-label font-medium text-fg">#PR-{pr.id.slice(0, 8).toUpperCase()}</div>
                                        <div className="text-nb-caption text-fg-subtle">{pr.pr_lines?.length} items</div>
                                    </div>
                                    <Button size="sm" onClick={() => { setShowPrMenu(false); handleCreateFromPR(pr); }}>Convert</Button>
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                )}
                <DataTable
                    data-testid="po-table"
                    rows={pos}
                    rowKey={(po: any) => po.id}
                    onRowClick={(po: any) => navigate(`/procurement/po/${po.id}`)}
                    columns={[
                        {
                            key: 'order', header: 'Order Info',
                            render: (po: any) => (
                                <div>
                                    <div className="font-medium text-fg">#{po.po_number}</div>
                                    {po.pr_id && (
                                        <div className="text-nb-caption text-fg-subtle">Reference: PR-{po.pr_id?.slice(0, 6).toUpperCase()}</div>
                                    )}
                                </div>
                            ),
                        },
                        { key: 'vendor', header: 'Vendor', render: (po: any) => po.vendor?.name },
                        { key: 'status', header: 'Status', render: (po: any) => <StatusBadge status={po.status} map={PO_STATUS_MAP} /> },
                        {
                            key: 'amount', header: 'Amount', align: 'right',
                            render: (po: any) => formatters.formatCurrency(parseFloat(po.total_amount || 0)),
                        },
                        {
                            key: 'progress', header: 'Progress',
                            render: (po: any) => {
                                const progress = poProgress(po);
                                return (
                                    <div className="flex items-center gap-nb-2">
                                        <div className="flex-1"><Progress value={progress} max={100} /></div>
                                        <span className="text-nb-caption text-fg-subtle">{Math.round(progress)}%</span>
                                    </div>
                                );
                            },
                        },
                        { key: 'date', header: 'Date', render: (po: any) => formatters.formatDate(po.created_at) },
                    ]}
                />
            </ListPageTemplate>

            <Modal
                open={showForm}
                onClose={closeForm}
                title="Create Purchase Order"
                size="xl"
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
                        <Button type="submit" form="po-form" disabled={submitting}>
                            {submitting ? 'Creating...' : 'Create Purchase Order'}
                        </Button>
                    </>
                }
            >
                <form id="po-form" onSubmit={handleSubmit} className="space-y-nb-4">
                    {formData.pr_id && (
                        <Alert variant="info" title={`Converting from PR #${formData.pr_id.slice(0, 8).toUpperCase()}`}>
                            Items pre-filled from requisition. Select a vendor and adjust quantities as needed.
                        </Alert>
                    )}

                    <FieldGrid columns={2}>
                        <Select
                            label="Vendor"
                            name="vendor_id"
                            required
                            placeholder="Select Vendor"
                            value={formData.vendor_id}
                            options={vendors.map(v => ({ value: v.id, label: v.name }))}
                            onChange={(e: any) => setFormData(prev => ({ ...prev, vendor_id: val(e) }))}
                        />
                        <TextField
                            label="PO Number"
                            name="po_number"
                            required
                            value={formData.po_number}
                            onChange={(e: any) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                        />
                    </FieldGrid>

                    <div className="space-y-nb-1">
                        <Select
                            label="Link to Requisition"
                            name="pr_id"
                            value={formData.pr_id}
                            options={prOptions}
                            onChange={(e: any) => setFormData(prev => ({ ...prev, pr_id: val(e) }))}
                        />
                        {approvedPrs.length === 0 && pendingCount > 0 && (
                            <p className="text-nb-caption text-warning">
                                You have {pendingCount} pending PR(s). PRs must be approved before conversion to PO.
                            </p>
                        )}
                        <div className="text-nb-caption text-fg-subtle">
                            Currency: <span className="font-medium text-fg-muted">{settings?.base_currency || 'USD'}</span>
                            <span> · From org settings</span>
                        </div>
                    </div>

                    <Textarea
                        label="Terms & Conditions"
                        name="terms"
                        rows={3}
                        value={formData.terms}
                        placeholder="Payment terms, delivery conditions, etc."
                        onChange={(e: any) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                    />
                    <TextField
                        label="Shipping Address"
                        name="shipping_address"
                        value={formData.shipping_address}
                        placeholder="Delivery address for goods"
                        onChange={(e: any) => setFormData(prev => ({ ...prev, shipping_address: e.target.value }))}
                    />

                    <div className="space-y-nb-3">
                        <div className="flex items-center justify-between">
                            <div className="text-nb-label font-medium text-fg-muted">Order Items <span className="text-danger">*</span></div>
                            <Button type="button" variant="ghost" size="sm" onClick={addItemLine}>+ Add Item</Button>
                        </div>
                        {items.length === 0 && (
                            <EmptyState title={'No items added yet. Click "+ Add Item" to begin.'} />
                        )}
                        {items.map((item, idx) => {
                            const hasTaxCode = !!item.tax_code_id;
                            return (
                                <div key={idx} className="flex flex-wrap items-end gap-nb-2">
                                    <div className="min-w-48 flex-1">
                                        <ItemSearchSelector
                                            value={item.item_id}
                                            selectedName={item._selectedName}
                                            onSelect={(selected) => updateItemWithProduct(idx, selected)}
                                            className="flex-1"
                                        />
                                    </div>
                                    <div className="w-20">
                                        <TextField
                                            name={`qty_${idx}`}
                                            type="number"
                                            min="1"
                                            placeholder="Qty"
                                            aria-label="Quantity"
                                            value={item.quantity}
                                            onChange={(e: any) => updateItem(idx, 'quantity', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-28">
                                        <TextField
                                            name={`price_${idx}`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="Unit Price"
                                            aria-label="Unit Price"
                                            value={item.unit_price}
                                            onChange={(e: any) => updateItem(idx, 'unit_price', e.target.value)}
                                        />
                                    </div>
                                    <Badge tone={hasTaxCode ? 'warning' : 'neutral'}>{hasTaxCode ? 'Tax ✓' : 'No Tax'}</Badge>
                                    <div className="w-36">
                                        <TextField
                                            name={`desc_${idx}`}
                                            placeholder="Description"
                                            aria-label="Description"
                                            value={item.description}
                                            onChange={(e: any) => updateItem(idx, 'description', e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        title="Remove item"
                                        aria-label="Remove item"
                                        onClick={() => removeItemLine(idx)}
                                    >
                                        <X size={16} aria-hidden="true" />
                                    </Button>
                                </div>
                            );
                        })}
                        {items.length > 0 && (
                            <div className="flex justify-end border-t border-line pt-nb-2">
                                <dl className="min-w-48 space-y-nb-1 text-nb-caption">
                                    <div className="flex justify-between gap-nb-4">
                                        <dt className="text-fg-subtle">Subtotal</dt>
                                        <dd className="font-medium text-fg-muted">{formatters.formatCurrency(subtotal)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-nb-4">
                                        <dt className="text-fg-subtle">Tax</dt>
                                        <dd className="italic text-fg-subtle">{isTaxInclusive ? 'Inclusive in price' : 'Resolved on save'}</dd>
                                    </div>
                                    <div className="flex justify-between gap-nb-4 border-t border-line-strong pt-nb-1">
                                        <dt className="text-fg-subtle">Total</dt>
                                        <dd className="text-nb-body font-semibold text-fg">{formatters.formatCurrency(total)}</dd>
                                    </div>
                                </dl>
                            </div>
                        )}
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default POListPage;
