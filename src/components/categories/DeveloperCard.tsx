import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Globe, Mail, Phone, MapPin, User, Loader2, Pencil } from 'lucide-react';
import { Alert, Button, IconButton, Select, TextField } from '@so360/design-system';
import { inventoryService } from '../../services/inventoryService';
import type { DeveloperProfile, DeveloperUpdate } from '../../types/inventory';

interface DeveloperCardProps {
    /** Core partner id (role developer) from the project's metadata. */
    partnerId: string;
    /** Projects (root categories) linked to this developer. */
    projects: { id: string; name: string }[];
    /** The project currently open, highlighted in the list. */
    currentProjectId?: string | null;
    onSelectProject?: (id: string) => void;
    /** May edit website / logo / status / account manager on the Core partner. */
    canEdit?: boolean;
}

interface EditDraft {
    website: string;
    logo_url: string;
    status: '' | 'active' | 'inactive';
    account_manager_user_id: string;
}

const toDraft = (d: DeveloperProfile): EditDraft => {
    const st = (d.status || '').toLowerCase();
    return {
        website: d.website || '',
        logo_url: d.logo_url || '',
        status: st === 'active' || st === 'inactive' ? st : '',
        account_manager_user_id: d.account_manager_user_id || '',
    };
};

/** Only fields with a value are sent; blanks leave the partner untouched. */
export const toDeveloperUpdate = (d: EditDraft): DeveloperUpdate => {
    const out: DeveloperUpdate = {};
    if (d.website.trim()) out.website = d.website.trim();
    if (d.logo_url.trim()) out.logo_url = d.logo_url.trim();
    if (d.status) out.status = d.status;
    if (d.account_manager_user_id.trim()) out.account_manager_user_id = d.account_manager_user_id.trim();
    return out;
};

const fmtDate = (v: string | null): string | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
};

/** Only http(s) links are rendered as anchors; a bare domain gets https://. */
const safeHref = (v: string): string | null => {
    const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
        return new URL(url).toString();
    } catch {
        return null;
    }
};

const Line: React.FC<{ icon?: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
    <div className="flex items-start gap-2">
        <span className="text-fg-subtle mt-0.5">{icon}</span>
        <span className="text-fg-subtle w-28 shrink-0">{label}</span>
        <span className="text-fg break-words min-w-0">{children}</span>
    </div>
);

/**
 * Developer (RFP §3) for a real-estate project. The developer is a Core
 * partner; this card reads it through Core's partner APIs and lists the
 * projects that point at it via `metadata.developer_partner_id`.
 */
