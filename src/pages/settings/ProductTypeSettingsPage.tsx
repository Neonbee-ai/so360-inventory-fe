import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { FeatureGate } from '@so360/design-system';
import { ArrowLeft, Plus, Trash2, Pencil, ChevronRight, AlertCircle, CheckCircle2, Sliders } from 'lucide-react';
import { ProductType, ProductTypeAttribute } from '../../types/productTypes';
import { productTypeService } from '../../services/productTypeService';
import AttributeEditor from './components/AttributeEditor';

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600';

const ProductTypeSettingsPage = () => {
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const manageProductTypesState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:product_types:create') : 'enabled';
    const canManageProductTypes = (shell?.effectiveFlagsLoaded !== false) && manageProductTypesState === 'enabled';
    const [types, setTypes] = useState<ProductType[]>([]);
    const [selectedType, setSelectedType] = useState<ProductType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Create new type state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Add attribute state
    const [showAddAttr, setShowAddAttr] = useState(false);

    useEffect(() => { loadTypes(); }, []);

    const loadTypes = async () => {
        try {
            setLoading(true);
            const data = await productTypeService.getAll();
            setTypes(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load product types');
        } finally {
            setLoading(false);
        }
    };

    const loadTypeDetail = async (id: string) => {
        try {
            const data = await productTypeService.getOne(id);
            setSelectedType(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load product type');
        }
    };

    const handleCreate = async () => {
        if (!newName.trim() || !newCode.trim()) return;
        setIsCreating(true);
        setError(null);
        try {
            await productTypeService.create({ name: newName.trim(), code: newCode.trim(), description: newDesc.trim() || undefined });
            recordActivity({ eventType: 'inventory.product_type.created', eventCategory: 'configuration', description: `Created product type "${newName.trim()}"`, resourceType: 'product_type' }).catch(() => {});
            setShowCreateForm(false);
            setNewName('');
            setNewCode('');
            setNewDesc('');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await loadTypes();
        } catch (err: any) {
            setError(err.message || 'Failed to create product type');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this product type?')) return;
        setError(null);
        try {
            await productTypeService.delete(id);
            recordActivity({ eventType: 'inventory.product_type.deleted', eventCategory: 'configuration', description: 'Deleted a product type', resourceType: 'product_type', resourceId: id }).catch(() => {});
            if (selectedType?.id === id) setSelectedType(null);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await loadTypes();
        } catch (err: any) {
            setError(err.message || 'Failed to delete');
        }
    };

    const handleAddAttribute = async (data: any) => {
        if (!selectedType) return;
        setError(null);
        try {
            await productTypeService.addAttribute(selectedType.id, data);
            recordActivity({ eventType: 'inventory.product_type.attribute_added', eventCategory: 'configuration', description: `Added attribute to product type "${selectedType.name}"`, resourceType: 'product_type', resourceId: selectedType.id }).catch(() => {});
            setShowAddAttr(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await loadTypeDetail(selectedType.id);
        } catch (err: any) {
            setError(err.message || 'Failed to add attribute');
        }
    };

    const handleDeleteAttribute = async (attrId: string) => {
        if (!selectedType || !confirm('Delete this attribute?')) return;
        setError(null);
        try {
            await productTypeService.deleteAttribute(selectedType.id, attrId);
            recordActivity({ eventType: 'inventory.product_type.attribute_deleted', eventCategory: 'configuration', description: `Removed attribute from product type "${selectedType.name}"`, resourceType: 'product_type', resourceId: selectedType.id }).catch(() => {});
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await loadTypeDetail(selectedType.id);
        } catch (err: any) {
            setError(err.message || 'Failed to delete attribute');
        }
    };

    if (loading) return <div className="p-8"><div className="animate-pulse text-slate-500">Loading product types...</div></div>;

    return (
        <div className="p-8">
            <header className="mb-8">
                <button onClick={() => navigate('/inventory/settings')} className="flex items-center gap-2 text-slate-400 hover:text-slate-50 transition-colors mb-4">
                    <ArrowLeft size={18} /> <span className="text-sm">Back to Settings</span>
                </button>
                <h1 className="text-2xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
                    <Sliders className="text-blue-500" size={24} /> Product Types
                </h1>
                <p className="text-slate-400 mt-1">Manage product type templates and their attribute schemas</p>
            </header>

            {error && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} /> <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <CheckCircle2 size={18} /> <span>Saved successfully</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Type list */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Types</h2>
                        <FeatureGate state={manageProductTypesState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                            >
                                <Plus size={14} /> New
                            </button>
                        </FeatureGate>
                    </div>

                    {showCreateForm && (
                        <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
                            <input type="text" value={newName} onChange={e => { setNewName(e.target.value); setNewCode(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_')); }} className={inputClass} placeholder="Name *" autoFocus />
                            <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} className={inputClass} placeholder="Code *" />
                            <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} className={inputClass} placeholder="Description" />
                            <div className="flex gap-2">
                                <button onClick={() => setShowCreateForm(false)} className="flex-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-sm">Cancel</button>
                                <button onClick={handleCreate} disabled={isCreating || !newName.trim() || !newCode.trim()} className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium">
                                    {isCreating ? '...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    )}

                    {types.map(pt => (
                        <button
                            key={pt.id}
                            onClick={() => loadTypeDetail(pt.id)}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                                selectedType?.id === pt.id
                                    ? 'border-blue-500 bg-blue-500/10'
                                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                            }`}
                        >
                            <div>
                                <span className="text-sm font-medium text-slate-200">{pt.name}</span>
                                {pt.is_system && <span className="ml-2 text-[10px] text-slate-600 uppercase">System</span>}
                                <p className="text-xs text-slate-500 mt-0.5">{pt.code}</p>
                            </div>
                            <ChevronRight size={14} className="text-slate-600" />
                        </button>
                    ))}
                </div>

                {/* Right: Type detail + attributes */}
                <div className="md:col-span-2">
                    {selectedType ? (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-50">{selectedType.name}</h2>
                                    <p className="text-sm text-slate-500">{selectedType.description || selectedType.code}</p>
                                    {selectedType.is_system && (
                                        <span className="inline-block mt-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">System template — attributes are read-only</span>
                                    )}
                                </div>
                                {!selectedType.is_system && canManageProductTypes && (
                                    <button
                                        onClick={() => handleDelete(selectedType.id)}
                                        className="text-slate-500 hover:text-rose-400 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>

                            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Attributes</h3>

                            {selectedType.product_type_attributes && selectedType.product_type_attributes.length > 0 ? (
                                <div className="space-y-2 mb-4">
                                    {selectedType.product_type_attributes.map((attr: ProductTypeAttribute) => (
                                        <div key={attr.id} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg group">
                                            <div>
                                                <span className="text-sm text-slate-200">{attr.label}</span>
                                                <span className="ml-2 text-xs text-slate-600">{attr.field_name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">{attr.field_type}</span>
                                                    {attr.is_required && <span className="text-xs text-rose-400">Required</span>}
                                                    {attr.unit && <span className="text-xs text-slate-600">{attr.unit}</span>}
                                                    {attr.field_type === 'select' && attr.options && (
                                                        <span className="text-xs text-slate-600">{attr.options.length} options</span>
                                                    )}
                                                </div>
                                            </div>
                                            {!selectedType.is_system && canManageProductTypes && (
                                                <button
                                                    onClick={() => handleDeleteAttribute(attr.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 mb-4">No attributes defined</p>
                            )}

                            {!selectedType.is_system && canManageProductTypes && (
                                <>
                                    {showAddAttr ? (
                                        <AttributeEditor
                                            onSave={handleAddAttribute}
                                            onCancel={() => setShowAddAttr(false)}
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setShowAddAttr(true)}
                                            className="w-full border border-dashed border-slate-700 px-4 py-3 rounded-lg text-sm text-slate-500 hover:text-blue-400 hover:border-blue-500/50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={16} /> Add Attribute
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Sliders size={48} className="text-slate-700 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-400 mb-2">Select a Product Type</h3>
                            <p className="text-sm text-slate-500">Choose a type from the left panel to view and manage its attributes</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductTypeSettingsPage;
