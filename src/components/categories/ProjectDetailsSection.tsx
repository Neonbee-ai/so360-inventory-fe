import React, { useEffect, useRef, useState } from 'react';
import { Building2, MapPin, Calendar, FileText, Upload, Loader2, X } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { mediaService } from '../../services/mediaService';
import type { CategoryMetadata } from '../../types/inventory';

const BROCHURE_MAX_BYTES = 10 * 1024 * 1024;
const BROCHURE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

interface ProjectDetailsSectionProps {
    value: CategoryMetadata;
    onChange: (next: CategoryMetadata) => void;
    disabled?: boolean;
}

const inputCls =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50';

/**
 * Real-estate project fields on a root category. Controlled — the page owns
 * the draft and sends it as `metadata` on Save.
 */
export const ProjectDetailsSection: React.FC<ProjectDetailsSectionProps> = ({ value, onChange, disabled }) => {
    const [developers, setDevelopers] = useState<{ id: string; name: string }[]>([]);
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
    const devOptions =
        currentDev && !developers.some((d) => d.id === currentDev)
            ? [{ id: currentDev, name: 'Current developer' }, ...developers]
            : developers;

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
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
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
        </section>
    );
};

export default ProjectDetailsSection;
