import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, DataTable, EmptyState, ListPageTemplate } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorPortalAdminService } from '../../../services/vendorPortalAdminService';
import { CHANGE_KIND_LABELS, CHANGE_STATUS_LABELS, CHANGE_STATUS_TONE } from '../../../utils/vendorPortal';

interface Row { id: string; vendor_id: string; kind: string; status: string; reason: string | null; created_at: string; fields: Record<string, unknown> }

const STATUS_FILTERS = [
  { value: 'submitted', label: 'Awaiting review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'forwarded', label: 'Sent to qualification' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Queue of governed profile changes proposed from the supplier portal (Pulse 0bf7c806). */
export default function ProfileChangeRequestsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, any>>({ status: 'submitted' });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    vendorPortalAdminService.listChangeRequests<{ data: Row[] }>({ status: filters.status || 'submitted' })
      .then((r) => { setRows(r?.data ?? []); setError(null); })
      .catch(() => setError('Could not load change requests.'))
      .finally(() => setLoading(false));
  }, [filters.status]);

  const columns: DataTableColumn<Row>[] = [
    { key: 'kind', header: 'Change', alwaysVisible: true, render: (r) => CHANGE_KIND_LABELS[r.kind] ?? r.kind },
    { key: 'fields', header: 'Fields', render: (r) => Object.keys(r.fields ?? {}).map((f) => f.replace(/_/g, ' ')).join(', ') },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={CHANGE_STATUS_TONE[r.status] ?? 'neutral'}>{CHANGE_STATUS_LABELS[r.status] ?? r.status}</Badge> },
    { key: 'reason', header: 'Reason', render: (r) => r.reason ?? '—' },
    { key: 'when', header: 'Requested', render: (r) => String(r.created_at ?? '').slice(0, 10) },
  ];

  return (
    <ListPageTemplate
      trail={[]}
      title="Supplier change requests"
      description="Company, contact and address changes proposed by suppliers wait here until someone other than the requester approves them."
      count={loading ? undefined : rows.length}
      loading={loading}
      loadingColumns={columns.length}
      isEmpty={!loading && !error && rows.length === 0}
      empty={<EmptyState title="Nothing waiting" description="Changes proposed from the supplier portal appear here." />}
      filterConfig={{
        fields: [{ key: 'status', label: 'Status', type: 'select', options: STATUS_FILTERS }],
        values: filters,
        onChange: (v: Record<string, any>) => setFilters({ status: v.status || 'submitted' }),
        onClear: () => setFilters({ status: 'submitted' }),
      }}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && rows.length > 0 && (
        <DataTable data-testid="change-requests-table" columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/vendors/change-requests/${r.id}`)} />
      )}
    </ListPageTemplate>
  );
}
