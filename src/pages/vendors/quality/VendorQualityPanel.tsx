import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, DataTable, EmptyState, Badge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { pct } from '../outcomes/outcomeLabels';
import { VCA_STATUS_LABELS, VCA_STATUS_TONE } from './correctiveActionLabels';

interface Row {
  inspection_id: string;
  inspection_number: string;
  status: string;
  result: string | null;
  ncr_number: string | null;
  ncr_status: string | null;
  inspected_at: string | null;
  link: string;
  lines: any[];
  corrective_action: { id: string; vca_number: string; status: string } | null;
}

/** Supplier quality on Vendor 360: inspections and NCRs by reference, with the corrective action they opened (Pulse aa067321). */
export default function VendorQualityPanel({ vendorId }: { vendorId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      vendorService.getQualityHistory<{ data: Row[] }>(vendorId),
      vendorService.getOutcomes<{ summary?: { supplier_defect_rate: number | null } }>(vendorId, { source_type: 'qc_line', limit: 200 }).catch(() => null),
    ])
      .then(([h, o]) => { if (alive) { setRows(h?.data ?? []); setRate(o?.summary?.supplier_defect_rate ?? null); setError(null); } })
      .catch(() => { if (alive) setError('Could not load quality history.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [vendorId]);

  const columns: DataTableColumn<Row>[] = [
    { key: 'insp', header: 'Inspection', render: (r) => <Button variant="ghost" size="sm" onClick={() => navigate(r.link)}>{r.inspection_number}</Button> },
    { key: 'result', header: 'Result', render: (r) => r.result ?? '—' },
    { key: 'ncr', header: 'NCR', render: (r) => (r.ncr_number ? `${r.ncr_number} · ${r.ncr_status ?? 'open'}` : '—') },
    { key: 'rejected', header: 'Rejected lines', align: 'right', render: (r) => r.lines.length },
    {
      key: 'counted',
      header: 'Counts against vendor',
      render: (r) => (r.lines.length ? (r.lines.some((l) => l.attribution === 'vendor' && l.verification_status === 'verified') ? 'Yes' : 'Not verified') : '—'),
    },
    {
      key: 'vca',
      header: 'Corrective action',
      render: (r) => (r.corrective_action
        ? <Button variant="ghost" size="sm" onClick={() => navigate(`/vendors/corrective-actions/${r.corrective_action!.id}`)}>
            {r.corrective_action.vca_number} <Badge tone={VCA_STATUS_TONE[r.corrective_action.status] ?? 'neutral'}>{VCA_STATUS_LABELS[r.corrective_action.status] ?? r.corrective_action.status}</Badge>
          </Button>
        : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-nb-3">
      {error && <Alert variant="error">{error}</Alert>}
      <Card title="Supplier quality">
        <p className="text-xs text-fg-subtle">Verified vendor defects as a share of inspected units</p>
        <p className="text-lg font-semibold text-fg">{pct(rate)}</p>
      </Card>
      <Card title="Inspections and NCRs">
        {!loading && rows.length === 0 ? (
          <EmptyState title="No inspections yet" description="Inspections of this vendor's receipts, and any NCR they raise, appear here." />
        ) : (
          <DataTable data-testid="vendor-quality-table" columns={columns} rows={rows} rowKey={(r) => r.inspection_id} />
        )}
      </Card>
    </div>
  );
}