export const DeveloperCard: React.FC<DeveloperCardProps> = ({ partnerId, projects, currentProjectId, onSelectProject, canEdit = false }) => {
    const [dev, setDev] = useState<DeveloperProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [logoFailed, setLogoFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [draft, setDraft] = useState<EditDraft | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        setLogoFailed(false);
        inventoryService
            .getDeveloper(partnerId)
            .then((p) => { if (alive) setDev(p); })
            .catch((err: any) => { if (alive) { setDev(null); setError(err?.message || 'Failed to load developer'); } })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [partnerId, attempt]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-fg-muted p-4" data-testid="developer-loading">
                <Loader2 size={14} className="animate-spin" /> Loading developer…
            </div>
        );
    }

    if (error || !dev) {
        return (
            <div className="p-4" data-testid="developer-error">
                <Alert variant="error" action={{ label: 'Retry', onClick: retry }}>
                    {error || 'Failed to load developer'}
                </Alert>
            </div>
        );
    }

    const saveEdit = async () => {
        if (!draft) return;
        const patch = toDeveloperUpdate(draft);
        if (!Object.keys(patch).length) { setDraft(null); return; }
        setSaving(true);
        setSaveError(null);
        try {
            await inventoryService.updateDeveloper(partnerId, patch);
            setDraft(null);
            retry();
        } catch (err: any) {
            setSaveError(err?.message || 'Failed to save developer');
        } finally {
            setSaving(false);
        }
    };

    const website = dev.website ? safeHref(dev.website) : null;
    const status = (dev.status || '').toLowerCase();
    const statusCls = status === 'active'
        ? 'bg-success/15 text-success'
        : status
            ? 'bg-surface-high text-fg-muted'
            : '';

    return (
        <section className="rounded-xl border border-line p-4 space-y-3 text-xs" aria-label="Developer" data-testid="developer-card">
            <div className="flex items-center gap-3">
                {dev.logo_url && !logoFailed ? (
                    <img
                        src={dev.logo_url}
                        alt={`${dev.name} logo`}
                        className="w-10 h-10 rounded-lg object-cover bg-surface-raised"
                        onError={() => setLogoFailed(true)}
                    />
                ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold" data-testid="developer-initial">
                        {dev.name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{dev.name}</p>
                    {dev.company && dev.company !== dev.name && <p className="text-fg-muted truncate">{dev.company}</p>}
                </div>
                {dev.status && (
                    <span className={`ml-auto px-2 py-0.5 rounded-md capitalize ${statusCls}`} data-testid="developer-status">{dev.status}</span>
                )}
                {canEdit && !draft && (
                    <span className={dev.status ? '' : 'ml-auto'}>
                        <IconButton
                            label="Edit developer"
                            icon={<Pencil size={12} />}
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSaveError(null); setDraft(toDraft(dev)); }}
                        />
                    </span>
                )}
            </div>

            {draft && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-line rounded-lg p-3" data-testid="developer-edit">
                    <TextField label="Website" name="developer_website" aria-label="Developer website" size="sm" value={draft.website} placeholder="https://"
                        onChange={(e) => setDraft({ ...draft, website: e.target.value })} />
                    <TextField label="Logo URL" name="developer_logo_url" aria-label="Developer logo URL" size="sm" value={draft.logo_url} placeholder="https://"
                        onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} />
                    <Select
                        label="Status"
                        name="developer_status"
                        aria-label="Developer status"
                        size="sm"
                        value={draft.status}
                        options={[
                            { value: '', label: 'Not set' },
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                        ]}
                        onValueChange={(v: string) => setDraft({ ...draft, status: v === 'active' || v === 'inactive' ? v : '' })}
                    />
                    <TextField label="Account manager (user ID)" name="developer_account_manager" aria-label="Account manager user ID" size="sm" value={draft.account_manager_user_id}
                        onChange={(e) => setDraft({ ...draft, account_manager_user_id: e.target.value })} />
                    {saveError && <div className="md:col-span-2"><Alert variant="error">{saveError}</Alert></div>}
                    <div className="flex gap-2 md:col-span-2">
                        <Button type="button" variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
                            {saving ? 'Saving…' : 'Save developer'}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setDraft(null)} disabled={saving}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {dev.description && <p className="text-fg-muted">{dev.description}</p>}

            <div className="space-y-1.5">
                {dev.contact_name && <Line icon={<User size={12} />} label="Contact">{dev.contact_name}</Line>}
                {dev.phone && <Line icon={<Phone size={12} />} label="Phone"><a href={`tel:${dev.phone}`} className="hover:underline">{dev.phone}</a></Line>}
                {dev.email && <Line icon={<Mail size={12} />} label="Email"><a href={`mailto:${dev.email}`} className="hover:underline">{dev.email}</a></Line>}
                {dev.website && (
                    <Line icon={<Globe size={12} />} label="Website">
                        {website ? <a href={website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{dev.website}</a> : dev.website}
                    </Line>
                )}
                {dev.address && <Line icon={<MapPin size={12} />} label="Address">{dev.address}</Line>}
                {dev.country && <Line label="Country">{dev.country}</Line>}
                {(dev.account_manager || dev.account_manager_user_id) && (
                    <Line label="Account manager">{dev.account_manager || dev.account_manager_user_id}</Line>
                )}
                {dev.notes && <Line label="Notes">{dev.notes}</Line>}
                {fmtDate(dev.created_at) && <Line label="Created">{fmtDate(dev.created_at)}</Line>}
                {fmtDate(dev.updated_at) && <Line label="Modified">{fmtDate(dev.updated_at)}</Line>}
            </div>

            <div className="border-t border-line pt-2">
                <p className="text-fg-subtle mb-1 flex items-center gap-1"><Building2 size={12} /> Projects ({projects.length})</p>
                {projects.length === 0 ? (
                    <p className="text-fg-subtle">No projects linked yet.</p>
                ) : (
                    <ul className="flex flex-wrap gap-1.5" data-testid="developer-projects">
                        {projects.map((p) => (
                            <li key={p.id}>
                                <Button
                                    type="button"
                                    variant={p.id === currentProjectId ? 'tonal' : 'ghost'}
                                    size="sm"
                                    onClick={() => onSelectProject?.(p.id)}
                                    aria-current={p.id === currentProjectId ? 'true' : undefined}
                                >
                                    {p.name}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};

export default DeveloperCard;
