import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DataTable, EmptyState } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';

interface ConsumerRow { consumer: string; last_seq: number | null; lag: number | null; failed: number; dead: number }

/** Consumer lag and failed/dead vendor events, with replay (Pulse 66b329c3). */
export default function IntegrationHealthTab({ canReplay }: { canReplay: boolean }) {
  const [rows, setRows] = useState<ConsumerRow[]>([]);
  const [parked, setParked] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    vendorService.getIntegrationHealth<{ consumers: ConsumerRow[]; parked_outbox: number }>()
      .then((h) => { setRows(h.consumers ?? []); setParked(h.parked_outbox ?? 0); setError(null); })
      .catch(() => setError('Could not load integration health.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const replay = async (consumer: string) => {
    try { await vendorService.replayIntegration({ consumer, status: 'dead' }); load(); }
    catch (e: any) { setError(e?.message || 'Replay failed.'); }
  };

  const columns: DataTableColumn<ConsumerRow>[] = [
    { key: 'consumer', header: 'Consumer' },
    { key: 'lag', header: 'Lag (events)', align: 'right', render: (r) => (r.lag ?? '—') },
    { key: 'failed', header: 'Failed', align: 'right' },
    { key: 'dead', header: 'Dead', align: 'right' },
    {
      key: 'replay',
      header: '',
      render: (r) => (canReplay && r.dead > 0 ? <Button variant="secondary" onClick={() => replay(r.consumer)}>Replay dead</Button> : null),
    },
  ];

  return (
    <Card title="Integration health">
      {error && <Alert variant="error">{error}</Alert>}
      {parked > 0 && <Alert variant="warning">{parked} vendor event(s) are parked in the outbox.</Alert>}
      {!loading && rows.length === 0 ? (
        <EmptyState title="No consumers yet" description="Modules that listen to vendor events appear here once they start." />
      ) : (
        <DataTable data-testid="integration-health-table" columns={columns} rows={rows} rowKey={(r) => r.consumer} />
      )}
    </Card>
  );
}
