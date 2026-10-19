import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert, Button, Card, DataTable, DescriptionList, DatePicker, EmptyState, FieldGrid, FieldGridItem,
    FormPageTemplate, FormSection, Select, Spinner, TextField, type DataTableColumn,
} from '@so360/design-system';
import { procurementService } from '../../services/procurementService';
import { vendorService } from '../../services/vendorService';
import { inventoryService } from '../../services/inventoryService';
import ItemSearchSelector from '../../components/ItemSearchSelector';
import { useInventoryFormatters } from '../../utils/formatters';

interface LineItem {
    item_id: string;
    _selectedName: string;
    warehouse_id: string;
    _warehouseName: string;
    quantity: number;
    unit_cost: number;
}

const OpeningBalancePage = () => {
    const navigate = useNavigate();
    const poListTrail = [{ label: 'Purchase Orders', to: '/procurement/po', onClick: () => navigate('/procurement/po') }];
    const formatters = useInventoryFormatters();
    // Org business date, not the UTC day: an opening balance dated a day
    // early lands in the wrong stock period.
    const today = formatters.businessToday();

    const [vendors, setVendors] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingUnlinked, setLoadingUnlinked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ po: any; grn: any; movements_linked: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        vendor_id: '',
        vendor_name: '',
        po_number: '',
        grn_number: '',
        effective_date: today,
        note: '',
    });

    const [items, setItems] = useState<LineItem[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [vendorData, locData] = await Promise.all([
                vendorService.getVendors(),
                inventoryService.getLocations(),
            ]);
            setVendors(Array.isArray(vendorData) ? vendorData : (vendorData?.data || []));
            const locs = Array.isArray(locData) ? locData : (locData?.data || locData?.warehouses || []);
            setWarehouses(locs);

            // Auto-generate PO / GRN numbers
            const year = new Date().getFullYear();
            setFormData(prev => ({
                ...prev,
                po_number: `OB-${year}-001`,
                grn_number: `GRN-OB-${year}-001`,
            }));
        } catch (err: any) {
            console.error('Failed to load initial data', err);
            setError(err?.message || 'Failed to load form data. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    const loadUnlinkedStock = async () => {
        setLoadingUnlinked(true);
        setError(null);
        try {
            const data = await procurementService.getUnlinkedMovements();
            const rows: LineItem[] = (Array.isArray(data) ? data : []).map((row: any) => ({
                item_id: row.item_id,
                _selectedName: row.item_name ? `${row.item_name}${row.item_sku ? ` (${row.item_sku})` : ''}` : row.item_id,
                warehouse_id: row.warehouse_id,
                _warehouseName: row.warehouse_name || row.warehouse_id,
                quantity: row.total_qty,
                unit_cost: row.avg_cost,
            }));

            if (rows.length === 0) {
                setError('No unlinked stock movements found. All items already have GRN references.');
            } else {
                setItems(rows);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load unlinked stock');
        } finally {
            setLoadingUnlinked(false);
        }
    };

    const addEmptyLine = () => {
        setItems(prev => [...prev, {
            item_id: '',
            _selectedName: '',
            warehouse_id: warehouses[0]?.id || '',
            _warehouseName: warehouses[0]?.name || '',
            quantity: 1,
            unit_cost: 0,
        }]);
    };

    const removeLine = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof LineItem, value: any) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const updateItemWithProduct = (index: number, selected: { id: string; name: string; sku: string; price?: number }) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                item_id: selected.id,
                _selectedName: `${selected.name} (${selected.sku})`,
                unit_cost: selected.price ?? 0,
            };
            return next;
        });
    };

    const totalValue = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setError(null);

        const validItems = items.filter(i => i.item_id && i.warehouse_id && i.quantity > 0);
        if (validItems.length === 0) {
            setError('Add at least one complete item line.');
            return;
        }

        setSubmitting(true);
        try {
            const dto: any = {
                po_number: formData.po_number.trim() || undefined,
                grn_number: formData.grn_number.trim() || undefined,
                effective_date: formData.effective_date || undefined,
                note: formData.note.trim() || undefined,
                items: validItems.map(i => ({
                    item_id: i.item_id,
                    warehouse_id: i.warehouse_id,
                    quantity: Number(i.quantity),
                    unit_cost: Number(i.unit_cost),
                })),
            };

            if (formData.vendor_id) {
                dto.vendor_id = formData.vendor_id;
            } else {
                dto.vendor_name = formData.vendor_name.trim() || 'Opening Balance Supplier';
            }

            const response = await procurementService.createOpeningBalance(dto);
            setResult(response);
        } catch (err: any) {
            setError(err.message || 'Failed to create opening balance');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <FormPageTemplate title="Opening Balance" trail={poListTrail}>
                <Spinner aria-label="Loading opening balance form" />
            </FormPageTemplate>
        );
    }

    if (result) {
        return (
            <FormPageTemplate
                title="Opening Balance Created"
                description="Procurement documents have been created and stock movements linked."
                trail={poListTrail}
                onCancel={() => navigate('/procurement/po')}
                cancelLabel="Back to PO List"
                secondaryAction={<Button variant="secondary" onClick={() => navigate(`/procurement/grn/${result.grn?.id}`)}>View GRN</Button>}
                primaryAction={<Button onClick={() => navigate(`/procurement/po/${result.po?.id}`)}>View PO</Button>}
            >
                <Alert variant="success">
                    Stock quantities were not changed; audit trail documents were created.
                </Alert>
                <Card title="Created documents">
                    <DescriptionList
                        columns={3}
                        items={[
                            { label: 'PO Number', value: `${result.po?.po_number ?? '-'} (Status: ${result.po?.status ?? '-'})` },
                            { label: 'GRN Number', value: `${result.grn?.grn_number ?? '-'} ${result.grn?.received_at?.split('T')[0] ?? ''}`.trim() },
                            { label: 'Movements Linked', value: `${result.movements_linked} stock records` },
                        ]}
                    />
                </Card>
            </FormPageTemplate>
        );
    }

    const warehouseOptions = warehouses.map(w => ({ value: w.id, label: w.name }));
    const completeLines = items.filter(i => i.item_id).length;

    const lineColumns: DataTableColumn<LineItem>[] = [
        {
            key: 'item',
            header: 'Item',
            alwaysVisible: true,
            render: (item) => {
                const idx = items.indexOf(item);
                return item.item_id ? (
                    <span>{item._selectedName}</span>
                ) : (
                    <ItemSearchSelector
                        value={item.item_id}
                        selectedName={item._selectedName}
                        onSelect={selected => updateItemWithProduct(idx, selected)}
                    />
                );
            },
        },
        {
            key: 'warehouse',
            header: 'Warehouse',
            render: (item) => {
                const idx = items.indexOf(item);
                return (
                    <Select
                        aria-label="Warehouse"
                        placeholder="Select warehouse"
                        value={item.warehouse_id}
                        options={warehouseOptions}
                        onValueChange={v => {
                            const wh = warehouses.find(w => w.id === v);
                            updateLine(idx, 'warehouse_id', v);
                            updateLine(idx, '_warehouseName', wh?.name || v);
                        }}
                    />
                );
            },
        },
        {
            key: 'quantity',
            header: 'Qty on Hand',
            align: 'right',
            render: (item) => (
                <TextField
                    type="number"
                    min="0.001"
                    step="0.001"
                    aria-label="Quantity on hand"
                    value={item.quantity}
                    onChange={e => updateLine(items.indexOf(item), 'quantity', parseFloat(e.target.value) || 0)}
                />
            ),
        },
        {
            key: 'unit_cost',
            header: 'Unit Cost',
            align: 'right',
            render: (item) => (
                <TextField
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label="Unit cost"
                    value={item.unit_cost}
                    onChange={e => updateLine(items.indexOf(item), 'unit_cost', parseFloat(e.target.value) || 0)}
                />
            ),
        },
        {
            key: 'total',
            header: 'Total Value',
            align: 'right',
            render: (item) => (item.quantity * item.unit_cost).toFixed(2),
        },
    ];

    return (
        <FormPageTemplate
            title="Opening Balance"
            description="Create backdated procurement documents for existing stock — without double-counting quantities."
            trail={poListTrail}
            onCancel={() => navigate('/procurement/po')}
            primaryAction={
                <Button
                    type="submit"
                    form="opening-balance-form"
                    loading={submitting}
                    disabled={submitting || completeLines === 0}
                >
                    Create Opening Balance
                </Button>
            }
        >
            <Alert variant="warning" title="How this works">
                This creates a Purchase Order (status: Received) and a Goods Receipt Note linked to your existing stock.
                Stock quantities are NOT changed — only audit trail documents are created.
                Use Load Unlinked Stock to auto-fill items that currently have no GRN.
            </Alert>

            <form id="opening-balance-form" onSubmit={handleSubmit} className="flex flex-col gap-nb-6">
                <FormSection title="Section A — Document Info">
                    <FieldGrid columns={2}>
                        <FieldGridItem>
                            <Select
                                label="Vendor"
                                name="vendor_id"
                                value={formData.vendor_id}
                                options={[
                                    { value: '', label: '-- Auto-create placeholder --' },
                                    ...vendors.map(v => ({ value: v.id, label: v.name })),
                                ]}
                                onValueChange={v => setFormData(prev => ({ ...prev, vendor_id: v, vendor_name: '' }))}
                            />
                        </FieldGridItem>
                        {!formData.vendor_id && (
                            <FieldGridItem>
                                <TextField
                                    label="Placeholder vendor name"
                                    name="vendor_name"
                                    placeholder="Placeholder vendor name"
                                    value={formData.vendor_name}
                                    onChange={e => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                                />
                            </FieldGridItem>
                        )}
                        <FieldGridItem>
                            <TextField
                                label="PO Number"
                                name="po_number"
                                placeholder="OB-2026-001"
                                value={formData.po_number}
                                onChange={e => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                            />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField
                                label="GRN Number"
                                name="grn_number"
                                placeholder="GRN-OB-2026-001"
                                value={formData.grn_number}
                                onChange={e => setFormData(prev => ({ ...prev, grn_number: e.target.value }))}
                            />
                        </FieldGridItem>
                        <FieldGridItem>
                            <DatePicker
                                label="Effective Date (Backdated)"
                                name="effective_date"
                                value={formData.effective_date}
                                onChange={v => setFormData(prev => ({ ...prev, effective_date: v }))}
                            />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField
                                label="Note"
                                name="note"
                                placeholder="e.g. Initial inventory setup Jan 2026"
                                value={formData.note}
                                onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
                            />
                        </FieldGridItem>
                    </FieldGrid>
                </FormSection>

                <FormSection
                    title="Section B — Item Lines"
                    actions={
                        <Button type="button" variant="secondary" size="sm" onClick={loadUnlinkedStock} loading={loadingUnlinked} disabled={loadingUnlinked}>
                            {loadingUnlinked ? 'Loading...' : '⟳ Load Unlinked Stock'}
                        </Button>
                    }
                >
                    <DataTable
                        columns={lineColumns}
                        rows={items}
                        rowKey={(_item) => String(items.indexOf(_item))}
                        rowActions={(item) => [{ label: 'Remove line', onSelect: () => removeLine(items.indexOf(item)) }]}
                        emptyState={
                            <EmptyState
                                title="No item lines yet"
                                description="Use Load Unlinked Stock to auto-fill items, or add a line manually."
                                action={<Button type="button" variant="ghost" onClick={addEmptyLine}>add a line manually</Button>}
                            />
                        }
                        footer={
                            <div className="flex flex-wrap items-center justify-between gap-nb-4">
                                <Button type="button" variant="ghost" size="sm" onClick={addEmptyLine}>+ Add line manually</Button>
                                <div className="text-right text-nb-caption text-fg-subtle">
                                    <div>Total Inventory Value</div>
                                    <div className="text-nb-section-title text-fg">{totalValue.toFixed(2)}</div>
                                    <div>{completeLines} items • stock unchanged</div>
                                </div>
                            </div>
                        }
                    />
                </FormSection>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </FormPageTemplate>
    );
};

export default OpeningBalancePage;
