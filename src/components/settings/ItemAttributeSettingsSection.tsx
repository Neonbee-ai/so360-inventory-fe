import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Info } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { ItemAttributeDefinition, ItemCategory } from '../../types/inventory';
import { toBound } from '../../utils/attributeBounds';
import { useConfirm, Button, IconButton, TextField, Textarea, Select, Checkbox, Alert, Card, EmptyState, Badge, DataTable, type DataTableColumn } from '@so360/design-system';

interface Props {
    categories: ItemCategory[];
    canManage: boolean;
}

const ATTRIBUTE_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency' },
    { value: 'select', label: 'Select (Dropdown)' },
    { value: 'multi_select', label: 'Multi-select' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Checkbox (Yes/No)' },
    { value: 'radio', label: 'Radio' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'file', label: 'File Upload' },
] as const;

// Field types that require a configurable list of options
const OPTION_TYPES = ['select', 'multi_select', 'radio'];

// Field types that take an optional min/max bound. Only these send
// min_value/max_value; every other type leaves them out of the request.
const NUMERIC_TYPES = ['number', 'currency'];

type AttributeType = 'text' | 'number' | 'currency' | 'select' | 'multi_select' | 'date' | 'boolean' | 'radio' | 'textarea' | 'file';

interface FormState {
    category_id: string;
    attribute_key: string;
    attribute_label: string;
    attribute_type: AttributeType;
    options_raw: string;
    unit: string;
    description: string;
    is_required: boolean;
    sort_order: string;
    min_value: string;
    max_value: string;
}

const emptyForm = (): FormState => ({
    category_id: '',
    attribute_key: '',
    attribute_label: '',
    attribute_type: 'text',
    options_raw: '',
    unit: '',
    description: '',
    is_required: false,
    sort_order: '0',
    min_value: '',
    max_value: '',
});


