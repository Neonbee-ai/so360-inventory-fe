import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import ItemSearchSelector from '../../components/ItemSearchSelector';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { FeatureGate } from '@so360/design-system';

interface PRLine {
    id: string;
    description: string;
    quantity: number;
    estimated_unit_price: number;
}

interface PR {
    id: string;
    status: string;
    required_date: string;
    description: string;
    created_at: string;
    requester?: { full_name: string };
    pr_lines: PRLine[];
}

const PRListPage = () => {
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const createPrState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:procurement:create_pr') : 'enabled';
    const canCreatePR = (shell?.effectiveFlagsLoaded !== false) && createPrState === 'enabled';
    const [prs, setPrs] = useState<PR[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ description: '', required_date: '' });
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const data = await procurementService.getPRs();
            setPrs(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            console.error('Failed to fetch PRs', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const createdPR = await procurementService.createPR({
                ...formData,
                items: items.map(it => ({
                    item_id: it.item_id,
                    quantity: parseFloat(it.quantity),
                    estimated_unit_price: parseFloat(it.price),
                    description: it.description || undefined,
                }))
            });
            recordActivity({ eventType: 'inventory.pr.created', eventCategory: 'financials', description: `Created Purchase Requisition`, resourceType: 'pr', resourceId: createdPR?.id }).catch(() => {});
            setShowForm(false);
            fetchData();
        } catch (error) {
            alert('Failed to create PR');
        }
    };

    const handleDelete = async (prId: string, status: string) => {
        if (!['draft', 'rejected'].includes(status)) {
            alert('Only draft or rejected PRs can be deleted');
            return;
        }

        const confirmed = window.confirm(
            'Are you sure you want to delete this Purchase Requisition? This action cannot be undone.'
        );
        if (!confirmed) return;

        try {
            await procurementService.deletePR(prId);
            await fetchData();
            alert('Purchase Requisition deleted successfully');
        } catch (err: any) {
            alert(err.message || 'Failed to delete PR');
        }
    };

    const addItemLine = () => {
        setItems([...items, { item_id: '', _selectedName: '', quantity: 1, price: 0, description: '' }]);
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
                                    <div className="font-semibold text-slate-200">#PR-{pr.id.slice(0, 8).toUpperCase()}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{pr.description}</div>
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
                                    <div className="text-[10px] text-slate-500">Requested {new Date(pr.created_at).toLocaleDateString()}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300">
                                    {pr.required_date ? new Date(pr.required_date).toLocaleDateString() : 'N/A'}
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
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-black/50">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-100">Create New Requisition</h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-50 transition-colors text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Required Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200"
                                        onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Justification / Description</label>
                                <textarea
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-200 resize-none"
                                    placeholder="Explain why these items are needed..."
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Description (optional)"
                                                value={item.description}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder-slate-600"
                                                onChange={(e) => updateItem(idx, 'description', e.target.value)}
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
