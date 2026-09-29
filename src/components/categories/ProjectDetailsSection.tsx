import React, { useEffect, useRef, useState } from 'react';
import { Building2, MapPin, Calendar, FileText, Upload, Loader2, X } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { mediaService } from '../../services/mediaService';
import { PROJECT_STATUSES, type CategoryMetadata, type DeveloperOption, type DeveloperRole, type ProjectStatus } from '../../types/inventory';
import { PaymentPlanTemplatesEditor } from './PaymentPlanTemplatesEditor';
import { TeamAgentPicker, UserAgentPicker } from './AgentPickers';

const BROCHURE_MAX_BYTES = 10 * 1024 * 1024;
const BROCHURE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

interface ProjectDetailsSectionProps {
    value: CategoryMetadata;
    onChange: (next: CategoryMetadata) => void;
    disabled?: boolean;
}

const inputCls =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50';

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
    planned: 'Planned',
    launched: 'Launched',
    under_construction: 'Under construction',
    ready: 'Ready',
    completed: 'Completed',
    on_hold: 'On hold',
};

const DEV_FILTERS: { key: DeveloperRole | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'developer', label: 'Developers' },
    { key: 'property_owner', label: 'Property owners' },
];

/** Blank text is stored as null so the backend clears the key. */
const textOrNull = (v: string): string | null => (v.trim() ? v : null);

/** A number input's text as a finite number, or null when blank / invalid. */
export const numberOrNull = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** Comma-separated text as a trimmed list; an empty list is stored as null. */
export const parseList = (v: string): string[] | null => {
    const list = v.split(',').map((x) => x.trim()).filter(Boolean);
    return list.length ? list : null;
};

/** Drop a nested object whose parts are all blank. */
const compact = <T extends Record<string, unknown>>(o: T): T | null =>
    Object.values(o).some((x) => x !== null && x !== undefined && x !== '') ? o : null;

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <label className="block">
        <span className="block text-xs text-slate-400 mb-1">{label}</span>
        {children}
    </label>
);

/**
 * Comma-separated list. Keeps its own text while typing (so "a, " is not
 * rewritten mid-entry) and commits the parsed list on blur.
 */
export const ListInput: React.FC<{
    label: string;
    value: string[] | null | undefined;
    onCommit: (next: string[] | null) => void;
    disabled?: boolean;
    placeholder?: string;
}> = ({ label, value, onCommit, disabled, placeholder }) => {
    const joined = (value || []).join(', ');
    const [draft, setDraft] = useState(joined);
    useEffect(() => { setDraft(joined); }, [joined]);
    return (
        <Field label={label}>
            <input
                aria-label={label}
                className={inputCls}
                value={draft}
                disabled={disabled}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => onCommit(parseList(draft))}
            />
        </Field>
    );
};

/**
 * Real-estate project fields on a root category. Controlled — the page owns
 * the draft and sends it as `metadata` on Save.
 */
