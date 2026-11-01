import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Alert, Badge, Button, Card, DataTable, DescriptionList, DetailPageTemplate, EmptyState,
    type DataTableColumn, type BadgeTone,
} from '@so360/design-system';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
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
    received_date?: string;
    supplier_delivery_note?: string;
    vehicle_number?: string;
    transporter?: string;
    gate_entry_no?: string;
    inspection_status?: string;
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
            setError(err.message || 'Failed to load GRN details');
        } finally {
            setIsLoading(false);
        }
    };

    /** Accepted quantity, falling back to received for receipts posted before the split existed. */
    const acceptedOf = (line: GRNLine) =>
        line.accepted_quantity == null ? line.quantity_received : line.accepted_quantity;

    const rejectedOf = (line: GRNLine) => (line.rejected_quantity || 0) + (line.damaged_quantity || 0);

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

    const columns: DataTableColumn<GRNLine>[] = [
        {
            key: 'item',
            header: 'Item',
            alwaysVisible: true,
            render: (line) => (
                <div>
                    <div className="text-nb-body text-fg">
                        {line.po_line?.items?.name || line.po_line?.description || 'Unknown Item'}
                    </div>
                    {line.po_line?.items?.sku && (
                        <div className="text-nb-caption text-fg-subtle">{line.po_line.items.sku}</div>
                    )}
                    {(line.batch_number || line.expiry_date || (line.serial_numbers?.length)) && (
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
            ),
        },
        { key: 'po_qty', header: 'PO Qty', align: 'right', render: (line) => line.po_line?.quantity || '-' },
        { key: 'received', header: 'Received', align: 'right', render: (line) => line.quantity_received },
        {
            key: 'accepted',
            header: 'Accepted',
            align: 'right',
            render: (line) => <span className="text-success">{acceptedOf(line)}</span>,
        },
        {
            key: 'rejected',
            header: 'Rejected',
            align: 'right',
            render: (line) => (
                <span className={rejectedOf(line) > 0 ? 'text-danger' : 'text-fg-subtle'}>{rejectedOf(line)}</span>
            ),
        },
        {
            key: 'unit_price',
            header: 'Unit Price',
            align: 'right',
            render: (line) => formatters.formatCurrency(line.po_line?.unit_price || 0),
        },
        {
            key: 'line_value',
            header: 'Line Value',
            align: 'right',
            render: (line) => formatters.formatCurrency(acceptedOf(line) * (line.po_line?.unit_price || 0)),
        },
    ];

    return (
        <DetailPageTemplate
            title={grn.grn_number}
            trail={GRN_TRAIL}
            status={
                <>
                    <Badge tone="success">Received</Badge>
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
            <Card title="Received Items">
                <DataTable
                    columns={columns}
                    rows={grn.grn_lines ?? []}
                    rowKey={(line) => line.id}
                    footer={
                        <div className="flex flex-wrap items-center justify-end gap-nb-4 text-nb-label text-fg-muted">
                            <span>Totals:</span>
                            <span>{totalQuantityReceived}</span>
                            <span className="text-success">{totalAccepted}</span>
                            <span className={totalRejected > 0 ? 'text-danger' : 'text-fg-subtle'}>{totalRejected}</span>
                            <span className="text-nb-section-title text-fg">{formatters.formatCurrency(totalValue)}</span>
                        </div>
                    }
                />
            </Card>

            <Card title="Stock Impact">
                <Alert variant="success" title="Stock Updated Successfully">
                    {totalQuantityReceived} units were added to {grn.warehouse?.name || 'warehouse'} inventory
                    on {formatters.formatDate(grn.created_at)}.
                </Alert>
            </Card>
        </DetailPageTemplate>
    );
};

export default GRNDetailPage;
