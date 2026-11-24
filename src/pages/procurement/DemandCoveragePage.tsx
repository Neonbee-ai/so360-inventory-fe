import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import {
    Alert, Badge, Button, DataTable, Drawer, EmptyState, Grid, GridItem, KpiCard, ListPageTemplate, NumberInput,
    Select, StatusBadge, TextField, toast, getErrorMessage, type DataTableColumn,
} from '@so360/design-system';

/**
 * Demand coverage workbench: for every approved requisition line, what stock
 * and confirmed inbound supply already covers it and what is left to buy.
 * The buyer decides per line: use stock, wait for supply, purchase, split or
 * escalate. Stale rows are flagged and refreshed with Recalculate.
 */
const STATUS_LABELS: Record<string, string> = {
    fully_covered: 'Fully covered',
    partially_covered: 'Partially covered',
    net_purchase_required: 'Net purchase required',
    waiting_confirmed_supply: 'Waiting for confirmed supply',
    exception: 'Exception - review',
};
const STATUS_TONES: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'primary'> = {
    fully_covered: 'success',
    partially_covered: 'info',
    net_purchase_required: 'warning',
    waiting_confirmed_supply: 'primary',
    exception: 'danger',
};
const DECISIONS = [
    { value: 'use_stock', label: 'Use existing stock' },
    { value: 'wait_supply', label: 'Wait for confirmed supply' },
    { value: 'purchase', label: 'Purchase the net quantity' },
    { value: 'split', label: 'Split stock / inbound / purchase' },
    { value: 'escalate', label: 'Escalate or expedite' },
];

