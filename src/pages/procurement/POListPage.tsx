import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { vendorService } from '../../services/vendorService';
import { useBusinessSettings, useActivity } from '@so360/shell-context';
import { useInventoryFormatters } from '../../utils/formatters';
import ItemSearchSelector from '../../components/ItemSearchSelector';

const POListPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useBusinessSettings();
    const formatters = useInventoryFormatters();
    const { recordActivity } = useActivity();
    const [pos, setPos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        fetchData();
    }, []);

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

    const fetchData = async () => {
        try {
            const [poData, vendorData] = await Promise.all([
                procurementService.getPOs(),
                vendorService.getVendors(),
            ]);
            setPos(Array.isArray(poData) ? poData : (poData?.data || []));
            setVendors(Array.isArray(vendorData) ? vendorData : (vendorData?.data || []));
        } catch (error) {
            console.error('Failed to fetch POs/vendors', error);
        } finally {
            setLoading(false);
        }
        // PRs loaded independently so a failure doesn't block the PO list
        loadPRs();
    };

    const loadPRs = async () => {
        try {
            const prData = await procurementService.getPRs();
            const prArray = Array.isArray(prData) ? prData : (prData?.data || []);
            setAllPrs(prArray);
            setApprovedPrs(prArray.filter((p: any) =>
                ['approved', 'partially_converted', 'converted_to_po'].includes(p.status)
            ));
        } catch (error) {
            console.error('Failed to fetch PRs', error);
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
        if (!formData.vendor_id) { alert('Please select a vendor.'); return; }
        if (!formData.po_number.trim()) { alert('PO number is required.'); return; }
        const validItems = items.filter(i => i.item_id && i.quantity > 0 && i.unit_price > 0);
        if (validItems.length === 0) { alert('Add at least one complete item line.'); return; }

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
            alert(error.message || 'Failed to create Purchase Order');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateFromPR = async (pr: any) => {
        try {
            const payload = await procurementService.getConversionPayload(pr.id);
            if (payload.is_fully_converted) {
                alert('This PR has been fully converted. All line quantities are already covered by existing Purchase Orders.');
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
            alert(error.message || 'Conversion failed');
        }
    };

    const { subtotal, taxTotal, total } = calculateTotals();

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        Purchase Orders
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">Official commercial documents issued to sellers.</p>
                </div>
                <div className="flex gap-4">
                    {approvedPrs.length > 0 && (
                        <div className="relative group">
                            <button className="px-6 py-3 bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 rounded-xl font-bold hover:bg-indigo-600/30 transition-all flex items-center gap-2">
                                <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px]">{approvedPrs.length}</span>
                                Convert Approved PRs
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 hidden group-hover:block z-50">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">Approved Requisitions</div>
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {approvedPrs.map(pr => (
                                        <div key={pr.id} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                                            <div className="text-xs">
                                                <div className="text-slate-300 font-bold">#PR-{pr.id.slice(0, 8).toUpperCase()}</div>
                                                <div className="text-slate-500">{pr.pr_lines?.length} items</div>
                                            </div>
                                            <button
                                                onClick={() => handleCreateFromPR(pr)}
                                                className="text-[10px] font-bold bg-indigo-500 px-2 py-1 rounded text-white"
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
                        className="px-6 py-3 bg-amber-600/20 border border-amber-500/50 text-amber-400 rounded-xl font-semibold transition-all hover:bg-amber-600/30 active:scale-95 flex items-center gap-2"
                    >
                        <span className="text-base leading-none">⚖</span> Opening Balance
                    </button>
                    <button
                        onClick={openNewPOForm}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center gap-2"
                    >
                        <span className="text-xl leading-none">+</span> New PO
                    </button>
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-800/30 border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Order Info</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Vendor</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Amount</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Progress</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 animate-pulse">Loading orders...</td></tr>
                        ) : pos.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">No purchase orders found.</td></tr>
                        ) : pos.map(po => {
                            const totalLines = po.po_lines?.length || 0;
                            const receivedLines = po.po_lines?.filter((l: any) => l.received_quantity >= l.quantity).length || 0;
                            const progress = totalLines > 0 ? (receivedLines / totalLines) * 100 : 0;

                            return (
                                <tr
                                    key={po.id}
                                    className="hover:bg-slate-800/20 transition-all cursor-pointer group"
                                    onClick={() => navigate(`/procurement/po/${po.id}`)}
                                >
                                    <td className="px-6 py-5">
                                        <div className="font-bold text-slate-100 uppercase tracking-tight">#{po.po_number}</div>
                                        {po.pr_id && (
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Reference: PR-{po.pr_id?.slice(0, 6).toUpperCase()}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-semibold text-slate-300 group-hover:text-blue-400 transition-colors uppercase">{po.vendor?.name}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border
                                            ${po.status === 'sent' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                po.status === 'partially_received' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                po.status === 'received' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    po.status === 'closed' ? 'bg-slate-500/10 text-slate-300 border-slate-500/20' :
                                                        po.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                    'bg-slate-700/50 text-slate-400 border-slate-600'}
                                        `}>
                                            {po.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 font-mono text-sm font-bold text-slate-100">
                                        {formatters.formatCurrency(parseFloat(po.total_amount || 0))}
                                    </td>
                                    <td className="px-6 py-5 w-48">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500">{Math.round(progress)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-[10px] text-slate-500 font-bold">
                                        {new Date(po.created_at).toLocaleDateString().toUpperCase()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* New PO Modal Form */}
            {showForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl shadow-black/50">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-100">Create Purchase Order</h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition-colors text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Conversion context banner */}
                            {formData.pr_id && (
                                <div className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-indigo-400 text-sm">PR</span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-indigo-300">
                                            Converting from PR #{formData.pr_id.slice(0, 8).toUpperCase()}
                                        </span>
                                        <span className="block text-xs text-indigo-400/70">
                                            Items pre-filled from requisition. Select a vendor and adjust quantities as needed.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Row 1: Vendor + PO Number */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor <span className="text-red-400">*</span></label>
                                    <select
                                        required
                                        value={formData.vendor_id}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                    >
                                        <option value="">Select Vendor</option>
                                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">PO Number <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.po_number}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Link PR (full width) */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Link to Requisition</label>
                                <select
                                    value={formData.pr_id}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
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
                                    <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                                        <span>⚠️</span>
                                        <span>You have {allPrs.filter(pr => ['pending_approval', 'draft'].includes(pr.status)).length} pending PR(s). PRs must be approved before conversion to PO.</span>
                                    </p>
                                )}
                                <div className="text-xs text-slate-500 mt-1">
                                    Currency: <span className="text-slate-300 font-semibold">{settings?.base_currency || 'USD'}</span>
                                    <span className="text-slate-600"> · From org settings</span>
                                </div>
                            </div>

                            {/* Row 3: Terms */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Terms & Conditions</label>
                                <textarea
                                    value={formData.terms}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200 resize-none"
                                    placeholder="Payment terms, delivery conditions, etc."
                                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                />
                            </div>

                            {/* Row 4: Shipping Address */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shipping Address</label>
                                <input
                                    type="text"
                                    value={formData.shipping_address}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                    placeholder="Delivery address for goods"
                                    onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                                />
                            </div>

                            {/* Line Items */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order Items <span className="text-red-400">*</span></label>
                                    <button type="button" onClick={addItemLine} className="text-blue-400 hover:text-blue-300 text-xs font-bold">+ Add Item</button>
                                </div>
                                {items.length === 0 && (
                                    <div className="text-center py-6 text-slate-600 text-sm border border-dashed border-slate-800 rounded-xl">
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
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                                                />
                                            </div>
                                            <div className="w-24 space-y-1">
                                                {/* Tax rate badge — resolved server-side */}
                                                <div className={`px-3 py-2 rounded-lg text-xs font-bold text-center border ${
                                                    hasTaxCode
                                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                        : 'bg-slate-800/50 text-slate-600 border-slate-700'
                                                }`}>
                                                    {hasTaxCode ? 'Tax ✓' : 'No Tax'}
                                                </div>
                                            </div>
                                            <div className="w-36 space-y-1">
                                                <input
                                                    type="text"
                                                    placeholder="Description"
                                                    value={item.description}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeItemLine(idx)}
                                                className="text-red-400 hover:text-red-300 text-lg font-bold px-2 py-1 transition-colors"
                                                title="Remove item"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}
                                {items.length > 0 && (
                                    <div className="flex justify-end pt-2 border-t border-slate-800">
                                        <div className="text-right space-y-1 min-w-48">
                                            <div className="flex justify-between items-center gap-6">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subtotal</span>
                                                <span className="text-sm font-semibold text-slate-300 font-mono">{formatters.formatCurrency(subtotal)}</span>
                                            </div>
                                            {isTaxInclusive ? (
                                                <div className="flex justify-between items-center gap-6">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tax</span>
                                                    <span className="text-xs text-slate-500 italic">Inclusive in price</span>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center gap-6">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tax</span>
                                                    <span className="text-xs text-amber-400 italic">Resolved on save</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center gap-6 border-t border-slate-700 pt-1">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
                                                <span className="text-lg font-bold text-slate-100 font-mono">{formatters.formatCurrency(total)}</span>
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
                                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                                >
                                    {submitting ? 'Creating...' : 'Create Purchase Order'}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all active:scale-95">
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
