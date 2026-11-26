import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DataTable, EmptyState, Modal, Select, StatusBadge, TextField } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { RISK_OPTIONS } from './lifecycleLabels';

interface Capability {
  process_family?: string[]; material_grade?: string[]; brand?: string[]; certification?: string[];
  tolerance_mm?: number; max_dimension_mm?: number; lead_time_days?: number;
}
interface Condition { id: string; description: string; status: string; due_date: string | null; enforcement: string }
interface Qualification {
  id: string;
  category_id: string | null;
  service_code: string | null;
  trade: string | null;
  territories: string[] | null;
  risk_tier: string | null;
  capability?: Capability | null;
  status: string;
  valid_to: string | null;
  version: number;
  is_legacy: boolean;
  vendor_qualification_conditions?: Condition[];
}

const PROCESS_OPTIONS = [
  { value: '', label: 'Any process' },
  ...['cnc', 'joinery', 'welding', 'metal_fabrication', 'stone_work', 'casting', 'painting', 'assembly', 'other'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
];

const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

/** The capability object the API stores; undefined when nothing was filled in. */
export function buildCapability(f: { process: string; grades: string; brands: string; certs: string; tolerance: string; maxDim: string; leadTime: string }): Capability | undefined {
  const c: Capability = {};
  if (f.process) c.process_family = [f.process];
  if (list(f.grades).length) c.material_grade = list(f.grades);
  if (list(f.brands).length) c.brand = list(f.brands);
  if (list(f.certs).length) c.certification = list(f.certs);
  if (num(f.tolerance) !== undefined) c.tolerance_mm = num(f.tolerance);
  if (num(f.maxDim) !== undefined) c.max_dimension_mm = num(f.maxDim);
  if (num(f.leadTime) !== undefined) c.lead_time_days = num(f.leadTime);
  return Object.keys(c).length ? c : undefined;
}

const capabilityText = (c?: Capability | null) =>
  !c ? '—' : [
    c.process_family?.join(', '), c.material_grade?.join(', '), c.brand?.join(', '),
    c.tolerance_mm !== undefined ? `tolerance ${c.tolerance_mm} mm` : null,
    c.max_dimension_mm !== undefined ? `up to ${c.max_dimension_mm} mm` : null,
    c.lead_time_days !== undefined ? `${c.lead_time_days} day lead time` : null,
  ].filter(Boolean).join(' · ') || '—';

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
  const [form, setForm] = useState({ service_code: '', trade: '', territory: '', risk_tier: 'low', valid_to: '', process: '', grades: '', brands: '', certs: '', tolerance: '', maxDim: '', leadTime: '' });
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
        capability: buildCapability(form),
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
    { key: 'capability', header: 'Capability', render: (q) => capabilityText(q.capability) },
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
          <TextField label="Service code" name="service_code" value={form.service_code} onChange={(e: any) => setForm({ ...form, service_code: e.target.value })} />
          <TextField label="Trade" name="trade" value={form.trade} onChange={(e: any) => setForm({ ...form, trade: e.target.value })} />
          <TextField label="Territory (e.g. IN-KL)" name="territory" value={form.territory} onChange={(e: any) => setForm({ ...form, territory: e.target.value })} />
          <Select label="Process" name="process" options={PROCESS_OPTIONS} value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} />
          <TextField label="Material grades (comma separated)" name="grades" value={form.grades} onChange={(e: any) => setForm({ ...form, grades: e.target.value })} />
          <TextField label="Brands (comma separated)" name="brands" value={form.brands} onChange={(e: any) => setForm({ ...form, brands: e.target.value })} />
          <TextField label="Certifications held (document types, comma separated)" name="certs" value={form.certs} onChange={(e: any) => setForm({ ...form, certs: e.target.value })} />
          <TextField label="Tightest tolerance held (mm)" name="tolerance" type="number" value={form.tolerance} onChange={(e: any) => setForm({ ...form, tolerance: e.target.value })} />
          <TextField label="Largest part (mm)" name="maxDim" type="number" value={form.maxDim} onChange={(e: any) => setForm({ ...form, maxDim: e.target.value })} />
          <TextField label="Usual lead time (days)" name="leadTime" type="number" value={form.leadTime} onChange={(e: any) => setForm({ ...form, leadTime: e.target.value })} />
          <Select label="Risk tier" name="risk_tier" options={RISK_OPTIONS} value={form.risk_tier} onChange={(e) => setForm({ ...form, risk_tier: e.target.value })} />
          <TextField label="Valid to" name="valid_to" type="date" value={form.valid_to} onChange={(e: any) => setForm({ ...form, valid_to: e.target.value })} />
        </div>
      </Modal>
    </Card>
  );
}
