import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import type { AvailabilityTower, AvailabilityUnit, UnitStatus } from '../../types/inventory';
import { buildAvailabilityGrid, cellKey, summarizeCounts, type AvailabilityCounts } from '../../utils/unitGrid';

interface AvailabilityMatrixProps {
    /** Project (root category) or a single tower. */
    categoryId: string;
    /** Bump to force a reload, e.g. after Generate units. */
    refreshKey?: number;
}

export const STATUS_STYLE: Record<UnitStatus, { label: string; short: string; cls: string }> = {
    available: { label: 'Available', short: 'A', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25' },
    on_hold: { label: 'On hold', short: 'H', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25' },
    sold: { label: 'Sold', short: 'S', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25' },
};

const towerCounts = (t: AvailabilityTower): AvailabilityCounts => ({
    total: Number(t.total) || 0,
    available: Number(t.available) || 0,
    on_hold: Number(t.on_hold) || 0,
    sold: Number(t.sold) || 0,
});

const CountsSummary: React.FC<{ counts: AvailabilityCounts }> = ({ counts }) => (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="availability-summary">
        <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200">Total {counts.total}</span>
        <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300">Available {counts.available}</span>
        <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300">On hold {counts.on_hold}</span>
        <span className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300">Sold {counts.sold}</span>
    </div>
);

/**
 * Floor × stack availability for a real-estate project. Tower tabs switch
 * the grid; each chip opens the unit's item page (one tap).
 */
export const AvailabilityMatrix: React.FC<AvailabilityMatrixProps> = ({ categoryId, refreshKey = 0 }) => {
    const navigate = useNavigate();
    const [towers, setTowers] = useState<AvailabilityTower[]>([]);
    const [projectUnits, setProjectUnits] = useState<AvailabilityUnit[]>([]);
    const [activeTower, setActiveTower] = useState<string | null>(null);
    const [towerUnits, setTowerUnits] = useState<Record<string, AvailabilityUnit[]>>({});
    const [loading, setLoading] = useState(true);
    const [towerLoading, setTowerLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setTowerUnits({});
        try {
            const res = await inventoryService.getCategoryAvailability(categoryId);
            setTowers(res.towers);
            setProjectUnits(res.units);
            setActiveTower(res.towers[0]?.category_id ?? null);
        } catch (err: any) {
            setError(err?.message || 'Failed to load availability');
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    // Units that carry their tower id are split locally; otherwise the tower is fetched on demand.
    const unitsTagged = projectUnits.some((u) => !!u.category_id);
    useEffect(() => {
        if (!activeTower || unitsTagged || towerUnits[activeTower] || activeTower === categoryId) return;
        let alive = true;
        setTowerLoading(true);
        inventoryService
            .getCategoryAvailability(activeTower)
            .then((res) => { if (alive) setTowerUnits((prev) => ({ ...prev, [activeTower]: res.units })); })
            .catch((err: any) => { if (alive) setError(err?.message || 'Failed to load tower'); })
            .finally(() => { if (alive) setTowerLoading(false); });
        return () => { alive = false; };
    }, [activeTower, unitsTagged, towerUnits, categoryId]);

    const visibleUnits = useMemo<AvailabilityUnit[]>(() => {
        if (!activeTower || activeTower === categoryId) return projectUnits;
        if (unitsTagged) return projectUnits.filter((u) => u.category_id === activeTower);
        return towerUnits[activeTower] || [];
    }, [activeTower, categoryId, projectUnits, towerUnits, unitsTagged]);

    const grid = useMemo(() => buildAvailabilityGrid(visibleUnits), [visibleUnits]);

    const projectCounts = useMemo<AvailabilityCounts>(() => {
        if (towers.length === 0) return summarizeCounts(projectUnits);
        return towers.map(towerCounts).reduce(
            (acc, c) => ({ total: acc.total + c.total, available: acc.available + c.available, on_hold: acc.on_hold + c.on_hold, sold: acc.sold + c.sold }),
            { total: 0, available: 0, on_hold: 0, sold: 0 },
        );
    }, [towers, projectUnits]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8" data-testid="availability-loading">
                <Loader2 size={16} className="animate-spin" /> Loading availability…
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm">
                <AlertCircle size={16} /> {error}
                <button onClick={load} className="ml-auto flex items-center gap-1 text-rose-300 hover:text-rose-200">
                    <RefreshCw size={14} /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <CountsSummary counts={projectCounts} />

            {towers.length > 0 && (
                <div className="flex flex-wrap gap-1" role="tablist" aria-label="Towers">
                    {towers.map((t) => (
                        <button
                            key={t.category_id}
                            role="tab"
                            aria-selected={activeTower === t.category_id}
                            onClick={() => setActiveTower(t.category_id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTower === t.category_id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                            {t.name} <span className="opacity-70">({towerCounts(t).available}/{towerCounts(t).total})</span>
                        </button>
                    ))}
                </div>
            )}

            {towerLoading ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
                    <Loader2 size={16} className="animate-spin" /> Loading tower…
                </div>
            ) : grid.floors.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center" data-testid="availability-empty">
                    No units yet. Use Generate units on a tower to create them.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="border-separate border-spacing-1 text-xs" data-testid="availability-grid">
                        <thead>
                            <tr>
                                <th className="text-slate-500 font-medium text-left pr-2">Floor</th>
                                {grid.stacks.map((s) => (
                                    <th key={s} className="text-slate-500 font-medium">{s}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {grid.floors.map((floor) => (
                                <tr key={floor}>
                                    <td className="text-slate-400 pr-2 font-mono">{floor}</td>
                                    {grid.stacks.map((stack) => {
                                        const u = grid.cells.get(cellKey(floor, stack));
                                        if (!u) return <td key={stack} />;
                                        const st = STATUS_STYLE[u.status] || STATUS_STYLE.available;
                                        return (
                                            <td key={stack}>
                                                <button
                                                    onClick={() => navigate(`/inventory/items/${u.item_id}`)}
                                                    title={`${u.unit_number} · ${st.label}${u.bedrooms != null ? ` · ${u.bedrooms} BR` : ''}`}
                                                    aria-label={`Unit ${u.unit_number} ${st.label}`}
                                                    className={`min-w-[52px] px-2 py-1 rounded-md border font-mono transition-colors ${st.cls}`}
                                                >
                                                    {u.unit_number} <span className="opacity-70">{st.short}</span>
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                {(Object.keys(STATUS_STYLE) as UnitStatus[]).map((k) => (
                    <span key={k} className="flex items-center gap-1">
                        <span className={`inline-block w-2.5 h-2.5 rounded-sm border ${STATUS_STYLE[k].cls}`} /> {STATUS_STYLE[k].short} = {STATUS_STYLE[k].label}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default AvailabilityMatrix;
