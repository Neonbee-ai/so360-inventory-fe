import React, { useEffect, useState } from 'react';
import { toast } from '@so360/design-system';
import { inventoryService } from '../../services/inventoryService';
import type { ItemOptionValue, MeasurementDef, OptionAppliesTo, OptionGroup } from '../../services/inventoryService';
import {
    appliesSummary,
    emptyApplies,
    emptyDef,
    emptyGroup,
    emptyOption,
    groupBody,
    picksSummary,
    setOptionPatch,
    toKey,
    validateGroup,
    type NamedRef,
} from '../../hooks/itemOptions';

/**
 * Settings → "Options & capture fields". Option groups (choices priced per
 * order line) and, when enabled, capture fields (measurements recorded on a
 * line, optionally the billing basis). One list, one inline side panel.
 */

const inputCls = 'w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500';
const primaryBtn = 'px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50';
const secondaryBtn = 'px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 disabled:opacity-50';

function AppliesToPicker({ value, onChange, categories }: {
    value: OptionAppliesTo;
    onChange: (v: OptionAppliesTo) => void;
    categories: NamedRef[];
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<NamedRef[]>([]);
    const [itemNames, setItemNames] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!query.trim()) { setResults([]); return; }
        let active = true;
        const t = setTimeout(async () => {
            try {
                const data: any = await inventoryService.getItems({ search: query.trim(), limit: 8 });
                const raw: any[] = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
                if (active) setResults(raw.map((r) => ({ id: r.id, name: r.name })));
            } catch {
                if (active) setResults([]);
            }
        }, 300);
        return () => { active = false; clearTimeout(t); };
    }, [query]);

    const toggleCategory = (id: string) => {
        const has = value.category_ids.includes(id);
        onChange({ ...value, category_ids: has ? value.category_ids.filter((c) => c !== id) : [...value.category_ids, id] });
    };

    return (
        <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Applies to — categories</p>
            <div className="flex flex-wrap gap-1.5">
                {categories.length === 0 && <span className="text-xs text-slate-500">No categories found.</span>}
                {categories.map((c) => {
                    const on = value.category_ids.includes(c.id);
                    return (
                        <button
                            key={c.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleCategory(c.id)}
                            className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
                        >
                            {c.name}
                        </button>
                    );
                })}
            </div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Applies to — items</p>
            <div className="flex flex-wrap gap-1.5">
                {value.item_ids.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                        {itemNames[id] || `Item ${id.slice(0, 8)}`}
                        <button
                            type="button"
                            aria-label={`Remove ${itemNames[id] || id}`}
                            className="text-slate-500 hover:text-rose-400"
                            onClick={() => onChange({ ...value, item_ids: value.item_ids.filter((x) => x !== id) })}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
            <input className={inputCls} placeholder="Search items to add" aria-label="Search items" value={query} onChange={(e) => setQuery(e.target.value)} />
            {results.length > 0 && (
                <ul className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950/60 text-sm">
                    {results.map((r) => (
                        <li key={r.id}>
                            <button
                                type="button"
                                className="w-full px-3 py-1.5 text-left text-slate-300 hover:bg-slate-800"
                                onClick={() => {
                                    if (!value.item_ids.includes(r.id)) onChange({ ...value, item_ids: [...value.item_ids, r.id] });
                                    setItemNames((n) => ({ ...n, [r.id]: r.name }));
                                    setQuery('');
                                    setResults([]);
                                }}
                            >
                                {r.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-[11px] text-slate-600">Leave both empty to apply to every item.</p>
        </div>
    );
}

export interface ItemOptionsSettingsSectionProps {
    categories: NamedRef[];
    captureFieldsEnabled: boolean;
    canEdit: boolean;
}

const ItemOptionsSettingsSection: React.FC<ItemOptionsSettingsSectionProps> = ({ categories, captureFieldsEnabled, canEdit }) => {
    const [view, setView] = useState<'groups' | 'fields'>('groups');
    const [groups, setGroups] = useState<OptionGroup[]>([]);
    const [defs, setDefs] = useState<MeasurementDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [editing, setEditing] = useState<OptionGroup | null>(null);
    const [editingDef, setEditingDef] = useState<MeasurementDef | null>(null);
    const [saving, setSaving] = useState(false);
    const [panelError, setPanelError] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setLoadError('');
            try {
                const [g, d] = await Promise.all([
                    inventoryService.listOptionGroups(),
                    captureFieldsEnabled ? inventoryService.listMeasurementDefs() : Promise.resolve([] as MeasurementDef[]),
                ]);
                if (!active) return;
                setGroups(g);
                setDefs(d);
            } catch (err: any) {
                if (active) setLoadError(err?.message || 'Failed to load item options.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [captureFieldsEnabled]);

    const patchGroup = (patch: Partial<OptionGroup>) => setEditing((g) => (g ? { ...g, ...patch } : g));
    const patchOption = (i: number, patch: Partial<ItemOptionValue>) => setEditing((g) => (g ? setOptionPatch(g, i, patch) : g));

    const saveGroup = async () => {
        if (!editing) return;
        const problem = validateGroup(editing);
        if (problem) { setPanelError(problem); return; }
        setSaving(true);
        setPanelError('');
        const body = groupBody(editing);
        try {
            if (editing.id) {
                const { id: _id, ...rest } = body;
                const saved = await inventoryService.updateOptionGroup(editing.id, rest);
                setGroups((gs) => gs.map((g) => (g.id === editing.id ? { ...body, ...(saved || {}) } : g)));
            } else {
                const saved = await inventoryService.createOptionGroup(body);
                setGroups((gs) => [...gs, { ...body, ...(saved || {}) }]);
            }
            setEditing(null);
            toast.success('Option group saved.');
        } catch (err: any) {
            setPanelError(err?.message || 'Could not save the option group.');
        } finally {
            setSaving(false);
        }
    };

    const removeGroup = async (g: OptionGroup) => {
        if (!g.id) return;
        try {
            await inventoryService.deleteOptionGroup(g.id);
            setGroups((gs) => gs.filter((x) => x.id !== g.id));
            if (editing?.id === g.id) setEditing(null);
        } catch (err: any) {
            toast.error(err?.message || 'Could not delete the option group.');
        }
    };

    const saveDef = async () => {
        if (!editingDef) return;
        if (!editingDef.label.trim()) { setPanelError('Label is required.'); return; }
        const key = editingDef.key.trim() || toKey(editingDef.label);
        if (!key) { setPanelError('Key is required.'); return; }
        setSaving(true);
        setPanelError('');
        const body: MeasurementDef = { ...editingDef, key, label: editingDef.label.trim(), unit: editingDef.unit.trim() };
        try {
            if (editingDef.id) {
                const { id: _id, ...rest } = body;
                const saved = await inventoryService.updateMeasurementDef(editingDef.id, rest);
                setDefs((ds) => ds.map((d) => (d.id === editingDef.id ? { ...body, ...(saved || {}) } : d)));
            } else {
                const saved = await inventoryService.createMeasurementDef(body);
                setDefs((ds) => [...ds, { ...body, ...(saved || {}) }]);
            }
            setEditingDef(null);
            toast.success('Capture field saved.');
        } catch (err: any) {
            setPanelError(err?.message || 'Could not save the capture field.');
        } finally {
            setSaving(false);
        }
    };

    const removeDef = async (d: MeasurementDef) => {
        if (!d.id) return;
        try {
            await inventoryService.deleteMeasurementDef(d.id);
            setDefs((ds) => ds.filter((x) => x.id !== d.id));
            if (editingDef?.id === d.id) setEditingDef(null);
        } catch (err: any) {
            toast.error(err?.message || 'Could not delete the capture field.');
        }
    };

    const showPanel = view === 'groups' ? !!editing : !!editingDef;

    return (
        <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6" data-testid="item-options-settings">
            <div className="flex items-center justify-between mb-4 gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-50">Options & capture fields</h2>
                    <p className="text-xs text-slate-500">Choices priced per order line, and measurements recorded on a line</p>
                </div>
                {canEdit && (view === 'groups' ? (
                    <button className={primaryBtn} onClick={() => { setPanelError(''); setEditing(emptyGroup()); }}>+ New group</button>
                ) : (
                    <button className={primaryBtn} onClick={() => { setPanelError(''); setEditingDef(emptyDef()); }}>+ New field</button>
                ))}
            </div>

            {captureFieldsEnabled && (
                <div className="mb-3 inline-flex rounded-lg border border-slate-800 bg-slate-950/40 p-0.5 text-sm" role="tablist" aria-label="Options sections">
                    <button role="tab" aria-selected={view === 'groups'} className={`rounded-md px-3 py-1.5 ${view === 'groups' ? 'bg-slate-800 text-slate-100' : 'text-slate-400'}`} onClick={() => setView('groups')}>
                        Option groups
                    </button>
                    <button role="tab" aria-selected={view === 'fields'} className={`rounded-md px-3 py-1.5 ${view === 'fields' ? 'bg-slate-800 text-slate-100' : 'text-slate-400'}`} onClick={() => setView('fields')}>
                        Capture fields
                    </button>
                </div>
            )}

            {loading ? (
                <div className="animate-pulse text-slate-500 text-sm">Loading options…</div>
            ) : loadError ? (
                <p role="alert" className="text-sm text-rose-400">{loadError}</p>
            ) : (
                <div className={`grid grid-cols-1 gap-4 ${showPanel ? 'xl:grid-cols-5' : ''}`}>
                    <div className={showPanel ? 'xl:col-span-3' : ''}>
                        {view === 'groups' ? (
                            groups.length === 0 ? (
                                <p className="text-sm text-slate-400">No option groups yet. Create one to offer choices on order lines.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                            <th className="py-2">Group</th><th>Picks</th><th>Applies to</th><th>Values</th><th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groups.map((g) => (
                                            <tr key={g.id} className="border-t border-slate-800 text-slate-300" data-testid={`option-group-${g.id}`}>
                                                <td className="py-2 font-medium text-slate-100">{g.name}</td>
                                                <td>{picksSummary(g)}</td>
                                                <td>{appliesSummary(g.applies_to, categories)}</td>
                                                <td className="text-slate-400">{(g.options || []).map((o) => o.name).join(' / ')}</td>
                                                <td className="whitespace-nowrap text-right">
                                                    {canEdit && (<>
                                                        <button className="text-xs text-blue-400 hover:underline mr-3" aria-label={`Edit ${g.name}`} onClick={() => { setPanelError(''); setEditing({ ...g, applies_to: g.applies_to ?? emptyApplies(), options: (g.options || []).map((o) => ({ ...o })) }); }}>Edit</button>
                                                        <button className="text-xs text-rose-400 hover:underline" aria-label={`Delete ${g.name}`} onClick={() => removeGroup(g)}>Delete</button>
                                                    </>)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        ) : defs.length === 0 ? (
                            <p className="text-sm text-slate-400">No capture fields yet. Add one to record a measurement on order lines.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                        <th className="py-2">Field</th><th>Unit</th><th>Applies to</th><th>Drives price</th><th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {defs.map((d) => (
                                        <tr key={d.id} className="border-t border-slate-800 text-slate-300" data-testid={`capture-field-${d.id}`}>
                                            <td className="py-2 font-medium text-slate-100">{d.label}</td>
                                            <td>{d.unit}</td>
                                            <td>{appliesSummary(d.applies_to, categories)}</td>
                                            <td>{d.is_billing_basis ? 'Yes' : '—'}</td>
                                            <td className="whitespace-nowrap text-right">
                                                {canEdit && (<>
                                                    <button className="text-xs text-blue-400 hover:underline mr-3" aria-label={`Edit ${d.label}`} onClick={() => { setPanelError(''); setEditingDef({ ...d, applies_to: d.applies_to ?? emptyApplies() }); }}>Edit</button>
                                                    <button className="text-xs text-rose-400 hover:underline" aria-label={`Delete ${d.label}`} onClick={() => removeDef(d)}>Delete</button>
                                                </>)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {view === 'groups' && editing && (
                        <aside className="xl:col-span-2 bg-slate-950/40 border border-slate-800 rounded-xl p-4" aria-label="Edit option group">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-100">{editing.id ? 'Edit group' : 'New group'}</h3>
                                    <button className="text-slate-500 hover:text-slate-200" aria-label="Close panel" onClick={() => setEditing(null)}>×</button>
                                </div>
                                <label className="block text-xs text-slate-400">
                                    Name
                                    <input className={`${inputCls} mt-1`} aria-label="Group name" value={editing.name} onChange={(e) => patchGroup({ name: e.target.value })} />
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="block text-xs text-slate-400">
                                        Selection
                                        <select className={`${inputCls} mt-1`} aria-label="Selection" value={editing.selection} onChange={(e) => {
                                            const selection = e.target.value as OptionGroup['selection'];
                                            patchGroup(selection === 'single' ? { selection, max_select: 1 } : { selection, max_select: null });
                                        }}>
                                            <option value="single">Pick one</option>
                                            <option value="multi">Pick many</option>
                                        </select>
                                    </label>
                                    <label className="flex items-end gap-2 text-xs text-slate-400">
                                        <input type="checkbox" aria-label="Required" checked={editing.is_required} onChange={(e) => patchGroup({ is_required: e.target.checked })} />
                                        Required
                                    </label>
                                </div>
                                {editing.selection === 'multi' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="block text-xs text-slate-400">
                                            Min picks
                                            <input type="number" min={0} className={`${inputCls} mt-1`} aria-label="Min picks" value={editing.min_select} onChange={(e) => patchGroup({ min_select: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                                        </label>
                                        <label className="block text-xs text-slate-400">
                                            Max picks
                                            <input type="number" min={1} className={`${inputCls} mt-1`} aria-label="Max picks" placeholder="Any" value={editing.max_select ?? ''} onChange={(e) => patchGroup({ max_select: e.target.value === '' ? null : Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                                        </label>
                                    </div>
                                )}

                                <AppliesToPicker categories={categories} value={editing.applies_to} onChange={(applies_to) => patchGroup({ applies_to })} />

                                <div>
                                    <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Values</p>
                                    <div className="space-y-2">
                                        {editing.options.map((o, i) => (
                                            <div key={i} className="grid grid-cols-[1fr_5.5rem_auto_auto_auto] items-center gap-2" data-testid="option-row">
                                                <input className={inputCls} aria-label={`Value ${i + 1} name`} placeholder="Value" value={o.name} onChange={(e) => patchOption(i, { name: e.target.value })} />
                                                <input className={`${inputCls} text-right`} type="number" aria-label={`Value ${i + 1} price add`} placeholder="+0" value={o.price_delta} onChange={(e) => patchOption(i, { price_delta: Number(e.target.value) })} />
                                                <label className="flex items-center gap-1 text-[11px] text-slate-400" title="Charge per unit instead of once per line">
                                                    <input type="checkbox" aria-label={`Value ${i + 1} per unit`} checked={o.price_mode === 'per_unit'} onChange={(e) => patchOption(i, { price_mode: e.target.checked ? 'per_unit' : 'fixed' })} />
                                                    /unit
                                                </label>
                                                <label className="flex items-center gap-1 text-[11px] text-slate-400">
                                                    <input
                                                        type={editing.selection === 'single' ? 'radio' : 'checkbox'}
                                                        name="option-default"
                                                        aria-label={`Value ${i + 1} default`}
                                                        checked={o.is_default}
                                                        onChange={(e) => patchOption(i, { is_default: e.target.checked })}
                                                    />
                                                    default
                                                </label>
                                                <button className="text-slate-500 hover:text-rose-400 disabled:opacity-30" aria-label={`Remove value ${i + 1}`} disabled={editing.options.length === 1} onClick={() => patchGroup({ options: editing.options.filter((_, idx) => idx !== i) })}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="mt-2 text-xs text-blue-400 hover:underline" onClick={() => patchGroup({ options: [...editing.options, emptyOption(editing.options.length)] })}>
                                        + value
                                    </button>
                                </div>

                                {panelError && <p role="alert" className="text-sm text-rose-400">{panelError}</p>}
                                <div className="flex justify-end gap-2">
                                    <button className={secondaryBtn} onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                                    <button className={primaryBtn} onClick={saveGroup} disabled={saving}>{saving ? 'Saving…' : 'Save group'}</button>
                                </div>
                            </div>
                        </aside>
                    )}

                    {view === 'fields' && editingDef && (
                        <aside className="xl:col-span-2 bg-slate-950/40 border border-slate-800 rounded-xl p-4" aria-label="Edit capture field">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-100">{editingDef.id ? 'Edit capture field' : 'New capture field'}</h3>
                                    <button className="text-slate-500 hover:text-slate-200" aria-label="Close panel" onClick={() => setEditingDef(null)}>×</button>
                                </div>
                                <label className="block text-xs text-slate-400">
                                    Label
                                    <input className={`${inputCls} mt-1`} aria-label="Field label" value={editingDef.label} onChange={(e) => setEditingDef({ ...editingDef, label: e.target.value, key: editingDef.id ? editingDef.key : toKey(e.target.value) })} />
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="block text-xs text-slate-400">
                                        Key
                                        <input className={`${inputCls} mt-1`} aria-label="Field key" value={editingDef.key} onChange={(e) => setEditingDef({ ...editingDef, key: toKey(e.target.value) })} />
                                    </label>
                                    <label className="block text-xs text-slate-400">
                                        Unit
                                        <input className={`${inputCls} mt-1`} aria-label="Field unit" placeholder="kg, m, pcs" value={editingDef.unit} onChange={(e) => setEditingDef({ ...editingDef, unit: e.target.value })} />
                                    </label>
                                </div>
                                <label className="flex items-center gap-2 text-xs text-slate-300">
                                    <input type="checkbox" aria-label="Drives price" checked={editingDef.is_billing_basis} onChange={(e) => setEditingDef({ ...editingDef, is_billing_basis: e.target.checked })} />
                                    Drives price (billing basis — replaces quantity in the line price)
                                </label>
                                <AppliesToPicker categories={categories} value={editingDef.applies_to} onChange={(applies_to) => setEditingDef({ ...editingDef, applies_to })} />
                                {panelError && <p role="alert" className="text-sm text-rose-400">{panelError}</p>}
                                <div className="flex justify-end gap-2">
                                    <button className={secondaryBtn} onClick={() => setEditingDef(null)} disabled={saving}>Cancel</button>
                                    <button className={primaryBtn} onClick={saveDef} disabled={saving}>{saving ? 'Saving…' : 'Save field'}</button>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            )}
        </section>
    );
};

export default ItemOptionsSettingsSection;
