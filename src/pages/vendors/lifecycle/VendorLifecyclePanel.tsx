import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, EmptyState, Modal, StatusBadge, Textarea } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { GateResult, gatesFromError, stateLabel } from './lifecycleLabels';

interface AllowedTransition { to_state: string; approval_only: boolean; gates: GateResult[] }
interface Lifecycle {
  state: string;
  risk_tier: string | null;
  next_review_at: string | null;
  history: Array<{ id: string; from_state: string | null; to_state: string; reason_code: string | null; actor_source: string; created_at: string }>;
  allowed_transitions: AllowedTransition[];
  pending_approvals: Array<{ id: string; status: string }>;
}

/** Lifecycle header + "Next action" card for Vendor 360 (Pulse 97d03c26). */
export default function VendorLifecyclePanel({ vendorId, canManage }: { vendorId: string; canManage: boolean }) {
  const [data, setData] = useState<Lifecycle | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [target, setTarget] = useState<AllowedTransition | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverGates, setServerGates] = useState<GateResult[] | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(() => {
    vendorService.getLifecycle<Lifecycle>(vendorId).then(setData).catch(() => setError(true));
  }, [vendorId]);
  useEffect(load, [load]);

  const close = () => { setTarget(null); setReason(''); setServerGates(null); setDialogError(null); };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setDialogError(null);
    try {
      await vendorService.transitionVendor(vendorId, {
        to_state: target.to_state,
        reason_code: reason.trim() ? 'OTHER' : target.to_state.toUpperCase(),
        reason_text: reason.trim() || undefined,
      });
      close();
      load();
    } catch (e: any) {
      setServerGates(gatesFromError(e));
      setDialogError(e?.body?.code === 'VENDOR_APPROVAL_REQUIRED'
        ? 'This move needs an approval decision, it cannot be set directly.'
        : e?.message || 'Could not change the state.');
    } finally {
      setBusy(false);
    }
  };

  // Flag off / not yet deployed: the panel stays out of the way.
  if (error || !data) return null;

  const gates = serverGates ?? target?.gates ?? [];
  return (
    <>
      <Card title="Lifecycle">
        <div className="flex flex-wrap items-center gap-nb-3">
          <StatusBadge status={data.state} label={stateLabel(data.state)} />
          {data.risk_tier && <span className="text-sm text-fg-muted">Risk: {data.risk_tier}</span>}
          {data.next_review_at && <span className="text-sm text-fg-muted">Next review: {data.next_review_at}</span>}
          {data.pending_approvals.length > 0 && (
            <span className="text-sm text-fg-muted">{data.pending_approvals.length} approval(s) pending</span>
          )}
        </div>
      </Card>

      <Card title="Next action">
        {data.allowed_transitions.length === 0 ? (
          <EmptyState title="No further steps" description="This vendor is in a final state." />
        ) : (
          <ul className="flex flex-col gap-nb-2">
            {data.allowed_transitions.map((t) => {
              const blocked = t.gates.filter((g) => !g.ok);
              return (
                <li key={t.to_state} className="flex items-center justify-between gap-nb-3 text-sm">
                  <span className="text-fg">{stateLabel(t.to_state)}{t.approval_only ? ' (needs approval)' : ''}</span>
                  <span className="flex items-center gap-nb-2">
                    {blocked.length > 0 && <span className="text-fg-muted">{blocked.length} gate(s) open</span>}
                    {canManage && !t.approval_only && (
                      <Button variant="secondary" onClick={() => setTarget(t)}>Move</Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="History">
        {data.history.length === 0 ? (
          <EmptyState title="No history yet" description="State changes are recorded here." />
        ) : (
          <ul className="flex flex-col gap-nb-2">
            {data.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-fg">{stateLabel(h.from_state)} → {stateLabel(h.to_state)}</span>
                <span className="text-fg-muted">{h.reason_code ?? ''} · {h.actor_source} · {h.created_at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!target}
        onClose={close}
        title={`Move to ${stateLabel(target?.to_state)}`}
        footer={<Button onClick={submit} disabled={busy}>Confirm</Button>}
      >
        {dialogError && <Alert variant="error">{dialogError}</Alert>}
        {gates.length > 0 && (
          <ul className="mb-nb-3 flex flex-col gap-nb-1 text-sm" data-testid="gate-results">
            {gates.map((g) => (
              <li key={g.gate} className={g.ok ? 'text-fg-muted' : 'text-fg'}>
                {g.ok ? 'Passed' : 'Blocked'} — {g.gate}: {g.message}
              </li>
            ))}
          </ul>
        )}
        <Textarea name="reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
