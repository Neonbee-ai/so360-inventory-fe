import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Info } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { ItemAttributeDefinition, ItemCategory } from '../../types/inventory';
import { toBound } from '../../utils/attributeBounds';
import { useConfirm } from '@so360/design-system';

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


const inputClass = 'w-full bg-surface-raised border border-line-strong rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:ring-2 focus:ring-focus/50 focus:border-primary transition-all placeholder:text-fg-subtle';
const labelClass = 'block text-xs font-medium text-fg-muted mb-1';

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

    return (
        <div>
            {confirmDialog}
            {error && (
                <div className="mb-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-fg-subtle animate-pulse">Loading...</div>
            ) : (
                <>
                    {defs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-line">
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-fg-subtle uppercase tracking-wide">Label</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-fg-subtle uppercase tracking-wide">Key</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-fg-subtle uppercase tracking-wide">Type</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-fg-subtle uppercase tracking-wide">Category</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-fg-subtle uppercase tracking-wide">Unit</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-fg-subtle uppercase tracking-wide">Required</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-fg-subtle uppercase tracking-wide">Order</th>
                                        {canManage && <th className="py-2 w-16" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {defs.map(def => (
                                        <tr key={def.id} className="border-b border-line/50 hover:bg-surface-raised/20 transition-colors">
                                            <td className="py-2.5 pr-4 text-fg font-medium">
                                                <span className="inline-flex items-center gap-1.5">
                                                    {def.attribute_label}
                                                    {def.description && (
                                                        <span
                                                            className="inline-flex text-fg-subtle shrink-0 cursor-help"
                                                            title={def.description}
                                                            aria-label={def.description}
                                                        >
                                                            <Info size={13} />
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-4 text-fg-muted font-mono text-xs">{def.attribute_key}</td>
                                            <td className="py-2.5 pr-4 text-fg-muted">
                                                {ATTRIBUTE_TYPES.find(t => t.value === def.attribute_type)?.label || def.attribute_type}
                                            </td>
                                            <td className="py-2.5 pr-4 text-fg-muted">{categoryName(def.category_id)}</td>
                                            <td className="py-2.5 pr-4 text-fg-subtle">{def.unit || '—'}</td>
                                            <td className="py-2.5 pr-4">
                                                {def.is_required
                                                    ? <span className="text-xs font-medium text-rose-400">Yes</span>
                                                    : <span className="text-xs text-fg-subtle">No</span>}
                                            </td>
                                            <td className="py-2.5 pr-4 text-fg-subtle">{def.sort_order}</td>
                                            {canManage && (
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openEdit(def)}
                                                            className="text-fg-subtle hover:text-primary transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(def.id)}
                                                            disabled={deletingId === def.id}
                                                            className="text-fg-subtle hover:text-rose-400 transition-colors disabled:opacity-50"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-fg-subtle italic">No attribute definitions yet.</p>
                    )}

                    {canManage && !showForm && (
                        <button
                            onClick={openCreate}
                            className="mt-4 flex items-center gap-2 text-sm text-primary hover:text-primary transition-colors"
                        >
                            <Plus size={16} /> Add Attribute
                        </button>
                    )}

                    {showForm && (
                        <div className="mt-4 p-4 bg-surface-raised/50 border border-line-strong rounded-xl space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-fg">
                                    {editingId ? 'Edit Attribute' : 'New Attribute'}
                                </span>
                                <button onClick={closeForm} className="text-fg-subtle hover:text-fg transition-colors">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Label *</label>
                                    <input
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
                                        className={inputClass}
                                        placeholder="e.g. Material"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Key * <span className="text-fg-subtle font-normal">(lowercase, numbers, underscore only)</span></label>
                                    <input
                                        type="text"
                                        value={form.attribute_key}
                                        onChange={e => setForm(f => ({ ...f, attribute_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                        className={inputClass}
                                        placeholder="e.g. material"
                                        disabled={!!editingId}
                                    />
                                    {!editingId && (
                                        <p className="mt-1 text-xs text-fg-subtle">Auto-generated from label. Edit if needed.</p>
                                    )}
                                </div>
                                <div>
                                    <label className={labelClass}>Type</label>
                                    <select
                                        value={form.attribute_type}
                                        onChange={e => setForm(f => ({ ...f, attribute_type: e.target.value as AttributeType }))}
                                        className={inputClass}
                                    >
                                        {ATTRIBUTE_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Category (blank = all items)</label>
                                    <select
                                        value={form.category_id}
                                        onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                                        className={inputClass}
                                    >
                                        <option value="">All items</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Unit (optional)</label>
                                    <input
                                        type="text"
                                        value={form.unit}
                                        onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                                        className={inputClass}
                                        placeholder="e.g. cm, kg, days"
                                    />
                                </div>
                                {NUMERIC_TYPES.includes(form.attribute_type) && (
                                    <>
                                        <div>
                                            <label className={labelClass}>Minimum value (optional)</label>
                                            <input
                                                type="number"
                                                value={form.min_value}
                                                onChange={e => setForm(f => ({ ...f, min_value: e.target.value }))}
                                                className={inputClass}
                                                placeholder="No minimum"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Maximum value (optional)</label>
                                            <input
                                                type="number"
                                                value={form.max_value}
                                                onChange={e => setForm(f => ({ ...f, max_value: e.target.value }))}
                                                className={inputClass}
                                                placeholder="No maximum"
                                            />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className={labelClass}>Sort Order</label>
                                    <input
                                        type="number"
                                        value={form.sort_order}
                                        onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                                        className={inputClass}
                                        min={0}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Description / Notes (optional)</label>
                                <textarea
                                    rows={4}
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    className={inputClass + ' resize-y'}
                                    placeholder="e.g. Used to specify the upholstery material for furniture products."
                                />
                            </div>

                            {OPTION_TYPES.includes(form.attribute_type) && (
                                <div>
                                    <label className={labelClass}>Options (one per line, format: value:Label)</label>
                                    <textarea
                                        rows={4}
                                        value={form.options_raw}
                                        onChange={e => setForm(f => ({ ...f, options_raw: e.target.value }))}
                                        className={inputClass + ' resize-none'}
                                        placeholder={'wood:Wood\nmetal:Metal\nplastic:Plastic'}
                                    />
                                </div>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_required}
                                    onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))}
                                    className="w-4 h-4 rounded border-line-strong bg-surface-raised text-primary focus:ring-focus/50"
                                />
                                <span className="text-sm text-fg-muted">Required field</span>
                            </label>

                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                >
                                    <Check size={14} />
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={closeForm}
                                    className="px-4 py-2 rounded-lg border border-line-strong text-fg-muted hover:text-fg hover:border-line-strong text-sm transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ItemAttributeSettingsSection;
