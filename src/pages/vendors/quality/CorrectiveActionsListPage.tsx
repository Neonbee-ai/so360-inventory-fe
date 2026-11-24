import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, DataTable, EmptyState, ListPageTemplate, Badge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { SEVERITY_LABELS, VCA_STATUS_LABELS, VCA_STATUS_TONE } from './correctiveActionLabels';

interface Vca { id: string; vca_number: string; vendor_id: string; status: string; severity: string | null; due_date: string | null; trigger_reason: string | null }

/** All vendor corrective actions (Pulse aa067321). */
export default function CorrectiveActionsListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [rows, setRows] = useState<Vca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    vendorService.listCorrectiveActions<{ data: Vca[] }>({ status: filters.status || undefined })
      .then((r) => { setRows(r?.data ?? []); setError(null); })
      .catch(() => setError('Could not load corrective actions.'))
      .finally(() => setLoading(false));
  }, [filters.status]);

  const columns: DataTableColumn<Vca>[] = [
    { key: 'no', header: 'Number', alwaysVisible: true, render: (r) => r.vca_number },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={VCA_STATUS_TONE[r.status] ?? 'neutral'}>{VCA_STATUS_LABELS[r.status] ?? r.status}</Badge> },
    { key: 'sev', header: 'Severity', render: (r) => (r.severity ? SEVERITY_LABELS[r.severity] ?? r.severity : '—') },
    { key: 'why', header: 'Raised because', render: (r) => r.trigger_reason ?? '—' },
    { key: 'due', header: 'Due', render: (r) => r.due_date ?? '—' },
  ];

  return (
    <ListPageTemplate
      trail={[]}
      title="Corrective actions"
      description="Supplier quality problems being fixed with the vendor."
      count={loading ? undefined : rows.length}
      loading={loading}
      isEmpty={!loading && !error && rows.length === 0}
      empty={<EmptyState title="No corrective actions" description="They open when verified vendor defects are serious or repeated." />}
      filterConfig={{
        fields: [{ key: 'status', label: 'Status', type: 'select', options: Object.entries(VCA_STATUS_LABELS).map(([value, label]) => ({ value, label })) }],
        values: filters,
        onChange: (v: Record<string, any>) => setFilters({ status: v.status || '' }),
        onClear: () => setFilters({}),
      }}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && rows.length > 0 && (
        <DataTable data-testid="vca-list-table" columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/vendors/corrective-actions/${r.id}`)} />
      )}
    </ListPageTemplate>
  );
}
