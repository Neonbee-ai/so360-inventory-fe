import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Package, Info, AlertCircle,
    ArrowDownLeft, ArrowUpRight, ArrowRightLeft,
    History, MapPin, DollarSign,
    Edit2, Trash2, Save, Loader2, ScanLine,
    AlertTriangle, RefreshCcw, Truck, Sliders,
    Image as ImageIcon, Tag, X, BarChart3
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Item, StockMovement, Unit, ItemCategory, Warehouse } from '../types/inventory';
import { TabId, ITEM_CLASSIFICATIONS, ItemClassification } from '../types/itemTypes';
import { Table } from '../components/common/Table';
import { TableSkeleton } from '../components/common/Skeleton';
import { useAuth } from '../hooks/useAuth';
import TabNavigation from './item-create/components/TabNavigation';
import FormSection from './item-create/components/FormSection';
import BasicInfoTab from './item-create/tabs/BasicInfoTab';
import MediaTab from './item-create/tabs/MediaTab';
import PricingTab, { TaxCodeOption } from './item-create/tabs/PricingTab';
import CategoryTab from './item-create/tabs/CategoryTab';
import StockTrackingTab from './item-create/tabs/StockTrackingTab';
import ShippingTab from './item-create/tabs/ShippingTab';
import AttributesTab from './item-create/tabs/AttributesTab';
import LifecycleStatusPanel from '../components/lifecycle/LifecycleStatusPanel';
import { useInventoryFormatters, useInventoryCurrencySymbol } from '../utils/formatters';
import { useActivity } from '@so360/shell-context';

// ── Types ─────────────────────────────────────────────
type ViewTabId = TabId | 'ledger';

