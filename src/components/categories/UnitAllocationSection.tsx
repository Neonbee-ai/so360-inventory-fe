import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import type { ItemCategory, UnitAllocation } from '../../types/inventory';
import { inheritedAllocation } from '../../utils/unitAllocation';
import { AssignedAgentsPanel } from './AssignedAgentsPanel';

interface UnitAllocationSectionProps {
    itemId: string;
    /** The unit's tower; inheritance walks tower → project from here. */
    towerId: string | null;
    categories: ItemCategory[];
    canManage: boolean;
}

const EMPTY: UnitAllocation = { assigned_user_ids: null, assigned_team_ids: null };
const same = (a: string[] | null, b: string[] | null) => (a || []).join(',') === (b || []).join(',');

/** A unit's own agents/teams (item custom_attributes), inheriting from its tower/project when empty. */
export const UnitAllocationSection: React.FC<UnitAllocationSectionProps> = ({ itemId, towerId, categories, canManage }) => {
    const [saved, setSaved] = useState<UnitAllocation>(EMPTY);
    const [draft, setDraft] = useState<UnitAllocation>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const inherited = useMemo(() => inheritedAllocation(categories, towerId), [categories, towerId]);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        inventoryService
            .getUnitAllocation(itemId)
            .then((a) => { if (alive) { setSaved(a); setDraft(a); setError(null); } })
            .catch((err: any) => { if (alive) setError(err?.message || 'Could not load agents'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [itemId]);

    const dirty = !same(saved.assigned_user_ids, draft.assigned_user_ids) || !same(saved.assigned_team_ids, draft.assigned_team_ids);

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            await inventoryService.setUnitAllocation(itemId, draft);
            setSaved(draft);
        } catch (err: any) {
            setError(err?.message || 'Failed to save agents');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-slate-500" data-testid="unit-allocation-loading">
                <Loader2 size={12} className="animate-spin" /> Loading agents…
            </div>
        );
    }

    return (
        <div className="border-t border-slate-800 pt-2 space-y-2" data-testid="unit-allocation">
            <AssignedAgentsPanel value={draft} onChange={setDraft} inherited={inherited} disabled={!canManage} scope="unit" />
            {error && <p className="text-rose-400">{error}</p>}
            {canManage && (
                <button
                    onClick={save}
                    disabled={!dirty || saving}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save agents'}
                </button>
            )}
        </div>
    );
};

export default UnitAllocationSection;
