import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Checkbox, DataTable, EmptyState, NumberInput, SectionCard, Select, Skeleton, TextField, toast, getErrorMessage, type DataTableColumn } from '@so360/design-system';
import { rfqService } from '../../services/rfqService';
import { useInventoryFormatters } from '../../utils/formatters';

const FLAG_TONES: Record<string, 'danger' | 'warning' | 'neutral'> = {
    QUOTE_EXPIRED: 'danger', MISSING_PAYMENT_TERMS: 'danger', MISSING_DELIVERY_TERMS: 'danger', FX_RATE_MISSING: 'danger',
    UOM_NO_FACTOR: 'danger', LINE_NOT_QUOTED: 'warning', NON_COMPLIANT: 'danger', DELIVERY_RISK: 'warning',
    PARTIAL_SUPPLY: 'warning', MOQ_EXCEEDS_REQUIRED: 'warning', PACK_SIZE_MISMATCH: 'warning',
    PARTIALLY_COMPLIANT: 'warning', COMPLIANCE_UNKNOWN: 'neutral',
};

interface Props {
    rfqId: string;
    /** quotation_id -> label shown in the table (vendor name). */
    quoteLabels: Record<string, string>;
    canAct: boolean;
    onLocked?: () => void;
}

/**
 * Evaluation tab: the normalised comparison (original vs base currency / RFQ UOM,
 * the FX rate and when it was taken), flags, weights and scores, evaluator
 * entries and the lock that freezes the snapshot used for the award.
 */
