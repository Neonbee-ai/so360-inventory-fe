import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
    Alert,
    Badge,
    Button,
    ConfirmDialog,
    EmptyState,
    Grid,
    GridItem,
    IconButton,
    Select,
    Switch,
    TextField,
} from '@so360/design-system';
import { productTypeService } from '../../../services/productTypeService';
import type { AttributeGroup, ProductTypeAttribute, SurfacePlacements } from '../../../types/productTypes';

/**
 * Attribute groups for one product type.
 *
 * A group is a heading ("Dimensions", "Material & Finish") that attributes sit
 * under, plus the storefront surfaces it appears on. The editor owns three
 * things here:
 *   1. groups — create, rename, reorder, delete, and toggle per-surface placement;
 *   2. assignment — which group each attribute belongs to;
 *   3. order inside a group — the arrows, which only renumber that group.
 *
 * The surface list is data, not code: the two known surfaces are always shown
 * and any extra surface already stored on the group is rendered too, so a
 * surface added by the storefront never becomes invisible or gets dropped when
 * a merchant saves an unrelated change.
 */

const KNOWN_SURFACES: { key: string; label: string; hint: string }[] = [
    { key: 'card', label: 'Show on product card', hint: 'Values appear under the product in listings.' },
    { key: 'pdp_specs', label: 'Show in product specs', hint: 'Values appear in the product page spec block.' },
];

const MAX_LABEL_LENGTH = 60;
const MAX_ORDER = 999;
/** Sentinel for the "no group" option; the API takes null for an unassign. */
const UNGROUPED = '';

interface AttributeGroupsPanelProps {
    productTypeId: string;
    attributes: ProductTypeAttribute[];
    /** False for a system template (shared across orgs) or without the product-type flag. */
    canManage: boolean;
    /** Fired after every successful write so the page can refetch the type. */
    onChanged?: () => void;
}

interface FormState {
    /** null = creating. */
    id: string | null;
    label: string;
    sortOrder: string;
    placements: SurfacePlacements;
}

const emptyForm = (): FormState => ({
    id: null,
    label: '',
    sortOrder: '',
    placements: { card: false, pdp_specs: true },
});

const bySortOrder = (a: { sort_order?: number }, b: { sort_order?: number }) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0);

const humanizeKey = (key: string) =>
    key.replace(/_/g, ' ').replace(/^[a-z]/, c => c.toUpperCase());

/** The two known surfaces plus any future surface already configured on the group. */
function surfacesOf(placements: SurfacePlacements | null | undefined) {
    const stored = placements || {};
    return [
        ...KNOWN_SURFACES.map(s => ({ ...s, extra: false })),
        ...Object.keys(stored)
            .filter(key => !KNOWN_SURFACES.some(s => s.key === key))
            .map(key => ({ key, label: humanizeKey(key), hint: 'Set by another storefront surface.', extra: true })),
    ];
}

