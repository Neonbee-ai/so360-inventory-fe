import React, { useCallback, useEffect, useMemo, useState } from 'react';
// Only Check and Loader2 come from lucide — both are already used across this
// repo and proven to resolve under vitest. The seven channel glyphs are drawn
// inline instead: a newly-introduced lucide icon that imports as `undefined`
// crashes the whole component under vitest and reds the pre-push gate, and
// Instagram/Facebook/Globe are not used anywhere else here to vouch for them.
import { Check, Loader2 } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';

export interface ChannelVisibilityRow {
    category_id: string;
    channel: string;
    is_visible: boolean;
    sort_order?: number;
    label_override?: string | null;
    /** 0 = this category has its own row; > 0 = value inherited from an ancestor. */
    inherited_from_depth?: number;
}

type GlyphProps = { className?: string; size?: number };

const Glyph: React.FC<GlyphProps & { children: React.ReactNode }> = ({ className, size = 16, children }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {children}
    </svg>
);

const GlobeIcon: React.FC<GlyphProps> = p => (
    <Glyph {...p}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20z" />
    </Glyph>
);

const MobileIcon: React.FC<GlyphProps> = p => (
    <Glyph {...p}>
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" />
    </Glyph>
);

const SparkleIcon: React.FC<GlyphProps> = p => (
    <Glyph {...p}>
        <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
        <path d="M18 16l.8 2L21 18.8 18.8 19.6 18 22l-.8-2.4L15 18.8 17.2 18z" />
    </Glyph>
);

const ChatIcon: React.FC<GlyphProps> = p => (
    <Glyph {...p}>
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l2-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
    </Glyph>
);

const InstagramIcon: React.FC<GlyphProps> = p => (
    <Glyph {...p}>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5h.01" />
    </Glyph>
);

const FacebookIcon: React.FC<GlyphProps> = p => (
    <Glyph {...p}>
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Glyph>
);

const StoreIcon: React.FC<GlyphProps> = p => (
    <Glyph {...p}>
        <path d="M3 9l1.5-5h15L21 9" />
        <path d="M4 9v11h16V9" />
        <path d="M9 20v-6h6v6" />
    </Glyph>
);

export const CHANNEL_META: { code: string; label: string; hint: string; Icon: React.ElementType }[] = [
    { code: 'web', label: 'Web store', hint: 'Your online storefront', Icon: GlobeIcon },
    { code: 'mobile', label: 'Mobile app', hint: 'Customer mobile app', Icon: MobileIcon },
    { code: 'neura', label: 'Neura AI', hint: 'Conversational commerce — the AI agent may offer these', Icon: SparkleIcon },
    { code: 'whatsapp', label: 'WhatsApp', hint: 'WhatsApp catalog', Icon: ChatIcon },
    { code: 'instagram', label: 'Instagram', hint: 'Instagram shopping', Icon: InstagramIcon },
    { code: 'facebook', label: 'Facebook', hint: 'Facebook shop', Icon: FacebookIcon },
    { code: 'pos', label: 'POS', hint: 'In-store point of sale', Icon: StoreIcon },
];

interface Props {
    categoryId: string;
    canManage: boolean;
    /** Notifies the page so it can surface a toast / record activity. */
    onSaved?: (channels: Record<string, boolean>) => void;
}

/**
 * Per-channel publish toggles for one category.
 *
 * A category with no row of its own inherits from the nearest ancestor that has
 * one; the backend view reports that as `inherited_from_depth > 0` and the row
 * is labelled "inherited" until the merchant sets it explicitly here.
 */
const CategoryChannelsPanel: React.FC<Props> = ({ categoryId, canManage, onSaved }) => {
    const [rows, setRows] = useState<ChannelVisibilityRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [applyToChildren, setApplyToChildren] = useState(false);
    const [draft, setDraft] = useState<Record<string, boolean>>({});

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await inventoryService.getCategoryChannels(categoryId);
            const list: ChannelVisibilityRow[] = Array.isArray(data) ? data : [];
            setRows(list);
            const next: Record<string, boolean> = {};
            CHANNEL_META.forEach(({ code }) => {
                next[code] = list.find(r => r.channel === code)?.is_visible ?? false;
            });
            setDraft(next);
        } catch (err: any) {
            setError(err?.message || 'Failed to load channel visibility');
        } finally {
            setIsLoading(false);
        }
    }, [categoryId]);

    useEffect(() => {
        load();
    }, [load]);

    const inheritedChannels = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => {
            if ((r.inherited_from_depth ?? 0) > 0) set.add(r.channel);
        });
        return set;
    }, [rows]);

    const isDirty = useMemo(
        () =>
            CHANNEL_META.some(({ code }) => {
                const current = rows.find(r => r.channel === code)?.is_visible ?? false;
                return draft[code] !== current;
            }),
        [draft, rows],
    );

    const toggle = (code: string) => {
        if (!canManage) return;
        setSaved(false);
        setDraft(prev => ({ ...prev, [code]: !prev[code] }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const channels = CHANNEL_META.map(({ code }) => ({
                channel: code,
                is_visible: draft[code] ?? false,
            }));
            await inventoryService.setCategoryChannels(categoryId, channels, applyToChildren);
            setSaved(true);
            onSaved?.({ ...draft });
            await load();
        } catch (err: any) {
            setError(err?.message || 'Failed to save channel visibility');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                <Loader2 size={14} className="animate-spin" />
                Loading channels…
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-200">Sales channels</h3>
                    <p className="text-xs text-slate-500">
                        Where this category — and the products in it — can be seen and sold.
                    </p>
                </div>
                {canManage && (
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !isDirty}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Save channels
                    </button>
                )}
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}
            {saved && !isDirty && <p className="text-xs text-emerald-400">Channel visibility saved</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CHANNEL_META.map(({ code, label, hint, Icon }) => {
                    const on = draft[code] ?? false;
                    const inherited = inheritedChannels.has(code);
                    return (
                        <button
                            key={code}
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={label}
                            disabled={!canManage}
                            onClick={() => toggle(code)}
                            className={`flex items-start gap-3 text-left p-3 rounded-xl border transition-colors disabled:cursor-not-allowed ${
                                on
                                    ? 'bg-blue-600/10 border-blue-600/50'
                                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                            }`}
                        >
                            <Icon size={16} className={on ? 'text-blue-400 mt-0.5' : 'text-slate-500 mt-0.5'} />
                            <span className="min-w-0">
                                <span className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${on ? 'text-slate-100' : 'text-slate-400'}`}>
                                        {label}
                                    </span>
                                    {inherited && (
                                        <span className="text-[10px] uppercase tracking-wide text-amber-400/80 border border-amber-400/30 rounded px-1 py-px">
                                            inherited
                                        </span>
                                    )}
                                </span>
                                <span className="block text-xs text-slate-500 truncate">{hint}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {canManage && (
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={applyToChildren}
                        onChange={e => setApplyToChildren(e.target.checked)}
                        className="accent-blue-600"
                    />
                    Also apply to every subcategory
                </label>
            )}
        </div>
    );
};

export default CategoryChannelsPanel;
