import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '@so360/design-system';
import { inventoryService } from '../../services/inventoryService';
import type { OptionGroup } from '../../services/inventoryService';
import {
    attachItem,
    detachItem,
    detachWouldWiden,
    groupLinkForItem,
    picksSummary,
    type GroupLink,
} from '../../hooks/itemOptions';

export const ITEM_OPTIONS_SETTINGS_PATH = '/inventory/settings?tab=options';

const LINK_LABEL: Record<Exclude<GroupLink, null>, string> = {
    item: 'Attached to this item',
    category: 'Via category',
    all: 'All items',
};

/**
 * Item detail → "Options". Lists the option groups that apply to this item
 * and lets a manager attach/detach the item (applies_to.item_ids only).
 */
const ItemOptionsTab: React.FC<{ itemId: string; categoryId?: string | null; canEdit: boolean }> = ({ itemId, categoryId, canEdit }) => {
    const [groups, setGroups] = useState<OptionGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const list = await inventoryService.listOptionGroups();
                if (active) setGroups(list);
            } catch (err: any) {
                if (active) setError(err?.message || 'Failed to load option groups.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [itemId]);

    const { applied, available } = useMemo(() => {
        const applied: Array<{ g: OptionGroup; link: Exclude<GroupLink, null> }> = [];
        const available: OptionGroup[] = [];
        for (const g of groups) {
            const link = groupLinkForItem(g, itemId, categoryId);
            if (link) applied.push({ g, link });
            else available.push(g);
        }
        return { applied, available };
    }, [groups, itemId, categoryId]);

    const setScope = async (g: OptionGroup, attach: boolean) => {
        if (!g.id) return;
        const applies_to = attach ? attachItem(g.applies_to, itemId) : detachItem(g.applies_to, itemId);
        setBusyId(g.id);
        try {
            // Send only the scope so the group's values are left untouched.
            await inventoryService.updateOptionGroup(g.id, { applies_to });
            setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, applies_to } : x)));
            toast.success(attach ? `Attached "${g.name}".` : `Detached "${g.name}".`);
        } catch (err: any) {
            toast.error(err?.message || 'Could not update the option group.');
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <div className="animate-pulse text-slate-500 text-sm">Loading options…</div>;
    if (error) return <p role="alert" className="text-sm text-rose-400">{error}</p>;

    return (
        <div className="space-y-6" data-testid="item-options-tab">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Choices offered when this item is added to an order line.</p>
                <Link to={ITEM_OPTIONS_SETTINGS_PATH} className="text-xs text-blue-400 hover:underline">Manage option groups</Link>
            </div>

            <div>
                <h4 className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Applies to this item</h4>
                {applied.length === 0 ? (
                    <p className="text-sm text-slate-500">No option groups apply to this item.</p>
                ) : (
                    <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                        {applied.map(({ g, link }) => {
                            const widen = link === 'item' && detachWouldWiden(g.applies_to, itemId);
                            return (
                                <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3" data-testid={`applied-group-${g.id}`}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-100">{g.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {picksSummary(g)} · {(g.options || []).map((o) => o.name).join(' / ')}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">{LINK_LABEL[link]}</span>
                                        {canEdit && link === 'item' && (
                                            <button
                                                type="button"
                                                className="text-xs text-rose-400 hover:underline disabled:opacity-40 disabled:no-underline"
                                                aria-label={`Detach ${g.name}`}
                                                disabled={busyId === g.id || widen}
                                                title={widen ? 'This is the only item in the group. Removing it would apply the group to every item, so change it in Settings instead.' : undefined}
                                                onClick={() => setScope(g, false)}
                                            >
                                                Detach
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {canEdit && available.length > 0 && (
                <div>
                    <h4 className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Other option groups</h4>
                    <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                        {available.map((g) => (
                            <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3" data-testid={`available-group-${g.id}`}>
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-200">{g.name}</p>
                                    <p className="text-xs text-slate-500">{picksSummary(g)}</p>
                                </div>
                                <button
                                    type="button"
                                    className="text-xs text-blue-400 hover:underline disabled:opacity-40"
                                    aria-label={`Attach ${g.name}`}
                                    disabled={busyId === g.id}
                                    onClick={() => setScope(g, true)}
                                >
                                    Attach
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ItemOptionsTab;
