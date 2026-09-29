import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import type { AgentOption } from '../../types/inventory';

const inputCls =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50';

/** Debounce for server-side user search while typing. */
export const USER_SEARCH_DEBOUNCE_MS = 200;

/** Chip text for an id no loaded option names (deleted user, other org, not in the first page). */
export const shortId = (id: string): string => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

const errorText = (e: unknown, fallback: string): string =>
    e instanceof Error && e.message ? e.message : fallback;

interface AgentMultiSelectProps {
    label: string;
    /** Selected ids. Empty is emitted as null so the parent inherits. */
    value: string[] | null | undefined;
    onChange: (next: string[] | null) => void;
    options: AgentOption[];
    /** Names for ids that are not in the current options (earlier searches). */
    names?: Record<string, string>;
    loading?: boolean;
    error?: string | null;
    /** Called with the search text on every keystroke. */
    onQueryChange?: (q: string) => void;
    disabled?: boolean;
}

/**
 * Chips for the selected ids plus a searchable option list. The label is a
 * span (not a <label>) so the picker can sit anywhere without nesting
 * interactive content inside a label.
 */
export const AgentMultiSelect: React.FC<AgentMultiSelectProps> = ({
    label, value, onChange, options, names, loading, error, onQueryChange, disabled,
}) => {
    const labelId = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const selected = value || [];

    const nameOf = (id: string): string | undefined =>
        options.find((o) => o.id === id)?.name || names?.[id];

    const q = query.trim().toLowerCase();
    const visible = options.filter((o) =>
        !selected.includes(o.id) &&
        (!q || o.name.toLowerCase().includes(q) || (o.detail || '').toLowerCase().includes(q)),
    );

    const add = (id: string) => {
        onChange([...selected, id]);
        setQuery('');
        onQueryChange?.('');
    };
    const remove = (id: string) => {
        const next = selected.filter((x) => x !== id);
        onChange(next.length ? next : null);
    };

    return (
        <div role="group" aria-labelledby={labelId}>
            <span id={labelId} className="block text-xs text-slate-400 mb-1">{label}</span>
            <div className="flex flex-wrap gap-1 mb-1">
                {selected.map((id) => {
                    const name = nameOf(id);
                    const text = name || shortId(id);
                    return (
                        <span key={id} title={name ? undefined : id} data-unknown={name ? undefined : 'true'}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-100">
                            {text}
                            {!disabled && (
                                <button type="button" aria-label={`Remove ${text}`} onClick={() => remove(id)}
                                    className="text-slate-400 hover:text-slate-100">
                                    <X size={12} />
                                </button>
                            )}
                        </span>
                    );
                })}
                {disabled && !selected.length && <span className="text-xs text-slate-500">None</span>}
            </div>
            {!disabled && (
                <div className="relative">
                    <input
                        aria-label={`Search ${label}`}
                        role="combobox"
                        aria-expanded={open}
                        className={inputCls}
                        value={query}
                        placeholder="Search…"
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                            onQueryChange?.(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setOpen(false);
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (visible[0]) add(visible[0].id);
                            }
                        }}
                    />
                    {open && (
                        <ul role="listbox" aria-label={`${label} options`}
                            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 text-sm">
                            {loading && (
                                <li className="flex items-center gap-2 px-3 py-2 text-slate-400">
                                    <Loader2 size={12} className="animate-spin" /> Loading…
                                </li>
                            )}
                            {!loading && !visible.length && <li className="px-3 py-2 text-slate-500">No matches</li>}
                            {!loading && visible.map((o) => (
                                <li key={o.id} role="option" aria-selected={false}
                                    className="cursor-pointer px-3 py-2 text-slate-100 hover:bg-slate-800"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => add(o.id)}>
                                    {o.name}
                                    {o.detail && o.detail !== o.name && <span className="ml-2 text-xs text-slate-500">{o.detail}</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {error && <span role="alert" className="block text-[11px] text-amber-400 mt-1">{error}</span>}
        </div>
    );
};

interface PickerProps {
    value: string[] | null | undefined;
    onChange: (next: string[] | null) => void;
    disabled?: boolean;
    label?: string;
}

/**
 * Org users from Core's directory. Searches server-side as the user types;
 * names seen in any response are kept so chips stay named after the list
 * narrows.
 */
export const UserAgentPicker: React.FC<PickerProps> = ({ value, onChange, disabled, label = 'Assigned users' }) => {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<AgentOption[]>([]);
    const [names, setNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const seq = useRef(0);

    useEffect(() => {
        const run = ++seq.current;
        setLoading(true);
        const t = setTimeout(() => {
            Promise.resolve()
                .then(() => inventoryService.searchOrgUsers(query))
                .then((list) => {
                    if (run !== seq.current) return;
                    setOptions(list);
                    setNames((prev) => {
                        const next = { ...prev };
                        list.forEach((o) => { next[o.id] = o.name; });
                        return next;
                    });
                    setError(null);
                })
                .catch((e) => {
                    if (run !== seq.current) return;
                    setOptions([]);
                    setError(`Could not load users: ${errorText(e, 'request failed')}`);
                })
                .finally(() => {
                    if (run === seq.current) setLoading(false);
                });
        }, query ? USER_SEARCH_DEBOUNCE_MS : 0);
        return () => clearTimeout(t);
    }, [query]);

    return (
        <AgentMultiSelect label={label} value={value} onChange={onChange} options={options} names={names}
            loading={loading} error={error} onQueryChange={setQuery} disabled={disabled} />
    );
};

/** Comma-separated ids, committed on blur (fallback when teams cannot be listed). */
const IdListFallback: React.FC<PickerProps & { label: string }> = ({ value, onChange, disabled, label }) => {
    const joined = (value || []).join(', ');
    const [draft, setDraft] = useState(joined);
    useEffect(() => { setDraft(joined); }, [joined]);
    return (
        <input aria-label={label} className={inputCls} value={draft} disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
                const list = draft.split(',').map((x) => x.trim()).filter(Boolean);
                onChange(list.length ? list : null);
            }} />
    );
};

/**
 * Teams are People Connect departments (what CRM's lead assignment resolves
 * assigned_team_ids against). If they cannot be listed — e.g. no
 * departments.read — the ids can still be entered by hand.
 */
export const TeamAgentPicker: React.FC<PickerProps> = ({ value, onChange, disabled, label = 'Assigned teams' }) => {
    const [options, setOptions] = useState<AgentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        Promise.resolve()
            .then(() => inventoryService.listTeams())
            .then((list) => { if (live) setOptions(list); })
            .catch((e) => { if (live) setFailed(errorText(e, 'request failed')); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, []);

    if (failed) {
        return (
            <div>
                <span className="block text-xs text-slate-400 mb-1">{label}</span>
                <IdListFallback label="Assigned team IDs" value={value} onChange={onChange} disabled={disabled} />
                <span role="alert" className="block text-[11px] text-amber-400 mt-1">
                    Could not load teams ({failed}). Enter team IDs separated by commas.
                </span>
            </div>
        );
    }
    return (
        <AgentMultiSelect label={label} value={value} onChange={onChange} options={options}
            loading={loading} disabled={disabled} />
    );
};
