import React, { useEffect, useRef, useState } from 'react';
import { procurementService } from '../../services/procurementService';
import { inventoryService } from '../../services/inventoryService';
import { receivingService, DIRECT_TO_SITE_FLAG, SERVICE_ACCEPTANCE_FLAG } from '../../services/receivingService';
import { useActivity, useShellBridge } from '@so360/shell-context';
import {
    toast, getErrorMessage, Alert, Button, Card, DataTable, DatePicker, EmptyState, FieldGrid, FieldGridItem,
    FormPageTemplate, FormSection, PeopleSelector, SegmentedControl, Select, Textarea, TextField, type DataTableColumn,
} from '@so360/design-system';

const GRN_ENTRY_TRAIL = [{ label: 'Goods Receipts', to: '/procurement/grn' }];

const INSPECTION_OPTIONS = [
    { value: 'not_required', label: 'Not required' },
    { value: 'pending', label: 'Required — pending' },
    { value: 'passed', label: 'Inspected — passed' },
    { value: 'partial', label: 'Inspected — partial' },
    { value: 'failed', label: 'Inspected — failed' },
];

/** Receiving discrepancies park the goods in quarantine and draft a supplier claim (Flow 07). */
const DISCREPANCY_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'wrong_item', label: 'Wrong item' },
    { value: 'wrong_uom', label: 'Wrong unit of measure' },
    { value: 'wrong_destination', label: 'Wrong destination' },
    { value: 'short', label: 'Short delivery' },
];

const EVIDENCE_TYPES = [
    { value: 'milestone', label: 'Milestone sign-off' },
    { value: 'timesheet', label: 'Timesheet' },
    { value: 'work_completion', label: 'Work completion' },
];
const EVIDENCE_MODULES = [
    { value: 'projects', label: 'Projects' },
    { value: 'maintenance', label: 'Maintenance' },
];

