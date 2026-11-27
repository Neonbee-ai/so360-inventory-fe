import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Checkbox, DataTable, EmptyState, getErrorMessage, Modal, TextField, toast } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorPortalAdminService } from '../../../services/vendorPortalAdminService';
import { PORTAL_ROLE_LABELS, PORTAL_ROLE_OPTIONS, PORTAL_STATUS_LABELS, PORTAL_STATUS_TONE, isValidEmail } from '../../../utils/vendorPortal';

interface Row {
  access: { id: string; portal_user_id: string; roles: string[]; status: string; next_access_review_at: string | null };
  user: { id: string; email: string; full_name: string | null; status: string; last_login_at: string | null };
}

interface Props { vendorId: string; canManage: boolean; canInvite: boolean }

/** Vendor 360 "Portal & Contacts": who from this supplier can sign in, with which roles (Pulse 0bf7c806). */
export default function VendorPortalPanel({ vendorId, canManage, canInvite }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<{ email: string; full_name: string; roles: string[] }>({ email: '', full_name: '', roles: ['rfq_responder'] });
  const [editing, setEditing] = useState<Row | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    vendorPortalAdminService.listPortalUsers<{ data: Row[] }>(vendorId)
      .then((r) => { setRows(r?.data ?? []); setError(null); })
      .catch(() => setError('Could not load portal users.'))
      .finally(() => setLoading(false));
  }, [vendorId]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setSaving(true);
    try { await fn(); toast.success(ok); after?.(); load(); } catch (e) { toast.error(getErrorMessage(e, 'That did not work.')); } finally { setSaving(false); }
  };

  const toggle = (list: string[], role: string) => (list.includes(role) ? list.filter((r) => r !== role) : [...list, role]);
  const inviteValid = isValidEmail(invite.email) && invite.roles.length > 0;

  const columns: DataTableColumn<Row>[] = [
    { key: 'name', header: 'Contact', alwaysVisible: true, render: (r) => (<div><div>{r.user.full_name || r.user.email}</div><div className="text-fg-muted text-sm">{r.user.email}</div></div>) },
    { key: 'roles', header: 'Roles', render: (r) => r.access.roles.map((x) => PORTAL_ROLE_LABELS[x] ?? x).join(', ') || '—' },
    { key: 'status', header: 'Status', render: (r) => { const s = r.access.status === 'active' ? r.user.status : r.access.status; return <Badge tone={PORTAL_STATUS_TONE[s] ?? 'neutral'}>{PORTAL_STATUS_LABELS[s] ?? s}</Badge>; } },
    { key: 'login', header: 'Last sign-in', render: (r) => (r.user.last_login_at ? String(r.user.last_login_at).slice(0, 10) : 'Never') },
    { key: 'review', header: 'Access review', render: (r) => (r.access.next_access_review_at ? String(r.access.next_access_review_at).slice(0, 10) : '—') },
    {
      key: 'actions', header: '', render: (r) => (canManage && r.access.status !== 'revoked' ? (
        <div className="flex gap-nb-1">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setEditRoles(r.access.roles); }}>Roles</Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => run(() => vendorPortalAdminService.revokeSessions(r.user.id), 'Sessions ended')}>End sessions</Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => run(() => vendorPortalAdminService.revokeAccess(r.access.id, 'removed_by_buyer'), 'Access removed')}>Remove access</Button>
        </div>
      ) : null),
    },
  ];

  return (
    <Card title="Portal & contacts" actions={canInvite ? <Button onClick={() => setInviteOpen(true)}>Invite contact</Button> : undefined}>
      <p className="text-fg-muted text-sm">People from this supplier who can sign in to the supplier portal. They see only this supplier's RFQs, purchase orders, documents and corrective actions. Changes to company, bank or qualification details always come back to you for approval.</p>
      {error && <Alert variant="error">{error}</Alert>}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="No portal users" description="Invite a contact so the supplier can respond to RFQs and acknowledge orders online." />
      ) : (
        <DataTable data-testid="portal-users-table" loading={loading} columns={columns} rows={rows} rowKey={(r) => r.access.id} />
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a supplier contact"
        footer={<Button disabled={!inviteValid || saving} onClick={() => run(() => vendorPortalAdminService.invite(vendorId, invite), 'Invitation sent', () => { setInviteOpen(false); setInvite({ email: '', full_name: '', roles: ['rfq_responder'] }); })}>Send invitation</Button>}
      >
        <div className="flex flex-col gap-nb-3">
          <TextField label="Email" name="portal_email" type="email" value={invite.email} onChange={(e: any) => setInvite({ ...invite, email: e.target.value })} />
          <TextField label="Full name" name="portal_name" value={invite.full_name} onChange={(e: any) => setInvite({ ...invite, full_name: e.target.value })} />
          <fieldset className="flex flex-col gap-nb-1">
            <legend className="text-sm text-fg-muted">Roles (least access wins)</legend>
            {PORTAL_ROLE_OPTIONS.map((o) => (
              <Checkbox key={o.value} name={`role-${o.value}`} label={o.label} checked={invite.roles.includes(o.value)} onChange={() => setInvite({ ...invite, roles: toggle(invite.roles, o.value) })} />
            ))}
          </fieldset>
          <p className="text-fg-muted text-sm">The link works once and expires. The contact must sign in with this email and complete two-step verification.</p>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Roles for ${editing?.user.full_name || editing?.user.email || ''}`}
        footer={<Button disabled={!editRoles.length || saving} onClick={() => editing && run(() => vendorPortalAdminService.updateRoles(editing.access.id, editRoles), 'Roles updated', () => setEditing(null))}>Save roles</Button>}
      >
        <fieldset className="flex flex-col gap-nb-1">
          {PORTAL_ROLE_OPTIONS.map((o) => (
            <Checkbox key={o.value} name={`role-${o.value}`} label={o.label} checked={editRoles.includes(o.value)} onChange={() => setEditRoles(toggle(editRoles, o.value))} />
          ))}
        </fieldset>
      </Modal>
    </Card>
  );
}
