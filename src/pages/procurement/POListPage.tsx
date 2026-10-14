import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { vendorService } from '../../services/vendorService';
import { useBusinessSettings, useActivity, useShellBridge, useQuota } from '@so360/shell-context';
import { useInventoryFormatters } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import ItemSearchSelector from '../../components/ItemSearchSelector';
import { QuotaBar, QuotaGate, FeatureGate, toast, getErrorMessage } from '@so360/design-system';

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

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {fetchError && (
                <div
                    role={fetchError.kind === 'error' ? 'alert' : 'status'}
                    className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
                        fetchError.kind === 'permission'
                            ? 'bg-warning/10 border border-warning/20 text-warning'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    }`}
                >
                    <span>{fetchError.kind === 'permission' ? '🔒' : '⚠'}</span>
                    <span className="flex-1">{fetchError.message}</span>
                    {/* Retry is only meaningful for transient failures — retrying a
                        permission denial would just fail identically. */}
                    {fetchError.kind === 'error' && (
                        <button
                            onClick={fetchData}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-bold hover:bg-rose-500/30 transition-colors"
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}
            {vendorNotice && (
                <div
                    role={vendorNotice.kind === 'error' ? 'alert' : 'status'}
                    className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
                        vendorNotice.kind === 'permission'
                            ? 'bg-warning/10 border border-warning/20 text-warning'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    }`}
                >
                    <span>{vendorNotice.kind === 'permission' ? '🔒' : '⚠'}</span>
                    <span className="flex-1">{vendorNotice.message}</span>
                    {vendorNotice.kind === 'error' && (
                        <button
                            onClick={fetchData}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-bold hover:bg-rose-500/30 transition-colors"
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        Purchase Orders
                    </h1>
                    <p className="text-fg-muted mt-2 font-medium">Official commercial documents issued to sellers.</p>
                </div>
                <div className="flex gap-4">
                    {approvedPrs.length > 0 && (
                        <div className="relative group">
                            <button className="px-6 py-3 bg-primary/20 border border-primary/50 text-primary rounded-xl font-bold hover:bg-primary/30 transition-all flex items-center gap-2">
                                <span className="w-5 h-5 bg-primary text-primary-fg rounded-full flex items-center justify-center text-[10px]">{approvedPrs.length}</span>
                                Convert Approved PRs
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-line rounded-2xl shadow-2xl p-4 hidden group-hover:block z-50">
                                <div className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest mb-3 border-b border-line pb-2">Approved Requisitions</div>
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {approvedPrs.map(pr => (
                                        <div key={pr.id} className="flex justify-between items-center bg-bg p-2 rounded-lg border border-line hover:border-line-strong transition-colors">
                                            <div className="text-xs">
                                                <div className="text-fg-muted font-bold">#PR-{pr.id.slice(0, 8).toUpperCase()}</div>
                                                <div className="text-fg-subtle">{pr.pr_lines?.length} items</div>
                                            </div>
                                            <button
                                                onClick={() => handleCreateFromPR(pr)}
                                                className="text-[10px] font-bold bg-primary px-2 py-1 rounded text-primary-fg"
                                            >
                                                Convert
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => navigate('/procurement/opening-balance')}
                        className="px-6 py-3 bg-warning/20 border border-warning/50 text-warning rounded-xl font-semibold transition-all hover:bg-warning/30 active:scale-95 flex items-center gap-2"
                    >
                        <span className="text-base leading-none">⚖</span> Opening Balance
                    </button>
                    <FeatureGate state={createPoState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <QuotaGate
                        quotaKey="max_po_per_month"
                        moduleCode="inventory"
                        used={quotaData?.current_usage ?? 0}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        disableOnExceeded
                    >
                        <button
                            onClick={openNewPOForm}
                            disabled={!!vendorNotice}
                            title={vendorNotice ? vendorNotice.message : undefined}
                            className="px-6 py-3 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary text-primary-fg rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center gap-2"
                        >
                            <span className="text-xl leading-none">+</span> New PO
                        </button>
                    </QuotaGate>
                    </FeatureGate>
                </div>
            </div>

            {quotaData && (
                <QuotaBar
                    label="Purchase Orders"
                    used={quotaData.current_usage}
                    limit={quotaData.limit}
                    isUnlimited={quotaData.is_unlimited}
                    className="mb-6"
                />
            )}

            <div className="bg-surface/50 border border-line rounded-3xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left">
                    <thead className="bg-surface-raised/30 border-b border-line">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Order Info</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Vendor</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Amount</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Progress</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-fg-subtle tracking-widest">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line/50">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-fg-subtle animate-pulse">Loading orders...</td></tr>
                        ) : pos.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-fg-subtle italic">No purchase orders found.</td></tr>
                        ) : pos.map(po => {
                            const totalLines = po.po_lines?.length || 0;
                            const receivedLines = po.po_lines?.filter((l: any) => l.received_quantity >= l.quantity).length || 0;
                            const progress = totalLines > 0 ? (receivedLines / totalLines) * 100 : 0;

                            return (
                                <tr
                                    key={po.id}
                                    className="hover:bg-surface-raised/20 transition-all cursor-pointer group"
                                    onClick={() => navigate(`/procurement/po/${po.id}`)}
                                >
                                    <td className="px-6 py-5">
                                        <div className="font-bold text-fg uppercase tracking-tight">#{po.po_number}</div>
                                        {po.pr_id && (
                                            <div className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest mt-0.5">Reference: PR-{po.pr_id?.slice(0, 6).toUpperCase()}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-semibold text-fg-muted group-hover:text-primary transition-colors uppercase">{po.vendor?.name}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border
                                            ${po.status === 'sent' ? 'bg-primary/10 text-primary border-primary/20' :
                                                po.status === 'acknowledged' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                                po.status === 'partially_received' ? 'bg-warning/10 text-warning border-warning/20' :
                                                po.status === 'received' ? 'bg-success/10 text-success border-success/20' :
                                                    po.status === 'closed' ? 'bg-fg-subtle/10 text-fg-muted border-line-strong/20' :
                                                        po.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                    'bg-line-strong/50 text-fg-muted border-line-strong'}
                                        `}>
                                            {po.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 font-mono text-sm font-bold text-fg">
                                        {formatters.formatCurrency(parseFloat(po.total_amount || 0))}
                                    </td>
                                    <td className="px-6 py-5 w-48">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-1000 ${progress === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-fg-subtle">{Math.round(progress)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-[10px] text-fg-subtle font-bold">
                                        {formatters.formatDate(po.created_at).toUpperCase()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* New PO Modal Form */}
            {showForm && (
                <div className="fixed inset-0 bg-bg/80 backdrop-blur-md flex items-center justify-center px-4 pt-24 pb-6 z-[600] animate-in fade-in zoom-in duration-300">
                    <div className="bg-surface border border-line rounded-3xl w-full max-w-3xl max-h-[calc(100vh-7.5rem)] flex flex-col overflow-hidden shadow-2xl shadow-black/50">
                        <div className="p-8 border-b border-line flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-fg">Create Purchase Order</h2>
                            <button onClick={() => setShowForm(false)} className="text-fg-subtle hover:text-fg transition-colors text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            {/* Conversion context banner */}
                            {formData.pr_id && (
                                <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-primary text-sm">PR</span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-primary">
                                            Converting from PR #{formData.pr_id.slice(0, 8).toUpperCase()}
                                        </span>
                                        <span className="block text-xs text-primary/70">
                                            Items pre-filled from requisition. Select a vendor and adjust quantities as needed.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Row 1: Vendor + PO Number */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Vendor <span className="text-danger">*</span></label>
                                    <select
                                        required
                                        value={formData.vendor_id}
                                        className="w-full bg-bg border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-focus/50 transition-all text-fg"
                                        onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                    >
                                        <option value="">Select Vendor</option>
                                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-fg-subtle uppercase tracking-wider">PO Number <span className="text-danger">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.po_number}
                                        className="w-full bg-bg border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-focus/50 transition-all text-fg"
                                        onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Link PR (full width) */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Link to Requisition</label>
                                <select
                                    value={formData.pr_id}
                                    className="w-full bg-bg border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-focus/50 transition-all text-fg"
                                    onChange={(e) => setFormData({ ...formData, pr_id: e.target.value })}
                                >
                                    <option value="">None (standalone PO)</option>
                                    {approvedPrs.length > 0 && (
                                        <optgroup label="✅ Available for Conversion">
                                            {approvedPrs.map(pr => (
                                                <option key={pr.id} value={pr.id}>
                                                    PR-{pr.id.slice(0, 8).toUpperCase()} — {pr.pr_lines?.length || 0} items — {pr.status.replace(/_/g, ' ')}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {allPrs.filter(pr => !['approved', 'partially_converted', 'converted_to_po'].includes(pr.status) && pr.status !== 'rejected' && pr.status !== 'closed').length > 0 && (
                                        <optgroup label="⏳ Pending Approval (Not Available)">
                                            {allPrs.filter(pr => !['approved', 'partially_converted', 'converted_to_po'].includes(pr.status) && pr.status !== 'rejected' && pr.status !== 'closed').map(pr => (
                                                <option key={pr.id} value={pr.id} disabled>
                                                    PR-{pr.id.slice(0, 8).toUpperCase()} — {pr.pr_lines?.length || 0} items — {pr.status.replace(/_/g, ' ')}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {approvedPrs.length === 0 && allPrs.filter(pr => !['approved', 'partially_converted', 'converted_to_po'].includes(pr.status) && pr.status !== 'rejected' && pr.status !== 'closed').length === 0 && (
                                        <option disabled>No purchase requisitions available</option>
                                    )}
                                </select>
                                {approvedPrs.length === 0 && allPrs.filter(pr => ['pending_approval', 'draft'].includes(pr.status)).length > 0 && (
                                    <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                                        <span>⚠️</span>
                                        <span>You have {allPrs.filter(pr => ['pending_approval', 'draft'].includes(pr.status)).length} pending PR(s). PRs must be approved before conversion to PO.</span>
                                    </p>
                                )}
                                <div className="text-xs text-fg-subtle mt-1">
                                    Currency: <span className="text-fg-muted font-semibold">{settings?.base_currency || 'USD'}</span>
                                    <span className="text-fg-subtle"> · From org settings</span>
                                </div>
                            </div>

                            {/* Row 3: Terms */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Terms & Conditions</label>
                                <textarea
                                    value={formData.terms}
                                    className="w-full bg-bg border border-line rounded-xl px-4 py-3 h-20 focus:outline-none focus:ring-2 focus:ring-focus/50 transition-all text-fg resize-none"
                                    placeholder="Payment terms, delivery conditions, etc."
                                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                />
                            </div>

                            {/* Row 4: Shipping Address */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Shipping Address</label>
                                <input
                                    type="text"
                                    value={formData.shipping_address}
                                    className="w-full bg-bg border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-focus/50 transition-all text-fg"
                                    placeholder="Delivery address for goods"
                                    onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                                />
                            </div>

                            {/* Line Items */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Order Items <span className="text-danger">*</span></label>
                                    <button type="button" onClick={addItemLine} className="text-primary hover:text-primary text-xs font-bold">+ Add Item</button>
                                </div>
                                {items.length === 0 && (
                                    <div className="text-center py-6 text-fg-subtle text-sm border border-dashed border-line rounded-xl">
                                        No items added yet. Click "+ Add Item" to begin.
                                    </div>
                                )}
                                {items.map((item, idx) => {
                                    const hasTaxCode = !!item.tax_code_id;
                                    return (
                                        <div key={idx} className="flex gap-3 items-end animate-in slide-in-from-top-2 duration-300">
                                            <div className="flex-1 space-y-1">
                                                <ItemSearchSelector
                                                    value={item.item_id}
                                                    selectedName={item._selectedName}
                                                    onSelect={(selected) => updateItemWithProduct(idx, selected)}
                                                    className="flex-1"
                                                />
                                            </div>
                                            <div className="w-20 space-y-1">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="Qty"
                                                    value={item.quantity}
                                                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-focus/30"
                                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                />
                                            </div>
                                            <div className="w-28 space-y-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="Unit Price"
                                                    value={item.unit_price}
                                                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-focus/30"
                                                    onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                                                />
                                            </div>
                                            <div className="w-24 space-y-1">
                                                {/* Tax rate badge — resolved server-side */}
                                                <div className={`px-3 py-2 rounded-lg text-xs font-bold text-center border ${
                                                    hasTaxCode
                                                        ? 'bg-warning/10 text-warning border-warning/20'
                                                        : 'bg-surface-raised/50 text-fg-subtle border-line-strong'
                                                }`}>
                                                    {hasTaxCode ? 'Tax ✓' : 'No Tax'}
                                                </div>
                                            </div>
                                            <div className="w-36 space-y-1">
                                                <input
                                                    type="text"
                                                    placeholder="Description"
                                                    value={item.description}
                                                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-focus/30"
                                                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeItemLine(idx)}
                                                className="text-danger hover:text-red-300 text-lg font-bold px-2 py-1 transition-colors"
                                                title="Remove item"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}
                                {items.length > 0 && (
                                    <div className="flex justify-end pt-2 border-t border-line">
                                        <div className="text-right space-y-1 min-w-48">
                                            <div className="flex justify-between items-center gap-6">
                                                <span className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Subtotal</span>
                                                <span className="text-sm font-semibold text-fg-muted font-mono">{formatters.formatCurrency(subtotal)}</span>
                                            </div>
                                            {isTaxInclusive ? (
                                                <div className="flex justify-between items-center gap-6">
                                                    <span className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Tax</span>
                                                    <span className="text-xs text-fg-subtle italic">Inclusive in price</span>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center gap-6">
                                                    <span className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Tax</span>
                                                    <span className="text-xs text-warning italic">Resolved on save</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center gap-6 border-t border-line-strong pt-1">
                                                <span className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Total</span>
                                                <span className="text-lg font-bold text-fg font-mono">{formatters.formatCurrency(total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex gap-4">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-6 py-4 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary-fg rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                                >
                                    {submitting ? 'Creating...' : 'Create Purchase Order'}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-4 bg-surface-raised hover:bg-line-strong text-fg-muted rounded-2xl font-bold transition-all active:scale-95">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default POListPage;
