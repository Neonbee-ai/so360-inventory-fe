import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search } from 'lucide-react';
import { procurementService } from '../../services/procurementService';
import { useShellBridge } from '@so360/shell-context';
import { useInventoryFormatters } from '../../utils/formatters';
import { FeatureGate } from '@so360/design-system';

interface GRN {
    id: string;
    grn_number: string;
    created_at: string;
    warehouse?: { name: string };
    po?: { po_number: string; vendor?: { name: string } };
    grn_lines?: Array<{ quantity_received: number }>;
}

const GRNListPage = () => {
    const navigate = useNavigate();
    const shell = useShellBridge();
    const formatters = useInventoryFormatters();
    const createGrnState = (shell?.permissionsLoaded === true && (shell?.hasPermission?.('goods_receipts.create') ?? false)) ? ((shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:procurement:create_grn') : 'enabled') : 'hidden';
    const [grns, setGrns] = useState<GRN[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchGRNs();
    }, []);

    const fetchGRNs = async () => {
        try {
            const data = await procurementService.getGRNs();
            setGrns(data);
        } catch (error) {
            console.error('Failed to fetch GRNs', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredGrns = grns.filter(grn =>
        grn.grn_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.po?.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.po?.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        Goods Receipt Notes
                    </h1>
                    <p className="text-fg-muted mt-2 font-medium">Track all received shipments and inventory updates.</p>
                </div>
                <FeatureGate state={createGrnState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <button
                        onClick={() => navigate('/procurement/grn/new')}
                        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-primary-fg rounded-xl font-semibold transition-all shadow-lg shadow-violet-900/20 active:scale-95 flex items-center gap-2"
                    >
                        <Plus size={20} /> New GRN
                    </button>
                </FeatureGate>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total GRNs', value: grns.length, icon: '📦', color: 'violet' },
                    { label: 'This Month', value: grns.filter(g => new Date(g.created_at).getMonth() === new Date().getMonth()).length, icon: '📅', color: 'blue' },
                    { label: 'Total Items Received', value: grns.reduce((sum, g) => sum + (g.grn_lines?.reduce((s, l) => s + l.quantity_received, 0) || 0), 0), icon: '📊', color: 'emerald' },
                ].map((stat, i) => (
                    <div key={i} className="bg-surface/50 border border-line p-6 rounded-2xl backdrop-blur-sm">
                        <div className="flex justify-between items-start">
                            <span className="text-2xl">{stat.icon}</span>
                            <span className={`text-xs font-bold uppercase tracking-wider text-${stat.color}-400`}>{stat.label}</span>
                        </div>
                        <div className="mt-4 text-3xl font-bold text-fg">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle" />
                <input
                    type="text"
                    placeholder="Search by GRN number, PO, or vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface/50 border border-line rounded-xl pl-11 pr-4 py-3 text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                />
            </div>

            {/* Table */}
            <div className="bg-surface/50 border border-line rounded-2xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-line bg-surface-raised/30">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-fg-muted">GRN Details</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-fg-muted">Purchase Order</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-fg-muted">Vendor</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-fg-muted">Warehouse</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-fg-muted">Items</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-fg-muted">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line/50">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-fg-subtle animate-pulse">Loading GRNs...</td>
                            </tr>
                        ) : filteredGrns.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-fg-subtle">
                                    {searchTerm ? 'No GRNs match your search.' : 'No goods receipt notes found.'}
                                </td>
                            </tr>
                        ) : filteredGrns.map((grn) => (
                            <tr
                                key={grn.id}
                                className="hover:bg-surface-raised/20 transition-colors cursor-pointer group"
                                onClick={() => navigate(`/procurement/grn/${grn.id}`)}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                            <Package size={18} className="text-violet-400" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-fg">{grn.grn_number}</div>
                                            <div className="text-xs text-fg-subtle">ID: {grn.id.slice(0, 8)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-primary font-medium">
                                        #{grn.po?.po_number || 'N/A'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-fg-muted">
                                    {grn.po?.vendor?.name || '-'}
                                </td>
                                <td className="px-6 py-4 text-sm text-fg-muted">
                                    {grn.warehouse?.name || '-'}
                                </td>
                                <td className="px-6 py-4 text-sm text-fg-muted font-mono">
                                    {grn.grn_lines?.length || 0} lines
                                </td>
                                <td className="px-6 py-4 text-sm text-fg-muted">
                                    {formatters.formatDate(grn.created_at)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GRNListPage;
