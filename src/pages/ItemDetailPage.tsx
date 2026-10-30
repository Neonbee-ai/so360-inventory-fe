import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Package, Info, AlertCircle,
    ArrowDownLeft, ArrowUpRight, ArrowRightLeft,
    History, MapPin, DollarSign,
    Edit2, Trash2, Save, ScanLine,
    AlertTriangle, RefreshCcw, Truck, Sliders,
    Image as ImageIcon, Tag, BarChart3, TrendingUp, FileText
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Item, StockMovement, Unit, ItemCategory, Warehouse } from '../types/inventory';
import { TabId, ITEM_CLASSIFICATIONS, ItemClassification } from '../types/itemTypes';
import {
    DetailPageTemplate, DataTable, Button, Modal, Alert, Badge, EmptyState, Grid, FieldGrid,
    type DataTableColumn,
} from '@so360/design-system';
import { useAuth } from '../hooks/useAuth';
import TabNavigation from './item-create/components/TabNavigation';
import FormSection from './item-create/components/FormSection';
import BasicInfoTab from './item-create/tabs/BasicInfoTab';
import MediaTab from './item-create/tabs/MediaTab';
import { imageMetaForUrls, type ImageMetaEntry } from '../utils/imageMeta';
import PricingTab, { TaxCodeOption } from './item-create/tabs/PricingTab';
import CategoryTab from './item-create/tabs/CategoryTab';
import StockTrackingTab from './item-create/tabs/StockTrackingTab';
import ShippingTab from './item-create/tabs/ShippingTab';
import AttributesTab from './item-create/tabs/AttributesTab';
import LifecycleStatusPanel from '../components/lifecycle/LifecycleStatusPanel';
import { useInventoryFormatters, useInventoryCurrencySymbol } from '../utils/formatters';
import { parseUtcDate } from '../utils/datetime';
import { useActivity } from '@so360/shell-context';

// ── Types ─────────────────────────────────────────────
type ViewTabId = TabId | 'ledger' | 'sales';

interface ItemSalesHistory {
    item_id: string;
    total_quantity_sold: number;
    invoice_count: number;
    recent_movements: any[];
}

interface EditFormData {
    name: string;
    sku: string;
    type: ItemClassification;
    brand: string;
    barcode: string;
    description: string;
    image_urls: string[];
    image_meta: ImageMetaEntry[];
    price: string;
    cost: string;
    category_id: string;
    unit_id: string;
    min_stock_threshold: string;
    reorder_level: string;
    is_batch_tracked: boolean;
    is_serial_tracked: boolean;
    is_active: boolean;
    weight: string;
    weight_unit: string;
    dimensions_length: string;
    dimensions_width: string;
    dimensions_height: string;
    dimensions_unit: string;
    tax_class: string;
    hsn_code: string;
    product_type_id: string;
    custom_attributes: Record<string, any>;
    cost_center_id: string;
    default_warehouse_id: string;
    is_online_visible: boolean;
    tax_code_id: string;
}

// ── Main Component ────────────────────────────────────
const VIEW_TABS: { id: ViewTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: 'Basic Info', icon: <Package size={14} /> },
    { id: 'media', label: 'Media', icon: <ImageIcon size={14} /> },
    { id: 'pricing', label: 'Pricing', icon: <DollarSign size={14} /> },
    { id: 'category', label: 'Category', icon: <Tag size={14} /> },
    { id: 'stock', label: 'Stock', icon: <BarChart3 size={14} /> },
    { id: 'shipping', label: 'Shipping', icon: <Truck size={14} /> },
    { id: 'attributes', label: 'Attributes', icon: <Sliders size={14} /> },
    { id: 'ledger', label: 'Ledger', icon: <History size={14} /> },
    { id: 'sales', label: 'Sales History', icon: <TrendingUp size={14} /> },
];

const ItemDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { can } = useAuth();
    const formatters = useInventoryFormatters();
    const currencySymbol = useInventoryCurrencySymbol();
    const { recordActivity } = useActivity();
    const [item, setItem] = useState<Item | null>(null);
    const [ledger, setLedger] = useState<StockMovement[]>([]);
    const [salesHistory, setSalesHistory] = useState<ItemSalesHistory | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewTab, setViewTab] = useState<ViewTabId>('basic');

    // Inline edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<EditFormData | null>(null);
    const [editTab, setEditTab] = useState<TabId>('basic');
    const [isSaving, setIsSaving] = useState(false);
    const [tabErrors, setTabErrors] = useState<Partial<Record<TabId, boolean>>>({});

    // Edit settings
    const [categories, setCategories] = useState<ItemCategory[]>([]);
    const [uoms, setUoms] = useState<Unit[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [taxCodes, setTaxCodes] = useState<TaxCodeOption[]>([]);
    const [isTaxCodesLoading, setIsTaxCodesLoading] = useState(true);
    const [taxCodesError, setTaxCodesError] = useState<string | null>(null);
    const [showNewUom, setShowNewUom] = useState(false);
    const [newUomName, setNewUomName] = useState('');
    const [newUomAbbr, setNewUomAbbr] = useState('');
    const [isCreatingUom, setIsCreatingUom] = useState(false);

    // Delete state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Image preview
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const loadTaxCodes = async () => {
        setIsTaxCodesLoading(true);
        setTaxCodesError(null);
        try {
            const taxCodeData = await inventoryService.getTaxCodes();
            setTaxCodes(taxCodeData);
        } catch {
            setTaxCodes([]);
            setTaxCodesError('Failed to load organization tax codes from Core settings.');
        } finally {
            setIsTaxCodesLoading(false);
        }
    };

    // ── Data Loading ──────────────────────────────────
    const fetchData = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            // Tax codes are independent of the item/ledger fetch — load them in
            // the same parallel batch instead of waiting for item+ledger first.
            const [itemData, ledgerData] = await Promise.all([
                inventoryService.getItem(id),
                inventoryService.getLedger(id),
                loadTaxCodes(),
            ]);
            if (itemData) {
                setItem(itemData);
                setLedger(ledgerData);
                // Sales history is supplementary — never block the page on it.
                inventoryService
                    .getItemSalesHistory(id)
                    .then((sh) => setSalesHistory(sh))
                    .catch(() => setSalesHistory(null));
            } else {
                setError('Item not found');
            }
        } catch {
            setError('Failed to load item details');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [id]);

    // ── Edit Handlers ─────────────────────────────────
    const handleEditClick = async () => {
        if (!item) return;
        setEditForm(initEditForm(item));
        setEditTab(viewTab !== 'ledger' && viewTab !== 'sales' ? viewTab : 'basic');
        setTabErrors({});
        setIsEditing(true);

        // Load settings and warehouses for dropdowns
        try {
            const [settings, warehouseData] = await Promise.all([
                inventoryService.getSettings(),
                inventoryService.getLocations(),
            ]);
            setCategories(settings.categories || []);
            setUoms(settings.uoms || []);
            setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
        } catch { /* non-blocking */ }
        await loadTaxCodes();
    };

    const handleCancelEdit = () => {
        setViewTab(editTab);
        setIsEditing(false);
        setEditForm(null);
        setEditTab('basic');
        setTabErrors({});
    };

    const updateField = (field: string, value: any) => {
        setEditForm(prev => prev ? { ...prev, [field]: value } : prev);
        if (field === 'name') setTabErrors(prev => ({ ...prev, basic: false }));
    };

    const handleCreateUom = async () => {
        if (!newUomName.trim() || !newUomAbbr.trim()) return;
        setIsCreatingUom(true);
        try {
            const created = await inventoryService.createUom(newUomName.trim(), newUomAbbr.trim());
            setUoms(prev => [...prev, created]);
            updateField('unit_id', created.id);
            setShowNewUom(false);
            setNewUomName('');
            setNewUomAbbr('');
        } catch (err: any) {
            setError(err.message || 'Failed to create unit of measure');
        } finally {
            setIsCreatingUom(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!id || !editForm) return;
        if (!editForm.name.trim()) {
            setTabErrors({ basic: true });
            setEditTab('basic');
            return;
        }
        if (isTaxCodesLoading || taxCodesError) {
            setTabErrors({ pricing: true });
            setEditTab('pricing');
            setError(isTaxCodesLoading
                ? 'Tax codes are still loading. Please wait before saving.'
                : 'Tax codes failed to load from Core settings. Please retry.');
            return;
        }

        setIsSaving(true);
        try {
            const dto: Record<string, any> = {
                name: editForm.name.trim(),
                type: editForm.type,
                is_active: editForm.is_active,
                is_batch_tracked: editForm.is_batch_tracked,
                is_serial_tracked: editForm.is_serial_tracked,
            };

            if (editForm.sku.trim()) dto.sku = editForm.sku.trim(); else dto.sku = null;
            if (editForm.brand.trim()) dto.brand = editForm.brand.trim(); else dto.brand = null;
            if (editForm.barcode.trim()) dto.barcode = editForm.barcode.trim(); else dto.barcode = null;
            if (editForm.description.trim()) dto.description = editForm.description.trim(); else dto.description = null;
            dto.image_urls = editForm.image_urls.length > 0 ? editForm.image_urls : [];
            // Sizes for the photos still on the item — new uploads plus any saved
            // photo whose thumbnail was measured while editing.
            dto.image_meta = imageMetaForUrls(editForm.image_meta, editForm.image_urls);
            if (editForm.price) dto.price = parseFloat(editForm.price); else dto.price = null;
            if (editForm.cost) dto.cost = parseFloat(editForm.cost); else dto.cost = null;
            if (editForm.category_id) dto.category_id = editForm.category_id; else dto.category_id = null;
            if (editForm.unit_id) dto.unit_id = editForm.unit_id; else dto.unit_id = null;
            if (editForm.min_stock_threshold) dto.min_stock_threshold = parseInt(editForm.min_stock_threshold); else dto.min_stock_threshold = null;
            if (editForm.reorder_level) dto.reorder_level = parseInt(editForm.reorder_level); else dto.reorder_level = null;
            if (editForm.weight) { dto.weight = parseFloat(editForm.weight); dto.weight_unit = editForm.weight_unit; } else { dto.weight = null; dto.weight_unit = null; }
            if (editForm.hsn_code.trim()) dto.hsn_code = editForm.hsn_code.trim(); else dto.hsn_code = null;
            if (editForm.product_type_id) dto.product_type_id = editForm.product_type_id; else dto.product_type_id = null;
            if (Object.keys(editForm.custom_attributes).length > 0) dto.custom_attributes = editForm.custom_attributes; else dto.custom_attributes = null;
            if (editForm.cost_center_id) dto.cost_center_id = editForm.cost_center_id; else dto.cost_center_id = null;
            if (editForm.default_warehouse_id) dto.default_warehouse_id = editForm.default_warehouse_id; else dto.default_warehouse_id = null;
            dto.is_online_visible = editForm.is_online_visible;
            if (editForm.tax_code_id) dto.tax_code_id = editForm.tax_code_id; else dto.tax_code_id = null;

            const hasLength = editForm.dimensions_length;
            const hasWidth = editForm.dimensions_width;
            const hasHeight = editForm.dimensions_height;
            if (hasLength || hasWidth || hasHeight) {
                dto.dimensions = {
                    ...(hasLength && { length: parseFloat(editForm.dimensions_length) }),
                    ...(hasWidth && { width: parseFloat(editForm.dimensions_width) }),
                    ...(hasHeight && { height: parseFloat(editForm.dimensions_height) }),
                    unit: editForm.dimensions_unit,
                };
            } else {
                dto.dimensions = null;
            }

            await inventoryService.updateItem(id, dto);
            recordActivity({ eventType: 'inventory.item.updated', eventCategory: 'data', description: `Updated item "${dto.name}"`, resourceType: 'item', resourceId: id }).catch(() => {});
            setViewTab(editTab);
            setIsEditing(false);
            setEditForm(null);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Failed to update item');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteItem = async () => {
        if (!id) return;
        setIsDeleting(true);
        try {
            await inventoryService.deleteItem(id);
            recordActivity({ eventType: 'inventory.item.deleted', eventCategory: 'data', description: `Deleted item "${item?.name}"`, resourceType: 'item', resourceId: id }).catch(() => {});
            navigate('/inventory/items');
        } catch (err: any) {
            setError(err.message || 'Failed to delete item');
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    // ── Render Tab Content for Edit ──────────────────
    const renderEditTab = () => {
        if (!editForm) return null;
        switch (editTab) {
            case 'basic':
                return (
                    <BasicInfoTab
                        name={editForm.name} sku={editForm.sku} type={editForm.type}
                        brand={editForm.brand} barcode={editForm.barcode} description={editForm.description}
                        unit_id={editForm.unit_id} uoms={uoms} product_type_id={editForm.product_type_id}
                        showNewUom={showNewUom} newUomName={newUomName} newUomAbbr={newUomAbbr} isCreatingUom={isCreatingUom}
                        updateField={updateField} setShowNewUom={setShowNewUom}
                        setNewUomName={setNewUomName} setNewUomAbbr={setNewUomAbbr} onCreateUom={handleCreateUom}
                    />
                );
            case 'media':
                return <MediaTab image_urls={editForm.image_urls} image_meta={editForm.image_meta} updateField={updateField} />;
            case 'pricing':
                return <PricingTab price={editForm.price} cost={editForm.cost} tax_class={editForm.tax_class} tax_code_id={editForm.tax_code_id} hsn_code={editForm.hsn_code} updateField={updateField} currencySymbol={currencySymbol} taxCodes={taxCodes} isTaxCodesLoading={isTaxCodesLoading} taxCodesError={taxCodesError} />;
            case 'category':
                return (
                    <CategoryTab
                        category_id={editForm.category_id} categories={categories} updateField={updateField}
                        onQuickAddCategory={async (name: string) => {
                            try {
                                const created = await inventoryService.createCategory(name);
                                setCategories(prev => [...prev, created]);
                                updateField('category_id', created.id);
                            } catch (err: any) {
                                setError(err.message || 'Failed to create category');
                            }
                        }}
                    />
                );
            case 'stock':
                return (
                    <StockTrackingTab
                        min_stock_threshold={editForm.min_stock_threshold} reorder_level={editForm.reorder_level}
                        is_batch_tracked={editForm.is_batch_tracked} is_serial_tracked={editForm.is_serial_tracked}
                        is_active={editForm.is_active} updateField={updateField}
                        default_warehouse_id={editForm.default_warehouse_id}
                        warehouses={warehouses}
                        is_online_visible={editForm.is_online_visible}
                    />
                );
            case 'shipping':
                return (
                    <ShippingTab
                        weight={editForm.weight} weight_unit={editForm.weight_unit}
                        dimensions_length={editForm.dimensions_length} dimensions_width={editForm.dimensions_width}
                        dimensions_height={editForm.dimensions_height} dimensions_unit={editForm.dimensions_unit}
                        updateField={updateField}
                    />
                );
            case 'attributes':
                return <AttributesTab product_type_id={editForm.product_type_id} custom_attributes={editForm.custom_attributes} updateField={updateField} />;
        }
    };

    // ── Loading / Error States ────────────────────────
    if (isLoading) return <DetailPageTemplate trail={[{ label: 'Items', to: '/inventory/items' }]} title="Item" loading>{null}</DetailPageTemplate>;
    if (error && !item) return (
        <EmptyState
            icon={AlertCircle}
            title={error}
            action={{ label: 'Back to Items', onClick: () => navigate('/inventory/items') }}
        />
    );
    if (!item) return null;

    // ── Derived Values ────────────────────────────────
    const totalStock = ledger.reduce((acc, curr) => acc + Number(curr.quantity), 0);
    const classification = ITEM_CLASSIFICATIONS.find(c => c.value === item.type);
    const ClassIcon = classification?.icon || Package;
    const hasImages = item.image_urls && item.image_urls.length > 0;
    const margin = (item.price && item.cost && item.price > 0 && item.cost > 0)
        ? (((item.price - item.cost) / item.price) * 100).toFixed(1) : null;
    const currentTaxCodeId = (item as any).tax_code_id as string | undefined;
    const selectedTaxCode = currentTaxCodeId
        ? taxCodes.find(tc => tc.id === currentTaxCodeId)
        : undefined;
    const taxDisplayValue = currentTaxCodeId
        ? (selectedTaxCode
            ? `${selectedTaxCode.name} — ${selectedTaxCode.rate}%`
            : `Unknown tax code (${currentTaxCodeId})`)
        : (item.tax_class ? `Legacy tax class: ${item.tax_class}` : null);

    // ── Movement Table Columns ────────────────────────
    const columns: DataTableColumn<StockMovement>[] = [
        {
            key: 'date',
            header: 'Date',
            render: (entry: StockMovement) => (
                <span className="text-fg-muted text-xs">{formatters.formatDateTime(entry.created_at)}</span>
            )
        },
        {
            key: 'activity',
            header: 'Activity',
            render: (entry: StockMovement) => {
                const getIcon = () => {
                    if (entry.type === 'inbound' || (entry.type === 'adjustment' && entry.quantity > 0)) return <ArrowDownLeft size={14} className="text-success" />;
                    if (entry.type === 'outbound' || (entry.type === 'adjustment' && entry.quantity < 0)) return <ArrowUpRight size={14} className="text-danger" />;
                    return <ArrowRightLeft size={14} className="text-primary" />;
                };
                return (
                    <div className="flex items-center gap-2">
                        {getIcon()}
                        <span className="font-medium text-fg capitalize">{entry.type}</span>
                    </div>
                );
            }
        },
        {
            key: 'quantity',
            header: 'Quantity',
            render: (entry: StockMovement) => (
                <span className={`font-bold ${entry.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                    {entry.quantity > 0 ? '+' : ''}{entry.quantity}
                </span>
            )
        },
        {
            key: 'warehouse',
            header: 'Warehouse',
            render: (entry: StockMovement) => (
                <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-fg-subtle" />
                    <span className="text-fg-muted">{entry.warehouses?.name}</span>
                </div>
            )
        },
        {
            key: 'reference',
            header: 'Reference/Reason',
            render: (entry: StockMovement) => (
                <span className="text-fg-subtle text-xs italic">{entry.reason_code || entry.reference_type || '-'}</span>
            )
        }
    ];

    // ── Render ────────────────────────────────────────
    return (
        <>
            <DetailPageTemplate
                title={item.name}
                trail={[{ label: 'Catalog', onClick: () => navigate('/inventory/items') }]}
                status={isEditing
                    ? <Badge tone="info">Editing</Badge>
                    : <Badge tone={item.is_active ? 'success' : 'neutral'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                secondaryActions={isEditing ? [
                    <Button key="cancel-editing" variant="secondary" onClick={handleCancelEdit}>Cancel Editing</Button>,
                ] : undefined}
                primaryAction={!isEditing && can('items.update')
                    ? <Button onClick={handleEditClick}><Edit2 size={16} /> Edit</Button>
                    : undefined}
                overflowActions={!isEditing && can('items.delete')
                    ? [{ label: 'Delete', danger: true, onSelect: () => setShowDeleteConfirm(true) }]
                    : undefined}
                tabs={isEditing ? undefined : VIEW_TABS}
                activeTab={viewTab}
                onTabChange={(id: string) => setViewTab(id as ViewTabId)}
                maxVisible={VIEW_TABS.length}
            >
            {error && <Alert variant="error" action={{ label: 'Dismiss', onClick: () => setError(null) }}>{error}</Alert>}
            {taxCodesError && <Alert variant="warning">{taxCodesError}</Alert>}

            <div className="p-8">
                <Grid>
                    {/* ═══ LEFT COLUMN ═══ */}
                    <Grid.Item span={4} className="space-y-6">

                        {/* Section A: Image Gallery + Hero Card */}
                        <div className="bg-surface/50 border border-line rounded-2xl p-6 relative overflow-hidden hover:border-line-strong transition-colors">
                            {/* Hero Image */}
                            {hasImages ? (
                                <div className="mb-4">
                                    <div
                                        className="aspect-[4/3] rounded-xl overflow-hidden border border-line-strong cursor-pointer group"
                                        onClick={() => setPreviewImage(item.image_urls![0])}
                                    >
                                        <img
                                            src={item.image_urls![0]}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {item.image_urls!.length > 1 && (
                                        <div className="flex gap-2 mt-2">
                                            {item.image_urls!.slice(1, 5).map((url, i) => (
                                                <div
                                                    key={i}
                                                    className="w-16 h-16 rounded-lg overflow-hidden border border-line-strong cursor-pointer hover:border-primary transition-colors"
                                                    onClick={() => setPreviewImage(url)}
                                                >
                                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                            {item.image_urls!.length > 5 && (
                                                <div className="w-16 h-16 rounded-lg border border-line-strong flex items-center justify-center text-xs text-fg-subtle font-medium">
                                                    +{item.image_urls!.length - 5}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-20 h-20 rounded-2xl bg-surface-raised flex items-center justify-center border border-line-strong mb-4 mt-6">
                                    <ClassIcon size={40} className="text-primary" />
                                </div>
                            )}

                            {/* Item Identity */}
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-nb-sm font-mono text-fg-subtle">{item.sku || 'No SKU'}</span>
                                {item.barcode && (
                                    <>
                                        <span className="text-fg-subtle">|</span>
                                        <span className="flex items-center gap-1 text-xs text-fg-subtle">
                                            <ScanLine size={12} /> {item.barcode}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Classification chip */}
                            {classification && (
                                <div className="flex items-center gap-1.5 mb-3">
                                    <ClassIcon size={14} className="text-primary" />
                                    <span className="text-xs font-semibold text-primary">{classification.label}</span>
                                </div>
                            )}

                            {/* Info rows */}
                            <div className="space-y-2">
                                {item.brand && <InfoChip label="Brand" value={item.brand} />}
                                <InfoChip label="Category" value={item.item_categories?.name || 'Uncategorized'} />
                                <InfoChip label="Unit" value={item.units ? `${item.units.name} (${item.units.abbreviation})` : 'Not set'} />
                                {item.product_types && <InfoChip label="Product Type" value={item.product_types.name} />}
                            </div>
                        </div>

                    </Grid.Item>

                    {/* ═══ RIGHT COLUMN ═══ */}
                    {isEditing ? (
                        /* ── EDIT MODE ── */
                        <Grid.Item span={8} className="space-y-4">
                            {/* ═══ 3 Summary Cards ═══ */}
                            <Grid columns={3} gap="sm">
                                {/* Card 1: Available Physical Stock */}
                                <div className="bg-primary rounded-2xl p-5 text-primary-fg relative overflow-hidden">
                                    <div className="absolute -right-3 -bottom-3 opacity-10">
                                        <Package size={80} />
                                    </div>
                                    <span className="text-primary text-nb-overline font-bold">Physical stock</span>
                                    <div className="text-4xl font-black mt-2 flex items-baseline gap-1.5">
                                        {totalStock}
                                        <span className="text-nb-sm font-normal text-primary">{item.units?.abbreviation || 'PCS'}</span>
                                    </div>
                                    <p className="mt-3 text-nb-overline text-primary flex items-center gap-1.5 bg-primary/30 w-fit px-2 py-1 rounded-lg">
                                        <Info size={11} /> Real-time count
                                    </p>
                                </div>
                                {/* Card 2: Stock Thresholds */}
                                <div className="bg-surface/50 border border-line rounded-2xl p-5 hover:border-line-strong transition-colors">
                                    <h3 className="text-nb-overline font-bold text-fg-muted mb-3">Stock thresholds</h3>
                                    {(item.min_stock_threshold != null || item.reorder_level != null) ? (
                                        <div className="space-y-2">
                                            {item.min_stock_threshold != null && (
                                                <div className="flex items-center justify-between p-2.5 bg-surface-raised/30 rounded-xl border border-line-strong/30">
                                                    <div className="flex items-center gap-1.5 text-fg-muted">
                                                        <AlertTriangle size={13} />
                                                        <span className="text-xs font-semibold">Min Stock</span>
                                                    </div>
                                                    <span className="text-sm text-fg font-medium">{item.min_stock_threshold}</span>
                                                </div>
                                            )}
                                            {item.reorder_level != null && (
                                                <div className="flex items-center justify-between p-2.5 bg-surface-raised/30 rounded-xl border border-line-strong/30">
                                                    <div className="flex items-center gap-1.5 text-fg-muted">
                                                        <RefreshCcw size={13} />
                                                        <span className="text-xs font-semibold">Reorder Level</span>
                                                    </div>
                                                    <span className="text-sm text-fg font-medium">{item.reorder_level}</span>
                                                </div>
                                            )}
                                            {item.min_stock_threshold != null && totalStock < item.min_stock_threshold && (
                                                <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-1.5">
                                                    <AlertTriangle size={12} className="text-warning flex-shrink-0" />
                                                    <span className="text-nb-overline text-warning font-medium">Below minimum!</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-fg-subtle italic">No thresholds set</p>
                                    )}
                                </div>
                                {/* Card 3: Product Lifecycle */}
                                <div className="bg-surface/50 border border-line rounded-2xl p-5 hover:border-line-strong transition-colors">
                                    <LifecycleStatusPanel
                                        itemId={item.id}
                                        productStatus={item.product_status || 'draft'}
                                        onStatusChange={(newStatus) => {
                                            setItem(prev => prev ? { ...prev, product_status: newStatus } : prev);
                                            recordActivity({ eventType: 'inventory.item.status_changed', eventCategory: 'data', description: `Changed item status to "${newStatus}"`, resourceType: 'item', resourceId: id }).catch(() => {});
                                        }}
                                    />
                                </div>
                            </Grid>
                            <div className="bg-surface/50 border border-line rounded-xl ring-1 ring-focus/20">
                                <TabNavigation activeTab={editTab} onTabChange={setEditTab} tabErrors={tabErrors} />
                                <div className="p-6 min-h-96">
                                    {renderEditTab()}
                                </div>
                            </div>
                        </Grid.Item>
                    ) : (
                        /* ── VIEW MODE ── */
                        <Grid.Item span={8} className="space-y-4">
                            {/* ═══ 3 Summary Cards ═══ */}
                            <Grid columns={3} gap="sm">
                                {/* Card 1: Available Physical Stock */}
                                <div className="bg-primary rounded-2xl p-5 text-primary-fg relative overflow-hidden">
                                    <div className="absolute -right-3 -bottom-3 opacity-10">
                                        <Package size={80} />
                                    </div>
                                    <span className="text-primary text-nb-overline font-bold">Physical stock</span>
                                    <div className="text-4xl font-black mt-2 flex items-baseline gap-1.5">
                                        {totalStock}
                                        <span className="text-nb-sm font-normal text-primary">{item.units?.abbreviation || 'PCS'}</span>
                                    </div>
                                    <p className="mt-3 text-nb-overline text-primary flex items-center gap-1.5 bg-primary/30 w-fit px-2 py-1 rounded-lg">
                                        <Info size={11} /> Real-time count
                                    </p>
                                </div>
                                {/* Card 2: Stock Thresholds */}
                                <div className="bg-surface/50 border border-line rounded-2xl p-5 hover:border-line-strong transition-colors">
                                    <h3 className="text-nb-overline font-bold text-fg-muted mb-3">Stock thresholds</h3>
                                    {(item.min_stock_threshold != null || item.reorder_level != null) ? (
                                        <div className="space-y-2">
                                            {item.min_stock_threshold != null && (
                                                <div className="flex items-center justify-between p-2.5 bg-surface-raised/30 rounded-xl border border-line-strong/30">
                                                    <div className="flex items-center gap-1.5 text-fg-muted">
                                                        <AlertTriangle size={13} />
                                                        <span className="text-xs font-semibold">Min Stock</span>
                                                    </div>
                                                    <span className="text-sm text-fg font-medium">{item.min_stock_threshold}</span>
                                                </div>
                                            )}
                                            {item.reorder_level != null && (
                                                <div className="flex items-center justify-between p-2.5 bg-surface-raised/30 rounded-xl border border-line-strong/30">
                                                    <div className="flex items-center gap-1.5 text-fg-muted">
                                                        <RefreshCcw size={13} />
                                                        <span className="text-xs font-semibold">Reorder Level</span>
                                                    </div>
                                                    <span className="text-sm text-fg font-medium">{item.reorder_level}</span>
                                                </div>
                                            )}
                                            {item.min_stock_threshold != null && totalStock < item.min_stock_threshold && (
                                                <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-1.5">
                                                    <AlertTriangle size={12} className="text-warning flex-shrink-0" />
                                                    <span className="text-nb-overline text-warning font-medium">Below minimum!</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-fg-subtle italic">No thresholds set</p>
                                    )}
                                </div>
                                {/* Card 3: Product Lifecycle */}
                                <div className="bg-surface/50 border border-line rounded-2xl p-5 hover:border-line-strong transition-colors">
                                    <LifecycleStatusPanel
                                        itemId={item.id}
                                        productStatus={item.product_status || 'draft'}
                                        onStatusChange={(newStatus) => {
                                            setItem(prev => prev ? { ...prev, product_status: newStatus } : prev);
                                            recordActivity({ eventType: 'inventory.item.status_changed', eventCategory: 'data', description: `Changed item status to "${newStatus}"`, resourceType: 'item', resourceId: id }).catch(() => {});
                                        }}
                                    />
                                </div>
                            </Grid>
                            <div className="bg-surface/50 border border-line rounded-xl">

                                {/* View Tab Content */}
                                <div className="p-6 min-h-96">
                                    {/* ── Basic Info ── */}
                                    {viewTab === 'basic' && (
                                        <div className="space-y-8">
                                            <FormSection title="Identification">
                                                <FieldGrid columns={3}>
                                                    <ReadOnlyField label="Item Name" value={item.name} />
                                                    <ReadOnlyField label="SKU" value={item.sku} mono />
                                                    <ReadOnlyField label="Barcode / UPC" value={item.barcode} />
                                                </FieldGrid>
                                                <FieldGrid columns={2} className="mt-nb-4">
                                                    <ReadOnlyField label="Brand" value={item.brand} />
                                                    <ReadOnlyField label="Unit of Measure" value={item.units ? `${item.units.name} (${item.units.abbreviation})` : null} />
                                                </FieldGrid>
                                            </FormSection>

                                            <FormSection title="Classification">
                                                <Grid columns={3} gap="sm">
                                                    {ITEM_CLASSIFICATIONS.map(cls => {
                                                        const Icon = cls.icon;
                                                        const isSelected = item.type === cls.value;
                                                        return (
                                                            <div
                                                                key={cls.value}
                                                                className={`p-3 rounded-xl border text-left ${
                                                                    isSelected
                                                                        ? 'border-primary bg-primary/10 ring-1 ring-focus/30'
                                                                        : 'border-line-strong/30 bg-surface-raised/20 opacity-40'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Icon size={16} className={isSelected ? 'text-primary' : 'text-fg-subtle'} />
                                                                    <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-fg-subtle'}`}>{cls.label}</span>
                                                                </div>
                                                                <p className="text-xs text-fg-subtle leading-tight">{cls.description}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </Grid>
                                            </FormSection>

                                            <FormSection title="Product Type">
                                                <ReadOnlyField label="Product Type" value={item.product_types?.name} />
                                            </FormSection>

                                            <FormSection title="Description">
                                                <div className="w-full bg-surface-raised/50 border border-line-strong/50 rounded-lg px-4 py-2.5 text-sm min-h-20">
                                                    {item.description?.trim() ? (
                                                        <p className="text-fg whitespace-pre-wrap leading-relaxed">{item.description}</p>
                                                    ) : (
                                                        <span className="text-fg-subtle">No description provided</span>
                                                    )}
                                                </div>
                                            </FormSection>

                                            {/* Metadata Footer */}
                                            <div className="flex flex-wrap gap-4 text-xs text-fg-subtle pt-2">
                                                {item.created_at && <span>Created: {formatters.formatDate(item.created_at)}</span>}
                                                {item.updated_at && <span>Updated: {formatters.formatDate(item.updated_at)}</span>}
                                                <span>ID: <span className="font-mono">{item.id}</span></span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Media ── */}
                                    {viewTab === 'media' && (
                                        <div className="space-y-8">
                                            <FormSection title="Product Images">
                                                {hasImages ? (
                                                    <Grid columns={4} gap="sm">
                                                        {item.image_urls!.map((url, i) => (
                                                            <div
                                                                key={i}
                                                                className="aspect-square rounded-lg overflow-hidden border border-line-strong cursor-pointer hover:border-primary transition-colors group"
                                                                onClick={() => setPreviewImage(url)}
                                                            >
                                                                <img src={url} alt={`${item.name} ${i + 1}`} className="w-full h-full object-cover" />
                                                            </div>
                                                        ))}
                                                    </Grid>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                                        <ImageIcon size={48} className="text-fg-subtle mb-4" />
                                                        <p className="text-sm text-fg-subtle">No images uploaded</p>
                                                    </div>
                                                )}
                                            </FormSection>
                                        </div>
                                    )}

                                    {/* ── Pricing ── */}
                                    {viewTab === 'pricing' && (
                                        <div className="space-y-8">
                                            <FormSection title="Pricing">
                                                <FieldGrid columns={2}>
                                                    <ReadOnlyField label={`Selling Price (${currencySymbol})`} value={item.price != null ? formatters.formatCurrency(Number(item.price)) : null} />
                                                    <ReadOnlyField label={`Cost Price (${currencySymbol})`} value={item.cost != null ? formatters.formatCurrency(Number(item.cost)) : null} />
                                                </FieldGrid>
                                                {margin && (
                                                    <div className="mt-4 p-3 bg-surface-raised/50 border border-line-strong/50 rounded-lg">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-fg-muted">Margin</span>
                                                            <span className="text-success font-semibold">{margin}%</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </FormSection>

                                            <FormSection title="Tax Information">
                                                <FieldGrid columns={2}>
                                                    <ReadOnlyField label="Tax Code" value={taxDisplayValue} />
                                                    <ReadOnlyField label="HSN / SAC Code" value={item.hsn_code} />
                                                </FieldGrid>
                                                {isTaxCodesLoading && (
                                                    <p className="text-xs text-fg-subtle mt-2">Loading tax code labels from Core settings...</p>
                                                )}
                                            </FormSection>
                                        </div>
                                    )}

                                    {/* ── Category ── */}
                                    {viewTab === 'category' && (
                                        <div className="space-y-6">
                                            <FormSection title="Item Category">
                                                <ReadOnlyField label="Category" value={item.item_categories?.name} />
                                            </FormSection>
                                        </div>
                                    )}

                                    {/* ── Stock ── */}
                                    {viewTab === 'stock' && (
                                        <div className="space-y-8">
                                            <FormSection title="Stock Thresholds">
                                                <FieldGrid columns={2}>
                                                    <ReadOnlyField label="Min Stock Threshold" value={item.min_stock_threshold != null ? String(item.min_stock_threshold) : null} />
                                                    <ReadOnlyField label="Reorder Level" value={item.reorder_level != null ? String(item.reorder_level) : null} />
                                                </FieldGrid>
                                            </FormSection>

                                            <FormSection title="Tracking Options">
                                                <div className="flex flex-col gap-3 p-4 bg-surface-raised/30 border border-line-strong/50 rounded-lg">
                                                    <StatusPill label="Batch Tracked" active={item.is_batch_tracked} />
                                                    <StatusPill label="Serial Tracked" active={item.is_serial_tracked} />
                                                </div>
                                            </FormSection>

                                            <FormSection title="Status">
                                                <div className="p-4 bg-surface-raised/30 border border-line-strong/50 rounded-lg">
                                                    <StatusPill label="Active" active={item.is_active} />
                                                </div>
                                            </FormSection>
                                        </div>
                                    )}

                                    {/* ── Shipping ── */}
                                    {viewTab === 'shipping' && (
                                        <div className="space-y-8">
                                            <FormSection title="Weight">
                                                <FieldGrid columns={2}>
                                                    <ReadOnlyField label="Weight" value={item.weight != null ? String(item.weight) : null} />
                                                    <ReadOnlyField label="Weight Unit" value={item.weight_unit || 'kg'} />
                                                </FieldGrid>
                                            </FormSection>

                                            <FormSection title="Dimensions (L x W x H)">
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <ReadOnlyField label="Length" value={item.dimensions?.length != null ? String(item.dimensions.length) : null} />
                                                    </div>
                                                    <span className="text-fg-subtle pb-3">&times;</span>
                                                    <div className="flex-1">
                                                        <ReadOnlyField label="Width" value={item.dimensions?.width != null ? String(item.dimensions.width) : null} />
                                                    </div>
                                                    <span className="text-fg-subtle pb-3">&times;</span>
                                                    <div className="flex-1">
                                                        <ReadOnlyField label="Height" value={item.dimensions?.height != null ? String(item.dimensions.height) : null} />
                                                    </div>
                                                    <div className="w-20 flex-shrink-0">
                                                        <ReadOnlyField label="Unit" value={item.dimensions?.unit || 'cm'} />
                                                    </div>
                                                </div>
                                            </FormSection>
                                        </div>
                                    )}

                                    {/* ── Attributes ── */}
                                    {viewTab === 'attributes' && (
                                        <div className="space-y-6">
                                            {!item.product_type_id ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                                    <Sliders size={48} className="text-fg-subtle mb-4" />
                                                    <h3 className="text-lg font-semibold text-fg-muted mb-2">No Product Type Selected</h3>
                                                    <p className="text-sm text-fg-subtle max-w-md">
                                                        Select a product type on the <span className="text-primary font-medium">Basic Info</span> tab to see
                                                        type-specific attributes here.
                                                    </p>
                                                </div>
                                            ) : item.product_types?.product_type_attributes && item.product_types.product_type_attributes.length > 0 ? (
                                                <FormSection title={`${item.product_types.name} Attributes`}>
                                                    <FieldGrid columns={2}>
                                                        {item.product_types.product_type_attributes
                                                            .sort((a, b) => a.sort_order - b.sort_order)
                                                            .map(attr => {
                                                                const val = item.custom_attributes?.[attr.field_name];
                                                                let display: string | null = null;
                                                                if (val != null && val !== '') {
                                                                    if (typeof val === 'boolean') display = val ? 'Yes' : 'No';
                                                                    else display = String(val);
                                                                }
                                                                return <ReadOnlyField key={attr.id} label={attr.label} value={display} />;
                                                            })
                                                        }
                                                    </FieldGrid>
                                                </FormSection>
                                            ) : item.custom_attributes && Object.keys(item.custom_attributes).length > 0 ? (
                                                <FormSection title={item.product_types?.name ? `${item.product_types.name} Attributes` : 'Custom Attributes'}>
                                                    <FieldGrid columns={2}>
                                                        {Object.entries(item.custom_attributes).map(([key, val]) => (
                                                            <ReadOnlyField key={key} label={key} value={val != null ? String(val) : null} />
                                                        ))}
                                                    </FieldGrid>
                                                </FormSection>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                                    <Sliders size={48} className="text-fg-subtle mb-4" />
                                                    <h3 className="text-lg font-semibold text-fg-muted mb-2">{item.product_types?.name || 'Product Type'}</h3>
                                                    <p className="text-sm text-fg-subtle">No attribute fields defined for this product type.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Ledger ── */}
                                    {viewTab === 'ledger' && (
                                        <div>
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-2">
                                                    <History size={20} className="text-primary" />
                                                    <h2 className="text-lg font-semibold text-fg">Movement Ledger</h2>
                                                </div>
                                                <span className="text-nb-overline text-fg-subtle border border-line px-3 py-1 rounded-full font-bold">
                                                    Audit Trail
                                                </span>
                                            </div>
                                            <DataTable columns={columns} rows={ledger} rowKey={(m: StockMovement) => m.id} emptyState=<EmptyState title="No movements recorded for this item." /> />
                                            <div className="mt-6 flex items-start gap-3 p-4 bg-surface/30 border border-line rounded-xl">
                                                <Info size={16} className="text-fg-subtle mt-1" />
                                                <p className="text-xs text-fg-subtle leading-relaxed">
                                                    This ledger is the immutable source of truth for all stock mutations. Each entry corresponds to a verified event. Manual changes to historical data are forbidden by system architectural constraints.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Sales History ── */}
                                    {viewTab === 'sales' && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-6">
                                                <TrendingUp size={20} className="text-primary" />
                                                <h2 className="text-lg font-semibold text-fg">Sales History</h2>
                                            </div>

                                            <Grid columns={2} gap="sm" className="mb-nb-6">
                                                <div className="bg-surface/50 border border-line rounded-xl p-5">
                                                    <div className="flex items-center gap-2 text-fg-subtle mb-2">
                                                        <BarChart3 size={14} />
                                                        <span className="text-nb-overline font-black">Total Quantity Sold</span>
                                                    </div>
                                                    <div className="text-2xl font-bold text-fg">
                                                        {salesHistory?.total_quantity_sold ?? 0}
                                                    </div>
                                                </div>
                                                <div className="bg-surface/50 border border-line rounded-xl p-5">
                                                    <div className="flex items-center gap-2 text-fg-subtle mb-2">
                                                        <FileText size={14} />
                                                        <span className="text-nb-overline font-black">Invoices Used In</span>
                                                    </div>
                                                    <div className="text-2xl font-bold text-fg">
                                                        {salesHistory?.invoice_count ?? 0}
                                                    </div>
                                                </div>
                                            </Grid>

                                            <h3 className="text-nb-overline font-black text-fg-subtle mb-3">Recent outbound movements</h3>
                                            {salesHistory && salesHistory.recent_movements.length > 0 ? (
                                                <div className="border border-line rounded-xl divide-y divide-line overflow-hidden">
                                                    {salesHistory.recent_movements.map((m: any, idx: number) => (
                                                        <div key={m.id || idx} className="flex items-center justify-between px-4 py-3 bg-surface/30">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <ArrowUpRight size={16} className="text-danger flex-shrink-0" />
                                                                <div className="min-w-0">
                                                                    <div className="text-xs text-fg truncate">
                                                                        {m.metadata?.note || (m.reference_id ? `Order ${m.reference_id}` : 'Outbound movement')}
                                                                    </div>
                                                                    <div className="text-nb-overline text-fg-subtle">
                                                                        {m.created_at ? parseUtcDate(m.created_at).toLocaleString() : ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-semibold text-fg whitespace-nowrap">
                                                                {Number(m.quantity)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 text-fg-subtle text-sm border border-line rounded-xl">
                                                    No sales recorded for this item yet.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Grid.Item>
                    )}
                </Grid>
            </div>

            {isEditing && (
                <div className="flex justify-end gap-nb-3 px-8 pb-8">
                    <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
                    <Button
                        variant="primary"
                        onClick={handleSaveEdit}
                        disabled={isSaving || isTaxCodesLoading || !!taxCodesError}
                        loading={isSaving}
                    ><Save size={16} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            )}
            </DetailPageTemplate>

            {/* ═══ DELETE CONFIRMATION ═══ */}
            <Modal
                open={showDeleteConfirm}
                onClose={() => !isDeleting && setShowDeleteConfirm(false)}
                title="Delete Item"
                description="This action cannot be undone"
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteItem} disabled={isDeleting} loading={isDeleting}>{<Trash2 size={16} />}
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </>
                }
            >
                <p className="text-fg-muted">
                    Are you sure you want to delete <strong className="text-fg">{item.name}</strong>?
                    Items with stock movements or balances cannot be deleted.
                </p>
            </Modal>

            {/* ═══ IMAGE PREVIEW MODAL ═══ */}
            <Modal open={!!previewImage} onClose={() => setPreviewImage(null)} title="Image preview" size="lg">
                {previewImage && <img src={previewImage} alt="Preview" className="w-full h-full object-contain rounded-xl" />}
            </Modal>
        </>
    );
};

// ── Helper: Initialize edit form from item ────────────
function initEditForm(item: Item): EditFormData {
    return {
        name: item.name,
        sku: item.sku || '',
        type: item.type,
        brand: item.brand || '',
        barcode: item.barcode || '',
        description: item.description || '',
        image_urls: item.image_urls || [],
        image_meta: Array.isArray(item.image_meta) ? item.image_meta : [],
        price: item.price?.toString() || '',
        cost: item.cost?.toString() || '',
        category_id: item.category_id || '',
        unit_id: item.unit_id || '',
        min_stock_threshold: item.min_stock_threshold?.toString() || '',
        reorder_level: item.reorder_level?.toString() || '',
        is_batch_tracked: item.is_batch_tracked,
        is_serial_tracked: item.is_serial_tracked,
        is_active: item.is_active,
        weight: item.weight?.toString() || '',
        weight_unit: item.weight_unit || 'kg',
        dimensions_length: item.dimensions?.length?.toString() || '',
        dimensions_width: item.dimensions?.width?.toString() || '',
        dimensions_height: item.dimensions?.height?.toString() || '',
        dimensions_unit: item.dimensions?.unit || 'cm',
        tax_class: item.tax_class || '',
        hsn_code: item.hsn_code || '',
        product_type_id: item.product_type_id || '',
        custom_attributes: item.custom_attributes || {},
        cost_center_id: item.cost_center_id || '',
        default_warehouse_id: item.default_warehouse_id || '',
        is_online_visible: item.is_online_visible || false,
        tax_code_id: item.tax_code_id || '',
    };
}

// ── Sub-components ────────────────────────────────────
const ReadOnlyField = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
    <div>
        <span className="block text-sm font-medium text-fg-muted mb-1.5">{label}</span>
        <div className={`w-full bg-surface-raised/50 border border-line-strong/50 rounded-lg px-4 py-2.5 text-sm min-h-10 flex items-center ${
            mono ? 'font-mono text-fg-muted' : 'text-fg'
        }`}>
            {value || <span className="text-fg-subtle">&mdash;</span>}
        </div>
    </div>
);

const InfoChip = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between p-2.5 bg-surface-raised/30 rounded-lg border border-line-strong/30">
        <span className="text-xs text-fg-subtle font-medium">{label}</span>
        <span className="text-xs text-fg-muted font-medium">{value}</span>
    </div>
);

const StatusPill = ({ label, active }: { label: string; active: boolean }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
        active ? 'bg-success/10 text-success border-success/20'
               : 'bg-surface-raised/50 text-fg-subtle border-line-strong'
    }`}>
        <span className={`w-2 h-2 rounded-full ${active ? 'bg-success' : 'bg-surface-high'}`} />
        {label}: {active ? 'Yes' : 'No'}
    </div>
);

export default ItemDetailPage;
