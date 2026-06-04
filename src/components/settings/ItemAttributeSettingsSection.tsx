import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { ItemAttributeDefinition, ItemCategory } from '../../types/inventory';

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

type AttributeType = 'text' | 'number' | 'currency' | 'select' | 'multi_select' | 'date' | 'boolean' | 'radio' | 'textarea' | 'file';

interface FormState {
    category_id: string;
    attribute_key: string;
    attribute_label: string;
    attribute_type: AttributeType;
    options_raw: string;
    unit: string;
    is_required: boolean;
    sort_order: string;
}

const emptyForm = (): FormState => ({
    category_id: '',
    attribute_key: '',
    attribute_label: '',
    attribute_type: 'text',
    options_raw: '',
    unit: '',
    is_required: false,
    sort_order: '0',
});

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600';
const labelClass = 'block text-xs font-medium text-slate-400 mb-1';

const ItemAttributeSettingsSection: React.FC<Props> = ({ categories, canManage }) => {
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
            is_required: def.is_required,
            sort_order: String(def.sort_order),
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
        setSaving(true);
        setError(null);
        try {
            const dto = {
                category_id: form.category_id || undefined,
                attribute_key: form.attribute_key.trim(),
                attribute_label: form.attribute_label.trim(),
                attribute_type: form.attribute_type,
                options: OPTION_TYPES.includes(form.attribute_type) ? parseOptions(form.options_raw) : undefined,
                unit: form.unit.trim() || undefined,
                is_required: form.is_required,
                sort_order: parseInt(form.sort_order) || 0,
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
        if (!confirm('Delete this attribute definition? This cannot be undone.')) return;
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
            {error && (
                <div className="mb-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-slate-500 animate-pulse">Loading...</div>
            ) : (
                <>
                    {defs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide">Label</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide">Key</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide">Type</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide">Category</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide">Unit</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide">Required</th>
                                        <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide">Order</th>
                                        {canManage && <th className="py-2 w-16" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {defs.map(def => (
                                        <tr key={def.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                            <td className="py-2.5 pr-4 text-slate-200 font-medium">{def.attribute_label}</td>
                                            <td className="py-2.5 pr-4 text-slate-400 font-mono text-xs">{def.attribute_key}</td>
                                            <td className="py-2.5 pr-4 text-slate-400">
                                                {ATTRIBUTE_TYPES.find(t => t.value === def.attribute_type)?.label || def.attribute_type}
                                            </td>
                                            <td className="py-2.5 pr-4 text-slate-400">{categoryName(def.category_id)}</td>
                                            <td className="py-2.5 pr-4 text-slate-500">{def.unit || '—'}</td>
                                            <td className="py-2.5 pr-4">
                                                {def.is_required
                                                    ? <span className="text-xs font-medium text-rose-400">Yes</span>
                                                    : <span className="text-xs text-slate-600">No</span>}
                                            </td>
                                            <td className="py-2.5 pr-4 text-slate-500">{def.sort_order}</td>
                                            {canManage && (
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openEdit(def)}
                                                            className="text-slate-500 hover:text-blue-400 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(def.id)}
                                                            disabled={deletingId === def.id}
                                                            className="text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
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
                        <p className="text-sm text-slate-500 italic">No attribute definitions yet.</p>
                    )}

                    {canManage && !showForm && (
                        <button
                            onClick={openCreate}
                            className="mt-4 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <Plus size={16} /> Add Attribute
                        </button>
                    )}

                    {showForm && (
                        <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-slate-200">
                                    {editingId ? 'Edit Attribute' : 'New Attribute'}
                                </span>
                                <button onClick={closeForm} className="text-slate-500 hover:text-slate-50 transition-colors">
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
                                    <label className={labelClass}>Key * <span className="text-slate-600 font-normal">(lowercase, numbers, underscore only)</span></label>
                                    <input
                                        type="text"
                                        value={form.attribute_key}
                                        onChange={e => setForm(f => ({ ...f, attribute_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                        className={inputClass}
                                        placeholder="e.g. material"
                                        disabled={!!editingId}
                                    />
                                    {!editingId && (
                                        <p className="mt-1 text-xs text-slate-600">Auto-generated from label. Edit if needed.</p>
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
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                                />
                                <span className="text-sm text-slate-300">Required field</span>
                            </label>

                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                >
                                    <Check size={14} />
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={closeForm}
                                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-50 hover:border-slate-500 text-sm transition-all"
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
