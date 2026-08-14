import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { inventoryService } from '../../services/inventoryService';
import ItemSearchSelector from '../../components/ItemSearchSelector';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { useInventoryFormatters } from '../../utils/formatters';
import { FeatureGate, toast, getErrorMessage, DepartmentSelector } from '@so360/design-system';

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
const sourceChips = (pr: PR) => {
    const chips: Array<{ label: string; className: string }> = [];
    if (pr.manufacturing_order_id || pr.source_type === 'manufacturing_order') {
        chips.push({
            label: pr.source_ref ? `MO ${pr.source_ref}` : 'Manufacturing',
            className: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
        });
    }
    if (pr.project_id) {
        chips.push({ label: 'Project', className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' });
    }
    if (pr.work_order_id) {
        chips.push({ label: 'Work Order', className: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' });
    }
    if (pr.source_type === 'sales_order') {
        chips.push({
            label: pr.source_ref ? `SO ${pr.source_ref}` : 'Sales Order',
            className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        });
    }
    return chips;
};

const PRIORITIES = [
    { value: 'low', label: 'Low', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
    { value: 'normal', label: 'Normal', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { value: 'high', label: 'High', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { value: 'urgent', label: 'Urgent', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
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
        Promise.all([
            inventoryService.getLocations().catch(() => []),
            inventoryService.searchProjects().catch(() => []),
            inventoryService.searchWorkOrders().catch(() => []),
        ]).then(([wh, prj, wo]) => {
            setWarehouses(Array.isArray(wh) ? wh : []);
            setProjects(Array.isArray(prj) ? prj : []);
            setWorkOrders(Array.isArray(wo) ? wo : []);
        });
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

        const confirmed = window.confirm(
            'Are you sure you want to delete this Purchase Requisition? This action cannot be undone.'
        );
        if (!confirmed) return;

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

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {fetchError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                    <span>⚠</span> {fetchError}
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Purchase Requisitions
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">Manage and track spending requests across the organization.</p>
                </div>
                <FeatureGate state={createPrState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center gap-2"
                    >
                        <span className="text-xl leading-none">+</span> New Requisition
                    </button>
                </FeatureGate>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total PRs', value: prs.length, icon: '📋', color: 'blue' },
                    { label: 'Pending Approval', value: prs.filter(p => p.status === 'pending_approval').length, icon: '⏳', color: 'amber' },
                    { label: 'Approved', value: prs.filter(p => p.status === 'approved').length, icon: '✅', color: 'emerald' },
                    { label: 'Converted', value: prs.filter(p => ['converted_to_po', 'partially_converted', 'fully_converted'].includes(p.status)).length, icon: '📦', color: 'indigo' },
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm hover:border-slate-700 transition-colors group">
                        <div className="flex justify-between items-start">
                            <span className="text-2xl">{stat.icon}</span>
                            <span className={`text-xs font-bold uppercase tracking-wider text-${stat.color}-400 bg-${stat.color}-400/10 px-2 py-0.5 rounded`}>{stat.label}</span>
                        </div>
                        <div className="mt-4 text-3xl font-bold text-slate-100">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* List Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/30">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">PR Details</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Requester</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Required Date</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Lines</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 animate-pulse">Loading requisition data...</td>
                            </tr>
                        ) : prs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No purchase requisitions found.</td>
                            </tr>
                        ) : prs.map((pr) => (
                            <tr key={pr.id} className="hover:bg-slate-800/20 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-200">{pr.pr_number || `#PR-${pr.id.slice(0, 8).toUpperCase()}`}</span>
                                        {pr.priority && pr.priority !== 'normal' && (
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${PRIORITIES.find(p => p.value === pr.priority)?.className || ''}`}>
                                                {pr.priority}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{pr.title || pr.description}</div>
                                    {sourceChips(pr).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {sourceChips(pr).map(chip => (
                                                <span
                                                    key={chip.label}
                                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${chip.className}`}
                                                >
                                                    {chip.label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                                        ${pr.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                            pr.status === 'pending_approval' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                pr.status === 'partially_converted' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                                    pr.status === 'fully_converted' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                        pr.status === 'converted_to_po' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                            pr.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                                                pr.status === 'closed' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' :
                                                                    'bg-slate-700/50 text-slate-400 border border-slate-600/20'}
                                    `}>
                                        {pr.status.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-slate-300">{pr.requester?.full_name || 'System'}</div>
                                    <div className="text-[10px] text-slate-500">Requested {formatters.formatDate(pr.created_at)}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300">
                                    {pr.required_date ? formatters.formatDate(pr.required_date) : 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                                    {pr.pr_lines?.length || 0} items
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => navigate(`/procurement/pr/${pr.id}`)}
                                            className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors cursor-pointer"
                                        >
                                            View Details →
                                        </button>
                                        {canCreatePR && (pr.status === 'draft' || pr.status === 'rejected') && (
                                            <button
                                                onClick={() => handleDelete(pr.id, pr.status)}
                                                className="text-rose-400 hover:text-rose-300 font-semibold text-sm transition-colors cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Form */}
            {showForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center px-4 pt-24 pb-6 z-[600] animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[calc(100vh-7.5rem)] flex flex-col overflow-hidden shadow-2xl shadow-black/50">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-100">Create New Requisition</h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-50 transition-colors text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Title</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        placeholder="e.g. Site 4 cement top-up"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Required Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.required_date}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData(prev => ({ ...prev, required_date: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                                <div className="flex gap-2">
                                    {PRIORITIES.map(p => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            aria-pressed={formData.priority === p.value}
                                            onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${formData.priority === p.value
                                                ? p.className
                                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'}`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
                                    <DepartmentSelector
                                        value={formData.department_id || undefined}
                                        orgId={inventoryService.getOrgId() || ''}
                                        placeholder="Select department"
                                        allowClear
                                        onChange={(departmentId: string | null) => setFormData(prev => ({ ...prev, department_id: departmentId || '' }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deliver To Warehouse</label>
                                    <select
                                        value={formData.warehouse_id}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData(prev => ({ ...prev, warehouse_id: e.target.value }))}
                                    >
                                        <option value="">Not specified</option>
                                        {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project</label>
                                    <select
                                        value={formData.project_id}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))}
                                    >
                                        <option value="">Not project-linked</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name || p.title || p.code}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manufacturing Order</label>
                                    <select
                                        value={formData.manufacturing_order_id}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData(prev => ({ ...prev, manufacturing_order_id: e.target.value }))}
                                    >
                                        <option value="">Not linked to production</option>
                                        {workOrders.map(w => <option key={w.id} value={w.id}>{w.order_number || w.mo_number || w.id.slice(0, 8)}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Budget Amount</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.budget_amount}
                                        placeholder="0.00"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData(prev => ({ ...prev, budget_amount: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Budget / Cost Code</label>
                                    <input
                                        type="text"
                                        value={formData.budget_code}
                                        placeholder="e.g. CC-OPS-2026"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData(prev => ({ ...prev, budget_code: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                                <textarea
                                    value={formData.description}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200 resize-none"
                                    placeholder="What is being requested..."
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Business Justification</label>
                                <textarea
                                    value={formData.justification}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200 resize-none"
                                    placeholder="Why this spend is needed, and what happens if it is not approved..."
                                    onChange={(e) => setFormData(prev => ({ ...prev, justification: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requested Items</label>
                                    <button type="button" onClick={addItemLine} className="text-blue-400 hover:text-blue-300 text-xs font-bold">+ Add Item</button>
                                </div>
                                {items.length === 0 && (
                                    <div className="text-center py-6 text-slate-600 text-sm border border-dashed border-slate-800 rounded-xl">
                                        No items added yet. Click "+ Add Item" to begin.
                                    </div>
                                )}
                                {items.map((item, idx) => (
                                    <div key={idx} className="space-y-2 p-3 bg-slate-950/50 border border-slate-800 rounded-xl animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex gap-3 items-center">
                                            <div className="flex-1">
                                                <ItemSearchSelector
                                                    value={item.item_id}
                                                    selectedName={item._selectedName}
                                                    onSelect={(selected) => updateItemWithProduct(idx, selected)}
                                                />
                                            </div>
                                            <div className="w-24">
                                                <input
                                                    type="number"
                                                    placeholder="Qty"
                                                    value={item.quantity}
                                                    min="1"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                />
                                            </div>
                                            <div className="w-32">
                                                <input
                                                    type="number"
                                                    placeholder="Est. Price"
                                                    value={item.price}
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    onChange={(e) => updateItem(idx, 'price', e.target.value)}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                                className="text-red-400 hover:text-red-300 text-lg font-bold px-2 py-1 transition-colors flex-shrink-0"
                                                title="Remove item"
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                placeholder="Description (optional)"
                                                value={item.description}
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder-slate-600"
                                                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="UOM"
                                                aria-label="Unit of measure"
                                                value={item.uom || ''}
                                                className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder-slate-600"
                                                onChange={(e) => updateItem(idx, 'uom', e.target.value)}
                                            />
                                            <input
                                                type="date"
                                                aria-label="Required delivery date"
                                                title="Required delivery date"
                                                value={item.required_delivery_date || ''}
                                                className="w-40 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                onChange={(e) => updateItem(idx, 'required_delivery_date', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button type="submit" className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95">
                                    Submit for Approval
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

export default PRListPage;
