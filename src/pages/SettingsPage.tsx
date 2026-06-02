import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, Box, Tag, MapPin, AlertCircle, CheckCircle2, X, Plus, Sliders, ChevronRight, ListFilter } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { useAuth } from '../hooks/useAuth';
import CategoryTreeView from '../components/categories/CategoryTreeView';
import { buildCategoryTree } from '../utils/categoryTree';
import ItemAttributeSettingsSection from '../components/settings/ItemAttributeSettingsSection';

interface UomItem {
    id: string;
    name: string;
    abbreviation: string;
}

interface CategoryItem {
    id: string;
    name: string;
    description?: string;
    icon_url?: string | null;
    image_url?: string | null;
    color?: string | null;
    sort_order?: number;
}

interface InventorySettingsData {
    uoms: UomItem[];
    categories: CategoryItem[];
}

const SettingsPage = () => {
    const navigate = useNavigate();
    const { can } = useAuth();
    const [settings, setSettings] = useState<InventorySettingsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Add UoM state
    const [showAddUom, setShowAddUom] = useState(false);
    const [newUomName, setNewUomName] = useState('');
    const [newUomAbbr, setNewUomAbbr] = useState('');
    const [addingUom, setAddingUom] = useState(false);

    // Add Category state
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDesc, setNewCategoryDesc] = useState('');
    const [addingCategory, setAddingCategory] = useState(false);

    // Default Logic state
    const [allowNegativeStock, setAllowNegativeStock] = useState(false);
    const [autoApproveTransfers, setAutoApproveTransfers] = useState(false);
    const [togglingLogic, setTogglingLogic] = useState(false);

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const [data, defaults] = await Promise.all([
                inventoryService.getSettings(),
                inventoryService.getOrgDefaultLogic().catch(() => ({ allow_negative_stock: false, auto_approve_transfers: false })),
            ]);
            setSettings(data);
            setAllowNegativeStock(defaults.allow_negative_stock);
            setAutoApproveTransfers(defaults.auto_approve_transfers);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleLogic = async (field: 'allow_negative_stock' | 'auto_approve_transfers', value: boolean) => {
        setTogglingLogic(true);
        setError(null);
        try {
            await inventoryService.updateOrgDefaultLogic({ [field]: value });
            if (field === 'allow_negative_stock') setAllowNegativeStock(value);
            else setAutoApproveTransfers(value);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to update setting');
        } finally {
            setTogglingLogic(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleAddUom = async () => {
        if (!newUomName.trim() || !newUomAbbr.trim()) return;
        setAddingUom(true);
        setError(null);
        try {
            await inventoryService.createUom(newUomName.trim(), newUomAbbr.trim());
            setNewUomName('');
            setNewUomAbbr('');
            setShowAddUom(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await fetchSettings();
        } catch (err: any) {
            setError(err.message || 'Failed to add unit of measure');
        } finally {
            setAddingUom(false);
        }
    };

    const handleDeleteUom = async (id: string) => {
        if (!confirm('Are you sure you want to delete this unit of measure?')) return;
        setError(null);
        try {
            await inventoryService.deleteUom(id);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await fetchSettings();
        } catch (err: any) {
            setError(err.message || 'Failed to delete unit of measure');
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        setAddingCategory(true);
        setError(null);
        try {
            await inventoryService.createCategory(newCategoryName.trim(), newCategoryDesc.trim() || undefined);
            setNewCategoryName('');
            setNewCategoryDesc('');
            setShowAddCategory(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await fetchSettings();
        } catch (err: any) {
            setError(err.message || 'Failed to add category');
        } finally {
            setAddingCategory(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category?')) return;
        setError(null);
        try {
            await inventoryService.deleteCategory(id);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await fetchSettings();
        } catch (err: any) {
            setError(err.message || 'Failed to delete category');
        }
    };

    if (isLoading) return <div className="p-8"><div className="animate-pulse text-slate-500">Loading settings...</div></div>;

    return (
        <div className="p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
                    <Settings className="text-slate-400" /> Inventory Settings
                </h1>
                <p className="text-slate-400 mt-1">Configure units, categories, and module defaults</p>
            </header>

            {error && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={18} />
                    <span>Settings updated successfully</span>
                </div>
            )}

            <div className="space-y-6">
                {/* Units of Measure */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
                        <Box size={20} className="text-blue-500" /> Units of Measure (UoM)
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {settings?.uoms.map((uom: UomItem) => (
                            <div key={uom.id} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-300 flex items-center gap-2 group">
                                <span>{uom.name} ({uom.abbreviation})</span>
                                {can('manage_locations') && (
                                    <button
                                        onClick={() => handleDeleteUom(uom.id)}
                                        className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition-all"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {showAddUom ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={newUomName}
                                    onChange={(e) => setNewUomName(e.target.value)}
                                    className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-sm text-slate-50 w-24"
                                />
                                <input
                                    type="text"
                                    placeholder="Abbr"
                                    value={newUomAbbr}
                                    onChange={(e) => setNewUomAbbr(e.target.value)}
                                    className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-sm text-slate-50 w-16"
                                />
                                <button
                                    onClick={handleAddUom}
                                    disabled={addingUom}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-sm disabled:opacity-50"
                                >
                                    {addingUom ? '...' : 'Add'}
                                </button>
                                <button
                                    onClick={() => setShowAddUom(false)}
                                    className="text-slate-400 hover:text-slate-50"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddUom(true)}
                                className="border border-dashed border-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-400 hover:border-slate-500 transition-all flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Unit
                            </button>
                        )}
                    </div>
                    <p className="mt-4 text-xs text-slate-500 italic">Define standard units for stocks and services (e.g., Pcs, KG, Hrs)</p>
                </section>

                {/* Categories */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
                        <Tag size={20} className="text-purple-500" /> Item Categories
                    </h2>
                    <CategoryTreeView
                        tree={buildCategoryTree(settings?.categories || [])}
                        onAdd={async (name, description, parentId) => {
                            setError(null);
                            try {
                                await inventoryService.createCategory(name, description || undefined, parentId);
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                                await fetchSettings();
                            } catch (err: any) {
                                setError(err.message || 'Failed to add category');
                            }
                        }}
                        onUpdate={async (id, data) => {
                            setError(null);
                            try {
                                await inventoryService.updateCategory(id, data);
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                                await fetchSettings();
                            } catch (err: any) {
                                setError(err.message || 'Failed to update category');
                            }
                        }}
                        onDelete={async (id) => {
                            setError(null);
                            try {
                                await inventoryService.deleteCategory(id);
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                                await fetchSettings();
                            } catch (err: any) {
                                setError(err.message || 'Failed to delete category');
                            }
                        }}
                        canManage={can('manage_locations')}
                        onSelect={() => {}}
                    />
                </section>

                {/* Item Attributes */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-slate-50 mb-2 flex items-center gap-2">
                        <ListFilter size={20} className="text-emerald-500" /> Item Attributes
                    </h2>
                    <p className="text-sm text-slate-500 mb-4">Define custom attributes per category (e.g. Material, Finish, Shelf Life). Values are stored as flexible metadata on each item.</p>
                    <ItemAttributeSettingsSection
                        categories={settings?.categories || []}
                        canManage={can('manage_locations')}
                    />
                </section>

                {/* Product Types */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-slate-50 mb-2 flex items-center gap-2">
                        <Sliders size={20} className="text-blue-500" /> Product Types
                    </h2>
                    <p className="text-sm text-slate-500 mb-4">Define product type templates with custom attribute fields (e.g. Electronics, Clothing)</p>
                    <button
                        onClick={() => navigate('/inventory/settings/product-types')}
                        className="w-full flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50 transition-all group"
                    >
                        <div className="text-left">
                            <p className="text-sm font-semibold text-slate-200">Manage Product Types</p>
                            <p className="text-xs text-slate-500">View system templates, create custom types, define attribute schemas</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </button>
                </section>

                {/* Integration Rules */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-slate-50 mb-4 flex items-center gap-2">
                        <MapPin size={20} className="text-amber-500" /> Default Logic
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                            <div>
                                <p className="text-sm font-semibold text-slate-200">Enforce Negative Stock Prevention</p>
                                <p className="text-xs text-slate-500">Block transactions if available quantity would drop below zero</p>
                            </div>
                            <button
                                type="button"
                                disabled={togglingLogic}
                                onClick={() => handleToggleLogic('allow_negative_stock', !allowNegativeStock)}
                                className={`w-12 h-6 rounded-full relative transition-colors disabled:opacity-50 ${allowNegativeStock ? 'bg-blue-600' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${allowNegativeStock ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                            <div>
                                <p className="text-sm font-semibold text-slate-200">Auto-approve Transfers</p>
                                <p className="text-xs text-slate-500">Mark transfers as Completed immediately after submission</p>
                            </div>
                            <button
                                type="button"
                                disabled={togglingLogic}
                                onClick={() => handleToggleLogic('auto_approve_transfers', !autoApproveTransfers)}
                                className={`w-12 h-6 rounded-full relative transition-colors disabled:opacity-50 ${autoApproveTransfers ? 'bg-blue-600' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoApproveTransfers ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <div className="mt-10 p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl">
                <p className="text-xs text-slate-500 leading-relaxed text-center">
                    Note: These settings apply globally to the <b>{inventoryService ? 'Neonbee' : ''} Inventory</b>.
                    Changes may affect ledger calculations and historical reporting.
                </p>
            </div>
        </div>
    );
};

export default SettingsPage;
