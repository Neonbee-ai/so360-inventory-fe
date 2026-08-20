import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Plus, Upload, X, Loader2, AlertCircle, ImageIcon, Save } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { mediaService } from '../services/mediaService';
import { useAuth } from '../hooks/useAuth';
import CategoryTreeView from '../components/categories/CategoryTreeView';
import CategoryIconLibrary from '../components/categories/CategoryIconLibrary';
import { buildCategoryTree } from '../utils/categoryTree';
import { ItemCategory } from '../types/inventory';
import { renderCategoryIcon, isPresetUrl } from '../constants/categoryIcons';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { FeatureGate } from '@so360/design-system';

const PRESET_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#64748B'];

const ImageUploadZone: React.FC<{
    label: string;
    subLabel?: string;
    currentUrl: string | null | undefined;
    aspectClass?: string;
    onUpload: (url: string) => void;
    onRemove: () => void;
}> = ({ label, subLabel, currentUrl, aspectClass = 'aspect-[3/1]', onUpload, onRemove }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = async (file: File) => {
        if (file.size > 2 * 1024 * 1024) { setUploadError('Max file size is 2MB'); return; }
        if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { setUploadError('PNG, JPG or SVG only'); return; }
        setUploadError(null);
        setUploading(true);
        try {
            const { url } = await mediaService.uploadFile(file);
            onUpload(url);
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    return (
        <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">{label}</label>
            {currentUrl ? (
                <div className={`relative ${aspectClass} rounded-xl overflow-hidden bg-slate-800 border border-slate-700`}>
                    <img src={currentUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="bg-white/10 backdrop-blur-sm border border-white/20 text-slate-50 px-3 py-1.5 rounded-lg text-xs hover:bg-white/20 transition-colors flex items-center gap-1.5"
                        >
                            <Upload size={12} /> Replace
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            className="bg-rose-500/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs hover:bg-rose-500 transition-colors flex items-center gap-1.5"
                        >
                            <X size={12} /> Remove
                        </button>
                    </div>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                </div>
            ) : (
                <div
                    className={`${aspectClass} rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 ${dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                >
                    {uploading ? (
                        <Loader2 size={20} className="text-blue-400 animate-spin" />
                    ) : (
                        <>
                            <ImageIcon size={20} className="text-slate-600" />
                            <span className="text-xs text-slate-500 text-center px-4">{subLabel || 'Click or drag to upload'}</span>
                        </>
                    )}
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                </div>
            )}
            {uploadError && (
                <p className="text-xs text-rose-400 mt-1">{uploadError}</p>
            )}
        </div>
    );
};

// ─── Cards View ────────────────────────────────────────────────────────────────
const CategoryCardsView: React.FC<{
    categories: ItemCategory[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}> = ({ categories, selectedId, onSelect }) => {
    const roots = categories.filter(c => !c.parent_id);

    const getParentName = (parentId: string | null | undefined): string => {
        if (!parentId) return '';
        return categories.find(c => c.id === parentId)?.name || '';
    };

    const renderCard = (cat: ItemCategory) => {
        const isRoot = !cat.parent_id;
        const isSelected = cat.id === selectedId;

        return (
            <div
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`relative cursor-pointer rounded-xl overflow-hidden transition-all hover:scale-[1.02] hover:opacity-95 ${
                    isRoot ? 'col-span-2' : 'col-span-1'
                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                style={{ aspectRatio: isRoot ? '3/1' : '1/1' }}
            >
                {/* Background */}
                {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div
                        className="absolute inset-0"
                        style={{
                            background: cat.color
                                ? `linear-gradient(135deg, ${cat.color}cc, ${cat.color}66)`
                                : 'linear-gradient(135deg, rgb(var(--s-800)), rgb(var(--s-700)))',
                        }}
                    />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* Icon top-left */}
                <div className="absolute top-2 left-2">
                    {renderCategoryIcon({
                        iconUrl: cat.icon_url,
                        imageUrl: undefined,
                        name: cat.name,
                        color: cat.color,
                        size: 28,
                    })}
                </div>

                {/* Name bottom */}
                <div className="absolute bottom-2 left-2 right-2">
                    {!isRoot && getParentName(cat.parent_id) && (
                        <p className="text-[10px] text-slate-50/60 leading-none mb-0.5 truncate">{getParentName(cat.parent_id)}</p>
                    )}
                    <p className={`text-slate-50 font-semibold truncate ${isRoot ? 'text-base' : 'text-sm'}`}>{cat.name}</p>
                </div>

                {/* Banner indicator */}
                {cat.image_url && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400" title="Has banner image" />
                )}
            </div>
        );
    };

    // Build ordered list: root + its children, then next root + its children
    const orderedCards: ItemCategory[] = [];
    roots.forEach(root => {
        orderedCards.push(root);
        categories.filter(c => c.parent_id === root.id).forEach(child => orderedCards.push(child));
    });
    // Include subcategories whose parents aren't in roots (edge case)
    categories.forEach(c => {
        if (!orderedCards.find(o => o.id === c.id)) orderedCards.push(c);
    });

    if (orderedCards.length === 0) {
        return <p className="text-sm text-slate-500 italic py-4">No categories created yet</p>;
    }

    return (
        <div className="grid grid-cols-2 gap-2">
            {orderedCards.map(cat => renderCard(cat))}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const CategoriesPage = () => {
    const navigate = useNavigate();
    const { can } = useAuth();
    const canManage = can('items.update');
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const createState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:items:create') : 'enabled';
    const canCreate = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('items.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && createState === 'enabled';
    const deleteState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:items:delete') : 'enabled';
    const canDelete = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('items.delete') ?? false) && (shell?.effectiveFlagsLoaded !== false) && deleteState === 'enabled';

    const [categories, setCategories] = useState<ItemCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'tree' | 'cards'>('tree');
    const [showAddRoot, setShowAddRoot] = useState(false);

    // Detail panel state
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editIconUrl, setEditIconUrl] = useState<string | null>(null);
    const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
    const [editSortOrder, setEditSortOrder] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const fetchCategories = async () => {
        try {
            setIsLoading(true);
            const data = await inventoryService.getSettings();
            setCategories(data.categories || []);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load categories');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchCategories(); }, []);

    const selectedCategory = useMemo(() => categories.find(c => c.id === selectedId) || null, [categories, selectedId]);

    const itemsCountMap = useMemo(() => {
        // placeholder — item count per category not fetched here
        return {} as Record<string, number>;
    }, []);

    useEffect(() => {
        if (!selectedCategory) return;
        setEditName(selectedCategory.name || '');
        setEditDesc(selectedCategory.description || '');
        setEditColor(selectedCategory.color || '');
        setEditIconUrl(selectedCategory.icon_url || null);
        setEditImageUrl(selectedCategory.image_url || null);
        setEditSortOrder(selectedCategory.sort_order ?? 0);
        setSaveError(null);
        setSaveSuccess(false);
    }, [selectedCategory?.id]);

    const tree = useMemo(() => buildCategoryTree(categories), [categories]);

    const handleAdd = async (name: string, description: string, parentId?: string) => {
        setError(null);
        try {
            const created = await inventoryService.createCategory(name, description || undefined, parentId);
            recordActivity({ eventType: 'inventory.category.created', eventCategory: 'data', description: `Created category "${name}"`, resourceType: 'category', resourceId: created.id }).catch(() => {});
            await fetchCategories();
            setSelectedId(created.id);
        } catch (err: any) {
            setError(err.message || 'Failed to add category');
        }
    };

    const handleUpdate = async (id: string, data: { name?: string; description?: string; icon_url?: string | null; image_url?: string | null; color?: string | null }) => {
        setError(null);
        try {
            await inventoryService.updateCategory(id, data);
            recordActivity({ eventType: 'inventory.category.updated', eventCategory: 'data', description: `Updated category "${data.name || id}"`, resourceType: 'category', resourceId: id }).catch(() => {});
            await fetchCategories();
        } catch (err: any) {
            setError(err.message || 'Failed to update category');
        }
    };

    const handleDelete = async (id: string) => {
        setError(null);
        try {
            await inventoryService.deleteCategory(id);
            recordActivity({ eventType: 'inventory.category.deleted', eventCategory: 'data', description: `Deleted category`, resourceType: 'category', resourceId: id }).catch(() => {});
            if (selectedId === id) setSelectedId(null);
            await fetchCategories();
        } catch (err: any) {
            setError(err.message || 'Failed to delete category');
        }
    };

    const handleSaveDetail = async () => {
        if (!selectedId || !editName.trim()) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            await inventoryService.updateCategory(selectedId, {
                name: editName.trim(),
                description: editDesc.trim() || undefined,
                color: editColor || null,
                icon_url: editIconUrl,
                image_url: editImageUrl,
                sort_order: editSortOrder,
            });
            recordActivity({ eventType: 'inventory.category.updated', eventCategory: 'data', description: `Updated category "${editName.trim()}"`, resourceType: 'category', resourceId: selectedId }).catch(() => {});
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
            await fetchCategories();
        } catch (err: any) {
            setSaveError(err.message || 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center gap-3 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                Loading categories...
            </div>
        );
    }

    return (
        <div className="p-8">
            <header className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
                        <Tag className="text-purple-400" /> Product Categories
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm">Organize your products with a hierarchical category system</p>
                </div>
                {canManage && (
                    <FeatureGate state={createState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <button
                        onClick={() => {
                            setSelectedId(null);
                            setViewMode('tree');
                            setShowAddRoot(true);
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> New Category
                    </button>
                    </FeatureGate>
                )}
            </header>

            {error && (
                <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3 text-sm">
                    <AlertCircle size={16} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
                </div>
            )}

            <div className="flex gap-6 items-start">
                {/* Left panel — tree / cards */}
                <div className="w-1/3 min-w-[260px] bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Categories</h2>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setViewMode('tree')}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${viewMode === 'tree' ? 'bg-slate-700 text-slate-50' : 'text-slate-500 hover:text-slate-300'}`}
                            >Tree</button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${viewMode === 'cards' ? 'bg-slate-700 text-slate-50' : 'text-slate-500 hover:text-slate-300'}`}
                            >Cards</button>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mb-3">
                        {categories.filter(c => c.icon_url || c.image_url).length} of {categories.length} have images
                    </p>
                    <div className="overflow-y-auto max-h-[600px]">
                        {viewMode === 'tree' ? (
                            <CategoryTreeView
                                tree={tree}
                                onAdd={canCreate ? handleAdd : undefined}
                                onUpdate={handleUpdate}
                                onDelete={canDelete ? handleDelete : undefined}
                                canManage={canManage}
                                onSelect={setSelectedId}
                                showAddRoot={showAddRoot}
                                onShowAddRootChange={setShowAddRoot}
                            />
                        ) : (
                            <CategoryCardsView
                                categories={categories}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                            />
                        )}
                    </div>
                </div>

                {/* Right panel — detail editor */}
                <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    {!selectedCategory ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                                <Tag size={28} className="text-slate-600" />
                            </div>
                            <p className="text-slate-500 text-sm">Select a category from the tree<br />to view and edit its details</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-50">
                                    {selectedCategory.parent_id ? 'Edit Subcategory' : 'Edit Category'}
                                </h2>
                                <div className="flex items-center gap-2">
                                    {saveSuccess && <span className="text-xs text-emerald-400">Saved!</span>}
                                    {saveError && <span className="text-xs text-rose-400">{saveError}</span>}
                                    <button
                                        onClick={handleSaveDetail}
                                        disabled={isSaving || !editName.trim()}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        Save
                                    </button>
                                </div>
                            </div>

                            {/* Banner image upload */}
                            <ImageUploadZone
                                label="Category Banner Image"
                                subLabel="PNG, JPG, SVG · max 2MB · 1200×400px recommended"
                                currentUrl={editImageUrl}
                                aspectClass="aspect-[3/1]"
                                onUpload={url => setEditImageUrl(url)}
                                onRemove={() => setEditImageUrl(null)}
                            />

                            {/* Icon upload + Name row */}
                            <div className="flex items-start gap-4">
                                {/* Icon — preset preview OR upload zone */}
                                {editIconUrl && isPresetUrl(editIconUrl) ? (
                                    <div className="flex-shrink-0">
                                        <label className="text-xs font-medium text-slate-400 mb-1 block">Icon</label>
                                        <div
                                            className="w-20 h-20 rounded-xl flex items-center justify-center relative group"
                                            style={{ background: editColor || 'rgb(var(--s-700))' }}
                                        >
                                            {renderCategoryIcon({ iconUrl: editIconUrl, name: editName, color: editColor, size: 48 })}
                                            <button
                                                type="button"
                                                onClick={() => setEditIconUrl(null)}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-shrink-0">
                                        <label className="text-xs font-medium text-slate-400 mb-1 block">Icon</label>
                                        <ImageUploadZone
                                            label=""
                                            subLabel="Square · max 2MB"
                                            currentUrl={editIconUrl}
                                            aspectClass="w-20 h-20"
                                            onUpload={url => setEditIconUrl(url)}
                                            onRemove={() => setEditIconUrl(null)}
                                        />
                                    </div>
                                )}

                                {/* Name + Description */}
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 mb-1 block">Name *</label>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                                            placeholder="Category name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 mb-1 block">Description</label>
                                        <textarea
                                            value={editDesc}
                                            onChange={e => setEditDesc(e.target.value)}
                                            rows={2}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-blue-500 placeholder:text-slate-600 resize-none"
                                            placeholder="Brief description..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Preset icon library */}
                            <CategoryIconLibrary
                                currentUrl={editIconUrl}
                                categoryColor={editColor}
                                onSelect={url => setEditIconUrl(url)}
                            />

                            {/* Color picker + Sort order */}
                            <div className="flex items-start gap-6">
                                <div>
                                    <label className="text-xs font-medium text-slate-400 mb-2 block">Color</label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setEditColor(editColor === c ? '' : c)}
                                                className="w-7 h-7 rounded-full border-2 transition-all"
                                                style={{ background: c, borderColor: editColor === c ? 'white' : 'transparent' }}
                                            />
                                        ))}
                                        {editColor && (
                                            <button type="button" onClick={() => setEditColor('')} className="text-xs text-slate-500 hover:text-slate-300">
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    {editColor && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded" style={{ background: editColor }} />
                                            <span className="text-xs text-slate-500 font-mono">{editColor}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-slate-400 mb-2 block">Sort Order</label>
                                    <input
                                        type="number"
                                        value={editSortOrder}
                                        onChange={e => setEditSortOrder(parseInt(e.target.value) || 0)}
                                        className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 focus:outline-none focus:border-blue-500"
                                        min={0}
                                    />
                                    <p className="text-xs text-slate-600 mt-1">Lower = appears first</p>
                                </div>
                            </div>

                            {/* Parent info */}
                            {selectedCategory.parent_id && (
                                <div className="bg-slate-800/50 rounded-lg px-4 py-3 text-sm text-slate-400">
                                    <span className="text-slate-500 text-xs">Parent: </span>
                                    {categories.find(c => c.id === selectedCategory.parent_id)?.name || selectedCategory.parent_id}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoriesPage;
