import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FileText, AlertCircle, Clock, CheckCircle,
    XCircle, Package, User, Calendar, Loader2, Truck, Building2
} from 'lucide-react';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import { useActivity, useShell, useBusinessSettings } from '@so360/shell-context';
import { toast, getErrorMessage } from '@so360/design-system';
import { poToDocumentData } from '../../utils/poToDocumentData';
import ProcurementTrace from '../../components/ProcurementTrace';

interface POLine {
    id: string;
    item_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    received_quantity: number;
    tax_code_id?: string;
    tax_rate?: number;
    tax_amount?: number;
    items?: { name: string; sku: string };
}

interface PO {
    id: string;
    po_number: string;
    status: string;
    total_amount: number;
    subtotal_amount?: number;
    tax_amount?: number;
    created_at: string;
    expected_delivery_date?: string;
    pr_id?: string;
    payment_terms?: string;
    delivery_terms?: string;
    incoterms?: string;
    shipping_address?: string;
    billing_address?: string;
    acknowledgement_status?: string;
    acknowledged_at?: string;
    acknowledged_by?: string;
    acknowledgement_note?: string;
    promised_delivery_date?: string;
    vendor?: { id: string; name: string; contact_email?: string };
    po_lines: POLine[];
}

const ACK_OPTIONS = [
    { value: 'accepted', label: 'Accepted', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { value: 'partially_accepted', label: 'Partially Accepted', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    { value: 'delayed', label: 'Delayed', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { value: 'rejected', label: 'Rejected', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
] as const;

const PODetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const { recordActivity } = useActivity();
    const shell = useShell();
    const { settings: businessSettings } = useBusinessSettings();
    const [po, setPo] = useState<PO | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusAction, setStatusAction] = useState<string | null>(null);
    const [showAckForm, setShowAckForm] = useState(false);
    const [ackSaving, setAckSaving] = useState(false);
    const [ackForm, setAckForm] = useState({
        acknowledgement_status: 'accepted',
        promised_delivery_date: '',
        acknowledged_by: '',
        acknowledgement_note: '',
    });

    useEffect(() => {
        if (id) fetchPO();
    }, [id]);

    const fetchPO = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await procurementService.getPODetail(id!);
            setPo(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load PO details');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'sent': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'acknowledged': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            case 'received': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'partially_received': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'cancelled': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            default: return 'bg-slate-700/50 text-slate-400 border-slate-600';
        }
    };

    // Use server-computed totals if available, fall back to line-level computation
    const subtotalAmount = po?.subtotal_amount != null && po.subtotal_amount > 0
        ? po.subtotal_amount
        : po?.po_lines?.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0) || 0;

    const taxAmount = po?.tax_amount != null && po.tax_amount > 0
        ? po.tax_amount
        : po?.po_lines?.reduce((sum, line) => sum + (line.tax_amount || 0), 0) || 0;

    const totalAmount = po?.total_amount || (subtotalAmount + taxAmount);

    const hasTax = taxAmount > 0;

    const totalReceived = po?.po_lines?.reduce((sum, line) =>
        sum + (line.received_quantity || 0), 0) || 0;

    const totalOrdered = po?.po_lines?.reduce((sum, line) =>
        sum + line.quantity, 0) || 0;

    const receiveProgress = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

    const handlePrint = async () => {
        if (!po) return;
        await shell?.printDocument?.('purchase_order', poToDocumentData(po, {
            currency: businessSettings?.base_currency || 'USD',
            seller: { name: shell?.currentOrg?.name || '' },
        }));
    };

    const handleStatusChange = async (status: 'sent' | 'closed' | 'cancelled') => {
        if (!po) return;

        const label = status.replace(/_/g, ' ');
        if (!window.confirm(`Change PO status to "${label}"?`)) return;

        setStatusAction(status);
        try {
            await procurementService.updatePOStatus(po.id, { status });
            if (status === 'cancelled') {
                recordActivity({ eventType: 'inventory.po.cancelled', eventCategory: 'financials', description: `Cancelled Purchase Order #${po.po_number}`, resourceType: 'po', resourceId: po.id }).catch(() => {});
            } else if (status === 'sent') {
                recordActivity({ eventType: 'inventory.po.updated', eventCategory: 'financials', description: `Sent Purchase Order #${po.po_number}`, resourceType: 'po', resourceId: po.id }).catch(() => {});
            } else if (status === 'closed') {
                recordActivity({ eventType: 'inventory.po.updated', eventCategory: 'financials', description: `Closed Purchase Order #${po.po_number}`, resourceType: 'po', resourceId: po.id }).catch(() => {});
            }
            await fetchPO();
        } catch (err: any) {
            toast.error(getErrorMessage(err, `Failed to update PO status to ${label}`));
        } finally {
            setStatusAction(null);
        }
    };

    const handleAcknowledge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!po) return;
        setAckSaving(true);
        try {
            await procurementService.acknowledgePO(po.id, {
                acknowledgement_status: ackForm.acknowledgement_status as any,
                promised_delivery_date: ackForm.promised_delivery_date || undefined,
                acknowledged_by: ackForm.acknowledged_by || undefined,
                acknowledgement_note: ackForm.acknowledgement_note || undefined,
            });
            recordActivity({
                eventType: 'inventory.po.acknowledged',
                eventCategory: 'financials',
                description: `Vendor acknowledgement recorded for PO #${po.po_number}`,
                resourceType: 'po',
                resourceId: po.id,
            }).catch(() => { });
            toast.success('Vendor acknowledgement recorded');
            setShowAckForm(false);
            await fetchPO();
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Failed to record acknowledgement'));
        } finally {
            setAckSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !po) {
        return (
            <div className="p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
                <h2 className="text-2xl font-bold text-slate-50 mb-2">{error || 'PO not found'}</h2>
                <button onClick={() => navigate('/procurement/po')} className="text-blue-400 hover:underline">
                    Back to Purchase Orders
                </button>
            </div>
        );
    }

    return (
        <div className="p-8">
            <button
                onClick={() => navigate('/procurement/po')}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-50 mb-6 transition-colors group"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to Purchase Orders
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - PO Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <FileText size={28} className="text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-50">
                                    #{po.po_number}
                                </h1>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(po.status)}`}>
                                    {po.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {po.vendor && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                    <Building2 size={16} className="text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-500 block">Vendor</span>
                                        <span className="text-sm text-slate-50">{po.vendor.name}</span>
                                        {po.vendor.contact_email && (
                                            <span className="block text-xs text-slate-500">{po.vendor.contact_email}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {po.pr_id && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                    <FileText size={16} className="text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-500 block">Source PR</span>
                                        <button
                                            onClick={() => navigate(`/procurement/pr/${po.pr_id}`)}
                                            className="text-sm text-blue-400 hover:text-blue-300"
                                        >
                                            #PR-{po.pr_id.slice(0, 8).toUpperCase()}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {po.expected_delivery_date && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                    <Truck size={16} className="text-slate-500" />
                                    <div>
                                        <span className="text-xs text-slate-500 block">Expected Delivery</span>
                                        <span className="text-sm text-slate-50">
                                            {formatters.formatDate(po.expected_delivery_date)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                <Clock size={16} className="text-slate-500" />
                                <div>
                                    <span className="text-xs text-slate-500 block">Created</span>
                                    <span className="text-sm text-slate-50">
                                        {formatters.formatDateTime(po.created_at)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Order Total with Tax Breakdown */}
                    <div className="bg-indigo-600 rounded-2xl p-6 text-white">
                        <span className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider">Order Total</span>
                        <div className="text-4xl font-black mt-2">
                            {formatters.formatCurrency(totalAmount)}
                        </div>
                        {hasTax ? (
                            <div className="mt-3 space-y-1">
                                <div className="flex justify-between text-sm text-indigo-200">
                                    <span>Subtotal</span>
                                    <span>{formatters.formatCurrency(subtotalAmount)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-indigo-200">
                                    <span>Tax</span>
                                    <span>{formatters.formatCurrency(taxAmount)}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-indigo-200">
                                {po.po_lines?.length || 0} line items
                            </p>
                        )}
                    </div>

                    {/* Receiving Progress */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                            <Package size={16} />
                            Receiving Progress
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Total Ordered</span>
                                <span className="text-slate-50 font-bold">{totalOrdered} units</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Received</span>
                                <span className="text-emerald-400 font-bold">{totalReceived} units</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${receiveProgress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    style={{ width: `${receiveProgress}%` }}
                                />
                            </div>
                            <div className="text-center text-xs text-slate-500">
                                {receiveProgress}% received
                            </div>
                        </div>
                    </div>

                    {/* Vendor Acknowledgement */}
                    {['sent', 'acknowledged', 'partially_received', 'received', 'closed'].includes(po.status) && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                                <CheckCircle size={16} />
                                Vendor Acknowledgement
                            </h3>

                            {po.acknowledgement_status && po.acknowledgement_status !== 'pending' ? (
                                <div className="space-y-3">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${ACK_OPTIONS.find(o => o.value === po.acknowledgement_status)?.className || 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
                                        {po.acknowledgement_status.replace(/_/g, ' ')}
                                    </span>
                                    {po.acknowledged_at && (
                                        <div className="text-xs text-slate-500">
                                            Acknowledged {formatters.formatDateTime(po.acknowledged_at)}
                                            {po.acknowledged_by ? ` by ${po.acknowledged_by}` : ''}
                                        </div>
                                    )}
                                    {po.promised_delivery_date && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Promised delivery</span>
                                            <span className="text-slate-50 font-bold">{formatters.formatDate(po.promised_delivery_date)}</span>
                                        </div>
                                    )}
                                    {po.acknowledgement_note && (
                                        <p className="text-xs text-slate-400 bg-slate-800/30 rounded-xl p-3">{po.acknowledgement_note}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">Awaiting the vendor's response to this order.</p>
                            )}

                            {['sent', 'acknowledged'].includes(po.status) && !showAckForm && (
                                <button
                                    onClick={() => setShowAckForm(true)}
                                    className="mt-4 w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    {po.acknowledgement_status && po.acknowledgement_status !== 'pending' ? 'Update acknowledgement' : 'Record acknowledgement'}
                                </button>
                            )}

                            {showAckForm && (
                                <form onSubmit={handleAcknowledge} className="mt-4 space-y-3 pt-4 border-t border-slate-800">
                                    <div className="space-y-1">
                                        <label htmlFor="ack-status" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vendor response</label>
                                        <select
                                            id="ack-status"
                                            value={ackForm.acknowledgement_status}
                                            onChange={e => setAckForm({ ...ackForm, acknowledgement_status: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        >
                                            {ACK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="ack-date" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Promised delivery date</label>
                                        <input
                                            id="ack-date"
                                            type="date"
                                            value={ackForm.promised_delivery_date}
                                            onChange={e => setAckForm({ ...ackForm, promised_delivery_date: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="ack-by" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acknowledged by</label>
                                        <input
                                            id="ack-by"
                                            type="text"
                                            placeholder="Vendor contact name"
                                            value={ackForm.acknowledged_by}
                                            onChange={e => setAckForm({ ...ackForm, acknowledged_by: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="ack-note" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                                        <textarea
                                            id="ack-note"
                                            value={ackForm.acknowledgement_note}
                                            onChange={e => setAckForm({ ...ackForm, acknowledgement_note: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 h-16 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={ackSaving}
                                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                        >
                                            {ackSaving && <Loader2 size={14} className="animate-spin" />}
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowAckForm(false)}
                                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    <ProcurementTrace type="po" id={po.id} />

                    {/* Commercial Terms */}
                    {(po.payment_terms || po.delivery_terms || po.incoterms || po.shipping_address || po.billing_address) && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                                <FileText size={16} />
                                Commercial Terms
                            </h3>
                            <div className="space-y-3 text-sm">
                                {po.payment_terms && (
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500">Payment terms</span>
                                        <span className="text-slate-50 text-right">{po.payment_terms}</span>
                                    </div>
                                )}
                                {po.delivery_terms && (
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500">Delivery terms</span>
                                        <span className="text-slate-50 text-right">{po.delivery_terms}</span>
                                    </div>
                                )}
                                {po.incoterms && (
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-500">Incoterms</span>
                                        <span className="text-slate-50 text-right">{po.incoterms}</span>
                                    </div>
                                )}
                                {po.shipping_address && (
                                    <div>
                                        <span className="text-slate-500 block mb-1">Ship to</span>
                                        <span className="text-slate-300 text-xs whitespace-pre-line">{po.shipping_address}</span>
                                    </div>
                                )}
                                {po.billing_address && (
                                    <div>
                                        <span className="text-slate-500 block mb-1">Bill to</span>
                                        <span className="text-slate-300 text-xs whitespace-pre-line">{po.billing_address}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Line Items */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Line Items */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
                            <Package size={20} className="text-indigo-400" />
                            Order Lines
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                        <th className="pb-3">Item</th>
                                        <th className="pb-3 text-center">Ordered</th>
                                        <th className="pb-3 text-center">Received</th>
                                        <th className="pb-3 text-right">Unit Price</th>
                                        <th className="pb-3 text-right">Tax</th>
                                        <th className="pb-3 text-right">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {po.po_lines?.map((line) => {
                                        const isFullyReceived = line.received_quantity >= line.quantity;
                                        const isPartiallyReceived = line.received_quantity > 0 && line.received_quantity < line.quantity;
                                        const lineTotal = line.quantity * line.unit_price;

                                        return (
                                            <tr key={line.id} className="border-b border-slate-800/50">
                                                <td className="py-3">
                                                    <span className="text-slate-50 font-medium">{line.items?.name || line.description}</span>
                                                    {line.items?.sku && (
                                                        <span className="block text-xs text-slate-500 font-mono">{line.items.sku}</span>
                                                    )}
                                                </td>
                                                <td className="py-3 text-center text-slate-300">{line.quantity}</td>
                                                <td className="py-3 text-center">
                                                    <span className={`font-medium ${isFullyReceived ? 'text-emerald-400' : isPartiallyReceived ? 'text-amber-400' : 'text-slate-500'}`}>
                                                        {line.received_quantity || 0}
                                                    </span>
                                                    {isFullyReceived && (
                                                        <CheckCircle size={14} className="inline ml-1 text-emerald-400" />
                                                    )}
                                                </td>
                                                <td className="py-3 text-right text-slate-300">
                                                    {formatters.formatCurrency(line.unit_price)}
                                                </td>
                                                <td className="py-3 text-right">
                                                    {line.tax_rate && line.tax_rate > 0 ? (
                                                        <div>
                                                            <span className="text-xs text-amber-400 font-bold">{line.tax_rate}%</span>
                                                            <span className="block text-xs text-slate-500">{formatters.formatCurrency(line.tax_amount || 0)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 text-right font-bold text-slate-50">
                                                    {formatters.formatCurrency(lineTotal)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    {hasTax ? (
                                        <>
                                            <tr className="border-t border-slate-700">
                                                <td colSpan={5} className="py-2 text-right text-slate-400 text-sm">
                                                    Subtotal:
                                                </td>
                                                <td className="py-2 text-right font-semibold text-slate-300">
                                                    {formatters.formatCurrency(subtotalAmount)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colSpan={5} className="py-2 text-right text-amber-400 text-sm font-semibold">
                                                    Tax:
                                                </td>
                                                <td className="py-2 text-right font-semibold text-amber-400">
                                                    {formatters.formatCurrency(taxAmount)}
                                                </td>
                                            </tr>
                                            <tr className="border-t border-slate-600">
                                                <td colSpan={5} className="py-4 text-right font-bold text-slate-400">
                                                    Grand Total:
                                                </td>
                                                <td className="py-4 text-right font-black text-xl text-slate-50">
                                                    {formatters.formatCurrency(totalAmount)}
                                                </td>
                                            </tr>
                                        </>
                                    ) : (
                                        <tr className="border-t border-slate-700">
                                            <td colSpan={5} className="py-4 text-right font-bold text-slate-400">
                                                Grand Total:
                                            </td>
                                            <td className="py-4 text-right font-black text-xl text-slate-50">
                                                {formatters.formatCurrency(totalAmount)}
                                            </td>
                                        </tr>
                                    )}
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-slate-50 mb-4">Actions</h2>
                        <div className="flex flex-wrap gap-3">
                            {po.status === 'draft' && (
                                <>
                                    <button
                                        onClick={() => handleStatusChange('sent')}
                                        disabled={!!statusAction}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                                    >
                                        {statusAction === 'sent' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                        Send PO
                                    </button>
                                    <button
                                        onClick={() => handleStatusChange('cancelled')}
                                        disabled={!!statusAction}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                                    >
                                        {statusAction === 'cancelled' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                        Cancel PO
                                    </button>
                                </>
                            )}
                            {po.status === 'sent' && (
                                <>
                                    <button
                                        onClick={() => handleStatusChange('cancelled')}
                                        disabled={!!statusAction || totalReceived > 0}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                                        title={totalReceived > 0 ? 'Cannot cancel after receiving goods' : ''}
                                    >
                                        {statusAction === 'cancelled' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                        Cancel PO
                                    </button>
                                    {receiveProgress === 100 && (
                                        <button
                                            onClick={() => handleStatusChange('closed')}
                                            disabled={!!statusAction}
                                            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-60 text-slate-50 rounded-lg font-medium transition-all flex items-center gap-2"
                                        >
                                            {statusAction === 'closed' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                            Close PO
                                        </button>
                                    )}
                                </>
                            )}
                            {po.status === 'partially_received' && (
                                <button
                                    onClick={() => handleStatusChange('closed')}
                                    disabled={!!statusAction}
                                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-60 text-slate-50 rounded-lg font-medium transition-all flex items-center gap-2"
                                >
                                    {statusAction === 'closed' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                    Close PO
                                </button>
                            )}
                            {po.status === 'received' && (
                                <button
                                    onClick={() => handleStatusChange('closed')}
                                    disabled={!!statusAction}
                                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-60 text-slate-50 rounded-lg font-medium transition-all flex items-center gap-2"
                                >
                                    {statusAction === 'closed' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                    Close PO
                                </button>
                            )}
                            {(po.status === 'sent' || po.status === 'partially_received') && (
                                <button
                                    onClick={() => navigate('/procurement/grn')}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                                >
                                    <Package size={16} />
                                    Record GRN
                                </button>
                            )}
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-50 rounded-lg font-medium transition-all flex items-center gap-2"
                            >
                                <FileText size={16} />
                                Print PO
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PODetailPage;
