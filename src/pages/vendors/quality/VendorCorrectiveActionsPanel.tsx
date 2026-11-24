import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Card, DataTable, EmptyState, Badge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { SEVERITY_LABELS, VCA_STATUS_LABELS, VCA_STATUS_TONE } from './correctiveActionLabels';

interface Vca { id: string; vca_number: string; status: string; severity: string | null; due_date: string | null; trigger_reason: string | null }

/** Corrective actions raised against one vendor (Pulse aa067321). */
export default function VendorCorrectiveActionsPanel({ vendorId }: { vendorId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Vca[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    vendorService.listCorrectiveActions<{ data: Vca[] }>({ vendor_id: vendorId })
      .then((r) => { if (alive) { setRows(r?.data ?? []); setError(null); } })
      .catch(() => { if (alive) setError('Could not load corrective actions.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [vendorId]);

  const columns: DataTableColumn<Vca>[] = [
    { key: 'no', header: 'Number', render: (r) => r.vca_number },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={VCA_STATUS_TONE[r.status] ?? 'neutral'}>{VCA_STATUS_LABELS[r.status] ?? r.status}</Badge> },
    { key: 'sev', header: 'Severity', render: (r) => (r.severity ? SEVERITY_LABELS[r.severity] ?? r.severity : '—') },
    { key: 'why', header: 'Raised because', render: (r) => r.trigger_reason ?? '—' },
    { key: 'due', header: 'Due', render: (r) => r.due_date ?? '—' },
  ];

  return (
    <Card title="Corrective actions">
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="No corrective actions" description="Serious or repeated verified defects open one automatically." />
      ) : (
        <DataTable data-testid="vendor-vca-table" columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/vendors/corrective-actions/${r.id}`)} />
      )}
    </Card>
  );
}
