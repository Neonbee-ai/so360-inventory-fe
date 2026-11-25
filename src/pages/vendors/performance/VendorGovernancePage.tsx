import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, DashboardPageTemplate, DataTable, DescriptionList, EmptyState, Grid, GridItem, SectionCard, toast, getErrorMessage } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorScorecardService } from '../../../services/vendorScorecardService';
import { SIGNAL_LABELS, WIDGET_TITLES } from './scorecardLabels';

const WIDGETS = Object.keys(WIDGET_TITLES);

/** Flatten a widget value to label/value rows for the DescriptionList (objects one level deep). */
export function widgetItems(value: any): Array<{ label: string; value: string }> {
  if (value === null || value === undefined) return [];
  if (typeof value !== 'object') return [{ label: 'Value', value: String(value) }];
  const out: Array<{ label: string; value: string }> = [];
  for (const [k, v] of Object.entries(value)) {
    if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v as object)) out.push({ label: `${k.replace(/_/g, ' ')}: ${k2.replace(/_/g, ' ')}`, value: v2 === null ? '—' : String(v2) });
    else out.push({ label: k.replace(/_/g, ' '), value: v === null || v === undefined ? '—' : String(v) });
  }
  return out;
}

/** Governance dashboard (Pulse f0dace0a): each widget shows when it was last refreshed and where to drill. */
export default function VendorGovernancePage() {
  const [data, setData] = useState<Record<string, any>>({});
  const [signals, setSignals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    WIDGETS.forEach((w) => vendorScorecardService.widget(w).then((r: any) => setData((d) => ({ ...d, [w]: r }))).catch(() => setData((d) => ({ ...d, [w]: { error: true } }))));
    vendorScorecardService.riskSignals({ status: 'open' }).then((r: any) => setSignals(Array.isArray(r) ? r : [])).catch(() => setError('Could not load risk signals.'));
  };
  useEffect(load, []);

  const act = async (id: string, status: 'actioned' | 'dismissed') => {
    try { await vendorScorecardService.setRiskSignalStatus(id, status); toast.success(status === 'actioned' ? 'Marked as actioned' : 'Dismissed'); load(); }
    catch (e) { toast.error(getErrorMessage(e, 'Could not update the signal')); }
  };

  const cols: DataTableColumn<any>[] = [
    { key: 'k', header: 'Signal', render: (s) => SIGNAL_LABELS[s.kind] ?? s.kind },
    { key: 'v', header: 'Vendor', render: (s) => String(s.vendor_id).slice(0, 8) },
    { key: 'a', header: 'Recommended', render: (s) => String(s.recommended_action).replace(/_/g, ' ') },
    { key: 'r', header: 'Approval', render: (s) => (s.lifecycle_request_id ? <Badge tone="info">Requested</Badge> : '—') },
    { key: 'x', header: '', render: (s) => (<span className="flex gap-nb-2"><Button size="sm" variant="secondary" onClick={() => act(s.id, 'actioned')}>Actioned</Button><Button size="sm" variant="ghost" onClick={() => act(s.id, 'dismissed')}>Dismiss</Button></span>) },
  ];

  return (
    <DashboardPageTemplate trail={[]} title="Vendor governance" description="Onboarding, coverage, evidence, delivery, quality, corrective actions and risk across vendors.">
      {error && <Alert variant="error">{error}</Alert>}
      <Grid columns={3}>
        {WIDGETS.map((w) => {
          const d = data[w];
          return (
            <GridItem key={w}>
              <SectionCard title={WIDGET_TITLES[w]}>
                {!d ? null : d.error ? <Alert variant="error">Not available.</Alert> : (
                  <>
                    <DescriptionList items={widgetItems(d.value)} />
                    <p className="mt-nb-2 text-xs text-fg-subtle" data-testid={`refreshed-${w}`}>Refreshed {String(d.last_refreshed_at).slice(0, 16).replace('T', ' ')}</p>
                  </>
                )}
              </SectionCard>
            </GridItem>
          );
        })}
      </Grid>
      <SectionCard title="Open risk signals">
        {signals.length === 0 ? <EmptyState title="No open risk signals" /> : <DataTable data-testid="risk-signals-table" columns={cols} rows={signals} rowKey={(s: any) => s.id} />}
      </SectionCard>
    </DashboardPageTemplate>
  );
}
