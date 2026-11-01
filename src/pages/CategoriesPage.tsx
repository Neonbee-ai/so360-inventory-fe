import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Plus, Upload, X, Loader2, ImageIcon, Save, ChevronDown, ChevronRight, Building2, LayoutGrid, Sparkles } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { mediaService } from '../services/mediaService';
import { useAuth } from '../hooks/useAuth';
import CategoryTreeView from '../components/categories/CategoryTreeView';
import CategoryIconLibrary from '../components/categories/CategoryIconLibrary';
import CategoryChannelsPanel from '../components/categories/CategoryChannelsPanel';
import { buildCategoryTree } from '../utils/categoryTree';
import { ItemCategory, CategoryMetadata } from '../types/inventory';
import { isUnitAllocationEnabled, usePropertyUnits } from '../hooks/usePropertyUnits';
import ProjectDetailsSection from '../components/categories/ProjectDetailsSection';
import GenerateUnitsDialog from '../components/categories/GenerateUnitsDialog';
import AvailabilityMatrix from '../components/categories/AvailabilityMatrix';
import DeveloperCard from '../components/categories/DeveloperCard';
import AssignedAgentsPanel from '../components/categories/AssignedAgentsPanel';
import { inheritedAllocation } from '../utils/unitAllocation';
import { cleanTemplates, templatesError } from '../utils/paymentPlanTemplates';
import { projectsOfDeveloper } from '../utils/developerProfile';
import { renderCategoryIcon, isPresetUrl } from '../constants/categoryIcons';
import {
    assessImageForSlot,
    CATEGORY_BANNER_SLOT,
    CATEGORY_IMAGE_SLOT,
    type ImageSlotSpec,
    type ProductImageAssessment,
} from '../utils/imageRatio';
import { fitImageFile, describeFit, IMAGE_FIT_SLOTS, type ImageFitSlot } from '../utils/imageFit';
import ImageSpecChip from '../components/media/ImageSpecChip';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { Alert, Button, Card, Cluster, FeatureGate, IconButton, ListPageTemplate, SegmentedControl, TextField, Textarea, Grid, GridItem } from '@so360/design-system';

const PRESET_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#64748B'];

/** Core media's hard limit. Images are auto-fitted to their slot's cap first. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

/** Limits enforced by inventory-be (CategoryFieldsDto) and migration 057. */
export const CATEGORY_SEO_LIMITS = { metaTitle: 70, metaDescription: 160, bannerAlt: 200, slug: 100 } as const;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same shape the DB trigger derives when the slug is left blank. */
const slugFromName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'category';

const CharCount: React.FC<{ value: string; max: number; testId: string }> = ({ value, max, testId }) => (
    <span
        data-testid={testId}
        className={`text-nb-overline tabular-nums ${value.length > max ? 'text-danger' : value.length > max * 0.9 ? 'text-warning' : 'text-fg-subtle'}`}
    >
        {value.length}/{max}
    </span>
);

