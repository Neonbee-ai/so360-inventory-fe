import React, { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Loader2, X } from 'lucide-react';
import { Alert, Button, Card, IconButton, Select, Textarea, TextField, FieldGrid } from '@so360/design-system';
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
        <TextField
            label={label}
            name={label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}
            aria-label={label}
            size="sm"
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onCommit(parseList(draft))}
        />
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
        <section aria-label="Project details">
            <Card title="Project details">
            <div className="space-y-4">

            <FieldGrid>
                <div className="space-y-1">
                    <Select
                        label="Developer"
                        name="developer_partner_id"
                        size="sm"
                        aria-label="Developer"
                        value={currentDev}
                        disabled={disabled || devLoading}
                        options={[
                            { value: '', label: devLoading ? 'Loading…' : 'No developer' },
                            ...devOptions.map((d) => ({ value: d.id, label: d.role === 'property_owner' ? `${d.name} (Property owner)` : d.name })),
                        ]}
                        onValueChange={(v: string) => set({ developer_partner_id: v || null })}
                    />
                    {hasOwners && (
                        <div className="flex gap-1" role="group" aria-label="Developer filter">
                            {DEV_FILTERS.map((f) => (
                                <Button
                                    key={f.key}
                                    type="button"
                                    size="sm"
                                    variant={devFilter === f.key ? 'tonal' : 'ghost'}
                                    aria-pressed={devFilter === f.key}
                                    onClick={() => setDevFilter(f.key)}
                                >
                                    {f.label}
                                </Button>
                            ))}
                        </div>
                    )}
                    {devError && <Alert variant="error">{devError}</Alert>}
                </div>

                <TextField
                    label="Location"
                    name="location"
                    size="sm"
                    aria-label="Location"
                    value={value.location || ''}
                    disabled={disabled}
                    placeholder="e.g. Dubai Marina"
                    onChange={(e) => set({ location: e.target.value || null })}
                />

                <TextField
                    label="Handover"
                    name="handover"
                    size="sm"
                    aria-label="Handover"
                    value={value.handover || ''}
                    disabled={disabled}
                    placeholder="e.g. Q4 2027"
                    onChange={(e) => set({ handover: e.target.value || null })}
                />

                <div>
                    <span className="block text-xs text-fg-muted mb-1 flex items-center gap-1"><FileText size={12} /> Brochure</span>
                    {value.brochure_url ? (
                        <div className="flex items-center gap-2 text-sm">
                            <a href={value.brochure_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                                View brochure
                            </a>
                            {!disabled && (
                                <IconButton
                                    label="Remove brochure"
                                    icon={<X size={14} />}
                                    variant="danger"
                                    size="sm"
                                    onClick={() => set({ brochure_url: null })}
                                />
                            )}
                        </div>
                    ) : (
                        <label className={`flex items-center gap-2 text-sm text-fg-muted bg-surface-raised border border-dashed border-line-strong rounded-lg px-3 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-primary'}`}>
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
                    {uploadError && <div className="mt-1"><Alert variant="error">{uploadError}</Alert></div>}
                </div>
            </FieldGrid>

            <FieldGrid data-testid="project-fields">
                <TextField label="Project code" name="project_code" size="sm" aria-label="Project code" value={value.project_code || ''} disabled={disabled}
                        onChange={(e) => set({ project_code: textOrNull(e.target.value) })} />
                <Select label="Project status" name="project_status" size="sm" aria-label="Project status" value={value.project_status || ''} disabled={disabled}
                    options={[{ value: '', label: 'Not set' }, ...PROJECT_STATUSES.map((st) => ({ value: st, label: PROJECT_STATUS_LABEL[st] }))]}
                    onValueChange={(v: string) => set({ project_status: (v || null) as ProjectStatus | null })} />
                <TextField label="Launch date" name="launch_date" size="sm" aria-label="Launch date" type="date" value={(value.launch_date || '').slice(0, 10)} disabled={disabled}
                        onChange={(e) => set({ launch_date: e.target.value || null })} />
                <TextField label="Completion date" name="completion_date" size="sm" aria-label="Completion date" type="date" value={(value.completion_date || '').slice(0, 10)} disabled={disabled}
                        onChange={(e) => set({ completion_date: e.target.value || null })} />
                <TextField label="City" name="city" size="sm" aria-label="City" value={value.city || ''} disabled={disabled}
                        onChange={(e) => set({ city: textOrNull(e.target.value) })} />
                <TextField label="Country" name="country" size="sm" aria-label="Country" value={value.country || ''} disabled={disabled}
                        onChange={(e) => set({ country: textOrNull(e.target.value) })} />
                <TextField label="Price from" name="price_from" size="sm" aria-label="Price from" type="number" min={0} value={value.price_range?.min ?? ''} disabled={disabled}
                        onChange={(e) => set({ price_range: compact({ ...(value.price_range || {}), min: numberOrNull(e.target.value) }) })} />
                <TextField label="Price to" name="price_to" size="sm" aria-label="Price to" type="number" min={0} value={value.price_range?.max ?? ''} disabled={disabled}
                        onChange={(e) => set({ price_range: compact({ ...(value.price_range || {}), max: numberOrNull(e.target.value) }) })} />
                {value.payment_plan && (
                    <TextField label="Payment plan (legacy)" name="payment_plan_legacy" size="sm" aria-label="Payment plan" value={value.payment_plan} readOnly
                        title="Legacy free-text plan. Use the payment plans below instead." />
                )}
                <TextField label="Commission %" name="commission" size="sm" aria-label="Commission %" type="number" min={0} max={100} step="0.01" value={value.commission_percent ?? ''} disabled={disabled}
                        onChange={(e) => set({ commission_percent: numberOrNull(e.target.value) })} />
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
                <TextField label="Map latitude" name="map_latitude" size="sm" aria-label="Map latitude" type="number" step="any" value={value.map?.lat ?? ''} disabled={disabled}
                        onChange={(e) => set({ map: compact({ ...(value.map || {}), lat: numberOrNull(e.target.value) }) })} />
                <TextField label="Map longitude" name="map_longitude" size="sm" aria-label="Map longitude" type="number" step="any" value={value.map?.lng ?? ''} disabled={disabled}
                        onChange={(e) => set({ map: compact({ ...(value.map || {}), lng: numberOrNull(e.target.value) }) })} />
                <TextField label="Map link" name="map_link" size="sm" aria-label="Map link" value={value.map?.url || ''} disabled={disabled} placeholder="https://"
                        onChange={(e) => set({ map: compact({ ...(value.map || {}), url: e.target.value.trim() || null }) })} />
            </FieldGrid>

            <PaymentPlanTemplatesEditor
                value={value.payment_plan_templates}
                disabled={disabled}
                onChange={(next) => set({ payment_plan_templates: next })}
            />

            <Textarea label="Description" name="description" aria-label="Description" rows={3} value={value.description || ''} disabled={disabled}
                onChange={(e) => set({ description: textOrNull(e.target.value) })} />
            </div>
            </Card>
        </section>
    );
};

export default ProjectDetailsSection;