const ItemAttributeSettingsSection: React.FC<Props> = ({ categories, canManage }) => {
    const [confirm, confirmDialog] = useConfirm();
    const [defs, setDefs] = useState<ItemAttributeDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const data = await inventoryService.getAttributeDefinitions();
            setDefs(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load attribute definitions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowForm(true);
        setError(null);
    };

    const openEdit = (def: ItemAttributeDefinition) => {
        setEditingId(def.id);
        setForm({
            category_id: def.category_id || '',
            attribute_key: def.attribute_key,
            attribute_label: def.attribute_label,
            attribute_type: def.attribute_type,
            options_raw: def.options ? def.options.map(o => `${o.value}:${o.label}`).join('\n') : '',
            unit: def.unit || '',
            description: def.description || '',
            is_required: def.is_required,
            sort_order: String(def.sort_order),
            min_value: def.min_value === null || def.min_value === undefined ? '' : String(def.min_value),
            max_value: def.max_value === null || def.max_value === undefined ? '' : String(def.max_value),
        });
        setShowForm(true);
        setError(null);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm());
        setError(null);
    };

    const parseOptions = (raw: string) => {
        if (!raw.trim()) return undefined;
        return raw.split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const [value, ...rest] = line.split(':');
                return { value: value.trim(), label: rest.length ? rest.join(':').trim() : value.trim() };
            });
    };

    const KEY_PATTERN = /^[a-z0-9_]+$/;

    const handleSave = async () => {
        if (!form.attribute_label.trim()) {
            setError('Label is required');
            return;
        }
        if (!form.attribute_key.trim()) {
            setError('Attribute key is required');
            return;
        }
        if (!KEY_PATTERN.test(form.attribute_key.trim())) {
            setError('Attribute key must contain only lowercase letters, numbers, and underscores (e.g. material, shelf_life)');
            return;
        }
        const isNumeric = NUMERIC_TYPES.includes(form.attribute_type);
        const minValue = toBound(form.min_value);
        const maxValue = toBound(form.max_value);
        if (isNumeric && minValue !== null && maxValue !== null && minValue > maxValue) {
            setError('Minimum value cannot be greater than the maximum value.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const dto = {
                // On edit, a blank category means "All items" and must be sent
                // as null — undefined was ignored, so an attribute could never
                // be moved back from a category to all items.
                category_id: form.category_id || (editingId ? null : undefined),
                attribute_key: form.attribute_key.trim(),
                attribute_label: form.attribute_label.trim(),
                attribute_type: form.attribute_type,
                options: OPTION_TYPES.includes(form.attribute_type) ? parseOptions(form.options_raw) : undefined,
                unit: form.unit.trim() || undefined,
                description: form.description.trim(),
                is_required: form.is_required,
                sort_order: parseInt(form.sort_order) || 0,
                ...(isNumeric ? { min_value: minValue, max_value: maxValue } : {}),
            };
            if (editingId) {
                await inventoryService.updateAttributeDefinition(editingId, dto);
            } else {
                await inventoryService.createAttributeDefinition(dto);
            }
            closeForm();
            await load();
        } catch (err: any) {
            setError(err.message || 'Failed to save attribute definition');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm({ title: 'Delete', message: 'Delete this attribute definition? This cannot be undone.', intent: 'danger', confirmLabel: 'Delete' }))) return;
        setDeletingId(id);
        setError(null);
        try {
            await inventoryService.deleteAttributeDefinition(id);
            await load();
        } catch (err: any) {
            setError(err.message || 'Failed to delete attribute definition');
        } finally {
            setDeletingId(null);
        }
    };

    const categoryName = (id?: string | null) =>
        id ? (categories.find(c => c.id === id)?.name || id) : 'All items';

    const attributeColumns: DataTableColumn<ItemAttributeDefinition>[] = [
        {
            key: 'attribute_label',
            header: 'Label',
            render: (def) => (
                <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                    {def.attribute_label}
                    {def.description && (
                        <span className="inline-flex text-fg-subtle shrink-0 cursor-help" title={def.description} aria-label={def.description}>
                            <Info size={13} />
                        </span>
                    )}
                </span>
            ),
        },
        { key: 'attribute_key', header: 'Key', render: (def) => <span className="font-mono text-xs text-fg-muted">{def.attribute_key}</span> },
        { key: 'attribute_type', header: 'Type', render: (def) => ATTRIBUTE_TYPES.find(t => t.value === def.attribute_type)?.label || def.attribute_type },
        { key: 'category_id', header: 'Category', render: (def) => categoryName(def.category_id) },
        { key: 'unit', header: 'Unit', render: (def) => def.unit || '—' },
        {
            key: 'is_required',
            header: 'Required',
            render: (def) => def.is_required
                ? <Badge tone="danger" size="sm">Yes</Badge>
                : <Badge tone="neutral" size="sm">No</Badge>,
        },
        { key: 'sort_order', header: 'Order', render: (def) => def.sort_order },
        ...(canManage ? [{
            key: 'actions',
            header: '',
            alwaysVisible: true,
            render: (def: ItemAttributeDefinition) => (
                <div className="flex items-center gap-2">
                    <IconButton label="Edit" variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(def)} />
                    <IconButton label="Delete" variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => handleDelete(def.id)} disabled={deletingId === def.id} />
                </div>
            ),
        } as DataTableColumn<ItemAttributeDefinition>] : []),
    ];

    return (
        <div>
            {confirmDialog}
            {error && (
                <div className="mb-4">
                    <Alert variant="error">{error}</Alert>
                </div>
            )}

            {loading ? (
                <p className="text-sm text-fg-subtle animate-pulse">Loading...</p>
            ) : (
                <>
                    {defs.length > 0 ? (
                        <DataTable<ItemAttributeDefinition>
                            data-testid="attribute-definitions-table"
                            rows={defs}
                            rowKey={(def) => def.id}
                            columns={attributeColumns}
                        />
                    ) : (
                        <EmptyState title="No attribute definitions yet." />
                    )}

                    {canManage && !showForm && (
                        <div className="mt-4">
                            <Button type="button" variant="ghost" onClick={openCreate}>
                                <Plus size={16} /> Add Attribute
                            </Button>
                        </div>
                    )}

                    {showForm && (
                        <div className="mt-4">
                            <Card
                                title={editingId ? 'Edit Attribute' : 'New Attribute'}
                                actions={<IconButton label="Close" variant="ghost" size="sm" icon={<X size={16} />} onClick={closeForm} />}
                                footer={(
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="tonal" onClick={handleSave} disabled={saving}>
                                            <Check size={14} />
                                            {saving ? 'Saving...' : 'Save'}
                                        </Button>
                                        <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
                                    </div>
                                )}
                            >
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <TextField
                                            name="attribute_label"
                                            label="Label"
                                            required
                                            type="text"
                                            value={form.attribute_label}
                                            onChange={e => {
                                                const label = e.target.value;
                                                const derivedKey = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                                                setForm(f => ({
                                                    ...f,
                                                    attribute_label: label,
                                                    // Auto-fill key from label when creating and key is empty
                                                    ...(!editingId && !f.attribute_key ? { attribute_key: derivedKey } : {}),
                                                }));
                                            }}
                                            placeholder="e.g. Material"
                                        />
                                        <TextField
                                            name="attribute_key"
                                            label="Key (lowercase, numbers, underscore only)"
                                            required
                                            type="text"
                                            value={form.attribute_key}
                                            onChange={e => setForm(f => ({ ...f, attribute_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                            placeholder="e.g. material"
                                            disabled={!!editingId}
                                            hint={!editingId ? 'Auto-generated from label. Edit if needed.' : undefined}
                                        />
                                        <Select
                                            name="attribute_type"
                                            label="Type"
                                            value={form.attribute_type}
                                            onChange={e => setForm(f => ({ ...f, attribute_type: e.target.value as AttributeType }))}
                                            options={ATTRIBUTE_TYPES.map(t => ({ value: t.value, label: t.label }))}
                                        />
                                        <Select
                                            name="category_id"
                                            label="Category (blank = all items)"
                                            value={form.category_id}
                                            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                                            options={[{ value: '', label: 'All items' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                                        />
                                        <TextField
                                            name="unit"
                                            label="Unit (optional)"
                                            type="text"
                                            value={form.unit}
                                            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                                            placeholder="e.g. cm, kg, days"
                                        />
                                        {NUMERIC_TYPES.includes(form.attribute_type) && (
                                            <>
                                                <TextField
                                                    name="min_value"
                                                    label="Minimum value (optional)"
                                                    type="number"
                                                    value={form.min_value}
                                                    onChange={e => setForm(f => ({ ...f, min_value: e.target.value }))}
                                                    placeholder="No minimum"
                                                />
                                                <TextField
                                                    name="max_value"
                                                    label="Maximum value (optional)"
                                                    type="number"
                                                    value={form.max_value}
                                                    onChange={e => setForm(f => ({ ...f, max_value: e.target.value }))}
                                                    placeholder="No maximum"
                                                />
                                            </>
                                        )}
                                        <TextField
                                            name="sort_order"
                                            label="Sort Order"
                                            type="number"
                                            value={form.sort_order}
                                            onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                                            min={0}
                                        />
                                    </div>

                                    <Textarea
                                        name="description"
                                        label="Description / Notes (optional)"
                                        rows={4}
                                        value={form.description}
                                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="e.g. Used to specify the upholstery material for furniture products."
                                    />

                                    {OPTION_TYPES.includes(form.attribute_type) && (
                                        <Textarea
                                            name="options_raw"
                                            label="Options (one per line, format: value:Label)"
                                            rows={4}
                                            value={form.options_raw}
                                            onChange={e => setForm(f => ({ ...f, options_raw: e.target.value }))}
                                            placeholder={'wood:Wood\nmetal:Metal\nplastic:Plastic'}
                                        />
                                    )}

                                    <Checkbox
                                        name="is_required"
                                        label="Required field"
                                        checked={form.is_required}
                                        onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))}
                                    />
                                </div>
                            </Card>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ItemAttributeSettingsSection;
