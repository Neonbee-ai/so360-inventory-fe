import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DataTable, EmptyState, FormField, Modal, Select, StatusBadge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { RISK_OPTIONS } from './lifecycleLabels';

interface Condition { id: string; description: string; status: string; due_date: string | null; enforcement: string }
interface Qualification {
  id: string;
  category_id: string | null;
  service_code: string | null;
  trade: string | null;
  territories: string[] | null;
  risk_tier: string | null;
  status: string;
  valid_to: string | null;
  version: number;
  is_legacy: boolean;
  vendor_qualification_conditions?: Condition[];
}

const scopeText = (q: Qualification) =>
  q.is_legacy
    ? 'All categories (legacy)'
    : [q.service_code, q.trade, q.category_id ? 'Category' : null, q.territories?.join(', ')].filter(Boolean).join(' · ') || 'All scope';

/** "Categories & Capabilities" tab: scoped qualifications with conditions (Pulse 97d03c26). */
export default function VendorQualificationsPanel({ vendorId, canEdit }: { vendorId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ service_code: '', trade: '', territory: '', risk_tier: 'low', valid_to: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    vendorService
      .getQualifications<Qualification[]>(vendorId)
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch(() => setError('Could not load qualifications.'))
      .finally(() => setLoading(false));
  }, [vendorId]);
  useEffect(load, [load]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const q: any = await vendorService.createQualification(vendorId, {
        service_code: form.service_code || undefined,
        trade: form.trade || undefined,
        territories: form.territory ? [form.territory.trim()] : undefined,
        risk_tier: form.risk_tier,
        valid_to: form.valid_to || undefined,
      });
      await vendorService.submitQualification(q.id);
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not save the qualification.');
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<Qualification>[] = [
    { key: 'scope', header: 'Scope', render: (q) => scopeText(q) },
    { key: 'status', header: 'Status', render: (q) => <StatusBadge status={q.status} /> },
    { key: 'risk', header: 'Risk', render: (q) => q.risk_tier ?? '—' },
    { key: 'valid_to', header: 'Valid to', render: (q) => q.valid_to ?? '—' },
    {
      key: 'conditions',
      header: 'Conditions',
      render: (q) => {
        const open = (q.vendor_qualification_conditions ?? []).filter((c) => c.status === 'open');
        return open.length === 0 ? '—' : open.map((c) => c.description).join('; ');
      },
    },
  ];

  return (
    <Card
      title="Qualifications"
      actions={canEdit ? <Button onClick={() => setOpen(true)}>Add qualification</Button> : undefined}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && rows.length === 0 ? (
        <EmptyState title="No qualifications" description="A vendor can only be selected for scopes it is qualified for." />
      ) : (
        <DataTable data-testid="qualifications-table" columns={columns} rows={rows} rowKey={(q) => q.id} />
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add qualification"
        footer={<Button onClick={create} disabled={saving}>Submit for approval</Button>}
      >
        <div className="flex flex-col gap-nb-3">
          <FormField label="Service code" name="service_code" value={form.service_code} onChange={(e: any) => setForm({ ...form, service_code: e.target.value })} />
          <FormField label="Trade" name="trade" value={form.trade} onChange={(e: any) => setForm({ ...form, trade: e.target.value })} />
          <FormField label="Territory (e.g. IN-KL)" name="territory" value={form.territory} onChange={(e: any) => setForm({ ...form, territory: e.target.value })} />
          <Select label="Risk tier" name="risk_tier" options={RISK_OPTIONS} value={form.risk_tier} onChange={(e) => setForm({ ...form, risk_tier: e.target.value })} />
          <FormField label="Valid to" name="valid_to" type="date" value={form.valid_to} onChange={(e: any) => setForm({ ...form, valid_to: e.target.value })} />
        </div>
      </Modal>
    </Card>
  );
}
