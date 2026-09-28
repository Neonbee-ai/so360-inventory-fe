import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw, X, ExternalLink } from 'lucide-react';
import { useBusinessSettings } from '@so360/shell-context';
import { inventoryService } from '../../services/inventoryService';
import {
    UNIT_STATUS_OVERRIDES,
    type AvailabilityTower,
    type AvailabilityUnit,
    type UnitStatus,
    type UnitStatusOverride,
} from '../../types/inventory';
import {
    addCounts,
    buildAvailabilityGrid,
    cellKey,
    emptyCounts,
    formatUnitMoney,
    percentSold,
    summarizeCounts,
    toCounts,
    type AvailabilityCounts,
} from '../../utils/unitGrid';

interface AvailabilityMatrixProps {
    /** Project (root category) or a single tower. */
    categoryId: string;
    /** Bump to force a reload, e.g. after Generate units. */
    refreshKey?: number;
    /** May set or clear a unit's manual status (Blocked / Cancelled / Unavailable). */
    canManage?: boolean;
}

export const STATUS_STYLE: Record<UnitStatus, { label: string; short: string; cls: string }> = {
    available: { label: 'Available', short: 'A', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25' },
    on_hold: { label: 'On hold', short: 'H', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25' },
    sold: { label: 'Sold', short: 'S', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25' },
    blocked: { label: 'Blocked', short: 'B', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/50 hover:bg-slate-500/30' },
    cancelled: { label: 'Cancelled', short: 'C', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40 hover:bg-orange-500/25' },
    unavailable: { label: 'Unavailable', short: 'U', cls: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/60 hover:bg-zinc-700/60' },
};

const towerCounts = (t: AvailabilityTower): AvailabilityCounts => toCounts(t);

const MANUAL_BUCKETS: { key: 'blocked' | 'cancelled' | 'unavailable'; label: string }[] = [
    { key: 'blocked', label: 'Blocked' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'unavailable', label: 'Unavailable' },
];

/** Project dashboard card (RFP §4): Total / Available / Reserved / Sold / % Sold. */
const CountsSummary: React.FC<{ counts: AvailabilityCounts }> = ({ counts }) => (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="availability-summary">
        <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200">Total {counts.total}</span>
        <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300">Available {counts.available}</span>
        <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300">Reserved {counts.on_hold}</span>
        <span className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300">Sold {counts.sold}</span>
        {MANUAL_BUCKETS.filter((b) => counts[b.key] > 0).map((b) => (
            <span key={b.key} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400">{b.label} {counts[b.key]}</span>
        ))}
        <span className="px-2 py-1 rounded-lg bg-blue-500/15 text-blue-300 font-semibold" data-testid="percent-sold">
            {percentSold(counts)}% Sold
        </span>
    </div>
);

const OVERRIDE_LABEL: Record<UnitStatusOverride, string> = { blocked: 'Blocked', cancelled: 'Cancelled', unavailable: 'Unavailable' };

const fmtDate = (v: string | null | undefined): string | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) =>
    value === null || value === undefined || value === '' ? null : (
        <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-slate-200 text-right">{value}</dd>
        </div>
    );

interface UnitPanelProps {
    unit: AvailabilityUnit;
    orgCurrency: string | null;
    canManage: boolean;
    onClose: () => void;
    onOpen: () => void;
    onSaved: () => void;
}

/**
 * One unit's RFP §5 fields. Buyer / agent / dates are not stored in inventory:
 * the reservation reference points at the CRM record that owns them.
 */
const UnitPanel: React.FC<UnitPanelProps> = ({ unit, orgCurrency, canManage, onClose, onOpen, onSaved }) => {
    const [override, setOverride] = useState<string>(unit.status_override || '');
    const [reason, setReason] = useState<string>(unit.status_override_reason || '');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const st = STATUS_STYLE[unit.status] || STATUS_STYLE.available;
    const money = (v: number | null | undefined) => formatUnitMoney(v, unit.currency, orgCurrency);
    const ref = unit.deal_ref;
    const dirty = override !== (unit.status_override || '') || (!!override && reason !== (unit.status_override_reason || ''));

    const save = async () => {
        setSaving(true);
        setSaveError(null);
        try {
            await inventoryService.setUnitStatusOverride(unit.item_id, (override || null) as UnitStatusOverride | null, reason);
            onSaved();
        } catch (err: any) {
            setSaveError(err?.message || 'Failed to update status');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3 text-xs" data-testid="unit-panel">
            <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-100">Unit {unit.unit_number}</h4>
                <span className={`px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
                <button onClick={onClose} aria-label="Close unit" className="ml-auto text-slate-500 hover:text-slate-200">
                    <X size={14} />
                </button>
            </div>
            {unit.status_override_reason && unit.status_override && (
                <p className="text-slate-400" data-testid="unit-override-reason">Reason: {unit.status_override_reason}</p>
            )}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <Row label="Property type" value={unit.property_type} />
                <Row label="Floor" value={unit.floor} />
                <Row label="Bedrooms" value={unit.bedrooms} />
                <Row label="Bathrooms" value={unit.bathrooms} />
                <Row label="Area (sq ft)" value={unit.area_sqft} />
                <Row label="Built-up area" value={unit.built_up_area} />
                <Row label="Plot area" value={unit.plot_area} />
                <Row label="View" value={unit.view} />
                <Row label="Original price" value={money(unit.original_price)} />
                <Row label="Discount" value={money(unit.discount)} />
                <Row label="Final price" value={money(unit.final_price ?? unit.price)} />
            </dl>
            {ref && (
                <div className="border-t border-slate-800 pt-2 space-y-1" data-testid="unit-deal-ref">
                    <p className="text-slate-500 uppercase tracking-wide text-[10px]">
                        {ref.reservation_status === 'committed' ? 'Sale record' : 'Reservation'}
                    </p>
                    <dl className="space-y-1">
                        <Row label="Reference" value={`${ref.reference_type} · ${ref.reference_id}`} />
                        <Row label="Reserved on" value={fmtDate(ref.reserved_at)} />
                        <Row label="Sold on" value={fmtDate(ref.sold_at)} />
                    </dl>
                    <p className="text-slate-500">Buyer and agent are on the linked record.</p>
                </div>
            )}
            {canManage && (
                <div className="border-t border-slate-800 pt-2 space-y-2" data-testid="unit-override-form">
                    <label className="block text-slate-400">
                        Manual status
                        <select
                            aria-label="Manual status"
                            value={override}
                            onChange={(e) => setOverride(e.target.value)}
                            className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200"
                        >
                            <option value="">None (use live status)</option>
                            {UNIT_STATUS_OVERRIDES.map((o) => (
                                <option key={o} value={o}>{OVERRIDE_LABEL[o]}</option>
                            ))}
                        </select>
                    </label>
                    {override && (
                        <input
                            aria-label="Reason"
                            placeholder="Reason (optional)"
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200"
                        />
                    )}
                    {saveError && <p className="text-rose-400">{saveError}</p>}
                    <button
                        onClick={save}
                        disabled={!dirty || saving}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save status'}
                    </button>
                </div>
            )}
            <button onClick={onOpen} className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                <ExternalLink size={12} /> Open unit
            </button>
        </div>
    );
};

/**
 * Floor × stack availability for a real-estate project. Tower tabs switch
 * the grid; a chip opens the unit's details (and its manual status), from
 * which "Open unit" goes to the item page.
 */
export const AvailabilityMatrix: React.FC<AvailabilityMatrixProps> = ({ categoryId, refreshKey = 0, canManage = false }) => {
    const navigate = useNavigate();
    const { settings } = useBusinessSettings();
    const orgCurrency: string | null = settings?.base_currency || null;
    const [towers, setTowers] = useState<AvailabilityTower[]>([]);
    const [totals, setTotals] = useState<AvailabilityCounts | null>(null);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
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
            setTotals(res.totals ?? null);
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
        if (totals) return totals;
        if (towers.length === 0) return summarizeCounts(projectUnits);
        return towers.map(towerCounts).reduce(addCounts, emptyCounts());
    }, [totals, towers, projectUnits]);

    const selectedUnit = useMemo(
        () => (selectedUnitId ? visibleUnits.find((u) => u.item_id === selectedUnitId) || null : null),
        [selectedUnitId, visibleUnits],
    );

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
                                                    onClick={() => setSelectedUnitId(u.item_id)}
                                                    aria-pressed={selectedUnitId === u.item_id}
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

            {selectedUnit && (
                <UnitPanel
                    key={`${selectedUnit.item_id}|${selectedUnit.status_override ?? ''}`}
                    unit={selectedUnit}
                    orgCurrency={orgCurrency}
                    canManage={canManage}
                    onClose={() => setSelectedUnitId(null)}
                    onOpen={() => navigate(`/inventory/items/${selectedUnit.item_id}`)}
                    onSaved={load}
                />
            )}

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
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
