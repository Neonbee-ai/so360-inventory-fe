import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import { useActivity, useShell, useBusinessSettings } from '@so360/shell-context';
import {
    toast, getErrorMessage, useConfirm, DetailPageTemplate, Button, Badge, StatusBadge, SectionCard, DescriptionList,
    DataTable, EmptyState, Select, TextField, Textarea, Progress,
} from '@so360/design-system';
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

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const ACK_OPTIONS = [
    { value: 'accepted', label: 'Accepted', tone: 'success' as Tone },
    { value: 'partially_accepted', label: 'Partially Accepted', tone: 'info' as Tone },
    { value: 'delayed', label: 'Delayed', tone: 'warning' as Tone },
    { value: 'rejected', label: 'Rejected', tone: 'danger' as Tone },
] as const;

const STATUS_TONES: Record<string, Tone> = {
    sent: 'primary', acknowledged: 'info', received: 'success', partially_received: 'warning', cancelled: 'danger',
};

const PODetailPage = () => {
    const [confirm, confirmDialog] = useConfirm();
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
        if (!(await confirm({ title: 'Change PO status', message: `Change PO status to "${label}"?`, intent: 'default', confirmLabel: 'Change' }))) return;

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

    const backToList = () => navigate('/procurement/po');

    if (error || (!isLoading && !po)) {
        return (
            <EmptyState
                title={error || 'PO not found'}
                action={{ label: 'Back to Purchase Orders', onClick: backToList }}
            />
        );
    }

    if (isLoading || !po) {
        return <DetailPageTemplate title="Purchase Order" loading onBack={backToList} backLabel="Back to Purchase Orders">{null}</DetailPageTemplate>;
    }

    const statusText = po.status.replace(/_/g, ' ');
    const busy = !!statusAction;
    const hasAck = !!po.acknowledgement_status && po.acknowledgement_status !== 'pending';
    const ackOption = ACK_OPTIONS.find(o => o.value === po.acknowledgement_status);

    const closeLabel = (key: string) => (statusAction === key ? 'Working...' : null);
    const closeBtn = (variant: 'primary' | 'secondary') => (
        <Button key="close" variant={variant} onClick={() => handleStatusChange('closed')} disabled={busy}>
            {closeLabel('closed') ?? 'Close PO'}
        </Button>
    );

    let primaryAction: React.ReactNode = null;
    const secondaryActions: React.ReactNode[] = [];
    if (po.status === 'draft') {
        primaryAction = (
            <Button onClick={() => handleStatusChange('sent')} disabled={busy}>{closeLabel('sent') ?? 'Send PO'}</Button>
        );
    } else if (po.status === 'sent' || po.status === 'partially_received') {
        primaryAction = <Button onClick={() => navigate('/procurement/grn')}>Record GRN</Button>;
    } else if (po.status === 'received') {
        primaryAction = closeBtn('primary');
    }
    if (po.status === 'draft' || po.status === 'sent') {
        secondaryActions.push(
            <Button
                key="cancel"
                variant="danger"
                onClick={() => handleStatusChange('cancelled')}
                disabled={busy || (po.status === 'sent' && totalReceived > 0)}
                title={po.status === 'sent' && totalReceived > 0 ? 'Cannot cancel after receiving goods' : undefined}
            >
                {closeLabel('cancelled') ?? 'Cancel PO'}
            </Button>,
        );
    }
    if ((po.status === 'sent' && receiveProgress === 100) || po.status === 'partially_received') {
        secondaryActions.push(closeBtn('secondary'));
    }
    secondaryActions.push(<Button key="print" variant="secondary" onClick={handlePrint}>Print PO</Button>);

    const overviewItems = [
        ...(po.vendor ? [{
            label: 'Vendor',
            value: (
                <>
                    <span>{po.vendor.name}</span>
                    {po.vendor.contact_email && <span className="block text-xs text-fg-subtle">{po.vendor.contact_email}</span>}
                </>
            ),
        }] : []),
        ...(po.pr_id ? [{
            label: 'Source PR',
            value: (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/pr/${po.pr_id}`)}>
                    #PR-{po.pr_id.slice(0, 8).toUpperCase()}
                </Button>
            ),
        }] : []),
        ...(po.expected_delivery_date ? [{ label: 'Expected Delivery', value: formatters.formatDate(po.expected_delivery_date) }] : []),
        { label: 'Created', value: formatters.formatDateTime(po.created_at) },
    ];

    const columns = [
        {
            key: 'item', header: 'Item',
            render: (line: POLine) => (
                <>
                    <span className="font-medium">{line.items?.name || line.description}</span>
                    {line.items?.sku && <span className="block text-xs text-fg-subtle font-mono">{line.items.sku}</span>}
                </>
            ),
        },
        { key: 'ordered', header: 'Ordered', align: 'center' as const, render: (line: POLine) => line.quantity },
        {
            key: 'received', header: 'Received', align: 'center' as const,
            render: (line: POLine) => {
                const full = line.received_quantity >= line.quantity;
                const partial = line.received_quantity > 0 && line.received_quantity < line.quantity;
                return (
                    <>
                        <span>{line.received_quantity || 0}</span>
                        {full && <Badge tone="success" size="sm">Complete</Badge>}
                        {partial && <Badge tone="warning" size="sm">Partial</Badge>}
                    </>
                );
            },
        },
        { key: 'unit_price', header: 'Unit Price', align: 'right' as const, render: (line: POLine) => formatters.formatCurrency(line.unit_price) },
        {
            key: 'tax', header: 'Tax', align: 'right' as const,
            render: (line: POLine) => (line.tax_rate && line.tax_rate > 0 ? (
                <>
                    <span className="text-xs">{line.tax_rate}%</span>
                    <span className="block text-xs text-fg-subtle">{formatters.formatCurrency(line.tax_amount || 0)}</span>
                </>
            ) : <span className="text-xs text-fg-subtle">—</span>),
        },
        { key: 'total', header: 'Line Total', align: 'right' as const, render: (line: POLine) => formatters.formatCurrency(line.quantity * line.unit_price) },
    ];

    const termItems = [
        po.payment_terms && { label: 'Payment terms', value: po.payment_terms },
        po.delivery_terms && { label: 'Delivery terms', value: po.delivery_terms },
        po.incoterms && { label: 'Incoterms', value: po.incoterms },
        po.shipping_address && { label: 'Ship to', value: <span className="whitespace-pre-line">{po.shipping_address}</span> },
        po.billing_address && { label: 'Bill to', value: <span className="whitespace-pre-line">{po.billing_address}</span> },
    ].filter(Boolean) as { label: string; value: React.ReactNode }[];

    const sidePanel = (
        <div className="space-y-6">
            <SectionCard title="Order Total">
                <div className="text-3xl font-bold">{formatters.formatCurrency(totalAmount)}</div>
                {hasTax ? (
                    <DescriptionList items={[
                        { label: 'Subtotal', value: formatters.formatCurrency(subtotalAmount) },
                        { label: 'Tax', value: formatters.formatCurrency(taxAmount) },
                    ]} />
                ) : (
                    <p className="mt-2 text-sm text-fg-muted">{po.po_lines?.length || 0} line items</p>
                )}
            </SectionCard>

            <SectionCard title="Receiving Progress">
                <DescriptionList items={[
                    { label: 'Total Ordered', value: `${totalOrdered} units` },
                    { label: 'Received', value: `${totalReceived} units` },
                ]} />
                <Progress value={receiveProgress} max={100} />
                <div className="text-center text-xs text-fg-subtle">{receiveProgress}% received</div>
            </SectionCard>

            {['sent', 'acknowledged', 'partially_received', 'received', 'closed'].includes(po.status) && (
                <SectionCard title="Vendor Acknowledgement">
                    {hasAck ? (
                        <div className="space-y-3">
                            <Badge tone={ackOption?.tone || 'neutral'}>{po.acknowledgement_status!.replace(/_/g, ' ')}</Badge>
                            {po.acknowledged_at && (
                                <div className="text-xs text-fg-subtle">
                                    Acknowledged {formatters.formatDateTime(po.acknowledged_at)}
                                    {po.acknowledged_by ? ` by ${po.acknowledged_by}` : ''}
                                </div>
                            )}
                            {po.promised_delivery_date && (
                                <DescriptionList items={[{ label: 'Promised delivery', value: formatters.formatDate(po.promised_delivery_date) }]} />
                            )}
                            {po.acknowledgement_note && <p className="text-xs text-fg-muted">{po.acknowledgement_note}</p>}
                        </div>
                    ) : (
                        <p className="text-xs text-fg-subtle">Awaiting the vendor's response to this order.</p>
                    )}

                    {['sent', 'acknowledged'].includes(po.status) && !showAckForm && (
                        <Button variant="secondary" onClick={() => setShowAckForm(true)}>
                            {hasAck ? 'Update acknowledgement' : 'Record acknowledgement'}
                        </Button>
                    )}

                    {showAckForm && (
                        <form onSubmit={handleAcknowledge} className="space-y-3">
                            <Select
                                label="Vendor response"
                                name="ack-status"
                                id="ack-status"
                                value={ackForm.acknowledgement_status}
                                onChange={(e: any) => setAckForm({ ...ackForm, acknowledgement_status: e?.target ? e.target.value : e })}
                                options={ACK_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                            />
                            <TextField
                                label="Promised delivery date"
                                name="ack-date"
                                id="ack-date"
                                type="date"
                                value={ackForm.promised_delivery_date}
                                onChange={(e: any) => setAckForm({ ...ackForm, promised_delivery_date: e.target.value })}
                            />
                            <TextField
                                label="Acknowledged by"
                                name="ack-by"
                                id="ack-by"
                                placeholder="Vendor contact name"
                                value={ackForm.acknowledged_by}
                                onChange={(e: any) => setAckForm({ ...ackForm, acknowledged_by: e.target.value })}
                            />
                            <Textarea
                                label="Remarks"
                                name="ack-note"
                                id="ack-note"
                                value={ackForm.acknowledgement_note}
                                onChange={(e: any) => setAckForm({ ...ackForm, acknowledgement_note: e.target.value })}
                            />
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="secondary" onClick={() => setShowAckForm(false)}>Cancel</Button>
                                <Button type="submit" disabled={ackSaving}>{ackSaving ? 'Saving...' : 'Save'}</Button>
                            </div>
                        </form>
                    )}
                </SectionCard>
            )}

            <ProcurementTrace type="po" id={po.id} />

            {termItems.length > 0 && (
                <SectionCard title="Commercial Terms">
                    <DescriptionList items={termItems} />
                </SectionCard>
            )}
        </div>
    );

    return (
        <>
            {confirmDialog}
            <DetailPageTemplate
                title={`#${po.po_number}`}
                status={<StatusBadge status={statusText} map={{ [statusText]: STATUS_TONES[po.status] || 'neutral' }} />}
                onBack={backToList}
                backLabel="Back to Purchase Orders"
                primaryAction={primaryAction}
                secondaryActions={secondaryActions}
                sidePanel={sidePanel}
            >
                <div className="space-y-6">
                    <SectionCard title="Overview">
                        <DescriptionList items={overviewItems} />
                    </SectionCard>
                    <SectionCard title="Order Lines">
                        <DataTable
                            data-testid="po-lines-table"
                            columns={columns}
                            rows={po.po_lines || []}
                            rowKey={(line: POLine) => line.id}
                        />
                        <DescriptionList items={[
                            ...(hasTax ? [
                                { label: 'Subtotal', value: formatters.formatCurrency(subtotalAmount) },
                                { label: 'Tax', value: formatters.formatCurrency(taxAmount) },
                            ] : []),
                            { label: 'Grand Total', value: formatters.formatCurrency(totalAmount) },
                        ]} />
                    </SectionCard>
                </div>
            </DetailPageTemplate>
        </>
    );
};

export default PODetailPage;