export const ProjectDetailsSection: React.FC<ProjectDetailsSectionProps> = ({ value, onChange, disabled }) => {
    const [developers, setDevelopers] = useState<DeveloperOption[]>([]);
    const [devFilter, setDevFilter] = useState<DeveloperRole | 'all'>('all');
    const [devLoading, setDevLoading] = useState(true);
    const [devError, setDevError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let alive = true;
        setDevLoading(true);
        inventoryService
            .searchDevelopers()
            .then((list) => { if (alive) { setDevelopers(list); setDevError(null); } })
            .catch(() => { if (alive) setDevError('Could not load developers'); })
            .finally(() => { if (alive) setDevLoading(false); });
        return () => { alive = false; };
    }, []);

    const set = (patch: Partial<CategoryMetadata>) => onChange({ ...value, ...patch });

    const currentDev = value.developer_partner_id || '';
    // Keep a saved developer selectable even when the lookup did not return it.
    const filtered = devFilter === 'all' ? developers : developers.filter((d) => d.role === devFilter);
    const savedDev = developers.find((d) => d.id === currentDev);
    const devOptions: DeveloperOption[] = !currentDev || filtered.some((d) => d.id === currentDev)
        ? filtered
        : [savedDev || { id: currentDev, name: 'Current developer', role: 'developer' }, ...filtered];
    const hasOwners = developers.some((d) => d.role === 'property_owner');

    const handleBrochure = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > BROCHURE_MAX_BYTES) { setUploadError('Max 10 MB'); return; }
        if (file.type && !BROCHURE_TYPES.includes(file.type)) { setUploadError('PDF or image only'); return; }
        setUploadError(null);
        setUploading(true);
        try {
            const { url } = await mediaService.uploadFile(file);
            set({ brochure_url: url });
        } catch (err: any) {
            setUploadError(err?.message || 'Upload failed');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <section className="space-y-4 border border-slate-800 rounded-xl p-4" aria-label="Project details">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Building2 size={16} className="text-blue-400" /> Project details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                    <span className="block text-xs text-slate-400 mb-1">Developer</span>
                    <select
                        aria-label="Developer"
                        className={inputCls}
                        value={currentDev}
                        disabled={disabled || devLoading}
                        onChange={(e) => set({ developer_partner_id: e.target.value || null })}
                    >
                        <option value="">{devLoading ? 'Loading…' : 'No developer'}</option>
                        {devOptions.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.role === 'property_owner' ? `${d.name} (Property owner)` : d.name}
                            </option>
                        ))}
                    </select>
                    {hasOwners && (
                        <div className="flex gap-1 mt-1" role="group" aria-label="Developer filter">
                            {DEV_FILTERS.map((f) => (
                                <button
                                    key={f.key}
                                    type="button"
                                    aria-pressed={devFilter === f.key}
                                    onClick={() => setDevFilter(f.key)}
                                    className={`px-2 py-0.5 rounded-full text-[11px] border ${devFilter === f.key ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {devError && <span className="block text-[11px] text-rose-400 mt-1">{devError}</span>}
                </label>

                <label className="block">
                    <span className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><MapPin size={12} /> Location</span>
                    <input
                        aria-label="Location"
                        className={inputCls}
                        value={value.location || ''}
                        disabled={disabled}
                        placeholder="e.g. Dubai Marina"
                        onChange={(e) => set({ location: e.target.value || null })}
                    />
                </label>

                <label className="block">
                    <span className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Calendar size={12} /> Handover</span>
                    <input
                        aria-label="Handover"
                        className={inputCls}
                        value={value.handover || ''}
                        disabled={disabled}
                        placeholder="e.g. Q4 2027"
                        onChange={(e) => set({ handover: e.target.value || null })}
                    />
                </label>

                <div>
                    <span className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><FileText size={12} /> Brochure</span>
                    {value.brochure_url ? (
                        <div className="flex items-center gap-2 text-sm">
                            <a href={value.brochure_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate">
                                View brochure
                            </a>
                            {!disabled && (
                                <button
                                    type="button"
                                    aria-label="Remove brochure"
                                    onClick={() => set({ brochure_url: null })}
                                    className="p-1 text-slate-500 hover:text-rose-400"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <label className={`flex items-center gap-2 text-sm text-slate-300 bg-slate-800 border border-dashed border-slate-700 rounded-lg px-3 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-blue-500'}`}>
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                            {uploading ? 'Uploading…' : 'Upload PDF'}
                            <input
                                ref={fileRef}
                                data-testid="brochure-input"
                                type="file"
                                accept="application/pdf,image/png,image/jpeg,image/webp"
                                className="hidden"
                                disabled={disabled || uploading}
                                onChange={handleBrochure}
                            />
                        </label>
                    )}
                    {uploadError && <span className="block text-[11px] text-rose-400 mt-1">{uploadError}</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="project-fields">
                <Field label="Project code">
                    <input aria-label="Project code" className={inputCls} value={value.project_code || ''} disabled={disabled}
                        onChange={(e) => set({ project_code: textOrNull(e.target.value) })} />
                </Field>
                <Field label="Project status">
                    <select aria-label="Project status" className={inputCls} value={value.project_status || ''} disabled={disabled}
                        onChange={(e) => set({ project_status: (e.target.value || null) as ProjectStatus | null })}>
                        <option value="">Not set</option>
                        {PROJECT_STATUSES.map((st) => (
                            <option key={st} value={st}>{PROJECT_STATUS_LABEL[st]}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Launch date">
                    <input aria-label="Launch date" type="date" className={inputCls} value={(value.launch_date || '').slice(0, 10)} disabled={disabled}
                        onChange={(e) => set({ launch_date: e.target.value || null })} />
                </Field>
                <Field label="Completion date">
                    <input aria-label="Completion date" type="date" className={inputCls} value={(value.completion_date || '').slice(0, 10)} disabled={disabled}
                        onChange={(e) => set({ completion_date: e.target.value || null })} />
                </Field>
                <Field label="City">
                    <input aria-label="City" className={inputCls} value={value.city || ''} disabled={disabled}
                        onChange={(e) => set({ city: textOrNull(e.target.value) })} />
                </Field>
                <Field label="Country">
                    <input aria-label="Country" className={inputCls} value={value.country || ''} disabled={disabled}
                        onChange={(e) => set({ country: textOrNull(e.target.value) })} />
                </Field>
                <Field label="Price from">
                    <input aria-label="Price from" type="number" min={0} className={inputCls} value={value.price_range?.min ?? ''} disabled={disabled}
                        onChange={(e) => set({ price_range: compact({ ...(value.price_range || {}), min: numberOrNull(e.target.value) }) })} />
                </Field>
                <Field label="Price to">
                    <input aria-label="Price to" type="number" min={0} className={inputCls} value={value.price_range?.max ?? ''} disabled={disabled}
                        onChange={(e) => set({ price_range: compact({ ...(value.price_range || {}), max: numberOrNull(e.target.value) }) })} />
                </Field>
                {value.payment_plan && (
                    <Field label="Payment plan (legacy)">
                        <input aria-label="Payment plan" className={`${inputCls} cursor-default`} value={value.payment_plan} readOnly
                            title="Legacy free-text plan. Use the payment plans below instead." />
                    </Field>
                )}
                <Field label="Commission %">
                    <input aria-label="Commission %" type="number" min={0} max={100} step="0.01" className={inputCls} value={value.commission_percent ?? ''} disabled={disabled}
                        onChange={(e) => set({ commission_percent: numberOrNull(e.target.value) })} />
                </Field>
                <ListInput label="Property types" value={value.property_types} disabled={disabled} placeholder="Apartment, Villa"
                    onCommit={(v) => set({ property_types: v })} />
                <ListInput label="Amenities" value={value.amenities} disabled={disabled} placeholder="Pool, Gym"
                    onCommit={(v) => set({ amenities: v })} />
                <ListInput label="Image URLs" value={value.images} disabled={disabled} onCommit={(v) => set({ images: v })} />
                <ListInput label="Video URLs" value={value.videos} disabled={disabled} onCommit={(v) => set({ videos: v })} />
                <ListInput label="Floor plan URLs" value={value.floor_plans} disabled={disabled} onCommit={(v) => set({ floor_plans: v })} />
                <ListInput label="Document URLs" value={value.documents} disabled={disabled} onCommit={(v) => set({ documents: v })} />
                <UserAgentPicker value={value.assigned_user_ids} disabled={disabled} onChange={(v) => set({ assigned_user_ids: v })} />
                <TeamAgentPicker value={value.assigned_team_ids} disabled={disabled} onChange={(v) => set({ assigned_team_ids: v })} />
                <Field label="Map latitude">
                    <input aria-label="Map latitude" type="number" step="any" className={inputCls} value={value.map?.lat ?? ''} disabled={disabled}
                        onChange={(e) => set({ map: compact({ ...(value.map || {}), lat: numberOrNull(e.target.value) }) })} />
                </Field>
                <Field label="Map longitude">
                    <input aria-label="Map longitude" type="number" step="any" className={inputCls} value={value.map?.lng ?? ''} disabled={disabled}
                        onChange={(e) => set({ map: compact({ ...(value.map || {}), lng: numberOrNull(e.target.value) }) })} />
                </Field>
                <Field label="Map link">
                    <input aria-label="Map link" className={inputCls} value={value.map?.url || ''} disabled={disabled} placeholder="https://"
                        onChange={(e) => set({ map: compact({ ...(value.map || {}), url: e.target.value.trim() || null }) })} />
                </Field>
            </div>

            <PaymentPlanTemplatesEditor
                value={value.payment_plan_templates}
                disabled={disabled}
                onChange={(next) => set({ payment_plan_templates: next })}
            />

            <Field label="Description">
                <textarea aria-label="Description" rows={3} className={inputCls} value={value.description || ''} disabled={disabled}
                    onChange={(e) => set({ description: textOrNull(e.target.value) })} />
            </Field>
        </section>
    );
};

export default ProjectDetailsSection;
