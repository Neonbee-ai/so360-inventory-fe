import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RecordNotFound, NOT_FOUND_ERROR, isNotFoundError } from '../../components/RecordNotFound';
import {
    Alert, Badge, Button, Card, DataTable, DescriptionList, DetailPageTemplate, EmptyState,
    type DataTableColumn, type BadgeTone,
} from '@so360/design-system';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import { EXCEPTION_LABELS } from '../vendors/outcomes/outcomeLabels';
import ProcurementTrace from '../../components/ProcurementTrace';

interface GRNLine {
    id: string;
    item_id: string;
    quantity_received: number;
    accepted_quantity?: number;
    rejected_quantity?: number;
    damaged_quantity?: number;
    batch_number?: string;
    expiry_date?: string;
    serial_numbers?: string[];
    rejection_reason?: string;
    /** Item master identity resolved server-side from `item_id`. */
    item?: GRNItem | null;
    po_line?: {
        quantity: number;
        unit_price: number;
        description: string;
        items?: GRNItem | null;
    };
}

interface GRNItem {
    id?: string;
    name: string;
    sku?: string;
    description?: string | null;
    uom?: string | null;
}

interface GRNInspection {
    id: string;
    inspection_number?: string;
    status?: string;
    result?: string | null;
}

/** Authoritative stock posting state, read from Inventory by the API. */
interface GRNStockImpact {
    state: 'posted' | 'on_hold' | 'pending';
    posted_quantity?: number;
    posted_at?: string | null;
    warehouse?: { id: string; name: string } | null;
}

interface GRN {
    id: string;
    grn_number: string;
    created_at: string;
    notes?: string;
    received_date?: string;
    supplier_delivery_note?: string;
    vehicle_number?: string;
    transporter?: string;
    gate_entry_no?: string;
    inspection_status?: string;
    inspection?: GRNInspection | null;
    /** Vendor 10: open receipt-attribution exceptions for this receipt or its lines. */
    integration_exceptions?: { id: string; exception_code: string }[];
    stock_impact?: GRNStockImpact;
    stock_on_hold?: boolean;
    stock_posted_at?: string | null;
    is_partial?: boolean;
    warehouse?: { id: string; name: string };
    po?: {
        id: string;
        po_number: string;
        vendor?: { id: string; name: string; contact_email?: string };
    };
    grn_lines: GRNLine[];
    received_by?: { full_name: string };
}

const TOTALS_ID = '__totals__';
const GRN_TRAIL = [{ label: 'Goods Receipt Notes', to: '/procurement/grn' }];

