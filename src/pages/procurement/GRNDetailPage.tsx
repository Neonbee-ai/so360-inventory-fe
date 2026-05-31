import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Package, AlertCircle, Clock, Building2,
    FileText, CheckCircle, Truck
} from 'lucide-react';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';

interface GRNLine {
    id: string;
    item_id: string;
    quantity_received: number;
    po_line?: {
        quantity: number;
        unit_price: number;
        description: string;
        items?: { name: string; sku: string };
    };
}

interface GRN {
    id: string;
    grn_number: string;
    created_at: string;
    notes?: string;
    warehouse?: { id: string; name: string };
    po?: {
        id: string;
        po_number: string;
        vendor?: { id: string; name: string; contact_email?: string };
    };
    grn_lines: GRNLine[];
    received_by?: { full_name: string };
}

const GRNDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [grn, setGrn] = useState<GRN | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) fetchGRN();
    }, [id]);

    const fetchGRN = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await procurementService.getGRNDetail(id!);
            setGrn(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load GRN details');
        } finally {
            setIsLoading(false);
        }
    };

    const totalQuantityReceived = grn?.grn_lines?.reduce((sum, line) =>
        sum + line.quantity_received, 0) || 0;

    const totalValue = grn?.grn_lines?.reduce((sum, line) =>
        sum + (line.quantity_received * (line.po_line?.unit_price || 0)), 0) || 0;

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !grn) {
        return (
            <div className="p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">{error || 'GRN not found'}</h2>
                <button onClick={() => navigate('/procurement/grn')} className="text-violet-400 hover:underline">
                    Back to GRNs
                </button>
            </div>
        );
    }

    return (
        <div className="p-8">
            <button
                onClick={() => navigate('/procurement/grn')}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors group"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to Goods Receipt Notes
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - GRN Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                <Package size={28} className="text-violet-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">
                                    {grn.grn_number}
                                </h1>
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Received
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {grn.po && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                    <FileText size={16} className="text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-500 block">Purchase Order</span>
                                        <button
                                            onClick={() => navigate(`/procurement/po/${grn.po?.id}`)}
                                            className="text-sm text-blue-400 hover:text-blue-300"
                                        >
                                            #{grn.po.po_number}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {grn.po?.vendor && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                    <Truck size={16} className="text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-500 block">Vendor</span>
                                        <button
                                            onClick={() => navigate(`/vendors/${grn.po?.vendor?.id}`)}
                                            className="text-sm text-blue-400 hover:text-blue-300"
                                        >
                                            {grn.po.vendor.name}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {grn.warehouse && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                    <Building2 size={16} className="text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-500 block">Receiving Warehouse</span>
                                        <button
                                            onClick={() => navigate(`/inventory/warehouses/${grn.warehouse?.id}`)}
                                            className="text-sm text-blue-400 hover:text-blue-300"
                                        >
                                            {grn.warehouse.name}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                <Clock size={16} className="text-slate-500" />
                                <div>
                                    <span className="text-xs text-slate-500 block">Received Date</span>
                                    <span className="text-sm text-white">
                                        {new Date(grn.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            {grn.received_by && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                    <CheckCircle size={16} className="text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-500 block">Received By</span>
                                        <span className="text-sm text-white">{grn.received_by.full_name}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {grn.notes && (
                            <div className="mt-6 pt-6 border-t border-slate-800">
                                <span className="text-xs text-slate-500 block mb-2">Notes</span>
                                <p className="text-sm text-slate-300">{grn.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Summary Card */}
                    <div className="bg-violet-600 rounded-2xl p-6 text-white">
                        <span className="text-violet-100 text-[10px] font-bold uppercase tracking-wider">Receipt Summary</span>
                        <div className="text-4xl font-black mt-2">
                            {totalQuantityReceived} units
                        </div>
                        <p className="mt-2 text-sm text-violet-200">
                            Value: {formatters.formatCurrency(totalValue)}
                        </p>
                    </div>
                </div>

                {/* Right Column - Line Items */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Package size={20} className="text-violet-400" />
                            Received Items
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                        <th className="pb-3">Item</th>
                                        <th className="pb-3 text-center">PO Qty</th>
                                        <th className="pb-3 text-center">Received</th>
                                        <th className="pb-3 text-right">Unit Price</th>
                                        <th className="pb-3 text-right">Line Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {grn.grn_lines?.map((line) => (
                                        <tr key={line.id} className="border-b border-slate-800/50">
                                            <td className="py-3">
                                                <span className="text-white font-medium">
                                                    {line.po_line?.items?.name || line.po_line?.description || 'Unknown Item'}
                                                </span>
                                                {line.po_line?.items?.sku && (
                                                    <span className="block text-xs text-slate-500 font-mono">{line.po_line.items.sku}</span>
                                                )}
                                            </td>
                                            <td className="py-3 text-center text-slate-400">
                                                {line.po_line?.quantity || '-'}
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="text-emerald-400 font-bold">{line.quantity_received}</span>
                                            </td>
                                            <td className="py-3 text-right text-slate-300">
                                                {formatters.formatCurrency(line.po_line?.unit_price || 0)}
                                            </td>
                                            <td className="py-3 text-right font-bold text-white">
                                                {formatters.formatCurrency(line.quantity_received * (line.po_line?.unit_price || 0))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-700">
                                        <td colSpan={2} className="py-4 text-right font-bold text-slate-400">
                                            Totals:
                                        </td>
                                        <td className="py-4 text-center font-bold text-emerald-400">
                                            {totalQuantityReceived}
                                        </td>
                                        <td></td>
                                        <td className="py-4 text-right font-black text-xl text-white">
                                            {formatters.formatCurrency(totalValue)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Stock Impact */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <CheckCircle size={20} className="text-emerald-400" />
                            Stock Impact
                        </h2>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle size={20} className="text-emerald-400 mt-0.5" />
                                <div>
                                    <p className="text-emerald-400 font-medium">Stock Updated Successfully</p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {totalQuantityReceived} units were added to {grn.warehouse?.name || 'warehouse'} inventory
                                        on {new Date(grn.created_at).toLocaleDateString()}.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GRNDetailPage;
