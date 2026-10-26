import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ShoppingCart } from 'lucide-react';
import { procurementService } from '../../services/procurementService';
import { useActivity } from '@so360/shell-context';
import {
    toast, getErrorMessage, useConfirm, DetailPageTemplate, Button, Badge, StatusBadge, SectionCard, DescriptionList,
    DataTable, EmptyState, Grid,
} from '@so360/design-system';
import { useInventoryFormatters } from '../../utils/formatters';

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
    const [confirm, confirmDialog] = useConfirm();
    const { id } = useParams();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const formatters = useInventoryFormatters();
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
            setError(err?.status === 404 || err?.status === 400 ? 'PR not found' : (err.message || 'Failed to load PR details'));
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
            toast.info('Delegation feature coming soon!');
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
                toast.warning('This PR has been fully converted. All line quantities are already covered by existing Purchase Orders.');
                return;
            }
            navigate('/procurement/po', { state: { convertFromPR: payload } });
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Failed to prepare conversion'));
        } finally {
            setIsLoadingConversion(false);
        }
    };

    const handleClosePR = async () => {
        if (!id) return;
        if (!(await confirm({ title: 'Close requisition', message: 'Are you sure you want to close this Purchase Requisition? ' +
            'Closed PRs cannot be reopened or converted to additional POs.', intent: 'danger', confirmLabel: 'Close' }))) return;

        setIsLoading(true);
        try {
            await procurementService.closePR(id);
            await fetchPR(); // Refresh data
            toast.success('Purchase Requisition closed successfully');
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Failed to close PR'));
        } finally {
            setIsLoading(false);
        }
    };

    const STATUS_TONES: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'info'> = {
        approved: 'success', pending_approval: 'warning', rejected: 'danger', converted_to_po: 'primary',
        partially_converted: 'info', fully_converted: 'primary', closed: 'neutral',
    };

    const canConvert = pr && ['approved', 'partially_converted', 'converted_to_po'].includes(pr.status);
    const canClose = pr && ['approved', 'partially_converted', 'fully_converted', 'converted_to_po'].includes(pr.status);

    const totalAmount = pr?.pr_lines?.reduce((sum, line) =>
        sum + (line.quantity * line.estimated_unit_price), 0) || 0;

    if (isLoading) {
        return <DetailPageTemplate title="Purchase Requisition" loading onBack={() => navigate('/procurement/pr')} backLabel="Back to Purchase Requisitions">{null}</DetailPageTemplate>;
    }

    if (error || !pr) {
        // Keep the page shell (title) around the not-found state so the route settles with a real page, not a bare fragment.
        return (
            <DetailPageTemplate title="Purchase Requisition">
                <EmptyState
                    title={error || 'PR not found'}
                    action={{ label: 'Back to PRs', onClick: () => navigate('/procurement/pr') }}
                />
            </DetailPageTemplate>
        );
    }

    const gates = pr.approval_gates || [];
    const firstMeta = gates[0]?.metadata;
    const statusText = pr.status.replace(/_/g, ' ');

    const overview = [
        { label: 'Requester', value: pr.requester?.full_name || 'System' },
        { label: 'Required Date', value: pr.required_date ? formatters.formatDate(pr.required_date) : 'Not set' },
        { label: 'Created', value: formatters.formatDateTime(pr.created_at) },
        pr.description ? { label: 'Description', value: pr.description } : null,
        { label: 'Estimated Total', value: `${formatters.formatCurrency(totalAmount)} (${pr.pr_lines?.length || 0} line items)` },
    ].filter(Boolean) as { label: string; value: React.ReactNode }[];

    const primaryAction = canConvert ? (
        <Button onClick={handleCreatePO} disabled={isLoadingConversion}>
            <ShoppingCart size={16} /> {isLoadingConversion ? 'Preparing...' : 'Create PO from this PR'}
        </Button>
    ) : undefined;

    const secondaryActions = canClose && pr.status !== 'closed'
        ? [<Button key="close" variant="secondary" onClick={handleClosePR} disabled={isLoading}>Close PR</Button>]
        : undefined;

    return (
        <DetailPageTemplate
            title={`#PR-${pr.id.slice(0, 8).toUpperCase()}`}
            status={<StatusBadge status={statusText} map={{ [statusText]: STATUS_TONES[pr.status] || 'neutral' }} />}
            onBack={() => navigate('/procurement/pr')}
            backLabel="Back to Purchase Requisitions"
            primaryAction={primaryAction}
            secondaryActions={secondaryActions}
        >
            {confirmDialog}
            <Grid>
                <Grid.Item span={4} className="space-y-6">
                    <SectionCard title="Overview"><DescriptionList items={overview} /></SectionCard>
                </Grid.Item>

                <Grid.Item span={8} className="space-y-6">
                    <SectionCard title="Requested Items">
                        <DataTable
                            data-testid="pr-lines-table"
                            rows={pr.pr_lines || []}
                            rowKey={(line: PRLine) => line.id}
                            columns={[
                                {
                                    key: 'item', header: 'Item',
                                    render: (line: PRLine) => (
                                        <>
                                            <span className="text-fg font-medium">{line.items?.name || line.description}</span>
                                            {line.items?.sku && <span className="block text-xs text-fg-subtle font-mono">{line.items.sku}</span>}
                                        </>
                                    ),
                                },
                                { key: 'qty', header: 'Qty', align: 'center', render: (line: PRLine) => line.quantity },
                                {
                                    key: 'converted', header: 'Converted', align: 'center',
                                    render: (line: PRLine) => {
                                        const converted = line.converted_quantity || 0;
                                        const tone = converted >= line.quantity ? 'text-success' : converted > 0 ? 'text-warning' : 'text-fg-subtle';
                                        return <span className={`font-mono font-bold text-sm ${tone}`}>{converted}/{line.quantity}</span>;
                                    },
                                },
                                { key: 'price', header: 'Est. Price', align: 'right', render: (line: PRLine) => formatters.formatCurrency(line.estimated_unit_price) },
                                {
                                    key: 'subtotal', header: 'Subtotal', align: 'right',
                                    render: (line: PRLine) => <span className="font-bold">{formatters.formatCurrency(line.quantity * line.estimated_unit_price)}</span>,
                                },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard
                        title={`Approval Workflow${firstMeta?.policy_name ? ` (${firstMeta.policy_name})` : ''}`}
                        actions={firstMeta?.approval_mode ? <Badge tone={firstMeta.approval_mode === 'PARALLEL' ? 'info' : 'primary'}>{firstMeta.approval_mode}</Badge> : undefined}
                    >
                        <div className="space-y-3">
                            {gates.length > 0 ? gates.map((gate, idx) => {
                                const slaDeadline = gate.metadata?.sla_deadline ? new Date(gate.metadata.sla_deadline) : null;
                                const now = new Date();
                                const isOverdue = !!slaDeadline && now > slaDeadline && gate.status === 'pending';
                                const hoursRemaining = slaDeadline
                                    ? Math.max(0, Math.floor((slaDeadline.getTime() - now.getTime()) / 3600000))
                                    : null;
                                const GateIcon = gate.status === 'approved' ? CheckCircle : gate.status === 'rejected' ? XCircle : Clock;
                                const iconTone = gate.status === 'approved' ? 'text-success' : gate.status === 'rejected' || isOverdue ? 'text-danger' : 'text-warning';

                                return (
                                    <div key={idx} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${isOverdue ? 'border-danger' : 'border-line'}`}>
                                        <div className="flex items-center gap-3 flex-1">
                                            <GateIcon size={20} className={iconTone} />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-fg font-medium">{gate.metadata?.description || `Level ${gate.gate_level}`}</span>
                                                    {gate.metadata?.fallback && <Badge tone="warning">DEFAULT</Badge>}
                                                </div>
                                                {gate.approver && (
                                                    <span className="block text-xs text-fg-subtle">
                                                        {gate.approver.full_name}
                                                        {gate.approved_at && ` - ${formatters.formatDate(gate.approved_at)}`}
                                                    </span>
                                                )}
                                                {gate.comments && <span className="block text-xs text-fg-muted italic mt-1">"{gate.comments}"</span>}
                                                {gate.status === 'pending' && gate.metadata?.sla_hours && (
                                                    <div className={`mt-2 text-xs ${isOverdue ? 'text-danger' : hoursRemaining && hoursRemaining < 8 ? 'text-warning' : 'text-fg-muted'}`}>
                                                        {isOverdue
                                                            ? <span className="font-bold">OVERDUE by {Math.abs(hoursRemaining || 0)}h</span>
                                                            : <span>Due in {hoursRemaining}h (SLA: {gate.metadata.sla_hours}h)</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {gate.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => handleApprove(gate.gate_name)} disabled={isApproving}>Approve</Button>
                                                <Button size="sm" variant="danger" onClick={() => handleReject(gate.gate_name)} disabled={isApproving}>Reject</Button>
                                                {gate.metadata?.can_delegate && (
                                                    <Button size="sm" variant="secondary" onClick={() => handleDelegate(gate.id)} disabled={isApproving}>Delegate</Button>
                                                )}
                                            </div>
                                        )}
                                        {isOverdue && gate.metadata?.escalation_role_id && <Badge tone="danger">Will escalate</Badge>}
                                    </div>
                                );
                            }) : (
                                <p className="text-center py-6 text-fg-subtle">No approval workflow configured</p>
                            )}
                        </div>
                        {firstMeta?.approval_mode === 'PARALLEL' && (
                            <p className="mt-4 text-xs text-fg-muted">
                                <span className="font-bold">Parallel Approval:</span> All steps can be approved simultaneously.
                            </p>
                        )}
                    </SectionCard>

                    {pr.linked_pos && pr.linked_pos.length > 0 && (
                        <SectionCard title="Linked Purchase Orders">
                            <DataTable
                                data-testid="pr-linked-pos"
                                rows={pr.linked_pos}
                                rowKey={(po: LinkedPO) => po.id}
                                onRowClick={(po: LinkedPO) => navigate(`/procurement/po/${po.id}`)}
                                columns={[
                                    {
                                        key: 'po', header: 'PO',
                                        render: (po: LinkedPO) => (
                                            <>
                                                <span className="text-fg font-bold">#{po.po_number}</span>
                                                <span className="block text-xs text-fg-subtle">Created {formatters.formatDate(po.created_at)}</span>
                                            </>
                                        ),
                                    },
                                    {
                                        key: 'status', header: 'Status',
                                        render: (po: LinkedPO) => <Badge tone={po.status === 'sent' ? 'primary' : po.status === 'received' ? 'success' : 'neutral'}>{po.status}</Badge>,
                                    },
                                    {
                                        key: 'total', header: 'Total', align: 'right',
                                        render: (po: LinkedPO) => <span className="font-mono font-bold">{formatters.formatCurrency(parseFloat(String(po.total_amount || 0)))}</span>,
                                    },
                                ]}
                            />
                        </SectionCard>
                    )}
                </Grid.Item>
            </Grid>
        </DetailPageTemplate>
    );
};

export default PRDetailPage;