const ImageUploadZone: React.FC<{
    label: string;
    subLabel?: string;
    currentUrl: string | null | undefined;
    aspectClass?: string;
    onUpload: (url: string) => void;
    onRemove: () => void;
    /** Target shape/size; when set, the preview shows a size badge graded against it. */
    slot?: ImageSlotSpec;
    /** Stored size + cap: files are auto-fitted to it before upload and the chip shows it. */
    fitSlot: ImageFitSlot;
    /** Alt text for the preview image. */
    alt?: string;
}> = ({ label, subLabel, currentUrl, aspectClass = 'aspect-[3/1]', onUpload, onRemove, slot, fitSlot, alt = '' }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [assessment, setAssessment] = useState<ProductImageAssessment | null>(null);
    /** What auto-fit did to the last file — never silent. */
    const [fitNote, setFitNote] = useState<string | null>(null);

    useEffect(() => { setAssessment(null); }, [currentUrl]);

    const handleFile = async (file: File) => {
        if (!IMAGE_TYPES.includes(file.type)) { setUploadError('PNG, JPG, SVG or WebP only'); return; }
        setUploadError(null);
        setFitNote(null);
        setUploading(true);
        try {
            let toSend = file;
            try {
                const fit = await fitImageFile(file, fitSlot);
                toSend = fit.file;
                setFitNote(describeFit(fit));
            } catch {
                toSend = file; // fall back to the original if it still fits
            }
            if (toSend.size > MAX_IMAGE_BYTES) { setUploadError('Max file size is 10 MB'); return; }
            const { url } = await mediaService.uploadFile(toSend);
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
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {/* comb-exception: caption for the upload zone (not a form control); Comb has no standalone caption primitive */}
                {label && <label className="text-xs font-medium text-fg-muted">{label}</label>}
                <ImageSpecChip slot={fitSlot} />
            </div>
            {currentUrl ? (
                <div className={`relative ${aspectClass} rounded-xl overflow-hidden bg-surface-raised border border-line-strong`}>
                    <img
                        src={currentUrl}
                        alt={alt}
                        className="w-full h-full object-cover"
                        onLoad={e => {
                            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                            setAssessment(slot && w > 0 && h > 0 ? assessImageForSlot(w, h, slot) : null);
                        }}
                    />
                    {assessment && (
                        <div
                            data-testid="slot-size-badge"
                            title={assessment.ok ? 'Good fit for this slot' : assessment.issues.join('\n')}
                            className={`absolute bottom-0 inset-x-0 px-2 py-0.5 text-nb-overline leading-tight text-center truncate ${
                                assessment.ok ? 'bg-surface/80 text-fg-muted' : 'bg-warning/90 text-primary-fg font-medium'
                            }`}
                        >
                            {assessment.ok ? '' : '⚠ '}{assessment.size} · {assessment.ratio}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-overlay/0 hover:bg-overlay/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                        <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><Upload size={12} /> Replace</Button>
                        <Button type="button" variant="danger" size="sm" onClick={onRemove}><X size={12} /> Remove</Button>
                    </div>
                    {/* comb-exception: hidden native file input driven by the Comb Replace button / drop zone */}
                    <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                </div>
            ) : (
                <div
                    className={`${aspectClass} rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 ${dragOver ? 'border-primary bg-primary/5' : 'border-line-strong hover:border-line-strong bg-surface-raised/30'}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                >
                    {uploading ? (
                        <Loader2 size={20} className="text-primary animate-spin" />
                    ) : (
                        <>
                            <ImageIcon size={20} className="text-fg-subtle" />
                            <span className="text-xs text-fg-subtle text-center px-4">{subLabel || 'Click or drag to upload'}</span>
                        </>
                    )}
                    {/* comb-exception: hidden native file input driven by the Comb Replace button / drop zone */}
                    <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                </div>
            )}
            {uploadError && (
                <p className="text-xs text-danger mt-1">{uploadError}</p>
            )}
            {fitNote && !uploadError && (
                <p data-testid="image-fit-note" className="text-nb-overline text-fg-subtle mt-1 break-words">{fitNote}</p>
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
                } ${isSelected ? 'ring-2 ring-focus' : ''}`}
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
                        <p className="text-nb-overline text-fg/60 leading-none mb-0.5 truncate">{getParentName(cat.parent_id)}</p>
                    )}
                    <p className={`text-fg font-semibold truncate ${isRoot ? 'text-base' : 'text-sm'}`}>{cat.name}</p>
                </div>

                {/* Banner indicator */}
                {cat.image_url && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-success" title="Has banner image" />
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
        return <p className="text-sm text-fg-subtle italic py-4">No categories created yet</p>;
    }

    return (
        <Grid columns={2} gap="sm">
            {orderedCards.map(cat => renderCard(cat))}
        </Grid>
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
    const channelVisibilityState = (shell as any)?.getFeatureState
        ? (shell as any).getFeatureState('submodule:inventory:channel_visibility')
        : 'enabled';
    const canCreate = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('items.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && createState === 'enabled';
    const deleteState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:items:delete') : 'enabled';
    const canDelete = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('items.delete') ?? false) && (shell?.effectiveFlagsLoaded !== false) && deleteState === 'enabled';
    // Real-estate mode: categories become Projects (root) / Towers (child).
    const { enabled: propertyUnits, labels } = usePropertyUnits();
    // Per-tower / per-unit agent overrides (action:crm:unit_allocation).
    const unitAllocation = propertyUnits && isUnitAllocationEnabled(shell);

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
    const [editBannerUrl, setEditBannerUrl] = useState<string | null>(null);
    const [editSortOrder, setEditSortOrder] = useState(0);
    const [editSlug, setEditSlug] = useState('');
    const [editMetaTitle, setEditMetaTitle] = useState('');
    const [editMetaDesc, setEditMetaDesc] = useState('');
    const [editBannerAlt, setEditBannerAlt] = useState('');
    const [seoOpen, setSeoOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const saveSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current); }, []);
    const [editMetadata, setEditMetadata] = useState<CategoryMetadata>({});
    const [showGenerate, setShowGenerate] = useState(false);
    const [showAvailability, setShowAvailability] = useState(false);
    const [availabilityKey, setAvailabilityKey] = useState(0);

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
    // The saved developer of the selected project (root category); drafts are not looked up.
    const selectedDeveloperId =
        propertyUnits && selectedCategory && !selectedCategory.parent_id
            ? selectedCategory.metadata?.developer_partner_id || null
            : null;
    const developerProjects = useMemo(
        () => projectsOfDeveloper(categories, selectedDeveloperId),
        [categories, selectedDeveloperId],
    );

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
        setEditBannerUrl(selectedCategory.banner_url || null);
        setEditSortOrder(selectedCategory.sort_order ?? 0);
        setEditSlug(selectedCategory.slug || '');
        setEditMetaTitle(selectedCategory.meta_title || '');
        setEditMetaDesc(selectedCategory.meta_description || '');
        setEditBannerAlt(selectedCategory.banner_alt || '');
        setEditMetadata({ ...(selectedCategory.metadata || {}) });
        setShowGenerate(false);
        setShowAvailability(false);
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

    const slugValue = editSlug.trim();
    const slugError = slugValue && !SLUG_PATTERN.test(slugValue)
        ? 'Use lowercase letters, numbers and single hyphens (e.g. summer-shoes)'
        : null;
    const previewSlug = slugValue || selectedCategory?.slug || slugFromName(editName);

    /**
     * SEO fields that differ from the saved category. Untouched fields are left
     * out so plain edits never name columns that may not exist before migration 057.
     */
    const changedSeoFields = () => {
        const out: { slug?: string; meta_title?: string | null; meta_description?: string | null; banner_alt?: string | null } = {};
        if (slugValue !== (selectedCategory?.slug ?? '')) out.slug = slugValue; // '' → DB regenerates from name
        const fields: Array<['meta_title' | 'meta_description' | 'banner_alt', string]> = [
            ['meta_title', editMetaTitle],
            ['meta_description', editMetaDesc],
            ['banner_alt', editBannerAlt],
        ];
        for (const [key, value] of fields) {
            const saved = selectedCategory?.[key];
            const next = value.trim();
            if (next !== (saved ?? '')) out[key] = next || null;
        }
        return out;
    };

    const handleSaveDetail = async () => {
        if (!selectedId || !editName.trim()) return;
        if (slugError) {
            setSeoOpen(true);
            setSaveError(slugError);
            return;
        }
        const isProject = propertyUnits && !selectedCategory?.parent_id;
        const isTower = unitAllocation && !!selectedCategory?.parent_id;
        const planError = isProject ? templatesError(editMetadata.payment_plan_templates) : null;
        if (planError) { setSaveError(planError); return; }
        setIsSaving(true);
        setSaveError(null);
        try {
            await inventoryService.updateCategory(selectedId, {
                name: editName.trim(),
                description: editDesc.trim() || undefined,
                color: editColor || null,
                icon_url: editIconUrl,
                image_url: editImageUrl,
                // Only when changed — keeps plain edits off the banner_url column,
                // which may not exist until migration 052 is applied.
                ...((editBannerUrl ?? null) !== (selectedCategory?.banner_url ?? null)
                    ? { banner_url: editBannerUrl }
                    : {}),
                sort_order: editSortOrder,
                ...changedSeoFields(),
                // Project details live on the root category only, and only in real-estate mode.
                ...(isProject
                    ? {
                        metadata: {
                            ...(selectedCategory?.metadata || {}),
                            ...editMetadata,
                            ...(editMetadata.payment_plan_templates !== undefined
                                ? { payment_plan_templates: cleanTemplates(editMetadata.payment_plan_templates) }
                                : {}),
                        },
                    }
                    : {}),
                // A tower only carries its agent/team override.
                ...(isTower
                    ? {
                        metadata: {
                            ...(selectedCategory?.metadata || {}),
                            assigned_user_ids: editMetadata.assigned_user_ids ?? null,
                            assigned_team_ids: editMetadata.assigned_team_ids ?? null,
                        },
                    }
                    : {}),
            });
            recordActivity({ eventType: 'inventory.category.updated', eventCategory: 'data', description: `Updated category "${editName.trim()}"`, resourceType: 'category', resourceId: selectedId }).catch(() => {});
            setSaveSuccess(true);
            if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current);
            saveSuccessTimer.current = setTimeout(() => setSaveSuccess(false), 2500);
            await fetchCategories();
        } catch (err: any) {
            setSaveError(err.message || 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center gap-3 text-fg-subtle">
                <Loader2 size={18} className="animate-spin" />
                Loading categories...
            </div>
        );
    }

    return (
        <ListPageTemplate trail={[]}
            title={propertyUnits ? labels.categories : 'Product Categories'}
            description={propertyUnits
                ? 'Projects, their towers and unit availability'
                : 'Organize your products with a hierarchical category system'}
            primaryAction={canManage ? (
                <FeatureGate state={createState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <Button
                        variant="primary"
                        onClick={() => {
                            setSelectedId(null);
                            setViewMode('tree');
                            setShowAddRoot(true);
                        }}
                    ><Plus size={16} />
                        {`New ${labels.category}`}
                    </Button>
                </FeatureGate>
            ) : undefined}
        >
            {error && (
                <div className="mb-4">
                    <Alert variant="error" action={{ label: 'Dismiss', onClick: () => setError(null) }}>{error}</Alert>
                </div>
            )}

            <Grid className="items-start">
                {/* Left panel — tree / cards */}
                <GridItem span={{ base: 'full', lg: 4 }}>
                  <Card
                    title={labels.categories}
                    actions={
                        <SegmentedControl
                            name="categories-view"
                            size="sm"
                            aria-label="Categories view"
                            value={viewMode}
                            onChange={(v: string) => setViewMode(v as 'tree' | 'cards')}
                            options={[{ value: 'tree', label: 'Tree' }, { value: 'cards', label: 'Cards' }]}
                        />
                    }
                  >
                    <p className="text-nb-caption text-fg-muted mb-3">
                        {categories.filter(c => c.icon_url || c.image_url || c.banner_url).length} of {categories.length} have images
                    </p>
                    <div className="overflow-y-auto max-h-96">
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
                  </Card>
                </GridItem>

                {/* Right panel — detail editor */}
                <GridItem span={{ base: 'full', lg: 8 }}>
                  <Card
                    title={selectedCategory ? `Edit ${selectedCategory.parent_id ? labels.subcategory : labels.category}` : undefined}
                    actions={selectedCategory ? (
                        <Cluster gap="tight">
                            {saveSuccess && <span className="text-nb-caption text-success">Saved!</span>}
                            {saveError && <span className="text-nb-caption text-danger">{saveError}</span>}
                            <Button
                                variant="primary"
                                onClick={handleSaveDetail}
                                disabled={isSaving || !editName.trim() || !!slugError}
                                loading={isSaving}
                            ><Save size={14} />
                                Save
                            </Button>
                        </Cluster>
                    ) : undefined}
                  >
                    {!selectedCategory ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-surface-raised flex items-center justify-center">
                                <Tag size={28} className="text-fg-subtle" />
                            </div>
                            <p className="text-fg-subtle text-sm">Select a {labels.category.toLowerCase()} from the tree<br />to view and edit its details</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Real estate: project details, unit generation and availability */}
                            {propertyUnits && (
                                <div className="space-y-4" data-testid="property-units-panel">
                                    {selectedDeveloperId && (
                                        <DeveloperCard
                                            key={selectedDeveloperId}
                                            partnerId={selectedDeveloperId}
                                            projects={developerProjects}
                                            currentProjectId={selectedCategory.id}
                                            onSelectProject={setSelectedId}
                                            canEdit={canManage}
                                        />
                                    )}
                                    {!selectedCategory.parent_id && (
                                        <ProjectDetailsSection
                                            value={editMetadata}
                                            onChange={setEditMetadata}
                                            disabled={!canManage}
                                        />
                                    )}
                                    {unitAllocation && selectedCategory.parent_id && (
                                        <AssignedAgentsPanel
                                            scope="tower"
                                            value={{
                                                assigned_user_ids: editMetadata.assigned_user_ids ?? null,
                                                assigned_team_ids: editMetadata.assigned_team_ids ?? null,
                                            }}
                                            onChange={next => setEditMetadata(m => ({ ...m, ...next }))}
                                            inherited={inheritedAllocation(categories, selectedCategory.parent_id)}
                                            disabled={!canManage}
                                        />
                                    )}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setShowAvailability(v => !v)}
                                            aria-pressed={showAvailability}
                                        ><LayoutGrid size={14} />
                                            {showAvailability ? 'Hide availability' : 'Availability'}
                                        </Button>
                                        {selectedCategory.parent_id && canCreate && (
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                onClick={() => setShowGenerate(true)}
                                            ><Sparkles size={14} />
                                                Generate units
                                            </Button>
                                        )}
                                    </div>
                                    {showAvailability && (
                                        <AvailabilityMatrix
                                            key={selectedCategory.id}
                                            categoryId={selectedCategory.id}
                                            refreshKey={availabilityKey}
                                            canManage={canManage}
                                            allocationEnabled={unitAllocation}
                                            categories={categories}
                                        />
                                    )}
                                    {selectedCategory.parent_id && (
                                        <GenerateUnitsDialog
                                            isOpen={showGenerate}
                                            onClose={() => setShowGenerate(false)}
                                            tower={{ id: selectedCategory.id, name: selectedCategory.name }}
                                            onGenerated={result => {
                                                setAvailabilityKey(k => k + 1);
                                                recordActivity({
                                                    eventType: 'inventory.category.units_generated',
                                                    eventCategory: 'data',
                                                    description: `Generated ${result.created} units in "${selectedCategory.name}"`,
                                                    resourceType: 'category',
                                                    resourceId: selectedCategory.id,
                                                }).catch(() => {});
                                            }}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Banner (category page hero) + square image (category tiles) */}
                            <ImageUploadZone
                                label="Category banner"
                                subLabel="Shown at the top of the category page"
                                currentUrl={editBannerUrl}
                                aspectClass="aspect-[16/5]"
                                slot={CATEGORY_BANNER_SLOT}
                                fitSlot={IMAGE_FIT_SLOTS.categoryBanner}
                                onUpload={url => setEditBannerUrl(url)}
                                onRemove={() => setEditBannerUrl(null)}
                                alt={editBannerAlt}
                            />
                            <div className="-mt-3">
                                <div className="flex justify-end mb-1">
                                    <CharCount value={editBannerAlt} max={CATEGORY_SEO_LIMITS.bannerAlt} testId="banner-alt-count" />
                                </div>
                                <TextField
                                    name="category-banner-alt"
                                    id="category-banner-alt"
                                    label="Banner alt text"
                                    value={editBannerAlt}
                                    maxLength={CATEGORY_SEO_LIMITS.bannerAlt}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditBannerAlt(e.target.value)}
                                    placeholder={`Describe the banner, e.g. "${editName || 'Category'} collection on display"`}
                                    hint="Read by screen readers and search engines. Blank uses the category name."
                                />
                            </div>
                            <div className="w-48 max-w-full">
                                <ImageUploadZone
                                    label="Category image"
                                    subLabel="Shown on category tiles"
                                    currentUrl={editImageUrl}
                                    aspectClass="aspect-square"
                                    slot={CATEGORY_IMAGE_SLOT}
                                    fitSlot={IMAGE_FIT_SLOTS.categoryImage}
                                    onUpload={url => setEditImageUrl(url)}
                                    onRemove={() => setEditImageUrl(null)}
                                />
                            </div>

                            {/* Icon upload + Name row */}
                            <div className="flex items-start gap-4">
                                {/* Icon — preset preview OR upload zone */}
                                {editIconUrl && isPresetUrl(editIconUrl) ? (
                                    <div className="flex-shrink-0">
                                        {/* comb-exception: caption for a non-input preview tile */}
                                        <label className="text-xs font-medium text-fg-muted mb-1 block">Icon</label>
                                        <div
                                            className="w-20 h-20 rounded-xl flex items-center justify-center relative group"
                                            style={{ background: editColor || 'rgb(var(--s-700))' }}
                                        >
                                            {renderCategoryIcon({ iconUrl: editIconUrl, name: editName, color: editColor, size: 48 })}
                                            <IconButton
                                                label="Remove icon"
                                                variant="danger"
                                                size="sm"
                                                icon={<X size={10} />}
                                                onClick={() => setEditIconUrl(null)}
                                                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-36 max-w-full shrink min-w-0">
                                        <ImageUploadZone
                                            label="Icon"
                                            subLabel="Click or drag"
                                            currentUrl={editIconUrl}
                                            aspectClass="w-20 h-20"
                                            fitSlot={IMAGE_FIT_SLOTS.categoryIcon}
                                            onUpload={url => setEditIconUrl(url)}
                                            onRemove={() => setEditIconUrl(null)}
                                        />
                                    </div>
                                )}

                                {/* Name + Description */}
                                <div className="flex-1 space-y-3">
                                    <TextField
                                        name="category-name"
                                        label="Name *"
                                        value={editName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                        placeholder="Category name"
                                    />
                                    <Textarea
                                        name="category-description"
                                        label="Description"
                                        value={editDesc}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditDesc(e.target.value)}
                                        rows={2}
                                        placeholder="Brief description..."
                                    />
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
                                    {/* comb-exception: Comb ColorPicker adds a hex field and cannot toggle-off a selected preset; swatch row keeps existing click-to-clear behaviour */}
                                    <label className="text-xs font-medium text-fg-muted mb-2 block">Color</label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {PRESET_COLORS.map(c => (
                                            <button // comb-exception: colour swatch, inline-styled by dynamic hex
                                                key={c}
                                                type="button"
                                                onClick={() => setEditColor(editColor === c ? '' : c)}
                                                className="w-7 h-7 rounded-full border-2 transition-all"
                                                style={{ background: c, borderColor: editColor === c ? 'white' : 'transparent' }}
                                            />
                                        ))}
                                        {editColor && (
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditColor('')}>Clear</Button>
                                        )}
                                    </div>
                                    {editColor && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded" style={{ background: editColor }} />
                                            <span className="text-xs text-fg-subtle font-mono">{editColor}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="w-32 max-w-full">
                                        <TextField
                                            name="category-sort-order"
                                            label="Sort Order"
                                            type="number"
                                            value={editSortOrder}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSortOrder(parseInt(e.target.value) || 0)}
                                            min={0}
                                            hint="Lower = appears first"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Search engine listing (storefront /c/<slug>) */}
                            <div className="border-t border-line pt-5">
                                {/* comb-exception: disclosure header needs aria-expanded/aria-controls on the trigger plus an inline collapsed URL hint; Comb Collapsible owns its own trigger */}
                                <button // comb-exception: disclosure header needs aria-expanded/aria-controls and an inline URL hint
                                    type="button"
                                    onClick={() => setSeoOpen(o => !o)}
                                    aria-expanded={seoOpen}
                                    aria-controls="category-seo-section"
                                    className="flex w-full items-center gap-2 text-left"
                                >
                                    {seoOpen ? <ChevronDown size={14} className="text-fg-muted" /> : <ChevronRight size={14} className="text-fg-muted" />}
                                    <span className="text-sm font-semibold text-fg">Search engine listing</span>
                                    {!seoOpen && (
                                        <span className="ml-auto truncate text-xs text-fg-subtle">/c/{previewSlug}</span>
                                    )}
                                </button>
                                {seoOpen && (
                                    <div id="category-seo-section" className="mt-4 space-y-4">
                                        {/* Google-style preview */}
                                        <div data-testid="seo-snippet-preview" className="rounded-lg border border-line-strong bg-surface-raised/40 px-4 py-3">
                                            <p className="text-xs text-fg-muted truncate">
                                                <span data-testid="seo-snippet-url">/c/{previewSlug}</span>
                                            </p>
                                            <p data-testid="seo-snippet-title" className="text-base text-primary truncate">
                                                {editMetaTitle.trim() || editName.trim() || 'Category'}
                                            </p>
                                            <p data-testid="seo-snippet-description" className="text-xs text-fg-muted line-clamp-2">
                                                {editMetaDesc.trim() || editDesc.trim() || 'Add a meta description to control the text shown under the title in search results.'}
                                            </p>
                                        </div>

                                        <div>
                                            <TextField
                                                name="category-slug"
                                                id="category-slug"
                                                label="URL slug"
                                                value={editSlug}
                                                maxLength={CATEGORY_SEO_LIMITS.slug}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSlug(e.target.value)}
                                                aria-invalid={!!slugError}
                                                placeholder={slugFromName(editName)}
                                                hint={slugError ? undefined : 'Leave blank to generate it from the name. Changing it changes the page address.'}
                                            />
                                            {slugError && (
                                                <p data-testid="slug-error" className="text-nb-overline text-danger mt-1">{slugError}</p>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex justify-end mb-1">
                                                <CharCount value={editMetaTitle} max={CATEGORY_SEO_LIMITS.metaTitle} testId="meta-title-count" />
                                            </div>
                                            <TextField
                                                name="category-meta-title"
                                                id="category-meta-title"
                                                label="Meta title"
                                                value={editMetaTitle}
                                                maxLength={CATEGORY_SEO_LIMITS.metaTitle}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditMetaTitle(e.target.value)}
                                                placeholder={editName || 'Category name'}
                                            />
                                        </div>

                                        <div>
                                            <div className="flex justify-end mb-1">
                                                <CharCount value={editMetaDesc} max={CATEGORY_SEO_LIMITS.metaDescription} testId="meta-description-count" />
                                            </div>
                                            <Textarea
                                                name="category-meta-description"
                                                id="category-meta-description"
                                                label="Meta description"
                                                value={editMetaDesc}
                                                maxLength={CATEGORY_SEO_LIMITS.metaDescription}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditMetaDesc(e.target.value)}
                                                rows={3}
                                                placeholder="A one- or two-sentence summary shown under the title in search results"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sales channel visibility */}
                            {channelVisibilityState === 'enabled' && (
                                <div className="border-t border-line pt-5">
                                    <CategoryChannelsPanel
                                        key={selectedCategory.id}
                                        categoryId={selectedCategory.id}
                                        canManage={canManage}
                                        onSaved={() => {
                                            recordActivity({
                                                eventType: 'inventory.category.channels_updated',
                                                eventCategory: 'data',
                                                description: `Updated sales channels for "${selectedCategory.name}"`,
                                                resourceType: 'category',
                                                resourceId: selectedCategory.id,
                                            }).catch(() => {});
                                        }}
                                    />
                                </div>
                            )}

                            {/* Parent info */}
                            {selectedCategory.parent_id && (
                                <div className="bg-surface-raised/50 rounded-lg px-4 py-3 text-sm text-fg-muted">
                                    <span className="text-fg-subtle text-xs">Parent: </span>
                                    {categories.find(c => c.id === selectedCategory.parent_id)?.name || selectedCategory.parent_id}
                                </div>
                            )}
                        </div>
                    )}
                  </Card>
                </GridItem>
            </Grid>
        </ListPageTemplate>
    );
};

export default CategoriesPage;
