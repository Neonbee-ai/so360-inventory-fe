import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, DataTable, EmptyState, ListPageTemplate } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { PAYEE_KIND_LABELS, PAYEE_STATUS_LABELS, PAYEE_STATUS_TONE, type PayeeKind } from '../../../utils/payeeChange';

interface Row { id: string; vendor_id: string; kind: PayeeKind; status: string; reason: string; requested_by: string; created_at: string; verified?: boolean; source: string }

const STATUS_FILTERS = [
  { value: 'open', label: 'Awaiting review' },
  { value: 'applied', label: 'Applied' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Finance queue: bank / payee / governed-field change requests (Pulse 5d23afa0). */
export default function PayeeChangeApprovalsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, any>>({ status: 'open' });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    vendorService.listPayeeChangeQueue({ status: filters.status || 'open', vendor_id: filters.vendor_id || undefined })
      .then((r: any) => { setRows(Array.isArray(r) ? r : r?.data ?? []); setError(null); })
      .catch(() => setError('Could not load change requests.'))
      .finally(() => setLoading(false));
  }, [filters.status, filters.vendor_id]);

  const columns: DataTableColumn<Row>[] = [
    { key: 'kind', header: 'Change', alwaysVisible: true, render: (r) => PAYEE_KIND_LABELS[r.kind] ?? r.kind },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={PAYEE_STATUS_TONE[r.status] ?? 'neutral'}>{PAYEE_STATUS_LABELS[r.status] ?? r.status}</Badge> },
    { key: 'verified', header: 'Verified', render: (r) => (r.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="neutral">Not yet</Badge>) },
    { key: 'source', header: 'From', render: (r) => (r.source === 'vendor_portal' ? 'Vendor portal' : 'Internal') },
    { key: 'reason', header: 'Reason', render: (r) => r.reason },
    { key: 'when', header: 'Requested', render: (r) => String(r.created_at ?? '').slice(0, 10) },
  ];

  return (
    <ListPageTemplate
      trail={[]}
      title="Finance approvals"
      description="Bank and payment-detail changes wait here until an independent Finance reviewer verifies and approves them."
      count={loading ? undefined : rows.length}
      loading={loading}
      isEmpty={!loading && !error && rows.length === 0}
      empty={<EmptyState title="Nothing waiting" description="New bank or payment-detail change requests appear here." />}
      filterConfig={{
        fields: [{ key: 'status', label: 'Status', type: 'select', options: STATUS_FILTERS }],
        values: filters,
        onChange: (v: Record<string, any>) => setFilters({ status: v.status || 'open' }),
        onClear: () => setFilters({ status: 'open' }),
      }}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && rows.length > 0 && (
        <DataTable data-testid="payee-approvals-table" columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/vendors/finance-approvals/${r.id}`)} />
      )}
    </ListPageTemplate>
  );
}
