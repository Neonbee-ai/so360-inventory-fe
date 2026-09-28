import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Globe, Mail, Phone, MapPin, User, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import type { DeveloperProfile } from '../../types/inventory';

interface DeveloperCardProps {
    /** Core partner id (role developer) from the project's metadata. */
    partnerId: string;
    /** Projects (root categories) linked to this developer. */
    projects: { id: string; name: string }[];
    /** The project currently open, highlighted in the list. */
    currentProjectId?: string | null;
    onSelectProject?: (id: string) => void;
}

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
        <span className="text-slate-500 mt-0.5">{icon}</span>
        <span className="text-slate-500 w-28 shrink-0">{label}</span>
        <span className="text-slate-200 break-words min-w-0">{children}</span>
    </div>
);

/**
 * Developer (RFP §3) for a real-estate project. The developer is a Core
 * partner; this card reads it through Core's partner APIs and lists the
 * projects that point at it via `metadata.developer_partner_id`.
 */
export const DeveloperCard: React.FC<DeveloperCardProps> = ({ partnerId, projects, currentProjectId, onSelectProject }) => {
    const [dev, setDev] = useState<DeveloperProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [logoFailed, setLogoFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

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
            <div className="flex items-center gap-2 text-xs text-slate-400 p-4" data-testid="developer-loading">
                <Loader2 size={14} className="animate-spin" /> Loading developer…
            </div>
        );
    }

    if (error || !dev) {
        return (
            <div className="flex items-center gap-2 text-xs text-rose-300 p-4" data-testid="developer-error">
                <AlertCircle size={14} /> {error || 'Failed to load developer'}
                <button onClick={retry} className="ml-2 flex items-center gap-1 text-slate-300 hover:text-white">
                    <RefreshCw size={12} /> Retry
                </button>
            </div>
        );
    }

    const website = dev.website ? safeHref(dev.website) : null;
    const status = (dev.status || '').toLowerCase();
    const statusCls = status === 'active'
        ? 'bg-emerald-500/15 text-emerald-300'
        : status
            ? 'bg-slate-700 text-slate-300'
            : '';

    return (
        <section className="rounded-xl border border-slate-800 p-4 space-y-3 text-xs" aria-label="Developer" data-testid="developer-card">
            <div className="flex items-center gap-3">
                {dev.logo_url && !logoFailed ? (
                    <img
                        src={dev.logo_url}
                        alt={`${dev.name} logo`}
                        className="w-10 h-10 rounded-lg object-cover bg-slate-800"
                        onError={() => setLogoFailed(true)}
                    />
                ) : (
                    <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center text-sm font-semibold" data-testid="developer-initial">
                        {dev.name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{dev.name}</p>
                    {dev.company && dev.company !== dev.name && <p className="text-slate-400 truncate">{dev.company}</p>}
                </div>
                {dev.status && (
                    <span className={`ml-auto px-2 py-0.5 rounded-md capitalize ${statusCls}`} data-testid="developer-status">{dev.status}</span>
                )}
            </div>

            {dev.description && <p className="text-slate-300">{dev.description}</p>}

            <div className="space-y-1.5">
                {dev.contact_name && <Line icon={<User size={12} />} label="Contact">{dev.contact_name}</Line>}
                {dev.phone && <Line icon={<Phone size={12} />} label="Phone"><a href={`tel:${dev.phone}`} className="hover:underline">{dev.phone}</a></Line>}
                {dev.email && <Line icon={<Mail size={12} />} label="Email"><a href={`mailto:${dev.email}`} className="hover:underline">{dev.email}</a></Line>}
                {dev.website && (
                    <Line icon={<Globe size={12} />} label="Website">
                        {website ? <a href={website} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{dev.website}</a> : dev.website}
                    </Line>
                )}
                {dev.address && <Line icon={<MapPin size={12} />} label="Address">{dev.address}</Line>}
                {dev.country && <Line label="Country">{dev.country}</Line>}
                {dev.account_manager && <Line label="Account manager">{dev.account_manager}</Line>}
                {dev.notes && <Line label="Notes">{dev.notes}</Line>}
                {fmtDate(dev.created_at) && <Line label="Created">{fmtDate(dev.created_at)}</Line>}
                {fmtDate(dev.updated_at) && <Line label="Modified">{fmtDate(dev.updated_at)}</Line>}
            </div>

            <div className="border-t border-slate-800 pt-2">
                <p className="text-slate-500 mb-1 flex items-center gap-1"><Building2 size={12} /> Projects ({projects.length})</p>
                {projects.length === 0 ? (
                    <p className="text-slate-500">No projects linked yet.</p>
                ) : (
                    <ul className="flex flex-wrap gap-1.5" data-testid="developer-projects">
                        {projects.map((p) => (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelectProject?.(p.id)}
                                    aria-current={p.id === currentProjectId ? 'true' : undefined}
                                    className={`px-2 py-1 rounded-lg border ${p.id === currentProjectId ? 'border-blue-500 text-blue-300' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                                >
                                    {p.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};

export default DeveloperCard;