const RFQEvaluationPanel: React.FC<Props> = ({ rfqId, quoteLabels, canAct, onLocked }) => {
    const formatters = useInventoryFormatters();
    const [ev, setEv] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [entry, setEntry] = useState<any>({ quotation_id: '', criterion: 'technical', score: undefined, comment: '', disqualified: false, disqualify_reason: '', coi_declared: false, coi_note: '' });

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list: any[] = await rfqService.listEvaluations(rfqId);
            const latest = (list || []).find(e => e.status !== 'superseded');
            setEv(latest ? await rfqService.getEvaluation(rfqId, latest.id) : null);
        } catch (err) {
            setError(getErrorMessage(err, 'Quote evaluation is not available'));
        } finally {
            setLoading(false);
        }
    }, [rfqId]);
    useEffect(() => { load(); }, [load]);

    const act = async (fn: () => Promise<any>, ok: string) => {
        if (busy) return;
        setBusy(true);
        try {
            const res = await fn();
            toast.success(ok);
            await load();
            return res;
        } catch (err) {
            toast.error(getErrorMessage(err, 'Action failed'));
        } finally {
            setBusy(false);
        }
    };

    const label = (qid: string) => quoteLabels[qid] || qid.slice(0, 8);
    const rows = (ev?.normalized || []).map((n: any) => ({ n, s: (ev.scores || []).find((x: any) => x.quotation_id === n.quotation_id) }));
    const draft = ev?.status === 'draft';

    const columns: DataTableColumn<any>[] = [
        { key: 'vendor', header: 'Quotation', render: ({ n }: any) => <>{label(n.quotation_id)}<span className="block text-xs text-fg-subtle">v{n.version} · {n.currency}</span></> },
        {
            key: 'orig', header: 'Original', align: 'right',
            render: ({ n }: any) => n.lines.map((l: any) => (
                <span key={l.rfq_line_id} className="block text-xs">{l.original.quantity} {l.original.uom || ''} × {l.original.unit_price} {n.currency}</span>
            )),
        },
        {
            key: 'norm', header: `Normalised (${ev?.base_currency || 'base'})`, align: 'right',
            render: ({ n }: any) => (n.totals.evaluated_cost != null
                ? <><span className="font-semibold">{formatters.formatCurrency(n.totals.evaluated_cost)}</span><span className="block text-xs text-fg-subtle">tax {formatters.formatCurrency(n.totals.tax ?? 0)} separate</span></>
                : <Badge tone="danger">Not comparable</Badge>),
        },
        {
            key: 'fx', header: 'FX rate',
            render: ({ n }: any) => (n.fx && n.currency !== n.base_currency
                ? <>{n.fx.rate}<span className="block text-xs text-fg-subtle">{n.fx.source} · {n.fx.effective_date || 'n/a'}</span></>
                : '-'),
        },
        { key: 'flags', header: 'Flags', render: ({ n }: any) => (n.flags.length ? <div className="flex flex-wrap gap-nb-1">{n.flags.map((f: string) => <Badge key={f} size="sm" tone={FLAG_TONES[f] || 'neutral'}>{f.replace(/_/g, ' ').toLowerCase()}</Badge>)}</div> : '-') },
        {
            key: 'score', header: 'Score', align: 'right',
            render: ({ s }: any) => (s ? <>{s.total ?? '-'}{s.rank ? <Badge size="sm" tone="success" className="ml-nb-1">#{s.rank}</Badge> : s.disqualified || s.mandatory_failures?.length ? <Badge size="sm" tone="danger" className="ml-nb-1">out</Badge> : null}</> : '-'),
        },
    ];

    const submitEntry = () => act(async () => {
        const res = await rfqService.addEvaluationEntry(rfqId, ev.id, {
            quotation_id: entry.quotation_id,
            criterion: entry.criterion,
            ...(entry.score !== undefined ? { score: entry.score } : {}),
            ...(entry.comment ? { comment: entry.comment } : {}),
            disqualified: entry.disqualified,
            ...(entry.disqualified ? { disqualify_reason: entry.disqualify_reason } : {}),
            coi_declared: entry.coi_declared,
            ...(entry.coi_declared ? { coi_note: entry.coi_note } : {}),
        });
        setEntry({ ...entry, score: undefined, comment: '', disqualified: false, disqualify_reason: '', coi_declared: false, coi_note: '' });
        return res;
    }, 'Entry recorded');

    if (loading) return <Skeleton />;
    return (
        <div className="flex flex-col gap-nb-4">
            {error && <Alert variant="warning">{error}</Alert>}
            {!error && !ev && (
                <EmptyState
                    title="No evaluation yet"
                    description="An evaluation normalises every current quotation (currency, UOM, price breaks, landed cost) and scores it against the weighted criteria."
                    action={canAct ? { label: 'Create evaluation', onClick: () => act(() => rfqService.createEvaluation(rfqId), 'Evaluation created') } : undefined}
                />
            )}
            {ev && (
                <>
                    {ev.stale_quotes && (
                        <Alert variant="warning" title="Quotations changed after this evaluation">
                            A quotation was added or revised. This snapshot is unchanged; create a new evaluation version before awarding.
                        </Alert>
                    )}
                    <SectionCard
                        title={`Evaluation v${ev.version}`}
                        actions={canAct ? (
                            <div className="flex gap-nb-2">
                                {draft && <Button size="sm" disabled={busy} onClick={() => act(() => rfqService.lockEvaluation(rfqId, ev.id).then(r => { onLocked?.(); return r; }), 'Snapshot locked')}>Lock snapshot</Button>}
                                {(ev.stale_quotes || !draft) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => rfqService.createEvaluation(rfqId), 'New evaluation version created')}>New version</Button>}
                            </div>
                        ) : undefined}
                    >
                        <p className="mb-nb-2 text-nb-sm text-fg-muted">
                            Status {ev.status} · scoring rule v{ev.criteria?.rule_version} · weights {Object.entries(ev.criteria?.weights || {}).map(([k, w]) => `${k} ${w}`).join(', ')}
                            {ev.snapshot_hash ? ` · snapshot ${String(ev.snapshot_hash).slice(0, 10)}` : ''}
                        </p>
                        {ev.recommendation?.lowest_cost_fails_mandatory && (
                            <Alert variant="warning">The lowest-cost quotation fails a mandatory technical criterion and cannot be recommended.</Alert>
                        )}
                        <DataTable data-testid="rfq-evaluation-table" rows={rows} rowKey={(r: any) => r.n.quotation_id} columns={columns} />
                        {ev.recommendation?.recommended_quotation_id && (
                            <p className="mt-nb-2 text-nb-sm text-fg">Recommended: <strong>{label(ev.recommendation.recommended_quotation_id)}</strong></p>
                        )}
                    </SectionCard>

                    {draft && canAct && (
                        <SectionCard title="Evaluator entry">
                            <div className="flex flex-col gap-nb-3">
                                <Select
                                    name="entry-quotation" label="Quotation" placeholder="Select" value={entry.quotation_id}
                                    onChange={(e: any) => setEntry({ ...entry, quotation_id: e?.target ? e.target.value : e })}
                                    options={(ev.normalized || []).map((n: any) => ({ value: n.quotation_id, label: label(n.quotation_id) }))}
                                />
                                <TextField name="entry-criterion" label="Criterion" value={entry.criterion} onChange={(e: any) => setEntry({ ...entry, criterion: e.target.value })} />
                                <NumberInput name="entry-score" label="Score (0-100)" min={0} max={100} value={entry.score} onChange={(v: any) => setEntry({ ...entry, score: v ?? undefined })} />
                                <TextField name="entry-comment" label="Comment" value={entry.comment} onChange={(e: any) => setEntry({ ...entry, comment: e.target.value })} />
                                <Checkbox name="entry-disq" label="Disqualify this quotation" checked={entry.disqualified} onChange={() => setEntry({ ...entry, disqualified: !entry.disqualified })} />
                                {entry.disqualified && <TextField name="entry-disq-reason" label="Disqualification reason (required)" value={entry.disqualify_reason} onChange={(e: any) => setEntry({ ...entry, disqualify_reason: e.target.value })} />}
                                <Checkbox name="entry-coi" label="I have a conflict of interest with this vendor" checked={entry.coi_declared} onChange={() => setEntry({ ...entry, coi_declared: !entry.coi_declared })} />
                                {entry.coi_declared && <TextField name="entry-coi-note" label="Describe the conflict (required)" value={entry.coi_note} onChange={(e: any) => setEntry({ ...entry, coi_note: e.target.value })} />}
                                <div><Button size="sm" disabled={busy || !entry.quotation_id || !entry.criterion} onClick={submitEntry}>Record entry</Button></div>
                            </div>
                        </SectionCard>
                    )}
                    {(ev.entries || []).length > 0 && (
                        <SectionCard title="Entries">
                            <ul className="space-y-nb-1 text-nb-sm">
                                {ev.entries.map((e: any) => (
                                    <li key={e.id}>{label(e.quotation_id)} · {e.criterion}{e.score != null ? ` ${e.score}` : ''}{e.disqualified ? ` · disqualified: ${e.disqualify_reason}` : ''}{e.coi_declared ? ` · conflict declared (ignored): ${e.coi_note}` : ''}{e.comment ? ` — ${e.comment}` : ''}</li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}
                </>
            )}
        </div>
    );
};

export default RFQEvaluationPanel;
