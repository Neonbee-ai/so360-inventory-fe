import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, DataTable, DescriptionList, DetailPageTemplate, EmptyState, Textarea, toast, getErrorMessage } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorPortalAdminService } from '../../../services/vendorPortalAdminService';
import { useAuth } from '../../../hooks/useAuth';
import { CHANGE_KIND_LABELS, CHANGE_STATUS_LABELS, CHANGE_STATUS_TONE, changeDecisionState, changeDiffRows, type ChangeDiffRow } from '../../../utils/vendorPortal';

const TRAIL = [{ label: 'Supplier change requests', to: '/vendors/change-requests' }];

/** One supplier change request: old vs requested values, approve / reject (never the requester) (Pulse 0bf7c806). */
export default function ProfileChangeRequestDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth() as any;
  const [req, setReq] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    vendorPortalAdminService.getChangeRequest(id).then((r) => { setReq(r); setError(null); }).catch(() => setError('Could not load this change request.'));
  }, [id]);
  useEffect(load, [load]);

  const decide = async (decision: 'approve' | 'reject') => {
    setSaving(true);
    try {
      await vendorPortalAdminService.decideChangeRequest(id, decision, note || undefined);
      toast.success(decision === 'approve' ? 'Change approved and applied' : 'Change rejected');
      load();
    } catch (e) { toast.error(getErrorMessage(e, 'That did not work.')); } finally { setSaving(false); }
  };

  if (error) return <DetailPageTemplate title="Change request" trail={TRAIL}><EmptyState title={error} /></DetailPageTemplate>;
  if (!req) return <DetailPageTemplate title="Change request" trail={TRAIL} loading />;

  const state = changeDecisionState(req, user?.id);
  const cols: DataTableColumn<ChangeDiffRow>[] = [
    { key: 'f', header: 'Field', render: (r) => r.field },
    { key: 'b', header: 'Now', render: (r) => r.before },
    { key: 'a', header: 'Requested', render: (r) => r.after },
  ];

  return (
    <DetailPageTemplate
      title={CHANGE_KIND_LABELS[req.kind] ?? 'Change request'}
      trail={TRAIL}
      status={<Badge tone={CHANGE_STATUS_TONE[req.status] ?? 'neutral'}>{CHANGE_STATUS_LABELS[req.status] ?? req.status}</Badge>}
      sidePanel={
        <Card title="Details">
          <DescriptionList
            columns={1}
            items={[
              { label: 'Vendor', value: <Button variant="ghost" size="sm" onClick={() => navigate(`/vendors/${req.vendor_id}/360`)}>Open vendor 360</Button> },
              { label: 'From', value: req.requested_by_kind === 'portal_user' ? 'Supplier portal' : 'Internal user' },
              { label: 'Requested', value: String(req.created_at ?? '').slice(0, 10) },
              { label: 'Reason', value: req.reason ?? '—' },
              { label: 'Decision', value: req.decided_at ? String(req.decided_at).slice(0, 10) : '—' },
            ]}
          />
        </Card>
      }
    >
      {req.status === 'rejected' && <Alert variant="warning">Rejected{req.decision_note ? `: ${req.decision_note}` : '.'} The vendor record was not changed.</Alert>}
      {req.apply_error && state.open && <Alert variant="error">The last attempt failed: {req.apply_error}</Alert>}
      {state.reason && <Alert variant="info" data-testid="change-blocked">{state.reason}</Alert>}
      <Card title="What changes">
        <DataTable data-testid="change-diff" columns={cols} rows={changeDiffRows(req.fields)} rowKey={(r) => r.field} />
      </Card>
      {state.open && (
        <Card title="Decision">
          <Textarea label="Note (optional)" name="decision_note" value={note} onChange={(e: any) => setNote(e.target.value)} />
          <div className="flex gap-nb-2">
            <Button disabled={!state.canDecide || saving} onClick={() => decide('approve')}>Approve and apply</Button>
            <Button variant="secondary" disabled={!state.canDecide || saving} onClick={() => decide('reject')}>Reject</Button>
          </div>
        </Card>
      )}
    </DetailPageTemplate>
  );
}
