import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, DataTable, DescriptionList, DetailPageTemplate, EmptyState, Select, Textarea,
  toast, getErrorMessage,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { vendorService } from '../../../services/vendorService';
import { useAuth } from '../../../hooks/useAuth';
import {
  FINANCE_PERMS, PAYEE_KIND_LABELS, PAYEE_STATUS_LABELS, PAYEE_STATUS_TONE, VERIFICATION_METHOD_OPTIONS,
  diffRows, reviewState, type DiffRow,
} from '../../../utils/payeeChange';

const TRAIL = [{ label: 'Finance approvals', to: '/vendors/finance-approvals' }];

/** One payee change request: masked before/after, verification step, approve / reject (Pulse 5d23afa0). */
export default function PayeeChangeDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shell = useShellBridge();
  const { user, can } = useAuth() as any;
  const [req, setReq] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState('callback');
  const [verifyNote, setVerifyNote] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const canVerifyPerm = can(FINANCE_PERMS.VERIFY) || (shell?.hasPermission?.(FINANCE_PERMS.VERIFY) ?? false);
  const canApprovePerm = can(FINANCE_PERMS.APPROVE) || (shell?.hasPermission?.(FINANCE_PERMS.APPROVE) ?? false);

  const load = useCallback(() => {
    vendorService.getPayeeChange(id)
      .then((r: any) => { setReq(r); setError(null); })
      .catch(() => setError('Could not load this change request.'));
  }, [id]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    try { await fn(); toast.success(ok); load(); } catch (e) { toast.error(getErrorMessage(e, 'That did not work.')); } finally { setSaving(false); }
  };

  if (error) return <DetailPageTemplate title="Change request" trail={TRAIL}><EmptyState title={error} /></DetailPageTemplate>;
  if (!req) return <DetailPageTemplate title="Change request" trail={TRAIL} loading />;

  const state = reviewState(req, user?.id);
  const diff = diffRows(req.current_masked, req.proposed_masked);
  const diffCols: DataTableColumn<DiffRow>[] = [
    { key: 'f', header: 'Field', render: (r) => r.label },
    { key: 'b', header: 'Now', render: (r) => r.before },
    { key: 'a', header: 'Requested', render: (r) => r.after },
  ];
  const v = req.verification;

  return (
    <DetailPageTemplate
      title={PAYEE_KIND_LABELS[req.kind as keyof typeof PAYEE_KIND_LABELS] ?? 'Change request'}
      trail={TRAIL}
      status={<Badge tone={PAYEE_STATUS_TONE[req.status] ?? 'neutral'}>{PAYEE_STATUS_LABELS[req.status] ?? req.status}</Badge>}
      sidePanel={
        <Card title="Details">
          <DescriptionList
            columns={1}
            items={[
              { label: 'Vendor', value: <Button variant="ghost" size="sm" onClick={() => navigate(`/vendors/${req.vendor_id}/360`)}>Open vendor 360</Button> },
              { label: 'From', value: req.source === 'vendor_portal' ? 'Vendor portal' : 'Internal user' },
              { label: 'Requested', value: String(req.created_at ?? '').slice(0, 10) },
              { label: 'Effective from', value: req.effective_date ?? 'On approval' },
              { label: 'Reason', value: req.reason },
              { label: 'Decision', value: req.decided_at ? String(req.decided_at).slice(0, 10) : '—' },
            ]}
          />
        </Card>
      }
    >
      {req.status === 'rejected' && <Alert variant="warning">Rejected{req.decision_note ? `: ${req.decision_note}` : '.'} The vendor record was not changed.</Alert>}
      {req.apply_error && state.open && <Alert variant="error">The last approval attempt failed: {req.apply_error}</Alert>}
      {state.blockedReason && state.open && <Alert variant="info" data-testid="payee-blocked">{state.blockedReason}</Alert>}

      <Card title="What changes">
        {diff.length === 0
          ? <EmptyState title="No field values" description="This request changes the status of the account only." />
          : <DataTable data-testid="payee-diff-table" columns={diffCols} rows={diff} rowKey={(r) => r.key} />}
        <p className="mt-nb-2 text-nb-sm text-fg-muted">Account numbers are masked here. The full number is never shown on this page.</p>
      </Card>

      <Card title="Verification">
        {v?.verified_by ? (
          <DescriptionList columns={1} items={[
            { label: 'Method', value: VERIFICATION_METHOD_OPTIONS.find((o) => o.value === v.method)?.label ?? v.method },
            { label: 'Note', value: v.note ?? '—' },
            { label: 'Verified by', value: `User ${String(v.verified_by).slice(0, 8)}` },
            { label: 'When', value: String(v.at ?? '').slice(0, 16).replace('T', ' ') },
          ]} />
        ) : state.open ? (
          <div className="flex flex-col gap-nb-3">
            <p className="text-nb-sm text-fg-muted">Confirm the new details through a channel you already trust, not the one the request came from.</p>
            <Select label="How was it checked?" name="payee-verify-method" value={method} options={VERIFICATION_METHOD_OPTIONS} onValueChange={(x: string) => setMethod(x)} />
            <Textarea label="Who you spoke to or which document you checked" name="payee-verify-note" value={verifyNote} onChange={(e) => setVerifyNote(e.target.value)} />
            <div>
              <Button disabled={saving || !canVerifyPerm || !state.canVerify || (method !== 'penny_drop' && !verifyNote.trim())}
                data-testid="payee-verify" onClick={() => run(() => vendorService.verifyPayeeChange(id, { method, note: verifyNote }), 'Verification recorded')}>
                Record verification
              </Button>
            </div>
          </div>
        ) : <EmptyState title="Not verified" />}
      </Card>

      {state.open && (
        <div className="sticky bottom-0 flex flex-col gap-nb-2 border-t border-line bg-surface p-nb-3" data-testid="payee-action-bar">
          <Textarea label="Decision note (required to reject)" name="payee-decision-note" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
          <div className="flex flex-wrap gap-nb-2">
            <Button disabled={saving || !canApprovePerm || !state.canDecide} data-testid="payee-approve"
              onClick={() => run(() => vendorService.decidePayeeChange(id, { decision: 'approve', note: decisionNote || undefined }), 'Change approved and applied')}>Approve</Button>
            <Button variant="danger" disabled={saving || !canApprovePerm || state.isRequester || !decisionNote.trim()} data-testid="payee-reject"
              onClick={() => run(() => vendorService.decidePayeeChange(id, { decision: 'reject', note: decisionNote }), 'Change rejected')}>Reject</Button>
          </div>
        </div>
      )}
    </DetailPageTemplate>
  );
}
