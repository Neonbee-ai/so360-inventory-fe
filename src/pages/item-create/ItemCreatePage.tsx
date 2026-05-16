import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { Unit, ItemCategory, Warehouse } from '../../types/inventory';
import { TabId, ItemClassification } from '../../types/itemTypes';
import TabNavigation from './components/TabNavigation';
import BasicInfoTab from './tabs/BasicInfoTab';
import MediaTab from './tabs/MediaTab';
import PricingTab, { TaxCodeOption } from './tabs/PricingTab';
import CategoryTab from './tabs/CategoryTab';
import StockTrackingTab from './tabs/StockTrackingTab';
import ShippingTab from './tabs/ShippingTab';
import AttributesTab from './tabs/AttributesTab';
import { useInventoryCurrencySymbol } from '../../utils/formatters';
import { useActivity } from '@so360/shell-context';

interface FormData {
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

const initialFormData: FormData = {
    name: '',
    sku: '',
    type: 'product',
    brand: '',
    barcode: '',
    description: '',
    image_urls: [],
    price: '',
    cost: '',
    category_id: '',
    unit_id: '',
    min_stock_threshold: '',
    reorder_level: '',
    is_batch_tracked: false,
    is_serial_tracked: false,
    is_active: true,
    weight: '',
    weight_unit: 'kg',
    dimensions_length: '',
    dimensions_width: '',
    dimensions_height: '',
    dimensions_unit: 'cm',
    tax_class: '',
    hsn_code: '',
    product_type_id: '',
    custom_attributes: {},
    cost_center_id: '',
    default_warehouse_id: '',
    is_online_visible: false,
    tax_code_id: '',
};

const ItemCreatePage = () => {
    const navigate = useNavigate();
    const currencySymbol = useInventoryCurrencySymbol();
    const { recordActivity } = useActivity();
    const [form, setForm] = useState<FormData>(initialFormData);
    const [activeTab, setActiveTab] = useState<TabId>('basic');
    const [categories, setCategories] = useState<ItemCategory[]>([]);
    const [uoms, setUoms] = useState<Unit[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tabErrors, setTabErrors] = useState<Partial<Record<TabId, boolean>>>({});
    const [taxCodes, setTaxCodes] = useState<TaxCodeOption[]>([]);
    const [isTaxCodesLoading, setIsTaxCodesLoading] = useState(true);
    const [taxCodesError, setTaxCodesError] = useState<string | null>(null);

    // Inline create states — category
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDesc, setNewCategoryDesc] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    // Inline create states — UoM
    const [showNewUom, setShowNewUom] = useState(false);
    const [newUomName, setNewUomName] = useState('');
    const [newUomAbbr, setNewUomAbbr] = useState('');
    const [isCreatingUom, setIsCreatingUom] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsTaxCodesLoading(true);
        setTaxCodesError(null);

        try {
            const [settings, warehouseData] = await Promise.all([
                inventoryService.getSettings(),
                inventoryService.getLocations(),
            ]);
            setCategories(settings.categories || []);
            setUoms(settings.uoms || []);
            setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
        } catch {
            // Settings are optional, don't block the form
        }

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