interface EditFormData {
    name: string;
    sku: string;
    type: ItemClassification;
    brand: string;
    barcode: string;
    description: string;
    image_urls: string[];
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
const ItemDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { can } = useAuth();
    const formatters = useInventoryFormatters();
    const currencySymbol = useInventoryCurrencySymbol();
    const { recordActivity } = useActivity();
    const [item, setItem] = useState<Item | null>(null);
    const [ledger, setLedger] = useState<StockMovement[]>([]);
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
            const [itemData, ledgerData] = await Promise.all([
                inventoryService.getItem(id),
                inventoryService.getLedger(id)
            ]);
            await loadTaxCodes();
            if (itemData) {
                setItem(itemData);
                setLedger(ledgerData);
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
        setEditTab(viewTab !== 'ledger' ? viewTab : 'basic');
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
                return <MediaTab image_urls={editForm.image_urls} updateField={updateField} />;
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
    if (isLoading) return <div className="p-8"><TableSkeleton /></div>;
    if (error && !item) return (
        <div className="p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-50 mb-2">{error}</h2>
            <button onClick={() => navigate('/inventory/items')} className="text-blue-400 hover:underline">Back to Items</button>
        </div>
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
    const columns = [
        {
            header: 'Date',
            accessor: (entry: StockMovement) => (
                <span className="text-slate-400 text-xs">{new Date(entry.created_at).toLocaleString()}</span>
            )
        },
        {
            header: 'Activity',
            accessor: (entry: StockMovement) => {
                const getIcon = () => {
                    if (entry.type === 'inbound' || (entry.type === 'adjustment' && entry.quantity > 0)) return <ArrowDownLeft size={14} className="text-emerald-400" />;
                    if (entry.type === 'outbound' || (entry.type === 'adjustment' && entry.quantity < 0)) return <ArrowUpRight size={14} className="text-rose-400" />;
                    return <ArrowRightLeft size={14} className="text-blue-400" />;
                };
                return (
                    <div className="flex items-center gap-2">
                        {getIcon()}
                        <span className="font-medium text-slate-200 capitalize">{entry.type}</span>
                    </div>
                );
            }
        },
        {
            header: 'Quantity',
            accessor: (entry: StockMovement) => (
                <span className={`font-bold ${entry.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {entry.quantity > 0 ? '+' : ''}{entry.quantity}
                </span>
            )
        },
        {
            header: 'Warehouse',
            accessor: (entry: StockMovement) => (
                <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-slate-500" />
                    <span className="text-slate-300">{entry.warehouses?.name}</span>
                </div>
            )
        },
        {
            header: 'Reference/Reason',
            accessor: (entry: StockMovement) => (
                <span className="text-slate-500 text-xs italic">{entry.reason_code || entry.reference_type || '-'}</span>
            )
        }
    ];

    // ── Render ────────────────────────────────────────
    return (
        <div className="min-h-screen">
            {/* Error Banner */}
            {error && (
                <div className="px-8 pt-4">
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-300"><X size={16} /></button>
                    </div>
                </div>
            )}
            {taxCodesError && (
                <div className="px-8 pt-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm">
                        {taxCodesError}
                    </div>
                </div>
            )}

            {/* ═══ STICKY HEADER BAR ═══ */}
            <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
                <div className="px-8 py-4 flex items-center justify-between">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleCancelEdit}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-50 transition-colors group"
                            >
                                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                                Cancel Editing
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-50 text-sm font-semibold rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isSaving || isTaxCodesLoading || !!taxCodesError}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                                >
                                    {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate('/inventory/items')}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-50 transition-colors group"
                            >
                                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                                Back to Catalog
                            </button>
                            <div className="flex items-center gap-3">
                                {can('update_item') && (
                                    <button
                                        onClick={handleEditClick}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-50 text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <Edit2 size={16} /> Edit
                                    </button>
                                )}
                                {can('delete_item') && (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-4 py-2 bg-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 border border-slate-700 hover:border-rose-500/30"
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ═══ LEFT COLUMN ═══ */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Section A: Image Gallery + Hero Card */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden hover:border-slate-700 transition-colors">
                            {/* Active/Inactive badge */}
                            <div className="absolute top-4 right-4 z-10">
                                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${item.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-700'}`}>
                                    {item.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            {/* Hero Image */}
                            {hasImages ? (
                                <div className="mb-4">
                                    <div
                                        className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-700 cursor-pointer group"
                                        onClick={() => setPreviewImage(item.image_urls![0])}
                                    >
                                        <img
                                            src={item.image_urls![0]}
                                            alt={item.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </div>
                                    {item.image_urls!.length > 1 && (
                                        <div className="flex gap-2 mt-2">
                                            {item.image_urls!.slice(1, 5).map((url, i) => (
                                                <div
                                                    key={i}
                                                    className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 cursor-pointer hover:border-blue-500 transition-colors"
                                                    onClick={() => setPreviewImage(url)}
                                                >
                                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                            {item.image_urls!.length > 5 && (
                                                <div className="w-16 h-16 rounded-lg border border-slate-700 flex items-center justify-center text-xs text-slate-500 font-medium">
                                                    +{item.image_urls!.length - 5}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700 shadow-xl mb-4 mt-6">
                                    <ClassIcon size={40} className="text-blue-400" />
                                </div>
                            )}

                            {/* Item Identity */}
                            <h1 className="text-2xl font-bold text-slate-50 mb-1 leading-tight">{item.name}</h1>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs font-mono text-slate-500 tracking-widest">{item.sku || 'NO-SKU'}</span>
                                {item.barcode && (
                                    <>
                                        <span className="text-slate-700">|</span>
                                        <span className="flex items-center gap-1 text-xs text-slate-500">
                                            <ScanLine size={12} /> {item.barcode}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Classification chip */}
                            {classification && (
                                <div className="flex items-center gap-1.5 mb-3">
                                    <ClassIcon size={14} className="text-blue-400" />
                                    <span className="text-xs font-semibold text-blue-400">{classification.label}</span>
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

                    </div>

                    {/* ═══ RIGHT COLUMN ═══ */}
                    {isEditing ? (
                        /* ── EDIT MODE ── */
                        <div className="lg:col-span-2 space-y-4">
                            {/* ═══ 3 Summary Cards ═══ */}
                            <div className="grid grid-cols-3 gap-4">
                                {/* Card 1: Available Physical Stock */}
                                <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-900/40 relative overflow-hidden">
                                    <div className="absolute -right-3 -bottom-3 opacity-10">
                                        <Package size={80} />
                                    </div>
                                    <span className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">Physical Stock</span>
                                    <div className="text-4xl font-black mt-2 flex items-baseline gap-1.5">
                                        {totalStock}
                                        <span className="text-xs font-normal text-blue-200 uppercase">{item.units?.abbreviation || 'PCS'}</span>
                                    </div>
                                    <p className="mt-3 text-[10px] text-blue-100 flex items-center gap-1.5 bg-blue-500/30 w-fit px-2 py-1 rounded-lg">
                                        <Info size={11} /> Real-time count
                                    </p>
                                </div>
                                {/* Card 2: Stock Thresholds */}
                                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Stock Thresholds</h3>
                                    {(item.min_stock_threshold != null || item.reorder_level != null) ? (
                                        <div className="space-y-2">
                                            {item.min_stock_threshold != null && (
                                                <div className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <AlertTriangle size={13} />
                                                        <span className="text-xs font-semibold">Min Stock</span>
                                                    </div>
                                                    <span className="text-sm text-slate-50 font-medium">{item.min_stock_threshold}</span>
                                                </div>
                                            )}
                                            {item.reorder_level != null && (
                                                <div className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <RefreshCcw size={13} />
                                                        <span className="text-xs font-semibold">Reorder Level</span>
                                                    </div>
                                                    <span className="text-sm text-slate-50 font-medium">{item.reorder_level}</span>
                                                </div>
                                            )}
                                            {item.min_stock_threshold != null && totalStock < item.min_stock_threshold && (
                                                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-1.5">
                                                    <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
                                                    <span className="text-[10px] text-amber-400 font-medium">Below minimum!</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-600 italic">No thresholds set</p>
                                    )}
                                </div>
                                {/* Card 3: Product Lifecycle */}
                                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                                    <LifecycleStatusPanel
                                        itemId={item.id}
                                        productStatus={item.product_status || 'draft'}
                                        onStatusChange={(newStatus) => {
                                            setItem(prev => prev ? { ...prev, product_status: newStatus } : prev);
                                            recordActivity({ eventType: 'inventory.item.status_changed', eventCategory: 'data', description: `Changed item status to "${newStatus}"`, resourceType: 'item', resourceId: id }).catch(() => {});
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl ring-1 ring-blue-500/20">
                                <TabNavigation activeTab={editTab} onTabChange={setEditTab} tabErrors={tabErrors} />
                                <div className="p-6 min-h-[24rem]">
                                    {renderEditTab()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── VIEW MODE ── */
                        <div className="lg:col-span-2 space-y-4">
                            {/* ═══ 3 Summary Cards ═══ */}
                            <div className="grid grid-cols-3 gap-4">
                                {/* Card 1: Available Physical Stock */}
                                <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-900/40 relative overflow-hidden">
                                    <div className="absolute -right-3 -bottom-3 opacity-10">
                                        <Package size={80} />
                                    </div>
                                    <span className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">Physical Stock</span>
                                    <div className="text-4xl font-black mt-2 flex items-baseline gap-1.5">
                                        {totalStock}
                                        <span className="text-xs font-normal text-blue-200 uppercase">{item.units?.abbreviation || 'PCS'}</span>
                                    </div>
                                    <p className="mt-3 text-[10px] text-blue-100 flex items-center gap-1.5 bg-blue-500/30 w-fit px-2 py-1 rounded-lg">
                                        <Info size={11} /> Real-time count
                                    </p>
                                </div>
                                {/* Card 2: Stock Thresholds */}
                                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Stock Thresholds</h3>
                                    {(item.min_stock_threshold != null || item.reorder_level != null) ? (
                                        <div className="space-y-2">
                                            {item.min_stock_threshold != null && (
                                                <div className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <AlertTriangle size={13} />
                                                        <span className="text-xs font-semibold">Min Stock</span>
                                                    </div>
                                                    <span className="text-sm text-slate-50 font-medium">{item.min_stock_threshold}</span>
                                                </div>
                                            )}
                                            {item.reorder_level != null && (
                                                <div className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <RefreshCcw size={13} />
                                                        <span className="text-xs font-semibold">Reorder Level</span>
                                                    </div>
                                                    <span className="text-sm text-slate-50 font-medium">{item.reorder_level}</span>
                                                </div>
                                            )}
                                            {item.min_stock_threshold != null && totalStock < item.min_stock_threshold && (
                                                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-1.5">
                                                    <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
                                                    <span className="text-[10px] text-amber-400 font-medium">Below minimum!</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-600 italic">No thresholds set</p>
                                    )}
                                </div>
                                {/* Card 3: Product Lifecycle */}
                                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                                    <LifecycleStatusPanel
                                        itemId={item.id}
                                        productStatus={item.product_status || 'draft'}
                                        onStatusChange={(newStatus) => {
                                            setItem(prev => prev ? { ...prev, product_status: newStatus } : prev);
                                            recordActivity({ eventType: 'inventory.item.status_changed', eventCategory: 'data', description: `Changed item status to "${newStatus}"`, resourceType: 'item', resourceId: id }).catch(() => {});
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
                                {/* View Tab Bar — 8 tabs */}
                                <div className="flex gap-1 border-b border-slate-800 overflow-x-auto overflow-y-hidden scrollbar-hide rounded-t-xl">
                                    {([
                                        { id: 'basic' as ViewTabId, label: 'Basic Info', icon: <Package size={14} /> },
                                        { id: 'media' as ViewTabId, label: 'Media', icon: <ImageIcon size={14} /> },
                                        { id: 'pricing' as ViewTabId, label: 'Pricing', icon: <DollarSign size={14} /> },
                                        { id: 'category' as ViewTabId, label: 'Category', icon: <Tag size={14} /> },
                                        { id: 'stock' as ViewTabId, label: 'Stock', icon: <BarChart3 size={14} /> },
                                        { id: 'shipping' as ViewTabId, label: 'Shipping', icon: <Truck size={14} /> },
                                        { id: 'attributes' as ViewTabId, label: 'Attributes', icon: <Sliders size={14} /> },
                                        { id: 'ledger' as ViewTabId, label: 'Ledger', icon: <History size={14} /> },
                                    ]).map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setViewTab(tab.id)}
                                            className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${
                                                viewTab === tab.id
                                                    ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                                                    : 'text-slate-500 hover:text-slate-300 border-transparent'
                                            }`}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* View Tab Content */}
                                <div className="p-6 min-h-[24rem]">
                                    {/* ── Basic Info ── */}
                                    {viewTab === 'basic' && (
                                        <div className="space-y-8">
                                            <FormSection title="Identification">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <ReadOnlyField label="Item Name" value={item.name} />
                                                    <ReadOnlyField label="SKU" value={item.sku} mono />
                                                    <ReadOnlyField label="Barcode / UPC" value={item.barcode} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                    <ReadOnlyField label="Brand" value={item.brand} />
                                                    <ReadOnlyField label="Unit of Measure" value={item.units ? `${item.units.name} (${item.units.abbreviation})` : null} />
                                                </div>
                                            </FormSection>

                                            <FormSection title="Classification">
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {ITEM_CLASSIFICATIONS.map(cls => {
                                                        const Icon = cls.icon;
                                                        const isSelected = item.type === cls.value;
                                                        return (
                                                            <div
                                                                key={cls.value}
                                                                className={`p-3 rounded-xl border text-left ${
                                                                    isSelected
                                                                        ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                                                                        : 'border-slate-700/30 bg-slate-800/20 opacity-40'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Icon size={16} className={isSelected ? 'text-blue-400' : 'text-slate-600'} />
                                                                    <span className={`text-sm font-semibold ${isSelected ? 'text-blue-300' : 'text-slate-500'}`}>{cls.label}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 leading-tight">{cls.description}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </FormSection>

                                            <FormSection title="Product Type">
                                                <ReadOnlyField label="Product Type" value={item.product_types?.name} />
                                            </FormSection>

                                            <FormSection title="Description">
                                                <div className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-sm min-h-[80px]">
                                                    {item.description?.trim() ? (
                                                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{item.description}</p>
                                                    ) : (
                                                        <span className="text-slate-600">No description provided</span>
                                                    )}
                                                </div>
                                            </FormSection>

                                            {/* Metadata Footer */}
                                            <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-2">
                                                {item.created_at && <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>}
                                                {item.updated_at && <span>Updated: {new Date(item.updated_at).toLocaleDateString()}</span>}
                                                <span>ID: <span className="font-mono">{item.id}</span></span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Media ── */}
                                    {viewTab === 'media' && (
                                        <div className="space-y-8">
                                            <FormSection title="Product Images">
                                                {hasImages ? (
                                                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                                        {item.image_urls!.map((url, i) => (
                                                            <div
                                                                key={i}
                                                                className="aspect-square rounded-lg overflow-hidden border border-slate-700 cursor-pointer hover:border-blue-500 transition-colors group"
                                                                onClick={() => setPreviewImage(url)}
                                                            >
                                                                <img src={url} alt={`${item.name} ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                                        <ImageIcon size={48} className="text-slate-700 mb-4" />
                                                        <p className="text-sm text-slate-500">No images uploaded</p>
                                                    </div>
                                                )}
                                            </FormSection>
                                        </div>
                                    )}

                                    {/* ── Pricing ── */}
                                    {viewTab === 'pricing' && (
                                        <div className="space-y-8">
                                            <FormSection title="Pricing">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <ReadOnlyField label={`Selling Price (${currencySymbol})`} value={item.price != null ? formatters.formatCurrency(Number(item.price)) : null} />
                                                    <ReadOnlyField label={`Cost Price (${currencySymbol})`} value={item.cost != null ? formatters.formatCurrency(Number(item.cost)) : null} />
                                                </div>
                                                {margin && (
                                                    <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-slate-400">Margin</span>
                                                            <span className="text-emerald-400 font-semibold">{margin}%</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </FormSection>

                                            <FormSection title="Tax Information">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <ReadOnlyField label="Tax Code" value={taxDisplayValue} />
                                                    <ReadOnlyField label="HSN / SAC Code" value={item.hsn_code} />
                                                </div>
                                                {isTaxCodesLoading && (
                                                    <p className="text-xs text-slate-500 mt-2">Loading tax code labels from Core settings...</p>
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
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <ReadOnlyField label="Min Stock Threshold" value={item.min_stock_threshold != null ? String(item.min_stock_threshold) : null} />
                                                    <ReadOnlyField label="Reorder Level" value={item.reorder_level != null ? String(item.reorder_level) : null} />
                                                </div>
                                            </FormSection>

                                            <FormSection title="Tracking Options">
                                                <div className="flex flex-col gap-3 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                                                    <StatusPill label="Batch Tracked" active={item.is_batch_tracked} />
                                                    <StatusPill label="Serial Tracked" active={item.is_serial_tracked} />
                                                </div>
                                            </FormSection>

                                            <FormSection title="Status">
                                                <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                                                    <StatusPill label="Active" active={item.is_active} />
                                                </div>
                                            </FormSection>
                                        </div>
                                    )}

                                    {/* ── Shipping ── */}
                                    {viewTab === 'shipping' && (
                                        <div className="space-y-8">
                                            <FormSection title="Weight">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <ReadOnlyField label="Weight" value={item.weight != null ? String(item.weight) : null} />
                                                    <ReadOnlyField label="Weight Unit" value={item.weight_unit || 'kg'} />
                                                </div>
                                            </FormSection>

                                            <FormSection title="Dimensions (L x W x H)">
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <ReadOnlyField label="Length" value={item.dimensions?.length != null ? String(item.dimensions.length) : null} />
                                                    </div>
                                                    <span className="text-slate-600 pb-3">&times;</span>
                                                    <div className="flex-1">
                                                        <ReadOnlyField label="Width" value={item.dimensions?.width != null ? String(item.dimensions.width) : null} />
                                                    </div>
                                                    <span className="text-slate-600 pb-3">&times;</span>
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
                                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                                    <Sliders size={48} className="text-slate-700 mb-4" />
                                                    <h3 className="text-lg font-semibold text-slate-400 mb-2">No Product Type Selected</h3>
                                                    <p className="text-sm text-slate-500 max-w-md">
                                                        Select a product type on the <span className="text-blue-400 font-medium">Basic Info</span> tab to see
                                                        type-specific attributes here.
                                                    </p>
                                                </div>
                                            ) : item.product_types?.product_type_attributes && item.product_types.product_type_attributes.length > 0 ? (
                                                <FormSection title={`${item.product_types.name} Attributes`}>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                    </div>
                                                </FormSection>
                                            ) : item.custom_attributes && Object.keys(item.custom_attributes).length > 0 ? (
                                                <FormSection title={item.product_types?.name ? `${item.product_types.name} Attributes` : 'Custom Attributes'}>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {Object.entries(item.custom_attributes).map(([key, val]) => (
                                                            <ReadOnlyField key={key} label={key} value={val != null ? String(val) : null} />
                                                        ))}
                                                    </div>
                                                </FormSection>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                                    <Sliders size={48} className="text-slate-700 mb-4" />
                                                    <h3 className="text-lg font-semibold text-slate-400 mb-2">{item.product_types?.name || 'Product Type'}</h3>
                                                    <p className="text-sm text-slate-500">No attribute fields defined for this product type.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Ledger ── */}
                                    {viewTab === 'ledger' && (
                                        <div>
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-2">
                                                    <History size={20} className="text-blue-500" />
                                                    <h2 className="text-xl font-bold text-slate-50 tracking-tight">Movement Ledger</h2>
                                                </div>
                                                <span className="text-[10px] text-slate-500 border border-slate-800 px-3 py-1 rounded-full uppercase font-bold tracking-widest">
                                                    Audit Trail
                                                </span>
                                            </div>
                                            <Table data={ledger} columns={columns} emptyMessage="No movements recorded for this item." />
                                            <div className="mt-6 flex items-start gap-3 p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
                                                <Info size={16} className="text-slate-500 mt-1" />
                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                    This ledger is the immutable source of truth for all stock mutations. Each entry corresponds to a verified event. Manual changes to historical data are forbidden by system architectural constraints.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ DELETE CONFIRMATION ═══ */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                                <Trash2 size={24} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-50">Delete Item</h3>
                                <p className="text-slate-400 text-sm">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-slate-300 mb-6">
                            Are you sure you want to delete <strong className="text-slate-50">{item.name}</strong>?
                            Items with stock movements or balances cannot be deleted.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold py-2.5 rounded-lg transition-all">Cancel</button>
                            <button onClick={handleDeleteItem} disabled={isDeleting} className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2">
                                {isDeleting ? <><Loader2 size={18} className="animate-spin" /> Deleting...</> : <><Trash2 size={18} /> Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ IMAGE PREVIEW MODAL ═══ */}
            {previewImage && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full mx-4">
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-10 right-0 text-slate-50/70 hover:text-slate-50 transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <img src={previewImage} alt="Preview" className="w-full h-full object-contain rounded-xl" />
                    </div>
                </div>
            )}
        </div>
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
        <span className="block text-sm font-medium text-slate-400 mb-1.5">{label}</span>
        <div className={`w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-sm min-h-[42px] flex items-center ${
            mono ? 'font-mono tracking-wider text-slate-300' : 'text-slate-200'
        }`}>
            {value || <span className="text-slate-600">&mdash;</span>}
        </div>
    </div>
);

const InfoChip = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg border border-slate-700/30">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <span className="text-xs text-slate-300 font-medium">{value}</span>
    </div>
);

const StatusPill = ({ label, active }: { label: string; active: boolean }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
        active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
               : 'bg-slate-800/50 text-slate-500 border-slate-700'
    }`}>
        <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
        {label}: {active ? 'Yes' : 'No'}
    </div>
);

export default ItemDetailPage;
