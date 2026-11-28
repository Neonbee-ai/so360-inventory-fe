import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, DataTable, EmptyState, ListPageTemplate, StatusBadge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../services/vendorService';
import { RISK_OPTIONS, STATE_LABELS, stateLabel } from './lifecycle/lifecycleLabels';

interface QueueRow {
  vendor_id: string;
  vendor_code: string | null;
  name: string | null;
  state: string;
  risk_tier: string | null;
  next_review_at: string | null;
  waiting_since: string | null;
}

const QUEUE_STATES = [
  'registration_submitted', 'screening', 'information_required', 'under_qualification', 'pending_approval',
  'conditionally_approved', 'under_review', 'corrective_action', 'renewal_due',
];

/** Vendors waiting for a lifecycle action (Pulse 97d03c26). */
export default function ReviewQueuePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});

  useEffect(() => {
    setLoading(true);
    vendorService
      .getReviewQueue<{ items: QueueRow[] }>({ state: filters.state, risk: filters.risk })
      .then((r) => { setRows(r?.items ?? []); setError(null); })
      .catch(() => setError('Could not load the review queue.'))
      .finally(() => setLoading(false));
  }, [filters.state, filters.risk]);

  const columns: DataTableColumn<QueueRow>[] = [
    { key: 'name', header: 'Vendor', render: (r) => r.name ?? r.vendor_code ?? r.vendor_id.slice(0, 8) },
    { key: 'state', header: 'State', render: (r) => <StatusBadge status={r.state} label={stateLabel(r.state)} /> },
    { key: 'risk', header: 'Risk', render: (r) => r.risk_tier ?? '—' },
    { key: 'waiting', header: 'Waiting since', render: (r) => r.waiting_since?.slice(0, 10) ?? '—' },
    { key: 'review', header: 'Next review', render: (r) => r.next_review_at ?? '—' },
  ];

  return (
    <ListPageTemplate
      trail={[]}
      title="Vendor review queue"
      description="Vendors waiting for screening, qualification, approval or renewal."
      count={loading ? undefined : rows.length}
      loading={loading}
      loadingColumns={columns.length}
      isEmpty={!loading && !error && rows.length === 0}
      empty={<EmptyState title="Nothing waiting" description="No vendor needs a lifecycle action right now." />}
      filters={{
        fields: [
          { key: 'state', label: 'State', type: 'select', options: QUEUE_STATES.map((s) => ({ value: s, label: STATE_LABELS[s] })) },
          { key: 'risk', label: 'Risk', type: 'select', options: RISK_OPTIONS },
        ],
        values: filters,
        onChange: (v: Record<string, any>) => setFilters({ state: v.state || undefined, risk: v.risk || undefined }),
        onClear: () => setFilters({}),
      }}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && rows.length > 0 && (
        <DataTable
          data-testid="review-queue-table"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.vendor_id}
          onRowClick={(r: QueueRow) => navigate(`/inventory/vendors/${r.vendor_id}/360`)}
        />
      )}
    </ListPageTemplate>
  );
}
