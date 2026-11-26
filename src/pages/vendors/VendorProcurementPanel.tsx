import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, DataTable, EmptyState, Select, StatusBadge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorCollabService } from '../../services/vendorCollabService';

interface Ref {
  kind: 'rfq_invitation' | 'quotation' | 'purchase_order' | 'goods_receipt';
  id: string;
  number: string | null;
  status: string | null;
  at: string | null;
  path: string;
  detail: Record<string, any>;
}

export const KIND_LABELS: Record<Ref['kind'], string> = {
  rfq_invitation: 'RFQ invitation',
  quotation: 'Quotation',
  purchase_order: 'Purchase order',
  goods_receipt: 'Goods receipt',
};

const TYPE_OPTIONS = [{ value: '', label: 'All' }, ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))];

/** What the detail column says, from the source record only (response time, ack state, dates). */
export function detailText(r: Ref): string {
  const d = r.detail ?? {};
  if (r.kind === 'rfq_invitation') return d.response_hours != null ? `Responded in ${d.response_hours} h` : d.responded_at ? 'Responded' : 'No response yet';
  if (r.kind === 'purchase_order') return [d.acknowledgement_status ? `Ack: ${d.acknowledgement_status}` : null, d.promised_delivery_date ? `Promised ${d.promised_delivery_date}` : d.expected_delivery_date ? `Expected ${d.expected_delivery_date}` : null].filter(Boolean).join(' / ') || '—';
  return '—';
}

/** Vendor 360 "RFQ & PO" tab (Pulse 84fdc5b8). Procurement owns the records; rows link there, nothing is copied and no quote prices show. */
export default function VendorProcurementPanel({ vendorId, open }: { vendorId: string; open?: (path: string) => void }) {
  const [type, setType] = useState('');
  const [items, setItems] = useState<Ref[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setItems(null);
    vendorCollabService.procurementActivity(vendorId, type || undefined)
      .then((r: any) => { if (live) { setItems(r?.items ?? []); setError(null); } })
      .catch(() => { if (live) setError('Could not load the RFQ and PO references.'); });
    return () => { live = false; };
  }, [vendorId, type]);

  if (error) return <Alert variant="error">{error}</Alert>;

  const cols: DataTableColumn<Ref>[] = [
    { key: 'k', header: 'Type', render: (r) => KIND_LABELS[r.kind] },
    { key: 'n', header: 'Number', render: (r) => (
      <Button variant="ghost" size="sm" onClick={() => (open ? open(r.path) : window.location.assign(r.path))}>{r.number || r.id.slice(0, 8)}</Button>
    ) },
    { key: 's', header: 'Status', render: (r) => (r.status ? <StatusBadge status={r.status} /> : '—') },
    { key: 'd', header: 'Detail', render: (r) => detailText(r) },
    { key: 'a', header: 'Date', render: (r) => (r.at ? r.at.slice(0, 10) : '—') },
  ];

  return (
    <Card title="RFQs, purchase orders and receipts">
      <div className="mb-nb-3 max-w-xs">
        <Select label="Show" name="procurement-type" options={TYPE_OPTIONS} value={type} onChange={(e: any) => setType(e.target.value)} />
      </div>
      {items && items.length === 0
        ? <EmptyState title="No RFQs or purchase orders for this vendor yet." />
        : <DataTable columns={cols} rows={items ?? []} rowKey={(r: Ref) => `${r.kind}:${r.id}`} loading={!items} />}
    </Card>
  );
}
