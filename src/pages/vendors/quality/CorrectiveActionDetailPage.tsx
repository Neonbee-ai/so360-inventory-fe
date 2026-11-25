import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, DataTable, DescriptionList, DetailPageTemplate, EmptyState, Select, TextField, Textarea,
  toast, getErrorMessage,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { vendorService } from '../../../services/vendorService';
import { SEVERITY_LABELS, VCA_NEXT, VCA_STATUS_LABELS, VCA_STATUS_TONE } from './correctiveActionLabels';

const TRAIL = [{ label: 'Corrective actions', to: '/vendors/corrective-actions' }];

/** One corrective action: containment, vendor response, evidence, review and effectiveness (Pulse aa067321). */
export default function CorrectiveActionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shell = useShellBridge();
  const [vca, setVca] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({ containment: '', root_cause: '', corrective_plan: '', note: '', effectiveness_result: '' });
  const [evidence, setEvidence] = useState({ title: '', file_url: '' });
  const canUpdate = shell?.hasPermission?.('suppliers.update') ?? false;
  const canClose = shell?.hasPermission?.('vendors.approve') ?? false;

  const load = useCallback(() => {
    vendorService.getCorrectiveAction(id)
      .then((r: any) => {
        setVca(r);
        setFields((f) => ({ ...f, containment: r.containment ?? '', root_cause: r.root_cause ?? '', corrective_plan: r.corrective_plan ?? '', effectiveness_result: r.effectiveness_result ?? '' }));
        setError(null);
      })
      .catch(() => setError('Could not load this corrective action.'));
  }, [id]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    try { await fn(); toast.success(ok); load(); } catch (e) { toast.error(getErrorMessage(e, 'That did not work.')); } finally { setSaving(false); }
  };

  if (error) return <DetailPageTemplate title="Corrective action" trail={TRAIL}><EmptyState title={error} /></DetailPageTemplate>;
  if (!vca) return <DetailPageTemplate title="Corrective action" trail={TRAIL} loading />;

  const status: string = vca.status;
  const finished = ['closed', 'rejected', 'cancelled'].includes(status);
  const textFields = { containment: fields.containment, root_cause: fields.root_cause, corrective_plan: fields.corrective_plan };
  const moves = VCA_NEXT[status] ?? [];
  const evidenceCols: DataTableColumn<any>[] = [
    { key: 'title', header: 'Evidence', render: (e) => e.title },
    { key: 'file', header: 'File', render: (e) => (e.file_url ? <a href={e.file_url} target="_blank" rel="noreferrer" className="text-primary">Open</a> : '—') },
    { key: 'at', header: 'Added', render: (e) => String(e.added_at ?? '').slice(0, 10) },
  ];

  return (
    <DetailPageTemplate
      title={vca.vca_number}
      trail={TRAIL}
      status={<Badge tone={VCA_STATUS_TONE[status] ?? 'neutral'}>{VCA_STATUS_LABELS[status] ?? status}</Badge>}
      sidePanel={
        <Card title="Details">
          <DescriptionList
            columns={1}
            items={[
              { label: 'Vendor', value: <Button variant="ghost" size="sm" onClick={() => navigate(`/vendors/${vca.vendor_id}/360`)}>Open vendor 360</Button> },
              { label: 'Severity', value: vca.severity ? SEVERITY_LABELS[vca.severity] ?? vca.severity : '—' },
              { label: 'Raised because', value: vca.trigger_reason ?? '—' },
              { label: 'Source', value: vca.source_type === 'quality_inspection' ? <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/quality`)}>Inspection</Button> : vca.source_type },
              { label: 'Due', value: vca.due_date ?? '—' },
              { label: 'Reviewed', value: vca.reviewed_at ? String(vca.reviewed_at).slice(0, 10) : '—' },
            ]}
          />
        </Card>
      }
    >
      {finished && <Alert variant="info">This corrective action is {VCA_STATUS_LABELS[status].toLowerCase()} and can no longer change.</Alert>}

      <Card title="Containment and root cause">
        <div className="flex flex-col gap-nb-3">
          <Textarea label="Containment" name="vca-containment" value={fields.containment} disabled={finished || !canUpdate} onChange={(e) => setFields({ ...fields, containment: e.target.value })} />
          <Textarea label="Root cause" name="vca-root-cause" value={fields.root_cause} disabled={finished || !canUpdate} onChange={(e) => setFields({ ...fields, root_cause: e.target.value })} />
          <Textarea label="Corrective plan" name="vca-plan" value={fields.corrective_plan} disabled={finished || !canUpdate} onChange={(e) => setFields({ ...fields, corrective_plan: e.target.value })} />
        </div>
      </Card>

      <Card title="Vendor response">
        {vca.vendor_response
          ? <DescriptionList columns={1} items={Object.entries(vca.vendor_response).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: String(v) }))} />
          : <EmptyState title="No response yet" description="The vendor answers from the partner portal once you request a response." />}
      </Card>

      <Card title="Evidence">
        {(vca.evidence ?? []).length === 0
          ? <EmptyState title="No evidence" description="Closing needs at least one item." />
          : <DataTable data-testid="vca-evidence-table" columns={evidenceCols} rows={vca.evidence} rowKey={(e: any) => e.id} />}
        {!finished && canUpdate && (
          <div className="mt-nb-3 flex flex-col gap-nb-2 md:flex-row">
            <TextField label="Title" name="ev-title" value={evidence.title} onChange={(e) => setEvidence({ ...evidence, title: e.target.value })} />
            <TextField label="File link" name="ev-url" value={evidence.file_url} onChange={(e) => setEvidence({ ...evidence, file_url: e.target.value })} />
            <Button variant="secondary" disabled={saving || !evidence.title || !evidence.file_url} onClick={() => run(async () => { await vendorService.addCorrectiveActionEvidence(id, evidence); setEvidence({ title: '', file_url: '' }); }, 'Evidence added')}>Add evidence</Button>
          </div>
        )}
      </Card>

      {status === 'effectiveness_check' && (
        <Card title="Effectiveness review">
          <Select
            label="Result"
            name="vca-effectiveness"
            placeholder="Select a result"
            value={fields.effectiveness_result}
            options={[{ value: 'effective', label: 'Effective' }, { value: 'not_effective', label: 'Not effective' }]}
            onValueChange={(v: string) => setFields({ ...fields, effectiveness_result: v })}
          />
        </Card>
      )}

      {!finished && canUpdate && (
        <div className="sticky bottom-0 flex flex-wrap gap-nb-2 border-t border-line bg-surface p-nb-3" data-testid="vca-action-bar">
          <Button variant="secondary" disabled={saving} onClick={() => run(() => vendorService.transitionCorrectiveAction(id, { to_status: status, ...textFields }), 'Saved')}>Save</Button>
          {moves.map((m) => (
            <Button key={m.to} disabled={saving} onClick={() => run(() => vendorService.transitionCorrectiveAction(id, { to_status: m.to, ...textFields, note: fields.note || undefined }), `Moved to ${VCA_STATUS_LABELS[m.to]}`)}>{m.label}</Button>
          ))}
          {status === 'effectiveness_check' && fields.effectiveness_result === 'not_effective' && (
            <Button variant="secondary" disabled={saving} onClick={() => run(() => vendorService.transitionCorrectiveAction(id, { to_status: 'containment', effectiveness_result: 'not_effective' }), 'Returned to containment')}>Return to containment</Button>
          )}
          {status === 'effectiveness_check' && canClose && (
            <Button disabled={saving || fields.effectiveness_result !== 'effective'} onClick={() => run(() => vendorService.closeCorrectiveAction(id, { effectiveness_result: 'effective', note: fields.note || undefined }), 'Corrective action closed')}>Close</Button>
          )}
          {['open', 'containment', 'awaiting_vendor'].includes(status) && (
            <Button variant="ghost" disabled={saving} onClick={() => run(() => vendorService.transitionCorrectiveAction(id, { to_status: 'cancelled', note: fields.note || undefined }), 'Cancelled')}>Cancel</Button>
          )}
        </div>
      )}
    </DetailPageTemplate>
  );
}
