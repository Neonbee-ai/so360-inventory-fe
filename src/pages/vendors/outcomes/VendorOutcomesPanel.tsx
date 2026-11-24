import React, { useEffect, useState } from 'react';
import { Alert, Card, DataTable, EmptyState, StatusBadge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { pct, SOURCE_LABELS } from './outcomeLabels';

interface Fact {
  id: string;
  source_type: string;
  grn_id: string | null;
  source_parent_id: string | null;
  actual_at: string | null;
  received_qty: number | null;
  accepted_qty: number | null;
  rejected_qty: number | null;
  quarantined_qty: number | null;
  returned_qty: number | null;
  on_time: boolean | null;
  attributable_to: string;
  reason_code: string | null;
}
interface Summary { on_time_rate: number | null; fill_rate: number | null; reject_rate: number | null; receipts: number }

const q = (n: number | null) => (n === null || n === undefined ? '—' : String(Number(n)));

/** Receipts and supplier returns attributed to this vendor (Pulse 91b5ff86). Inventory stays the owner of stock. */
export default function VendorOutcomesPanel({ vendorId }: { vendorId: string }) {
  const [rows, setRows] = useState<Fact[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    vendorService
      .getOutcomes<{ data: Fact[]; summary: Summary }>(vendorId, { limit: 100 })
      .then((r) => { if (alive) { setRows(r?.data ?? []); setSummary(r?.summary ?? null); setError(null); } })
      .catch(() => { if (alive) setError('Could not load receipts and returns.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [vendorId]);

  const columns: DataTableColumn<Fact>[] = [
    { key: 'when', header: 'Date', render: (r) => r.actual_at?.slice(0, 10) ?? '—' },
    { key: 'type', header: 'Type', render: (r) => SOURCE_LABELS[r.source_type] ?? r.source_type },
    { key: 'received', header: 'Received', align: 'right', render: (r) => q(r.received_qty) },
    { key: 'accepted', header: 'Accepted', align: 'right', render: (r) => q(r.accepted_qty) },
    { key: 'rejected', header: 'Rejected', align: 'right', render: (r) => q(r.rejected_qty) },
    { key: 'hold', header: 'On hold', align: 'right', render: (r) => q(r.quarantined_qty) },
    { key: 'returned', header: 'Returned', align: 'right', render: (r) => q(r.returned_qty) },
    {
      key: 'timing',
      header: 'Delivery',
      render: (r) => (r.on_time === null || r.on_time === undefined ? '—' : <StatusBadge status={r.on_time ? 'success' : 'warning'} label={r.on_time ? 'On time' : 'Late'} />),
    },
    {
      key: 'owner',
      header: 'Counts against vendor',
      render: (r) => (r.source_type === 'supplier_return_line' || r.source_type === 'qc_line' ? (r.attributable_to === 'vendor' ? 'Yes' : 'No') : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-nb-3">
      {error && <Alert variant="error">{error}</Alert>}
      <Card title="Delivery and quality (last 100 records)">
        <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-4">
          <div><p className="text-xs text-fg-subtle">Receipts</p><p className="text-lg font-semibold text-fg">{summary?.receipts ?? '—'}</p></div>
          <div><p className="text-xs text-fg-subtle">On-time</p><p className="text-lg font-semibold text-fg">{pct(summary?.on_time_rate)}</p></div>
          <div><p className="text-xs text-fg-subtle">Accepted vs ordered</p><p className="text-lg font-semibold text-fg">{pct(summary?.fill_rate)}</p></div>
          <div><p className="text-xs text-fg-subtle">Rejected or returned</p><p className="text-lg font-semibold text-fg">{pct(summary?.reject_rate)}</p></div>
        </div>
      </Card>
      <Card title="Receipts and returns">
        {!loading && rows.length === 0 ? (
          <EmptyState title="No receipts or returns yet" description="Goods received against this vendor's orders, and returns sent back, appear here." />
        ) : (
          <DataTable data-testid="vendor-outcomes-table" columns={columns} rows={rows} rowKey={(r) => r.id} />
        )}
      </Card>
    </div>
  );
}