const DemandCoveragePage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [data, setData] = useState<any>({ rows: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('');
    const [recalculating, setRecalculating] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [decision, setDecision] = useState('purchase');
    const [reason, setReason] = useState('');
    const [split, setSplit] = useState({ stock_qty: 0, inbound_qty: 0, purchase_qty: 0 });
    const [saving, setSaving] = useState(false);
    const [drawerError, setDrawerError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await procurementService.getCoverage({ status: status || undefined }));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load coverage'));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [status]);

    const rows: any[] = data.rows || [];
    const summary = data.summary || {};
    const staleCount = rows.filter((r) => r.stale).length;

    const recalc = async () => {
        setRecalculating(true);
        try {
            await procurementService.recalculateCoverage(rows.map((r) => r.pr_line_id).slice(0, 500));
            await load();
            toast.success('Coverage recalculated');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Recalculation failed'));
        } finally {
            setRecalculating(false);
        }
    };

    const open = (row: any) => {
        setSelected(row);
        setDecision(row.decision || (Number(row.net_purchase_qty) > 0 ? 'purchase' : 'use_stock'));
        setReason(row.decision_reason || '');
        setSplit({
            stock_qty: Number(row.available_qty) || 0,
            inbound_qty: Number(row.inbound_confirmed_qty) || 0,
            purchase_qty: Number(row.net_purchase_qty) || 0,
        });
        setDrawerError(null);
    };

    const splitTotal = split.stock_qty + split.inbound_qty + split.purchase_qty;
    const splitInvalid = decision === 'split' && selected && Math.abs(splitTotal - Number(selected.gross_qty)) > 1e-6;

    const save = async () => {
        if (!selected) return;
        setSaving(true);
        setDrawerError(null);
        try {
            await procurementService.decideCoverage(selected.pr_line_id, {
                decision,
                reason: reason.trim() || undefined,
                ...(decision === 'split' ? { split } : {}),
            });
            toast.success('Decision recorded');
            setSelected(null);
            await load();
        } catch (err) {
            setDrawerError(getErrorMessage(err, 'Could not record the decision'));
        } finally {
            setSaving(false);
        }
    };

    const columns: DataTableColumn<any>[] = useMemo(() => [
        {
            key: 'line', header: 'Requisition line',
            render: (r: any) => (
                <>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/pr/${r.line?.pr_id}`)}>
                        {r.line?.purchase_requisitions?.pr_number || 'PR'}
                    </Button>
                    <span className="block text-xs text-fg-subtle">{r.line?.description || r.line?.item_id || '-'}</span>
                </>
            ),
        },
        { key: 'gross', header: 'Gross', align: 'right', render: (r: any) => formatters.formatNumber(Number(r.gross_qty)) },
        { key: 'avail', header: 'Stock', align: 'right', render: (r: any) => formatters.formatNumber(Number(r.available_qty)) },
        {
            key: 'inbound', header: 'Inbound (confirmed)', align: 'right',
            render: (r: any) => (
                <>
                    {formatters.formatNumber(Number(r.inbound_confirmed_qty))}
                    {Number(r.inbound_unconfirmed_qty) > 0 && (
                        <span className="block text-xs text-fg-subtle">+{formatters.formatNumber(Number(r.inbound_unconfirmed_qty))} unconfirmed</span>
                    )}
                </>
            ),
        },
        { key: 'net', header: 'To buy', align: 'right', render: (r: any) => <span className="font-semibold">{formatters.formatNumber(Number(r.net_purchase_qty))}</span> },
        {
            key: 'status', header: 'Status',
            render: (r: any) => (
                <span className="inline-flex flex-wrap items-center gap-2">
                    <StatusBadge status={STATUS_LABELS[r.status] || r.status} map={{ [STATUS_LABELS[r.status] || r.status]: STATUS_TONES[r.status] || 'neutral' }} />
                    {r.stale && <Badge tone="warning">Stale</Badge>}
                    {r.exception_reason && <span className="text-xs text-fg-subtle">{r.exception_reason.replace(/_/g, ' ').toLowerCase()}</span>}
                </span>
            ),
        },
        { key: 'eta', header: 'Earliest ETA', render: (r: any) => (r.earliest_eta ? formatters.formatDate(r.earliest_eta) : '-') },
        { key: 'order', header: 'Order by', render: (r: any) => (r.latest_order_date ? formatters.formatDate(r.latest_order_date) : '-') },
        {
            key: 'decision', header: 'Decision',
            render: (r: any) => (
                <Button size="sm" variant={r.decision ? 'ghost' : 'secondary'} onClick={() => open(r)}>
                    {r.decision ? DECISIONS.find((d) => d.value === r.decision)?.label || r.decision : 'Decide'}
                </Button>
            ),
        },
    ], [formatters, navigate]);

    return (
        <ListPageTemplate
            trail={[]}
            title="Demand Coverage"
            description="What stock and confirmed supply already cover, and what is left to buy."
            count={rows.length > 0 ? `${rows.length} line(s) - ${summary.net_purchase_required ?? 0} need purchase - ${staleCount} stale` : undefined}
            primaryAction={<Button onClick={() => navigate('/procurement/coverage/consolidate')}>Consolidate demand</Button>}
            headerSecondaryActions={[<Button key="recalc" variant="secondary" onClick={recalc} disabled={recalculating || rows.length === 0}>{recalculating ? 'Recalculating...' : 'Recalculate'}</Button>]}
            filters={(
                <Select
                    name="coverage-status"
                    label="Status"
                    value={status}
                    options={[{ value: '', label: 'All' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
                    onChange={(e: any) => setStatus(e?.target ? e.target.value : e)}
                />
            )}
            loading={loading && rows.length === 0}
            isEmpty={!loading && !error && rows.length === 0}
            empty={<EmptyState title="No approved requisition lines need coverage." />}
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                {staleCount > 0 && (
                    <Alert variant="warning">{staleCount} line(s) were calculated before stock, reservations or purchase orders changed. Recalculate before deciding.</Alert>
                )}
                <Grid columns="auto" data-testid="coverage-kpis">
                    {[
                        { label: 'Fully Covered', value: summary.fully_covered ?? 0 },
                        { label: 'Need Purchase', value: (summary.partially_covered ?? 0) + (summary.net_purchase_required ?? 0) },
                        { label: 'Waiting for Supply', value: summary.waiting_confirmed_supply ?? 0 },
                        { label: 'Exceptions', value: summary.exception ?? 0 },
                    ].map((k) => (
                        <GridItem key={k.label} span={3}><KpiCard label={k.label} value={k.value} /></GridItem>
                    ))}
                </Grid>
                <DataTable data-testid="coverage-table" columns={columns} rows={rows} rowKey={(r: any) => r.pr_line_id} loading={loading} />
            </div>
            <Drawer
                isOpen={!!selected}
                onClose={() => setSelected(null)}
                title="Buying decision"
                subtitle={selected ? `${selected.line?.purchase_requisitions?.pr_number || ''} - gross ${selected.gross_qty}, stock ${selected.available_qty}, confirmed inbound ${selected.inbound_confirmed_qty}, to buy ${selected.net_purchase_qty}` : undefined}
                size="md"
                name="coverage-decision"
                footer={(
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setSelected(null)} disabled={saving}>Cancel</Button>
                        <Button onClick={save} disabled={saving || !!splitInvalid || (decision === 'escalate' && !reason.trim())} data-testid="coverage-save">
                            {saving ? 'Saving...' : 'Record decision'}
                        </Button>
                    </div>
                )}
            >
                {drawerError && <Alert variant="error" className="mb-nb-3">{drawerError}</Alert>}
                <div className="flex flex-col gap-nb-3">
                    <Select name="decision" label="Decision" value={decision} options={DECISIONS} onChange={(e: any) => setDecision(e?.target ? e.target.value : e)} />
                    {decision === 'use_stock' && <p className="text-nb-sm text-fg-muted">Inventory will reserve the available stock for this demand; Procurement never moves stock itself.</p>}
                    {decision === 'split' && selected && (
                        <>
                            <NumberInput name="split-stock" label="From stock" value={split.stock_qty} min={0} onChange={(v) => setSplit((s) => ({ ...s, stock_qty: v ?? 0 }))} />
                            <NumberInput name="split-inbound" label="From confirmed inbound" value={split.inbound_qty} min={0} onChange={(v) => setSplit((s) => ({ ...s, inbound_qty: v ?? 0 }))} />
                            <NumberInput name="split-purchase" label="New purchase" value={split.purchase_qty} min={0} onChange={(v) => setSplit((s) => ({ ...s, purchase_qty: v ?? 0 }))} />
                            <p className={splitInvalid ? 'text-nb-sm text-danger' : 'text-nb-sm text-fg-muted'}>
                                Total {splitTotal} of {selected.gross_qty} gross{splitInvalid ? ' - must add up to the gross demand' : ''}
                            </p>
                        </>
                    )}
                    <TextField name="decision-reason" label={decision === 'escalate' ? 'Reason (required)' : 'Reason'} value={reason} onChange={(e: any) => setReason(e.target.value)} />
                </div>
            </Drawer>
        </ListPageTemplate>
    );
};

export default DemandCoveragePage;