const INSPECTION_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
    not_required: { label: 'Not required', tone: 'neutral' },
    pending: { label: 'Inspection pending', tone: 'warning' },
    in_progress: { label: 'Inspection in progress', tone: 'primary' },
    passed: { label: 'Passed', tone: 'success' },
    partial: { label: 'Partially passed', tone: 'info' },
    failed: { label: 'Failed', tone: 'danger' },
};

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
            setError(isNotFoundError(err) ? NOT_FOUND_ERROR : (err.message || 'Failed to load GRN details'));
        } finally {
            setIsLoading(false);
        }
    };

    /** Accepted quantity, falling back to received for receipts posted before the split existed. */
    const acceptedOf = (line: GRNLine) =>
        line.accepted_quantity == null ? line.quantity_received : line.accepted_quantity;

    const rejectedOf = (line: GRNLine) => (line.rejected_quantity || 0) + (line.damaged_quantity || 0);

    const itemOf = (line: GRNLine): GRNItem | null => line.item ?? line.po_line?.items ?? null;

    const totalQuantityReceived = grn?.grn_lines?.reduce((sum, line) =>
        sum + line.quantity_received, 0) || 0;

    const totalAccepted = grn?.grn_lines?.reduce((sum, line) =>
        sum + acceptedOf(line), 0) || 0;

    const totalRejected = grn?.grn_lines?.reduce((sum, line) => sum + rejectedOf(line), 0) || 0;

    // Only accepted stock is capitalised, so the GRN value follows accepted units.
    const totalValue = grn?.grn_lines?.reduce((sum, line) =>
        sum + (acceptedOf(line) * (line.po_line?.unit_price || 0)), 0) || 0;

    if (isLoading) {
        return <DetailPageTemplate title="Loading goods receipt" trail={GRN_TRAIL} loading />;
    }

    if (!grn && (error === NOT_FOUND_ERROR || !error)) {
        return (
            <DetailPageTemplate title="Goods receipt" trail={GRN_TRAIL}>
                <RecordNotFound listPath="/procurement/grn" listLabel="GRNs" />
            </DetailPageTemplate>
        );
    }

    if (error || !grn) {
        return (
            <DetailPageTemplate title="Goods receipt" trail={GRN_TRAIL}>
                <EmptyState
                    title={error || 'GRN not found'}
                    action={{ label: 'Back to GRNs', onClick: () => navigate('/procurement/grn') }}
                />
            </DetailPageTemplate>
        );
    }

    const linkButton = (label: string, to: string) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(to)}>{label}</Button>
    );

    const infoItems = [
        grn.po && { label: 'Purchase Order', value: linkButton(`#${grn.po.po_number}`, `/procurement/po/${grn.po.id}`) },
        grn.po?.vendor && { label: 'Vendor', value: linkButton(grn.po.vendor.name, `/vendors/${grn.po.vendor.id}`) },
        grn.warehouse && { label: 'Receiving Warehouse', value: linkButton(grn.warehouse.name, `/inventory/warehouses/${grn.warehouse.id}`) },
        {
            label: 'Received Date',
            value: grn.received_date
                ? formatters.formatDate(grn.received_date)
                : formatters.formatDateTime(grn.created_at),
        },
        grn.received_by && { label: 'Received By', value: grn.received_by.full_name },
        grn.inspection && {
            label: 'Quality Inspection',
            value: linkButton(
                `${grn.inspection.inspection_number || 'Inspection'} · ${INSPECTION_LABELS[grn.inspection.status || '']?.label || grn.inspection.status || ''}`,
                '/procurement/quality',
            ),
        },
    ].filter(Boolean) as { label: string; value: React.ReactNode }[];

    const deliveryItems = [
        grn.supplier_delivery_note && { label: 'Delivery note', value: grn.supplier_delivery_note },
        grn.vehicle_number && { label: 'Vehicle', value: grn.vehicle_number },
        grn.transporter && { label: 'Transporter', value: grn.transporter },
        grn.gate_entry_no && { label: 'Gate entry', value: grn.gate_entry_no },
    ].filter(Boolean) as { label: string; value: React.ReactNode }[];

    const summaryItems = [
        { label: 'Received', value: `${totalQuantityReceived} units` },
        { label: 'Accepted', value: `${totalAccepted} units` },
        totalRejected > 0 && { label: 'Rejected / damaged', value: `${totalRejected} units` },
        { label: 'Accepted value', value: formatters.formatCurrency(totalValue) },
    ].filter(Boolean) as { label: string; value: React.ReactNode }[];

    const awaitingInspection = ['pending', 'in_progress'].includes(grn.inspection_status || '');
    // Prefer the API's authoritative read; older responses fall back to the GRN's own markers.
    const stock: GRNStockImpact = grn.stock_impact ?? {
        state: grn.stock_on_hold ? 'on_hold' : grn.stock_posted_at ? 'posted' : 'pending',
        posted_quantity: totalAccepted,
        posted_at: grn.stock_posted_at ?? null,
        warehouse: grn.warehouse ?? null,
    };
    const warehouseName = stock.warehouse?.name || grn.warehouse?.name || 'the receiving warehouse';
    const totalsRow: GRNLine = { id: TOTALS_ID, item_id: '', quantity_received: totalQuantityReceived };

    const columns: DataTableColumn<GRNLine>[] = [
        {
            key: 'item',
            header: 'Item',
            alwaysVisible: true,
            render: (line) => {
                if (line.id === TOTALS_ID) return <span className="font-medium text-fg">Totals</span>;
                const item = itemOf(line);
                // `.length` is a number: `0 && <jsx>` renders a literal "0", so test a boolean.
                const hasTrace = Boolean(line.batch_number || line.expiry_date || line.serial_numbers?.length);
                return (
                    <div className="min-w-0 break-words">
                        {item ? (
                            <div className="text-nb-body text-fg">{item.name}</div>
                        ) : (
                            <div className="text-nb-body text-fg">
                                {line.po_line?.description || 'Item unavailable'}
                                <span className="ml-nb-2 text-nb-caption text-warning">
                                    Not found in item master{line.item_id ? ` (${line.item_id.slice(0, 8)})` : ''}
                                </span>
                            </div>
                        )}
                        {(item?.sku || item?.uom) && (
                            <div className="text-nb-caption text-fg-subtle">
                                {item?.sku}{item?.sku && item?.uom ? ' · ' : ''}{item?.uom && <>UOM {item.uom}</>}
                            </div>
                        )}
                        {item?.description && (
                            <div className="text-nb-caption text-fg-subtle">{item.description}</div>
                        )}
                        {hasTrace && (
                            <div className="text-nb-caption text-fg-subtle">
                                {line.batch_number && <>Batch {line.batch_number} </>}
                                {line.expiry_date && <>· Exp {formatters.formatDate(line.expiry_date)} </>}
                                {!!line.serial_numbers?.length && <>· {line.serial_numbers.length} serials</>}
                            </div>
                        )}
                        {line.rejection_reason && (
                            <div className="text-nb-caption text-danger">Rejected: {line.rejection_reason}</div>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'po_qty', header: 'PO Qty', align: 'right',
            render: (line) => (line.id === TOTALS_ID ? '' : (line.po_line?.quantity ?? '-')),
        },
        {
            key: 'received', header: 'Received', align: 'right',
            render: (line) => (line.id === TOTALS_ID ? <strong>{totalQuantityReceived}</strong> : line.quantity_received),
        },
        {
            key: 'accepted',
            header: 'Accepted',
            align: 'right',
            render: (line) => (line.id === TOTALS_ID
                ? <strong className="text-success">{totalAccepted}</strong>
                : <span className={awaitingInspection ? 'text-fg-muted' : 'text-success'}>{acceptedOf(line)}</span>),
        },
        {
            key: 'rejected',
            header: 'Rejected',
            align: 'right',
            render: (line) => {
                const n = line.id === TOTALS_ID ? totalRejected : rejectedOf(line);
                return <span className={n > 0 ? 'text-danger' : 'text-fg-subtle'}>{n}</span>;
            },
        },
        {
            key: 'unit_price',
            header: 'Unit Price',
            align: 'right',
            render: (line) => (line.id === TOTALS_ID ? '' : formatters.formatCurrency(line.po_line?.unit_price || 0)),
        },
        {
            key: 'line_value',
            header: 'Line Value',
            align: 'right',
            render: (line) => (line.id === TOTALS_ID
                ? <strong>{formatters.formatCurrency(totalValue)}</strong>
                : formatters.formatCurrency(acceptedOf(line) * (line.po_line?.unit_price || 0))),
        },
    ];

    return (
        <DetailPageTemplate
            title={grn.grn_number}
            trail={GRN_TRAIL}
            status={
                <>
                    <Badge tone="success">Goods received</Badge>
                    {(grn.integration_exceptions ?? []).length > 0 && (
                        <Badge tone="warning" title={(grn.integration_exceptions ?? []).map((e) => EXCEPTION_LABELS[e.exception_code] ?? e.exception_code).join('; ')}>
                            Vendor attribution needs review
                        </Badge>
                    )}
                    {grn.is_partial && <Badge tone="warning">Partial</Badge>}
                    {grn.inspection_status && grn.inspection_status !== 'not_required' && (
                        <Badge tone={INSPECTION_LABELS[grn.inspection_status]?.tone ?? 'neutral'}>
                            {INSPECTION_LABELS[grn.inspection_status]?.label || grn.inspection_status}
                        </Badge>
                    )}
                </>
            }
            sidePanel={
                <>
                    <Card title="Receipt details">
                        <DescriptionList items={infoItems} columns={1} />
                        {deliveryItems.length > 0 && (
                            <DescriptionList title="Delivery Details" items={deliveryItems} columns={1} />
                        )}
                        {grn.notes && <DescriptionList title="Notes" items={[{ label: 'Remarks', value: grn.notes }]} columns={1} />}
                    </Card>
                    <ProcurementTrace type="grn" id={grn.id} />
                    <Card title="Receipt Summary">
                        <DescriptionList items={summaryItems} columns={1} />
                    </Card>
                </>
            }
        >
            {(grn.integration_exceptions ?? []).length > 0 && (
                <Alert variant="warning" title="Vendor attribution needs review">
                    {(grn.integration_exceptions ?? []).map((e) => EXCEPTION_LABELS[e.exception_code] ?? e.exception_code).join('; ')}.{' '}
                    <Button variant="ghost" size="sm" onClick={() => navigate('/vendors/integration-exceptions')}>Open the queue</Button>
                </Alert>
            )}

            {awaitingInspection && (
                <Alert variant="warning" title="Awaiting quality inspection">
                    {totalQuantityReceived} unit{totalQuantityReceived === 1 ? '' : 's'} physically received; the accepted
                    and rejected figures below are the receiver&apos;s count until Quality closes the inspection
                    {grn.inspection?.inspection_number ? <> ({grn.inspection.inspection_number}, {INSPECTION_LABELS[grn.inspection.status || '']?.label || grn.inspection.status})</> : null}.
                </Alert>
            )}

            <Card title="Received Items">
                <DataTable
                    columns={columns}
                    rows={[...(grn.grn_lines ?? []), totalsRow]}
                    rowKey={(line) => line.id}
                />
            </Card>

            <Card title="Stock Impact">
                {stock.state === 'posted' && (
                    <Alert variant="success" title="Stock posted">
                        {stock.posted_quantity ?? totalAccepted} unit{(stock.posted_quantity ?? totalAccepted) === 1 ? '' : 's'} added to {warehouseName}
                        {stock.posted_at ? <> on {formatters.formatDate(stock.posted_at)}</> : null}.
                        {awaitingInspection && ' Inspection is still open; confirm availability with Quality.'}
                    </Alert>
                )}
                {stock.state === 'on_hold' && (
                    <Alert variant="warning" title="Stock on quality hold">
                        {totalQuantityReceived} unit{totalQuantityReceived === 1 ? '' : 's'} received into {warehouseName} but not
                        available for use. Stock posts to inventory when the inspection releases it.
                    </Alert>
                )}
                {stock.state === 'pending' && (
                    <Alert variant="info" title="No stock movement posted yet">
                        No inventory movement has been recorded for this receipt.
                    </Alert>
                )}
            </Card>
        </DetailPageTemplate>
    );
};

export default GRNDetailPage;
