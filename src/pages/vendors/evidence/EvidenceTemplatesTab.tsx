import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DataTable, Drawer, EmptyState, Select, StatusBadge, TextField } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { CONFIDENTIALITY_LABELS, typeLabel } from './evidenceLabels';

interface Template {
  id: string; code: string; name: string; document_type: string; country: string | null; vendor_type: string | null;
  risk_tier: string | null; global_mandatory: boolean; mandatory: boolean; confidentiality: string; status: string; version: number;
  warn_horizons_days: number[];
}
const EMPTY = { code: '', name: '', document_type: '', country: '', risk_tier: '', global: 'no', confidentiality: 'internal', horizons: '60,30,7' };

/** Which evidence a vendor must hold, by country / type / risk (Pulse f777120a). */
export default function EvidenceTemplatesTab({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    vendorService.listEvidenceTemplates<{ data: Template[] }>()
      .then((r) => { setRows(r?.data ?? []); setError(null); })
      .catch(() => setError('Could not load evidence templates.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); load(); } catch (e: any) { setError(e?.message || 'That did not work.'); }
  };

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setFormError(null); };
  const openEdit = (t: Template) => {
    if (t.status !== 'draft') return;
    setEditing(t);
    setForm({ code: t.code, name: t.name, document_type: t.document_type, country: t.country ?? '', risk_tier: t.risk_tier ?? '', global: t.global_mandatory ? 'yes' : 'no', confidentiality: t.confidentiality, horizons: (t.warn_horizons_days ?? []).join(',') });
    setFormError(null);
  };
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    const horizons = form.horizons.split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0);
    const dto = {
      name: form.name, document_type: form.document_type, country: form.country || null, risk_tier: form.risk_tier || null,
      global_mandatory: form.global === 'yes', confidentiality: form.confidentiality, warn_horizons_days: horizons,
    };
    setBusy(true);
    try {
      if (editing) await vendorService.updateEvidenceTemplate(editing.id, dto);
      else await vendorService.createEvidenceTemplate({ ...dto, code: form.code });
      setForm(null);
      load();
    } catch (e: any) {
      setFormError(e?.message || 'Could not save the template.');
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<Template>[] = [
    { key: 'name', header: 'Template', render: (t) => `${t.name} (${t.code})` },
    { key: 'doc', header: 'Document', render: (t) => typeLabel(t.document_type) },
    { key: 'applies', header: 'Applies to', render: (t) => [t.country, t.vendor_type, t.risk_tier].filter(Boolean).join(' · ') || 'Everyone' },
    { key: 'req', header: 'Required', render: (t) => (t.global_mandatory ? 'For every scope' : 'Where its category is bought') },
    { key: 'conf', header: 'Access', render: (t) => CONFIDENTIALITY_LABELS[t.confidentiality] ?? t.confidentiality },
    { key: 'ver', header: 'Version', align: 'right', render: (t) => `v${t.version}` },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status === 'active' ? 'success' : t.status === 'draft' ? 'pending' : 'default'} label={t.status} /> },
    {
      key: 'actions',
      header: '',
      render: (t) => !canEdit ? null : (
        <div className="flex gap-nb-2">
          {t.status === 'draft' && <><Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Edit</Button><Button variant="secondary" size="sm" onClick={() => act(() => vendorService.evidenceTemplateAction(t.id, 'activate'))}>Activate</Button></>}
          {t.status === 'active' && <><Button variant="ghost" size="sm" onClick={() => act(() => vendorService.evidenceTemplateAction(t.id, 'new-version'))}>New version</Button><Button variant="ghost" size="sm" onClick={() => act(() => vendorService.evidenceTemplateAction(t.id, 'retire'))}>Retire</Button></>}
        </div>
      ),
    },
  ];

  return (
    <Card title="Evidence templates" actions={canEdit ? <Button onClick={openNew}>New template</Button> : undefined}>
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && rows.length === 0 ? (
        <EmptyState title="No templates yet" description="Templates say which documents a vendor must hold, and when to warn before they expire." />
      ) : (
        <DataTable data-testid="evidence-templates-table" loading={loading} columns={columns} rows={rows} rowKey={(t) => t.id} />
      )}
      <Drawer name="evidence-template" isOpen={!!form} onClose={() => setForm(null)} title={editing ? 'Edit template' : 'New template'}
        footer={<><Button variant="ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</Button><Button onClick={save} disabled={busy}>Save draft</Button></>}>
        {formError && <Alert variant="error">{formError}</Alert>}
        {form && (
          <div className="flex flex-col gap-nb-3">
            <TextField label="Code" name="tpl-code" value={form.code} disabled={!!editing} onChange={(e: any) => set('code', e.target.value)} />
            <TextField label="Name" name="tpl-name" value={form.name} onChange={(e: any) => set('name', e.target.value)} />
            <TextField label="Document type" name="tpl-type" value={form.document_type} onChange={(e: any) => set('document_type', e.target.value)} />
            <TextField label="Country (2 letters, blank for all)" name="tpl-country" value={form.country} onChange={(e: any) => set('country', e.target.value)} />
            <Select name="tpl-risk" label="Risk tier" value={form.risk_tier} onChange={(e: any) => set('risk_tier', e.target.value)}
              options={[{ value: '', label: 'Any' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }]} />
            <Select name="tpl-global" label="Required for every scope" value={form.global} onChange={(e: any) => set('global', e.target.value)}
              options={[{ value: 'no', label: 'No, only where its category is bought' }, { value: 'yes', label: 'Yes, blocks every scope without it' }]} />
            <Select name="tpl-conf" label="Who can open the file" value={form.confidentiality} onChange={(e: any) => set('confidentiality', e.target.value)}
              options={Object.entries(CONFIDENTIALITY_LABELS).map(([value, label]) => ({ value, label }))} />
            <TextField label="Warn this many days before expiry" name="tpl-horizons" hint="Comma separated, e.g. 60,30,7" value={form.horizons} onChange={(e: any) => set('horizons', e.target.value)} />
          </div>
        )}
      </Drawer>
    </Card>
  );
}
