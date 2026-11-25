import React, { useEffect, useState } from 'react';
import { Alert, Badge, Card, DataTable, EmptyState, Grid, GridItem, KpiCard, SectionCard } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorScorecardService } from '../../../services/vendorScorecardService';
import { dimensionLabel, SIGNAL_LABELS, STANDING_LABELS, STANDING_TONE } from './scorecardLabels';

interface Result {
  definition_id: string | null; formula_version: number; period_start: string; period_end: string; overall: number | null; standing: string; sample_size: number;
  dimension_scores: Record<string, { value: number | null; sample: number; status: 'ok' | 'insufficient' }>;
  adjustments?: Array<{ dimension: string; delta: number; reason: string }>; computed_at?: string;
}

/** Vendor 360 "Performance" tab (Pulse f0dace0a): dimension scores with sample size, formula version and open risk signals. */
export default function VendorPerformancePanel({ vendorId }: { vendorId: string }) {
  const [res, setRes] = useState<{ source: string; results: Result[] } | null>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    vendorScorecardService.scorecard(vendorId).then((r: any) => live && setRes(r)).catch(() => live && setError('Could not load the scorecard.'));
    vendorScorecardService.riskSignals({ vendor_id: vendorId, status: 'open' }).then((r: any) => live && setSignals(Array.isArray(r) ? r : [])).catch(() => undefined);
    return () => { live = false; };
  }, [vendorId]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!res) return null;
  const top = res.results[0];
  if (!top) return <EmptyState title="No scorecard yet" description="Scores appear once receipts, quality and service outcomes are recorded for this vendor." />;

  const dims = Object.entries(top.dimension_scores);
  const cols: DataTableColumn<[string, Result['dimension_scores'][string]]>[] = [
    { key: 'd', header: 'Dimension', render: ([k]) => dimensionLabel(k) },
    { key: 'v', header: 'Score', align: 'right', render: ([, s]) => (s.status === 'ok' && s.value !== null ? `${s.value}` : <Badge tone="neutral">Not enough data</Badge>) },
    { key: 's', header: 'Sample', align: 'right', render: ([, s]) => s.sample },
  ];

  return (
    <div className="flex flex-col gap-nb-3">
      {res.source === 'preset' && <Alert variant="info">Showing the default scorecard. Your organisation has not activated its own scorecard definition yet.</Alert>}
      <Grid columns={3}>
        <GridItem><KpiCard label="Overall" value={top.overall === null ? '—' : String(top.overall)} /></GridItem>
        <GridItem><Card title="Standing"><Badge tone={STANDING_TONE[top.standing] ?? 'neutral'}>{STANDING_LABELS[top.standing] ?? top.standing}</Badge></Card></GridItem>
        <GridItem><KpiCard label="Facts counted" value={String(top.sample_size)} /></GridItem>
      </Grid>
      <SectionCard title={`Dimensions (formula v${top.formula_version}, ${top.period_start} to ${top.period_end})`}>
        <DataTable data-testid="scorecard-dimensions" columns={cols} rows={dims} rowKey={([k]) => k} />
        {!!top.adjustments?.length && (
          <ul className="mt-nb-3 list-disc pl-nb-4 text-sm text-fg" data-testid="scorecard-adjustments">
            {top.adjustments.map((a, i) => <li key={i}>{dimensionLabel(a.dimension)}: {a.delta > 0 ? '+' : ''}{a.delta} ({a.reason})</li>)}
          </ul>
        )}
      </SectionCard>
      {signals.length > 0 && (
        <SectionCard title="Open risk signals">
          <ul className="list-disc pl-nb-4 text-sm text-fg" data-testid="vendor-risk-signals">
            {signals.map((s) => <li key={s.id}>{SIGNAL_LABELS[s.kind] ?? s.kind}: recommended {String(s.recommended_action).replace(/_/g, ' ')}</li>)}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