const AttributeGroupsPanel: React.FC<AttributeGroupsPanelProps> = ({
    productTypeId,
    attributes,
    canManage,
    onChanged,
}) => {
    const [groups, setGroups] = useState<AttributeGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busyGroupId, setBusyGroupId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [labelError, setLabelError] = useState<string | null>(null);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleting, setDeleting] = useState<AttributeGroup | null>(null);
    const [busyAttributeId, setBusyAttributeId] = useState<string | null>(null);

    const loadGroups = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await productTypeService.getAttributeGroups(productTypeId);
            setGroups(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setLoadError(err?.message || 'Could not load attribute groups');
        } finally {
            setIsLoading(false);
        }
    }, [productTypeId]);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    const orderedGroups = useMemo(
        () => [...groups].sort((a, b) => bySortOrder(a, b) || a.label.localeCompare(b.label)),
        [groups],
    );

    /** group id → its attributes, ordered; the '' bucket holds ungrouped attributes. */
    const buckets = useMemo(() => {
        const map = new Map<string, ProductTypeAttribute[]>();
        attributes.forEach(attribute => {
            const key = attribute.group_id || UNGROUPED;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(attribute);
        });
        map.forEach(list =>
            list.sort((a, b) => bySortOrder(a, b) || a.label.localeCompare(b.label)),
        );
        return map;
    }, [attributes]);

    /** Groups in display order, then any attribute whose group is missing, then ungrouped. */
    const orderedAttributes = useMemo(() => {
        const groupIds = orderedGroups.map(group => group.id);
        const orphanKeys = [...buckets.keys()].filter(key => key !== UNGROUPED && !groupIds.includes(key));
        const keys = [...groupIds, ...orphanKeys, ...(buckets.has(UNGROUPED) ? [UNGROUPED] : [])];
        return keys.flatMap(key => buckets.get(key) || []);
    }, [buckets, orderedGroups]);

    const groupOptions = useMemo(
        () => orderedGroups.map(group => ({ value: group.id, label: group.label })),
        [orderedGroups],
    );

    const openCreate = () => {
        setForm(emptyForm());
        setLabelError(null);
        setOrderError(null);
        setActionError(null);
    };

    const openEdit = (group: AttributeGroup) => {
        setForm({
            id: group.id,
            label: group.label,
            sortOrder: String(group.sort_order ?? 0),
            placements: { ...(group.placements || {}) },
        });
        setLabelError(null);
        setOrderError(null);
        setActionError(null);
    };

    const setPlacement = (key: string, shown: boolean) => {
        setForm(current =>
            current ? { ...current, placements: { ...current.placements, [key]: shown } } : current,
        );
    };

    const handleSubmit = async () => {
        if (!form) return;

        const label = form.label.trim();
        const duplicateLabel = groups.some(
            group => group.id !== form.id && group.label.trim().toLowerCase() === label.toLowerCase(),
        );
        const nextLabelError = !label
            ? 'A group needs a name'
            : label.length > MAX_LABEL_LENGTH
                ? `Keep the name to ${MAX_LABEL_LENGTH} characters or fewer`
                : duplicateLabel
                    ? 'A group with this name already exists'
                    : null;

        const rawOrder = form.sortOrder.trim();
        const order = rawOrder === '' ? undefined : Number(rawOrder);
        const nextOrderError =
            order !== undefined && (!Number.isInteger(order) || order < 0 || order > MAX_ORDER)
                ? `Order must be a whole number from 0 to ${MAX_ORDER}`
                : null;

        setLabelError(nextLabelError);
        setOrderError(nextOrderError);
        if (nextLabelError || nextOrderError) return;

        setIsSaving(true);
        setActionError(null);
        try {
            const payload = { label, sort_order: order, placements: form.placements };
            if (form.id) {
                await productTypeService.updateAttributeGroup(productTypeId, form.id, payload);
            } else {
                await productTypeService.createAttributeGroup(productTypeId, payload);
            }
            setForm(null);
            await loadGroups();
            onChanged?.();
        } catch (err: any) {
            setActionError(err?.message || 'Could not save the group');
        } finally {
            setIsSaving(false);
        }
    };

    /** Placement toggles save immediately; only the changed surface is sent (the server merges). */
    const togglePlacement = async (group: AttributeGroup, key: string, shown: boolean) => {
        if (!canManage) return;
        const previous = group.placements || {};
        const optimistic = { ...previous, [key]: shown };
        setGroups(current => current.map(g => (g.id === group.id ? { ...g, placements: optimistic } : g)));
        setBusyGroupId(group.id);
        setActionError(null);
        try {
            await productTypeService.updateAttributeGroup(productTypeId, group.id, {
                placements: { [key]: shown },
            });
            onChanged?.();
        } catch (err: any) {
            setGroups(current =>
                current.map(g => (g.id === group.id ? { ...g, placements: previous } : g)),
            );
            setActionError(err?.message || 'Could not update where this group appears');
        } finally {
            setBusyGroupId(null);
        }
    };

    const moveGroup = async (group: AttributeGroup, delta: number) => {
        if (!canManage) return;
        const index = orderedGroups.findIndex(g => g.id === group.id);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= orderedGroups.length) return;

        const next = [...orderedGroups];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        const renumbered = next.map((g, i) => ({ ...g, sort_order: i }));
        const changed = renumbered.filter(
            g => (groups.find(original => original.id === g.id)?.sort_order ?? 0) !== g.sort_order,
        );

        setGroups(renumbered);
        setBusyGroupId(group.id);
        setActionError(null);
        try {
            await Promise.all(
                changed.map(g =>
                    productTypeService.updateAttributeGroup(productTypeId, g.id, { sort_order: g.sort_order }),
                ),
            );
            await loadGroups();
            onChanged?.();
        } catch (err: any) {
            setActionError(err?.message || 'Could not reorder the groups');
            await loadGroups();
        } finally {
            setBusyGroupId(null);
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;
        setBusyGroupId(deleting.id);
        setActionError(null);
        try {
            await productTypeService.deleteAttributeGroup(productTypeId, deleting.id);
            setDeleting(null);
            await loadGroups();
            onChanged?.();
        } catch (err: any) {
            setActionError(err?.message || 'Could not delete the group');
        } finally {
            setBusyGroupId(null);
        }
    };

    /** Move an attribute into a group (or out of one), appended at the end of it. */
    const assignAttribute = async (attribute: ProductTypeAttribute, groupId: string) => {
        if (!canManage) return;
        const targetBucket = buckets.get(groupId) || [];
        setBusyAttributeId(attribute.id);
        setActionError(null);
        try {
            await productTypeService.updateAttribute(productTypeId, attribute.id, {
                group_id: groupId || null,
                sort_order: targetBucket.length,
            });
            onChanged?.();
        } catch (err: any) {
            setActionError(err?.message || 'Could not move the attribute');
        } finally {
            setBusyAttributeId(null);
        }
    };

    /** Reorder inside one bucket only; every changed sort_order in that bucket is saved. */
    const moveAttribute = async (attribute: ProductTypeAttribute, delta: number) => {
        if (!canManage) return;
        const bucket = buckets.get(attribute.group_id || UNGROUPED) || [];
        const index = bucket.findIndex(a => a.id === attribute.id);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= bucket.length) return;

        const next = [...bucket];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);

        setBusyAttributeId(attribute.id);
        setActionError(null);
        try {
            await Promise.all(
                next.map((a, i) =>
                    a.sort_order === i
                        ? Promise.resolve(null)
                        : productTypeService.updateAttribute(productTypeId, a.id, { sort_order: i }),
                ),
            );
            onChanged?.();
        } catch (err: any) {
            setActionError(err?.message || 'Could not reorder the attributes');
        } finally {
            setBusyAttributeId(null);
        }
    };

    return (
        <section className="space-y-4" data-testid="attribute-groups-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-nb-section-title text-fg">Attribute groups</h3>
                    <p className="text-sm text-fg-muted">
                        Group attributes under a heading, order them, and choose where each group appears.
                    </p>
                </div>
                {canManage && !form && (
                    <Button type="button" variant="secondary" size="sm" onClick={openCreate}>
                        <Plus size={14} /> New group
                    </Button>
                )}
            </div>

            {!canManage && (
                <Alert variant="info">
                    This is a system template shared by every organization, so its groups are read-only.
                </Alert>
            )}
            {loadError && <Alert variant="error">{loadError}</Alert>}
            {actionError && <Alert variant="error">{actionError}</Alert>}

            {form && canManage && (
                <div
                    className="space-y-4 rounded-nb border border-line bg-surface-raised p-4"
                    data-testid="attribute-group-form"
                >
                    <Grid gap="md">
                        <GridItem span={8}>
                            <TextField
                                name="group-label"
                                label="Group name"
                                hint="For example Dimensions, Material & Finish, Care."
                                value={form.label}
                                error={labelError ?? undefined}
                                maxLength={MAX_LABEL_LENGTH}
                                autoFocus
                                onChange={e => {
                                    setForm({ ...form, label: e.target.value });
                                    if (labelError) setLabelError(null);
                                }}
                            />
                        </GridItem>
                        <GridItem span={4}>
                            <TextField
                                name="group-order"
                                type="number"
                                label="Order"
                                hint="Blank puts it last."
                                value={form.sortOrder}
                                error={orderError ?? undefined}
                                onChange={e => {
                                    setForm({ ...form, sortOrder: e.target.value });
                                    if (orderError) setOrderError(null);
                                }}
                            />
                        </GridItem>
                    </Grid>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-fg">Where it appears</p>
                        <Grid gap="md">
                            {surfacesOf(form.placements).map(surface => (
                                <GridItem key={surface.key} span={6}>
                                    <div className="flex items-start gap-3 rounded-nb border border-line p-3">
                                        <Switch
                                            name={`form-${surface.key}`}
                                            label={surface.label}
                                            description={surface.hint}
                                            checked={Boolean(form.placements[surface.key])}
                                            onCheckedChange={checked => setPlacement(surface.key, checked)}
                                        />
                                    </div>
                                </GridItem>
                            ))}
                        </Grid>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button type="button" variant="primary" size="sm" onClick={handleSubmit} disabled={isSaving}>
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                            {form.id ? 'Save group' : 'Create group'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)} disabled={isSaving}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-fg-subtle">
                    <Loader2 size={14} className="animate-spin" />
                    Loading groups…
                </div>
            ) : orderedGroups.length === 0 ? (
                <EmptyState
                    icon={Layers}
                    title="No attribute groups yet"
                    description="Groups give the product page headings like Dimensions or Material & Finish, and decide which values show on the product card."
                    action={canManage ? { label: 'Create the first group', onClick: openCreate } : undefined}
                />
            ) : (
                <div className="space-y-3">
                    {orderedGroups.map((group, index) => {
                        const groupAttributes = buckets.get(group.id) || [];
                        return (
                            <div
                                key={group.id}
                                className="space-y-3 rounded-nb border border-line bg-surface p-4"
                                data-testid={`attribute-group-${group.group_key}`}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-fg">{group.label}</span>
                                        <Badge tone="neutral" size="sm">
                                            {groupAttributes.length === 1
                                                ? '1 attribute'
                                                : `${groupAttributes.length} attributes`}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <IconButton
                                            label={`Move ${group.label} up`}
                                            icon={<ChevronUp size={14} />}
                                            size="sm"
                                            disabled={!canManage || index === 0 || busyGroupId === group.id}
                                            onClick={() => moveGroup(group, -1)}
                                        />
                                        <IconButton
                                            label={`Move ${group.label} down`}
                                            icon={<ChevronDown size={14} />}
                                            size="sm"
                                            disabled={
                                                !canManage ||
                                                index === orderedGroups.length - 1 ||
                                                busyGroupId === group.id
                                            }
                                            onClick={() => moveGroup(group, 1)}
                                        />
                                        <IconButton
                                            label={`Edit ${group.label}`}
                                            icon={<Pencil size={14} />}
                                            size="sm"
                                            disabled={!canManage || busyGroupId === group.id}
                                            onClick={() => openEdit(group)}
                                        />
                                        <IconButton
                                            label={`Delete ${group.label}`}
                                            icon={<Trash2 size={14} />}
                                            variant="danger"
                                            size="sm"
                                            disabled={!canManage || busyGroupId === group.id}
                                            onClick={() => {
                                                setActionError(null);
                                                setDeleting(group);
                                            }}
                                        />
                                    </div>
                                </div>

                                <Grid gap="md">
                                    {surfacesOf(group.placements).map(surface => (
                                        <GridItem key={surface.key} span={6}>
                                            <div className="flex items-start gap-3 rounded-nb border border-line p-3">
                                                <Switch
                                                    name={`${group.group_key}-${surface.key}`}
                                                    label={surface.label}
                                                    description={surface.hint}
                                                    checked={Boolean(group.placements?.[surface.key])}
                                                    disabled={!canManage || busyGroupId === group.id}
                                                    onCheckedChange={checked =>
                                                        togglePlacement(group, surface.key, checked)
                                                    }
                                                />
                                            </div>
                                        </GridItem>
                                    ))}
                                </Grid>

                                {groupAttributes.length === 0 && (
                                    <p className="text-xs text-fg-subtle">
                                        No attributes in this group yet — assign one below.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {attributes.length === 0 ? (
                <p className="text-sm text-fg-subtle">
                    Add an attribute above, then assign it to a group here.
                </p>
            ) : (
                <div className="space-y-2">
                    <div>
                        <h4 className="text-sm font-semibold text-fg">Attributes</h4>
                        <p className="text-xs text-fg-muted">
                            Choose the group for each attribute; the arrows order them inside that group.
                        </p>
                    </div>
                    <div className="divide-y divide-line rounded-nb border border-line">
                        {orderedAttributes.map(attribute => {
                            const bucketKey = attribute.group_id || UNGROUPED;
                            const bucket = buckets.get(bucketKey) || [];
                            const indexInBucket = bucket.findIndex(a => a.id === attribute.id);
                            return (
                                <div
                                    key={attribute.id}
                                    className="flex flex-wrap items-center gap-2 p-3"
                                    data-testid={`attribute-row-${attribute.field_name}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <span className="text-sm text-fg">{attribute.label}</span>
                                        <span className="ml-2 text-xs text-fg-subtle">{attribute.field_name}</span>
                                    </div>
                                    <div className="w-full wc-medium:w-64">
                                        <Select
                                            name={`attribute-group-${attribute.id}`}
                                            aria-label={`Group for ${attribute.label}`}
                                            value={bucketKey}
                                            options={[{ value: UNGROUPED, label: 'No group' }, ...groupOptions]}
                                            disabled={!canManage || busyAttributeId === attribute.id}
                                            onValueChange={value => assignAttribute(attribute, value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <IconButton
                                            label={`Move ${attribute.label} up`}
                                            icon={<ChevronUp size={14} />}
                                            size="sm"
                                            disabled={!canManage || indexInBucket <= 0 || busyAttributeId === attribute.id}
                                            onClick={() => moveAttribute(attribute, -1)}
                                        />
                                        <IconButton
                                            label={`Move ${attribute.label} down`}
                                            icon={<ChevronDown size={14} />}
                                            size="sm"
                                            disabled={
                                                !canManage ||
                                                indexInBucket < 0 ||
                                                indexInBucket === bucket.length - 1 ||
                                                busyAttributeId === attribute.id
                                            }
                                            onClick={() => moveAttribute(attribute, 1)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={Boolean(deleting)}
                title="Delete attribute group?"
                message={
                    deleting
                        ? `"${deleting.label}" will be removed. Its attributes stay in the product type but become ungrouped.`
                        : ''
                }
                confirmLabel="Delete group"
                intent="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleting(null)}
            />
        </section>
    );
};

export default AttributeGroupsPanel;
