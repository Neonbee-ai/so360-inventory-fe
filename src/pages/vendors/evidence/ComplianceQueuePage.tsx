import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, DataTable, EmptyState, ListPageTemplate, StatusBadge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { NOTIFICATION_LABELS, typeLabel } from './evidenceLabels';

interface Task { id: string; vendor_id: string; document_type: string; due_date: string; status: string; owner_role: string }
interface Note { id: string; vendor_id: string; kind: string; status: string; attempts: number; last_error: string | null; created_at: string }

/** Renewal work and notifications that did not go out (Pulse f777120a). */
export default function ComplianceQueuePage({ canEdit = true }: { canEdit?: boolean }) {
  const [filters, setFilters] = useState<Record<string, any>>({ view: 'renewals' });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const view = filters.view || 'renewals';

  const load = useCallback(() => {
    setLoading(true);
    const p = view === 'renewals'
      ? vendorService.listRenewalTasks<{ data: Task[] }>({ status: 'open' }).then((r) => setTasks(r?.data ?? []))
      : Promise.all([
          vendorService.listComplianceNotifications<{ data: Note[] }>('failed'),
          vendorService.listComplianceNotifications<{ data: Note[] }>('dead'),
        ]).then(([a, b]) => setNotes([...(a?.data ?? []), ...(b?.data ?? [])]));
    p.then(() => setError(null)).catch(() => setError('Could not load the compliance queue.')).finally(() => setLoading(false));
  }, [view]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); load(); } catch (e: any) { setError(e?.message || 'That did not work.'); }
  };

  const taskCols: DataTableColumn<Task>[] = [
    { key: 'doc', header: 'Document', render: (t) => typeLabel(t.document_type) },
    { key: 'due', header: 'Expires', render: (t) => t.due_date },
    { key: 'owner', header: 'Owner', render: (t) => t.owner_role.replace(/_/g, ' ') },
    { key: 'done', header: '', render: (t) => (canEdit ? <Button variant="secondary" onClick={() => act(() => vendorService.updateRenewalTask(t.id, { status: 'done' }))}>Mark done</Button> : null) },
  ];
  const noteCols: DataTableColumn<Note>[] = [
    { key: 'kind', header: 'Notice', render: (n) => NOTIFICATION_LABELS[n.kind] ?? n.kind },
    { key: 'status', header: 'Status', render: (n) => <StatusBadge status={n.status === 'dead' ? 'error' : 'warning'} label={n.status === 'dead' ? 'Gave up' : 'Will retry'} /> },
    { key: 'why', header: 'Why', render: (n) => n.last_error ?? '—' },
    { key: 'try', header: 'Attempts', align: 'right', render: (n) => n.attempts },
    { key: 'retry', header: '', render: (n) => (canEdit ? <Button variant="secondary" onClick={() => act(() => vendorService.retryComplianceNotification(n.id))}>Retry now</Button> : null) },
  ];

  const rows = view === 'renewals' ? tasks.length : notes.length;
  return (
    <ListPageTemplate
      trail={[]}
      title="Vendor compliance queue"
      description="Renewals to chase and notices that could not be delivered."
      count={loading ? undefined : rows}
      loading={loading}
      loadingColumns={(view === 'renewals' ? taskCols : noteCols).length}
      isEmpty={!loading && !error && rows === 0}
      empty={<EmptyState title="Nothing to do" description={view === 'renewals' ? 'No renewals are open.' : 'Every notice went out.'} />}
      filterConfig={{
        fields: [{ key: 'view', label: 'Show', type: 'select', options: [{ value: 'renewals', label: 'Renewals due' }, { value: 'notices', label: 'Failed notices' }] }],
        values: filters,
        onChange: (v: Record<string, any>) => setFilters({ view: v.view || 'renewals' }),
        onClear: () => setFilters({ view: 'renewals' }),
      }}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && view === 'renewals' && tasks.length > 0 && <DataTable data-testid="renewal-tasks-table" columns={taskCols} rows={tasks} rowKey={(t) => t.id} />}
      {!loading && view !== 'renewals' && notes.length > 0 && <DataTable data-testid="failed-notices-table" columns={noteCols} rows={notes} rowKey={(n) => n.id} />}
    </ListPageTemplate>
  );
}