const GRNEntryPage = () => {
    const { recordActivity } = useActivity();
    const shell = useShellBridge() as any;
    const directToSiteOn = shell?.isFeatureEnabled?.(DIRECT_TO_SITE_FLAG) !== false;
    const serviceOn = shell?.isFeatureEnabled?.(SERVICE_ACCEPTANCE_FLAG) !== false;
    // One key per form so a double click or a retry never posts two receipts.
    const idempotencyKey = useRef<string>(typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `grn-${Date.now()}`);
    const [receiptKind, setReceiptKind] = useState<'warehouse' | 'direct_to_site' | 'service'>('warehouse');
    const [siteInfo, setSiteInfo] = useState({ site_id: '', site_zone: '', custodian_person_id: '', proof_url: '' });
    const [evidence, setEvidence] = useState({ type: 'milestone', source_module: 'projects', source_id: '' });
    const [expectedNotice, setExpectedNotice] = useState<any>(null);
    const [pos, setPos] = useState<any[]>([]);
    const [selectedPo, setSelectedPo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [receiptLines, setReceiptLines] = useState<any[]>([]);
    const [grnData, setGrnData] = useState({
        grn_number: '',
        warehouse_id: '',
        received_date: new Date().toISOString().slice(0, 10),
        supplier_delivery_note: '',
        vehicle_number: '',
        transporter: '',
        gate_entry_no: '',
        inspection_status: 'not_required',
        notes: '',
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [poData, whData] = await Promise.all([
                procurementService.getPOs(),
                inventoryService.getLocations()
            ]);
            const open = poData.filter((po: any) => ['sent', 'acknowledged', 'partially_received'].includes(po.status));
            setPos(open);
            setWarehouses(whData);
            await prefillFromNotice(open);
        } catch (error) {
            console.error('Failed to fetch initial data', error);
        } finally {
            setLoading(false);
        }
    };

    /** "Receive" on an expected receipt opens this form with the PO, warehouse/site and quantity already filled. */
    const prefillFromNotice = async (openPos: any[]) => {
        const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('expected_receipt_id') : null;
        if (!id) return;
        try {
            const notice = await receivingService.expectedReceipt(id);
            const po = openPos.find(p => p.id === notice.po_id);
            if (!po) return;
            setExpectedNotice(notice);
            if (notice.warehouse_id) setGrnData(g => ({ ...g, warehouse_id: notice.warehouse_id, inspection_status: notice.inspection_required ? 'pending' : g.inspection_status }));
            if (notice.direct_to_site) {
                setReceiptKind('direct_to_site');
                setSiteInfo(si => ({ ...si, site_id: notice.site_id || '' }));
            }
            selectPo(po, notice);
        } catch (error) {
            console.error('Failed to load the expected receipt', error);
        }
    };

    const handleSelectPo = async (poId: string) => {
        const po = pos.find(p => p.id === poId);
        setExpectedNotice(null);
        selectPo(po, null);
    };

    const selectPo = (po: any, notice: any) => {
        setSelectedPo(po);
        setReceiptLines(po.po_lines.map((l: any) => {
            const forNotice = notice && notice.po_line_id === l.id;
            return {
            schedule_id: forNotice ? notice.schedule_id : undefined,
            expected_receipt_id: forNotice ? notice.id : undefined,
            discrepancy_type: 'none',
            po_line_id: l.id,
            item_id: l.item_id,
            ordered: l.quantity,
            already_received: l.received_quantity,
            quantity_received: forNotice ? Math.min(Number(notice.open_qty ?? notice.quantity), l.quantity - l.received_quantity) : l.quantity - l.received_quantity,
            rejected_quantity: 0,
            damaged_quantity: 0,
            batch_number: '',
            expiry_date: '',
            serial_numbers: '',
            rejection_reason: '',
            description: l.description,
            unit_cost: l.unit_price ?? null,
            _expanded: false,
            };
        }));
    };

    const updateLine = (idx: number, field: string, value: any) => {
        const next = [...receiptLines];
        next[idx] = { ...next[idx], [field]: value };
        setReceiptLines(next);
    };

    /** Quantity that will actually enter stock for a line. */
    const acceptedQty = (line: any) =>
        (parseFloat(String(line.quantity_received)) || 0)
        - (parseFloat(String(line.rejected_quantity)) || 0)
        - (parseFloat(String(line.damaged_quantity)) || 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const overRejected = receiptLines.find(l => parseFloat(String(l.quantity_received)) > 0 && acceptedQty(l) < 0);
        if (overRejected) {
            toast.warning(`Rejected + damaged quantity exceeds the received quantity for "${overRejected.description}".`);
            return;
        }

        if (receiptKind === 'direct_to_site' && (!siteInfo.site_id || !siteInfo.custodian_person_id || !siteInfo.proof_url)) {
            toast.warning('A direct-to-site receipt needs the site, who took custody and proof of receipt.');
            return;
        }
        if (receiptKind === 'service' && !evidence.source_id) {
            toast.warning('Service acceptance needs the milestone, timesheet or work-completion reference.');
            return;
        }

        try {
            const createdGRN = await procurementService.createGRN({
                ...grnData,
                ...(receiptKind === 'warehouse' ? {} : { warehouse_id: undefined }),
                receipt_kind: receiptKind,
                idempotency_key: idempotencyKey.current,
                ...(receiptKind === 'direct_to_site' ? {
                    site_id: siteInfo.site_id, site_zone: siteInfo.site_zone || undefined,
                    custodian_person_id: siteInfo.custodian_person_id, proof_url: siteInfo.proof_url,
                } : {}),
                ...(receiptKind === 'service' ? { acceptance_evidence: { ...evidence } } : {}),
                po_id: selectedPo.id,
                vendor_id: selectedPo.vendor_id || undefined,
                items: receiptLines.filter(l => parseFloat(String(l.quantity_received)) > 0).map(l => ({
                    po_line_id: l.po_line_id,
                    item_id: l.item_id,
                    ordered_quantity: l.ordered,
                    quantity_received: parseFloat(l.quantity_received),
                    rejected_quantity: parseFloat(String(l.rejected_quantity)) || 0,
                    damaged_quantity: parseFloat(String(l.damaged_quantity)) || 0,
                    accepted_quantity: acceptedQty(l),
                    batch_number: l.batch_number || undefined,
                    expiry_date: l.expiry_date || undefined,
                    serial_numbers: l.serial_numbers
                        ? String(l.serial_numbers).split(',').map((s: string) => s.trim()).filter(Boolean)
                        : undefined,
                    rejection_reason: l.rejection_reason || undefined,
                    unit_cost: l.unit_cost ?? null,
                    ...(l.schedule_id ? { schedule_id: l.schedule_id, expected_receipt_id: l.expected_receipt_id } : {}),
                    ...(l.discrepancy_type && l.discrepancy_type !== 'none' ? { discrepancy_type: l.discrepancy_type } : {}),
                }))
            });
            recordActivity({ eventType: 'inventory.grn.created', eventCategory: 'financials', description: `Created GRN #${grnData.grn_number} for PO #${selectedPo.po_number}`, resourceType: 'grn', resourceId: createdGRN?.id }).catch(() => {});
            toast.success('GRN Created Successfully');
            window.location.reload();
        } catch (error: any) {
            toast.error(`GRN creation failed: ${getErrorMessage(error, 'Failed to create GRN')}`);
        }
    };

    const poColumns: DataTableColumn<any>[] = [
        {
            key: 'po_number',
            header: 'Purchase Order',
            alwaysVisible: true,
            render: (po) => `#PO-${po.po_number || po.id.slice(0, 8).toUpperCase()}`,
        },
        { key: 'vendor', header: 'Vendor', render: (po) => po.vendor?.name },
    ];

    const cancelReceipt = () => {
        setSelectedPo(null);
        setReceiptLines([]);
    };

    return (
        <FormPageTemplate
            title="Goods Receipt Entry"
            description="Record incoming shipments and update stock levels against Purchase Orders."
            trail={GRN_ENTRY_TRAIL}
            onCancel={selectedPo ? cancelReceipt : undefined}
            primaryAction={selectedPo ? (
                <Button type="submit" form="grn-entry-form">Post Goods Receipt</Button>
            ) : undefined}
        >
            <FormSection title="1. Select Purchase Order">
                <DataTable
                    columns={poColumns}
                    rows={pos}
                    rowKey={(po) => po.id}
                    loading={loading}
                    onRowClick={(po) => handleSelectPo(po.id)}
                    getRowProps={(po) => ({ 'aria-selected': selectedPo?.id === po.id })}
                    emptyState={<EmptyState title="No open purchase orders" description="Only sent, acknowledged or partially received orders can be received." />}
                />
            </FormSection>

            {selectedPo ? (
                <form id="grn-entry-form" onSubmit={handleSubmit} className="flex flex-col gap-nb-6">
                    <FormSection title="Receipt details">
                        {expectedNotice && (
                            <Alert variant="info">
                                Receiving against an expected delivery due {expectedNotice.due_date || 'soon'}: {expectedNotice.open_qty ?? expectedNotice.quantity} still open.
                                {expectedNotice.inspection_required ? ' This delivery is routed to quality inspection.' : ''}
                            </Alert>
                        )}
                        {(directToSiteOn || serviceOn) && (
                            <SegmentedControl
                                name="receipt-kind"
                                size="sm"
                                aria-label="Receipt type"
                                value={receiptKind}
                                onChange={(v: string) => setReceiptKind(v as any)}
                                options={[
                                    { value: 'warehouse', label: 'Warehouse' },
                                    ...(directToSiteOn ? [{ value: 'direct_to_site', label: 'Direct to site' }] : []),
                                    ...(serviceOn ? [{ value: 'service', label: 'Service' }] : []),
                                ]}
                            />
                        )}
                        <FieldGrid columns={2}>
                            <FieldGridItem>
                                <TextField
                                    label="GRN Number"
                                    name="grn_number"
                                    required
                                    placeholder="e.g. GRN-2024-001"
                                    value={grnData.grn_number}
                                    onChange={e => setGrnData({ ...grnData, grn_number: e.target.value })}
                                />
                            </FieldGridItem>
                            {receiptKind === 'warehouse' && (
                            <FieldGridItem>
                                <Select
                                    label="Receiving Warehouse"
                                    name="warehouse_id"
                                    required
                                    placeholder="Select Warehouse"
                                    value={grnData.warehouse_id}
                                    options={warehouses.map(wh => ({ value: wh.id, label: wh.name }))}
                                    onValueChange={v => setGrnData({ ...grnData, warehouse_id: v })}
                                />
                            </FieldGridItem>
                            )}
                            {receiptKind === 'direct_to_site' && (
                                <>
                                    <FieldGridItem>
                                        <TextField label="Delivery site" name="site_id" required placeholder="Site reference" value={siteInfo.site_id} onChange={e => setSiteInfo({ ...siteInfo, site_id: e.target.value })} />
                                    </FieldGridItem>
                                    <FieldGridItem>
                                        <TextField label="Zone / area" name="site_zone" value={siteInfo.site_zone} onChange={e => setSiteInfo({ ...siteInfo, site_zone: e.target.value })} />
                                    </FieldGridItem>
                                    <FieldGridItem>
                                        <PeopleSelector
                                            name="custodian_person_id"
                                            orgId={inventoryService.getOrgId()}
                                            value={siteInfo.custodian_person_id}
                                            placeholder="Who took custody"
                                            filters={{ status: 'active' }}
                                            onChange={(id: any) => setSiteInfo({ ...siteInfo, custodian_person_id: (Array.isArray(id) ? id[0] : id) || '' })}
                                        />
                                    </FieldGridItem>
                                    <FieldGridItem>
                                        <TextField label="Proof of receipt (link)" name="proof_url" required placeholder="Signed delivery note or photo URL" value={siteInfo.proof_url} onChange={e => setSiteInfo({ ...siteInfo, proof_url: e.target.value })} />
                                    </FieldGridItem>
                                </>
                            )}
                            {receiptKind === 'service' && (
                                <>
                                    <FieldGridItem>
                                        <Select label="Evidence type" name="evidence_type" value={evidence.type} options={EVIDENCE_TYPES} onValueChange={(v: string) => setEvidence({ ...evidence, type: v })} />
                                    </FieldGridItem>
                                    <FieldGridItem>
                                        <Select label="Owning module" name="evidence_module" value={evidence.source_module} options={EVIDENCE_MODULES} onValueChange={(v: string) => setEvidence({ ...evidence, source_module: v })} />
                                    </FieldGridItem>
                                    <FieldGridItem>
                                        <TextField label="Evidence reference" name="evidence_source_id" required placeholder="Milestone, timesheet or work order id" value={evidence.source_id} onChange={e => setEvidence({ ...evidence, source_id: e.target.value })} />
                                    </FieldGridItem>
                                </>
                            )}
                            <FieldGridItem>
                                <DatePicker
                                    label="Received Date"
                                    name="received_date"
                                    value={grnData.received_date}
                                    onChange={v => setGrnData({ ...grnData, received_date: v })}
                                />
                            </FieldGridItem>
                            <FieldGridItem>
                                <TextField
                                    label="Supplier Delivery Note"
                                    name="supplier_delivery_note"
                                    placeholder="Challan / DN number"
                                    value={grnData.supplier_delivery_note}
                                    onChange={e => setGrnData({ ...grnData, supplier_delivery_note: e.target.value })}
                                />
                            </FieldGridItem>
                            <FieldGridItem>
                                <TextField
                                    label="Vehicle Number"
                                    name="vehicle_number"
                                    placeholder="e.g. KA-01-AB-1234"
                                    value={grnData.vehicle_number}
                                    onChange={e => setGrnData({ ...grnData, vehicle_number: e.target.value })}
                                />
                            </FieldGridItem>
                            <FieldGridItem>
                                <TextField
                                    label="Transporter"
                                    name="transporter"
                                    value={grnData.transporter}
                                    onChange={e => setGrnData({ ...grnData, transporter: e.target.value })}
                                />
                            </FieldGridItem>
                            <FieldGridItem>
                                <TextField
                                    label="Gate Entry No."
                                    name="gate_entry_no"
                                    value={grnData.gate_entry_no}
                                    onChange={e => setGrnData({ ...grnData, gate_entry_no: e.target.value })}
                                />
                            </FieldGridItem>
                            <FieldGridItem>
                                <Select
                                    label="Quality Inspection"
                                    name="inspection_status"
                                    value={grnData.inspection_status}
                                    options={INSPECTION_OPTIONS}
                                    onValueChange={v => setGrnData({ ...grnData, inspection_status: v })}
                                />
                            </FieldGridItem>
                        </FieldGrid>
                    </FormSection>

                    <FormSection title="2. Verify Quantities">
                        {receiptLines.map((line, idx) => (
                            <Card
                                key={idx}
                                title={line.description}
                                actions={
                                    <Button type="button" variant="ghost" size="sm" onClick={() => updateLine(idx, '_expanded', !line._expanded)}>
                                        {line._expanded ? 'Hide details' : 'Batch / QC'}
                                    </Button>
                                }
                            >
                                <p className="mb-nb-3 text-nb-caption text-fg-subtle">
                                    Ordered: {line.ordered} | Already received: {line.already_received} | Accepted now:{' '}
                                    <span className={acceptedQty(line) < 0 ? 'text-danger' : 'text-success'}>{acceptedQty(line)}</span>
                                </p>
                                <FieldGrid columns={3}>
                                    <FieldGridItem>
                                        <TextField
                                            type="number"
                                            min="0"
                                            label="Received"
                                            name={`received_${idx}`}
                                            aria-label={`Received quantity for ${line.description}`}
                                            value={line.quantity_received}
                                            onChange={e => updateLine(idx, 'quantity_received', e.target.value)}
                                        />
                                    </FieldGridItem>
                                    <FieldGridItem>
                                        <TextField
                                            type="number"
                                            min="0"
                                            label="Rejected"
                                            name={`rejected_${idx}`}
                                            aria-label={`Rejected quantity for ${line.description}`}
                                            value={line.rejected_quantity}
                                            onChange={e => updateLine(idx, 'rejected_quantity', e.target.value)}
                                        />
                                    </FieldGridItem>
                                    <FieldGridItem>
                                        <TextField
                                            type="number"
                                            min="0"
                                            label="Damaged"
                                            name={`damaged_${idx}`}
                                            aria-label={`Damaged quantity for ${line.description}`}
                                            value={line.damaged_quantity}
                                            onChange={e => updateLine(idx, 'damaged_quantity', e.target.value)}
                                        />
                                    </FieldGridItem>
                                </FieldGrid>

                                {line._expanded && (
                                    <div className="mt-nb-4">
                                        <FieldGrid columns={2}>
                                            <FieldGridItem>
                                                <Select
                                                    label="Discrepancy"
                                                    name={`discrepancy_${idx}`}
                                                    value={line.discrepancy_type}
                                                    options={DISCREPANCY_OPTIONS}
                                                    onValueChange={(v: string) => updateLine(idx, 'discrepancy_type', v)}
                                                />
                                            </FieldGridItem>
                                            <FieldGridItem>
                                                <TextField
                                                    label="Batch Number"
                                                    name={`batch_${idx}`}
                                                    aria-label={`Batch number for ${line.description}`}
                                                    value={line.batch_number}
                                                    onChange={e => updateLine(idx, 'batch_number', e.target.value)}
                                                />
                                            </FieldGridItem>
                                            <FieldGridItem>
                                                <TextField
                                                    type="date"
                                                    label="Expiry Date"
                                                    name={`expiry_${idx}`}
                                                    aria-label={`Expiry date for ${line.description}`}
                                                    value={line.expiry_date}
                                                    onChange={e => updateLine(idx, 'expiry_date', e.target.value)}
                                                />
                                            </FieldGridItem>
                                            <FieldGridItem>
                                                <TextField
                                                    label="Serial Numbers"
                                                    name={`serials_${idx}`}
                                                    placeholder="Comma separated"
                                                    aria-label={`Serial numbers for ${line.description}`}
                                                    value={line.serial_numbers}
                                                    onChange={e => updateLine(idx, 'serial_numbers', e.target.value)}
                                                />
                                            </FieldGridItem>
                                            <FieldGridItem>
                                                <TextField
                                                    label="Rejection Reason"
                                                    name={`reason_${idx}`}
                                                    placeholder="Why units were rejected"
                                                    aria-label={`Rejection reason for ${line.description}`}
                                                    value={line.rejection_reason}
                                                    onChange={e => updateLine(idx, 'rejection_reason', e.target.value)}
                                                />
                                            </FieldGridItem>
                                        </FieldGrid>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </FormSection>

                    <FormSection title="Notes">
                        <Textarea
                            label="Receipt Notes"
                            name="notes"
                            value={grnData.notes}
                            placeholder="Condition of the shipment, discrepancies, remarks for the buyer..."
                            onChange={e => setGrnData({ ...grnData, notes: e.target.value })}
                        />
                    </FormSection>
                </form>
            ) : (
                <EmptyState title="Select a Purchase Order to start receiving goods." />
            )}
        </FormPageTemplate>
    );
};

export default GRNEntryPage;