    const updateField = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
        // Clear error for the tab when user edits
        if (field === 'name') setTabErrors(prev => ({ ...prev, basic: false }));
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        setIsCreatingCategory(true);
        try {
            const created = await inventoryService.createCategory(
                newCategoryName.trim(),
                newCategoryDesc.trim() || undefined,
            );
            setCategories(prev => [...prev, created]);
            updateField('category_id', created.id);
            setShowNewCategory(false);
            setNewCategoryName('');
            setNewCategoryDesc('');
        } catch (err: any) {
            setError(err.message || 'Failed to create category');
        } finally {
            setIsCreatingCategory(false);
        }
    };

    const handleCreateUom = async () => {
        if (!newUomName.trim() || !newUomAbbr.trim()) return;
        setIsCreatingUom(true);
        try {
            const created = await inventoryService.createUom(
                newUomName.trim(),
                newUomAbbr.trim(),
            );
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

    const validate = (): boolean => {
        const errors: Partial<Record<TabId, boolean>> = {};
        if (!form.name.trim()) {
            errors.basic = true;
        }
        if (isTaxCodesLoading || taxCodesError) {
            errors.pricing = true;
        }
        setTabErrors(errors);

        if (Object.keys(errors).length > 0) {
            // Switch to the first tab with errors
            const firstErrorTab = (['basic', 'media', 'pricing', 'category', 'stock', 'shipping', 'attributes'] as TabId[])
                .find(t => errors[t]);
            if (firstErrorTab) setActiveTab(firstErrorTab);
            if (isTaxCodesLoading) {
                setError('Tax codes are still loading. Please wait before saving.');
            } else if (taxCodesError) {
                setError('Tax codes failed to load from Core settings. Please retry.');
            } else {
                setError('Please fill in all required fields');
            }
            return false;
        }
        return true;
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const dto: Record<string, any> = {
                name: form.name.trim(),
                type: form.type,
                is_active: form.is_active,
                is_batch_tracked: form.is_batch_tracked,
                is_serial_tracked: form.is_serial_tracked,
            };

            if (form.sku.trim()) dto.sku = form.sku.trim();
            if (form.brand.trim()) dto.brand = form.brand.trim();
            if (form.barcode.trim()) dto.barcode = form.barcode.trim();
            if (form.description.trim()) dto.description = form.description.trim();
            if (form.image_urls.length > 0) dto.image_urls = form.image_urls;
            if (form.price) dto.price = parseFloat(form.price);
            if (form.cost) dto.cost = parseFloat(form.cost);
            if (form.category_id) dto.category_id = form.category_id;
            if (form.unit_id) dto.unit_id = form.unit_id;
            if (form.min_stock_threshold) dto.min_stock_threshold = parseInt(form.min_stock_threshold);
            if (form.reorder_level) dto.reorder_level = parseInt(form.reorder_level);
            if (form.weight) dto.weight = parseFloat(form.weight);
            if (form.weight) dto.weight_unit = form.weight_unit;
            if (form.hsn_code.trim()) dto.hsn_code = form.hsn_code.trim();
            if (form.product_type_id) dto.product_type_id = form.product_type_id;
            if (Object.keys(form.custom_attributes).length > 0) dto.custom_attributes = form.custom_attributes;
            if (form.cost_center_id) dto.cost_center_id = form.cost_center_id;
            if (form.default_warehouse_id) dto.default_warehouse_id = form.default_warehouse_id;
            if (form.is_online_visible) dto.is_online_visible = form.is_online_visible;
            if (form.tax_code_id) dto.tax_code_id = form.tax_code_id;

            const hasLength = form.dimensions_length;
            const hasWidth = form.dimensions_width;
            const hasHeight = form.dimensions_height;
            if (hasLength || hasWidth || hasHeight) {
                dto.dimensions = {
                    ...(hasLength && { length: parseFloat(form.dimensions_length) }),
                    ...(hasWidth && { width: parseFloat(form.dimensions_width) }),
                    ...(hasHeight && { height: parseFloat(form.dimensions_height) }),
                    unit: form.dimensions_unit,
                };
            }

            const created = await inventoryService.createItem(dto);
            recordActivity({ eventType: 'inventory.item.created', eventCategory: 'data', description: `Created item "${dto.name}"`, resourceType: 'item', resourceId: created.id }).catch(() => {});
            navigate(`/inventory/items/${created.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to create item');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderTab = () => {
        switch (activeTab) {
            case 'basic':
                return (
                    <BasicInfoTab
                        name={form.name}
                        sku={form.sku}
                        type={form.type}
                        brand={form.brand}
                        barcode={form.barcode}
                        description={form.description}
                        unit_id={form.unit_id}
                        uoms={uoms}
                        product_type_id={form.product_type_id}
                        showNewUom={showNewUom}
                        newUomName={newUomName}
                        newUomAbbr={newUomAbbr}
                        isCreatingUom={isCreatingUom}
                        updateField={updateField}
                        setShowNewUom={setShowNewUom}
                        setNewUomName={setNewUomName}
                        setNewUomAbbr={setNewUomAbbr}
                        onCreateUom={handleCreateUom}
                    />
                );
            case 'media':
                return (
                    <MediaTab
                        image_urls={form.image_urls}
                        updateField={updateField}
                    />
                );
            case 'pricing':
                return (
                    <PricingTab
                        price={form.price}
                        cost={form.cost}
                        tax_class={form.tax_class}
                        tax_code_id={form.tax_code_id}
                        hsn_code={form.hsn_code}
                        updateField={updateField}
                        currencySymbol={currencySymbol}
                        taxCodes={taxCodes}
                        isTaxCodesLoading={isTaxCodesLoading}
                        taxCodesError={taxCodesError}
                    />
                );
            case 'category':
                return (
                    <CategoryTab
                        category_id={form.category_id}
                        categories={categories}
                        updateField={updateField}
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
                        min_stock_threshold={form.min_stock_threshold}
                        reorder_level={form.reorder_level}
                        is_batch_tracked={form.is_batch_tracked}
                        is_serial_tracked={form.is_serial_tracked}
                        is_active={form.is_active}
                        updateField={updateField}
                        default_warehouse_id={form.default_warehouse_id}
                        warehouses={warehouses}
                        is_online_visible={form.is_online_visible}
                    />
                );
            case 'shipping':
                return (
                    <ShippingTab
                        weight={form.weight}
                        weight_unit={form.weight_unit}
                        dimensions_length={form.dimensions_length}
                        dimensions_width={form.dimensions_width}
                        dimensions_height={form.dimensions_height}
                        dimensions_unit={form.dimensions_unit}
                        updateField={updateField}
                    />
                );
            case 'attributes':
                return (
                    <AttributesTab
                        product_type_id={form.product_type_id}
                        custom_attributes={form.custom_attributes}
                        updateField={updateField}
                    />
                );
        }
    };

    return (
        <div className="min-h-screen pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
                <div className="px-8 py-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/inventory/items')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to Items</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/inventory/items')}
                            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleSubmit()}
                            disabled={isSubmitting || isTaxCodesLoading || !!taxCodesError}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {isSubmitting ? 'Saving...' : 'Save Item'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-8 pt-6">
                <h1 className="text-2xl font-bold text-white mb-6">Register New Item</h1>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm mb-6">
                        {error}
                    </div>
                )}
                {taxCodesError && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm mb-6">
                        {taxCodesError}
                    </div>
                )}

                {/* Tab Bar */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
                    <TabNavigation
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        tabErrors={tabErrors}
                    />

                    {/* Tab Content */}
                    <div className="p-6 min-h-[24rem]">
                        {renderTab()}
                    </div>
                </div>
            </div>

            {/* Sticky footer for mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 p-4 md:hidden">
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/inventory/items')}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleSubmit()}
                        disabled={isSubmitting || isTaxCodesLoading || !!taxCodesError}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-semibold transition-all"
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {isSubmitting ? 'Saving...' : 'Save Item'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ItemCreatePage;
