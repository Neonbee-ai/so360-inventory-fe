import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, DataTable, Drawer, EmptyState, ListPageTemplate, Select, StatusBadge, Textarea } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { EXCEPTION_LABELS } from './outcomeLabels';

interface ExceptionRow {
  id: string;
  vendor_id: string | null;
  source_module: string;
  source_type: string;
  source_id: string;
  exception_code: string;
  status: string;
  detail: Record<string, any> | null;
  created_at: string;
  resolution_note: string | null;
}

/** Receipts and returns that could not be attributed to a vendor on their own (Pulse 91b5ff86). */
export default function VendorIntegrationExceptionsPage({ canResolve = true }: { canResolve?: boolean }) {
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [vendors, setVendors] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({ status: 'open' });
  const [active, setActive] = useState<ExceptionRow | null>(null);
  const [vendorId, setVendorId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    vendorService
      .getIntegrationExceptions<{ data: ExceptionRow[] }>({ status: filters.status, vendor_id: filters.vendor_id, source_module: filters.source_module })
      .then((r) => { setRows(r?.data ?? []); setError(null); })
      .catch(() => setError('Could not load integration exceptions.'))
      .finally(() => setLoading(false));
  }, [filters.status, filters.vendor_id, filters.source_module]);
  useEffect(load, [load]);

  useEffect(() => {
    vendorService.getVendors().then((list: any) => {
      const arr = Array.isArray(list) ? list : list?.data ?? [];
      setVendors(arr.map((v: any) => ({ value: v.id, label: v.name || v.vendor_code || v.id })));
    }).catch(() => setVendors([]));
  }, []);

  const open = (r: ExceptionRow) => { setActive(r); setVendorId(r.vendor_id ?? ''); setNote(''); setDrawerError(null); };

  const submit = async (status: 'resolved' | 'ignored') => {
    if (!active) return;
    setSaving(true);
    try {
      await vendorService.resolveIntegrationException(active.id, {
        status,
        resolution_note: note || undefined,
        vendor_id: status === 'resolved' && vendorId ? vendorId : undefined,
      });
      setActive(null);
      load();
    } catch (e: any) {
      setDrawerError(e?.message || 'Could not update this exception.');
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<ExceptionRow>[] = [
    { key: 'code', header: 'Problem', render: (r) => EXCEPTION_LABELS[r.exception_code] ?? r.exception_code },
    { key: 'source', header: 'Source', render: (r) => `${r.source_module} · ${r.source_type}` },
    { key: 'when', header: 'Raised', render: (r) => r.created_at?.slice(0, 10) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} label={r.status} /> },
    {
      key: 'action',
      header: '',
      render: (r) => (canResolve && r.status === 'open' ? <Button variant="secondary" onClick={() => open(r)}>Resolve</Button> : null),
    },
  ];

  return (
    <>
      <ListPageTemplate
        trail={[]}
        title="Vendor integration exceptions"
        description="Receipts and returns that need a vendor confirmed before they count towards performance."
        count={loading ? undefined : rows.length}
        loading={loading}
        isEmpty={!loading && !error && rows.length === 0}
        empty={<EmptyState title="Nothing to fix" description="Every receipt and return is attributed to a vendor." />}
        filterConfig={{
          fields: [
            { key: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'ignored', label: 'Ignored' }] },
            { key: 'source_module', label: 'Module', type: 'select', options: [{ value: 'inventory', label: 'Inventory' }] },
            { key: 'vendor_id', label: 'Vendor', type: 'select', options: vendors },
          ],
          values: filters,
          onChange: (v: Record<string, any>) => setFilters({ status: v.status || undefined, source_module: v.source_module || undefined, vendor_id: v.vendor_id || undefined }),
          onClear: () => setFilters({ status: 'open' }),
        }}
      >
        {error && <Alert variant="error">{error}</Alert>}
        {!loading && rows.length > 0 && (
          <DataTable data-testid="integration-exceptions-table" columns={columns} rows={rows} rowKey={(r) => r.id} />
        )}
      </ListPageTemplate>

      <Drawer
        name="resolve-exception"
        isOpen={!!active}
        onClose={() => setActive(null)}
        title="Resolve exception"
        subtitle={active ? EXCEPTION_LABELS[active.exception_code] ?? active.exception_code : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => submit('ignored')} disabled={saving}>Ignore</Button>
            <Button onClick={() => submit('resolved')} disabled={saving}>Resolve</Button>
          </>
        }
      >
        {drawerError && <Alert variant="error">{drawerError}</Alert>}
        <Select name="exception-vendor" label="Vendor this belongs to" value={vendorId} onChange={(e: any) => setVendorId(e.target.value)} options={[{ value: '', label: 'Keep as recorded' }, ...vendors]} />
        <Textarea name="exception-note" label="Note" value={note} onChange={(e: any) => setNote(e.target.value)} />
      </Drawer>
    </>
  );
}
