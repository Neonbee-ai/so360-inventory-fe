import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FileText, AlertCircle, Clock, CheckCircle,
    XCircle, Package, User, Calendar, Loader2, ShoppingCart, ExternalLink
} from 'lucide-react';
import { procurementService } from '../../services/procurementService';
import { useActivity } from '@so360/shell-context';

interface PRLine {
    id: string;
    item_id: string;
    description: string;
    quantity: number;
    estimated_unit_price: number;
    converted_quantity?: number;
    remaining_quantity?: number;
    items?: { name: string; sku: string };
}

interface LinkedPO {
    id: string;
    po_number: string;
    status: string;
    total_amount: number;
    created_at: string;
}

interface ApprovalGate {
    id: string;
    gate_name: string;
    gate_level: number;
    status: 'pending' | 'approved' | 'rejected';
    approver?: { full_name: string };
    approver_role_id?: string;
    approved_at?: string;
    comments?: string;
    metadata?: {
        level: number;
        description: string;
        policy_id?: string;
        policy_name?: string;
        approval_mode?: 'SEQUENTIAL' | 'PARALLEL';
        sla_hours?: number;
        sla_deadline?: string;
        escalation_role_id?: string;
        can_delegate?: boolean;
        fallback?: boolean;
    };
}

interface PR {
    id: string;
    status: string;
    description: string;
    required_date: string;
    created_at: string;
    requester?: { full_name: string; email: string };
    pr_lines: PRLine[];
    linked_pos?: LinkedPO[];
    approval_gates?: ApprovalGate[];
}

const PRDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const [pr, setPr] = useState<PR | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [isLoadingConversion, setIsLoadingConversion] = useState(false);

    useEffect(() => {
        if (id) fetchPR();
    }, [id]);

    const fetchPR = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await procurementService.getPRDetail(id!);
            setPr(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load PR details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (gateName: string) => {
        if (!id) return;
        setIsApproving(true);
        try {
            await procurementService.approvePR(id, {
                gate_name: gateName,
                status: 'approved',
                comments: 'Approved'
            });
            recordActivity({ eventType: 'inventory.pr.approved', eventCategory: 'financials', description: `Approved PR gate "${gateName}"`, resourceType: 'pr', resourceId: id }).catch(() => {});
            fetchPR();
        } catch (err: any) {
            setError(err.message || 'Failed to approve');
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async (gateName: string) => {
        const reason = prompt('Enter rejection reason:');
        if (!reason || !id) return;
        setIsApproving(true);
        try {
            await procurementService.approvePR(id, {
                gate_name: gateName,
                status: 'rejected',
                comments: reason
            });
            fetchPR();
        } catch (err: any) {
            setError(err.message || 'Failed to reject');
        } finally {
            setIsApproving(false);
        }
    };

    const handleDelegate = async (gateId: string) => {
        const targetEmail = prompt('Enter email of user to delegate to:');
        if (!targetEmail || !id) return;

        setIsApproving(true);
        try {
            // Note: Delegation API not yet implemented, placeholder for future
            alert('Delegation feature coming soon!');
            // await procurementService.delegatePRApproval(id, {
            //     gate_id: gateId,
            //     delegate_to_email: targetEmail,
            //     reason: 'Delegated approval'
            // });
            // fetchPR();
        } catch (err: any) {
            setError(err.message || 'Failed to delegate');
        } finally {
            setIsApproving(false);
        }
    };

    const handleCreatePO = async () => {
        if (!id) return;
        setIsLoadingConversion(true);
        try {
            const payload = await procurementService.getConversionPayload(id);
            if (payload.is_fully_converted) {
                alert('This PR has been fully converted. All line quantities are already covered by existing Purchase Orders.');
                return;
            }
            navigate('/procurement/po', { state: { convertFromPR: payload } });
        } catch (err: any) {
            alert(err.message || 'Failed to prepare conversion');
        } finally {
            setIsLoadingConversion(false);
        }
    };

    const handleClosePR = async () => {
        if (!id) return;
        const confirmed = window.confirm(
            'Are you sure you want to close this Purchase Requisition? ' +
            'Closed PRs cannot be reopened or converted to additional POs.'
        );
        if (!confirmed) return;

        setIsLoading(true);
        try {
            await procurementService.closePR(id);
            await fetchPR(); // Refresh data
            alert('Purchase Requisition closed successfully');
        } catch (err: any) {
            alert(err.message || 'Failed to close PR');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'pending_approval': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            case 'converted_to_po': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'partially_converted': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            case 'fully_converted': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'closed': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            default: return 'bg-slate-700/50 text-slate-400 border-slate-600';
        }
    };

    const canConvert = pr && ['approved', 'partially_converted', 'converted_to_po'].includes(pr.status);
    const canClose = pr && ['approved', 'partially_converted', 'fully_converted', 'converted_to_po'].includes(pr.status);

    const totalAmount = pr?.pr_lines?.reduce((sum, line) =>
        sum + (line.quantity * line.estimated_unit_price), 0) || 0;

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !pr) {
        return (
            <div className="p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">{error || 'PR not found'}</h2>
                <button onClick={() => navigate('/procurement/pr')} className="text-blue-400 hover:underline">
                    Back to PRs
                </button>
            </div>
        );
    }

    return (
        <div className="p-8">
            <button
                onClick={() => navigate('/procurement/pr')}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors group"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to Purchase Requisitions
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - PR Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <FileText size={28} className="text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">
                                    #PR-{pr.id.slice(0, 8).toUpperCase()}
                                </h1>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(pr.status)}`}>
                                    {pr.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                <User size={16} className="text-slate-500" />
                                <div>
                                    <span className="text-xs text-slate-500 block">Requester</span>
                                    <span className="text-sm text-white">{pr.requester?.full_name || 'System'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                <Calendar size={16} className="text-slate-500" />
                                <div>
                                    <span className="text-xs text-slate-500 block">Required Date</span>
                                    <span className="text-sm text-white">
                                        {pr.required_date ? new Date(pr.required_date).toLocaleDateString() : 'Not set'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                                <Clock size={16} className="text-slate-500" />
                                <div>
                                    <span className="text-xs text-slate-500 block">Created</span>
                                    <span className="text-sm text-white">
                                        {new Date(pr.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {pr.description && (
                            <div className="mt-6 pt-6 border-t border-slate-800">
                                <span className="text-xs text-slate-500 block mb-2">Description</span>
                                <p className="text-sm text-slate-300">{pr.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Estimated Total */}
                    <div className="bg-blue-600 rounded-2xl p-6 text-white">
                        <span className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">Estimated Total</span>
                        <div className="text-4xl font-black mt-2">
                            ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <p className="mt-2 text-sm text-blue-200">
                            {pr.pr_lines?.length || 0} line items
                        </p>
                    </div>

                    {/* Create PO Button */}
                    {canConvert && (
                        <button
                            onClick={handleCreatePO}
                            disabled={isLoadingConversion}
                            className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center justify-center gap-3"
                        >
                            {isLoadingConversion ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <ShoppingCart size={20} />
                            )}
                            {isLoadingConversion ? 'Preparing...' : 'Create PO from this PR'}
                        </button>
                    )}

                    {/* Close PR Button */}
                    {canClose && pr.status !== 'closed' && (
                        <button
                            onClick={handleClosePR}
                            disabled={isLoading}
                            className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-50 rounded-2xl font-bold transition-all"
                        >
                            Close PR
                        </button>
                    )}
                </div>

                {/* Right Column - Lines & Approvals */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Line Items */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Package size={20} className="text-blue-400" />
                            Requested Items
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                        <th className="pb-3">Item</th>
                                        <th className="pb-3 text-center">Qty</th>
                                        <th className="pb-3 text-center">Converted</th>
                                        <th className="pb-3 text-right">Est. Price</th>
                                        <th className="pb-3 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pr.pr_lines?.map((line) => {
                                        const converted = line.converted_quantity || 0;
                                        const convColor = converted >= line.quantity
                                            ? 'text-emerald-400'
                                            : converted > 0
                                                ? 'text-amber-400'
                                                : 'text-slate-600';

                                        return (
                                            <tr key={line.id} className="border-b border-slate-800/50">
                                                <td className="py-3">
                                                    <span className="text-white font-medium">{line.items?.name || line.description}</span>
                                                    {line.items?.sku && (
                                                        <span className="block text-xs text-slate-500 font-mono">{line.items.sku}</span>
                                                    )}
                                                </td>
                                                <td className="py-3 text-center text-slate-300">{line.quantity}</td>
                                                <td className="py-3 text-center">
                                                    <span className={`font-mono font-bold text-sm ${convColor}`}>
                                                        {converted}/{line.quantity}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right text-slate-300">
                                                    ${line.estimated_unit_price.toFixed(2)}
                                                </td>
                                                <td className="py-3 text-right font-bold text-white">
                                                    ${(line.quantity * line.estimated_unit_price).toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Approval Gates */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        {/* Header with policy name and mode */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <CheckCircle size={20} className="text-blue-400" />
                                Approval Workflow
                                {pr.approval_gates?.[0]?.metadata?.policy_name && (
                                    <span className="text-xs font-normal text-slate-400 ml-2">
                                        ({pr.approval_gates[0].metadata.policy_name})
                                    </span>
                                )}
                            </h2>
                            {pr.approval_gates?.[0]?.metadata?.approval_mode && (
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                    pr.approval_gates[0].metadata.approval_mode === 'PARALLEL'
                                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}>
                                    {pr.approval_gates[0].metadata.approval_mode}
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            {pr.approval_gates && pr.approval_gates.length > 0 ? (
                                pr.approval_gates.map((gate, idx) => {
                                    const slaDeadline = gate.metadata?.sla_deadline
                                        ? new Date(gate.metadata.sla_deadline)
                                        : null;
                                    const now = new Date();
                                    const isOverdue = slaDeadline && now > slaDeadline && gate.status === 'pending';
                                    const hoursRemaining = slaDeadline
                                        ? Math.max(0, Math.floor((slaDeadline.getTime() - now.getTime()) / 3600000))
                                        : null;

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center justify-between p-4 rounded-xl border ${
                                                isOverdue
                                                    ? 'bg-rose-900/20 border-rose-500/30'
                                                    : 'bg-slate-800/30 border-slate-700/30'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 flex-1">
                                                {gate.status === 'approved' ? (
                                                    <CheckCircle size={20} className="text-emerald-400" />
                                                ) : gate.status === 'rejected' ? (
                                                    <XCircle size={20} className="text-rose-400" />
                                                ) : isOverdue ? (
                                                    <AlertCircle size={20} className="text-rose-400 animate-pulse" />
                                                ) : (
                                                    <Clock size={20} className="text-amber-400" />
                                                )}

                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium">
                                                            {gate.metadata?.description || `Level ${gate.gate_level}`}
                                                        </span>
                                                        {gate.metadata?.fallback && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                DEFAULT
                                                            </span>
                                                        )}
                                                    </div>

                                                    {gate.approver && (
                                                        <span className="block text-xs text-slate-500">
                                                            {gate.approver.full_name}
                                                            {gate.approved_at && ` - ${new Date(gate.approved_at).toLocaleDateString()}`}
                                                        </span>
                                                    )}

                                                    {gate.comments && (
                                                        <span className="block text-xs text-slate-400 italic mt-1">
                                                            "{gate.comments}"
                                                        </span>
                                                    )}

                                                    {/* SLA Status */}
                                                    {gate.status === 'pending' && gate.metadata?.sla_hours && (
                                                        <div className={`mt-2 flex items-center gap-2 text-xs ${
                                                            isOverdue ? 'text-rose-400' :
                                                            hoursRemaining && hoursRemaining < 8 ? 'text-amber-400' :
                                                            'text-slate-400'
                                                        }`}>
                                                            <Clock size={12} />
                                                            {isOverdue ? (
                                                                <span className="font-bold">OVERDUE by {Math.abs(hoursRemaining || 0)}h</span>
                                                            ) : (
                                                                <span>Due in {hoursRemaining}h (SLA: {gate.metadata.sla_hours}h)</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            {gate.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleApprove(gate.gate_name)}
                                                        disabled={isApproving}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                                                    >
                                                        {isApproving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(gate.gate_name)}
                                                        disabled={isApproving}
                                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                                                    >
                                                        <XCircle size={14} />
                                                        Reject
                                                    </button>
                                                    {gate.metadata?.can_delegate && (
                                                        <button
                                                            onClick={() => handleDelegate(gate.id)}
                                                            disabled={isApproving}
                                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                                                        >
                                                            <User size={14} />
                                                            Delegate
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Escalation Warning */}
                                            {isOverdue && gate.metadata?.escalation_role_id && (
                                                <div className="ml-4 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20">
                                                    <span className="text-[10px] font-bold text-rose-400 uppercase">
                                                        Will escalate
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-6 text-slate-500">
                                    <Clock size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>No approval workflow configured</p>
                                </div>
                            )}
                        </div>

                        {/* Parallel Mode Notice */}
                        {pr.approval_gates?.[0]?.metadata?.approval_mode === 'PARALLEL' && (
                            <div className="mt-4 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                                <p className="text-xs text-cyan-400">
                                    <span className="font-bold">Parallel Approval:</span> All steps can be approved simultaneously.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Linked Purchase Orders */}
                    {pr.linked_pos && pr.linked_pos.length > 0 && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <ShoppingCart size={20} className="text-indigo-400" />
                                Linked Purchase Orders
                            </h2>
                            <div className="space-y-3">
                                {pr.linked_pos.map((po) => (
                                    <div
                                        key={po.id}
                                        onClick={() => navigate(`/procurement/po/${po.id}`)}
                                        className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/30 hover:border-indigo-500/30 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                                <FileText size={18} className="text-indigo-400" />
                                            </div>
                                            <div>
                                                <span className="text-white font-bold">#{po.po_number}</span>
                                                <span className="block text-xs text-slate-500">
                                                    Created {new Date(po.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border
                                                ${po.status === 'sent' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    po.status === 'received' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        'bg-slate-700/50 text-slate-400 border-slate-600'}`}
                                            >
                                                {po.status}
                                            </span>
                                            <span className="text-white font-bold font-mono">
                                                ${parseFloat(String(po.total_amount || 0)).toLocaleString()}
                                            </span>
                                            <ExternalLink size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PRDetailPage;
