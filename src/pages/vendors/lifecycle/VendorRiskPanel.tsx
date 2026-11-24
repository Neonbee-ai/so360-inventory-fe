import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, EmptyState, Textarea, Modal } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';

interface Restriction { id: string; kind: string; scope_kind: string; mode: string; status: string; reason_code: string | null; reason_text: string | null }
interface Review { id: string; source_type: string; source_number: string | null; open_value: number | null; status: string }

/** "Risk & Due Diligence" tab: restrictions and in-flight commitment reviews (Pulse 97d03c26). */
export default function VendorRiskPanel({ vendorId, canRestrict }: { vendorId: string; canRestrict: boolean }) {
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [liftId, setLiftId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    Promise.all([vendorService.getRestrictions<Restriction[]>(vendorId), vendorService.getCommitmentReviews<Review[]>(vendorId)])
      .then(([r, c]) => { setRestrictions(Array.isArray(r) ? r : []); setReviews(Array.isArray(c) ? c : []); })
      .catch(() => setError('Could not load risk details.'));
  }, [vendorId]);
  useEffect(load, [load]);

  const lift = async () => {
    if (!liftId) return;
    try {
      await vendorService.liftRestriction(liftId, reason);
      setLiftId(null);
      setReason('');
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not lift the restriction.');
    }
  };

  const decide = async (id: string, status: string) => {
    try { await vendorService.decideCommitmentReview(id, { status }); load(); }
    catch (e: any) { setError(e?.message || 'Could not record the decision.'); }
  };

  return (
    <>
      {error && <Alert variant="error">{error}</Alert>}
      <Card title="Restrictions">
        {restrictions.length === 0 ? (
          <EmptyState title="No restrictions" description="Restrictions and suspensions applied to this vendor show here." />
        ) : (
          <ul className="flex flex-col gap-nb-2">
            {restrictions.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-fg">{r.kind} · {r.scope_kind} · {r.mode} · {r.reason_code ?? ''}</span>
                <span className="flex items-center gap-nb-2 text-fg-muted">
                  {r.status}
                  {canRestrict && r.status === 'active' && (
                    <Button variant="secondary" onClick={() => setLiftId(r.id)}>Lift</Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Commitment reviews">
        {reviews.length === 0 ? (
          <EmptyState title="Nothing in flight" description="Open orders and RFQs are listed when a vendor is suspended or restricted." />
        ) : (
          <ul className="flex flex-col gap-nb-2">
            {reviews.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-fg">{c.source_type} {c.source_number ?? ''}</span>
                <span className="flex items-center gap-nb-2 text-fg-muted">
                  {c.status}
                  {c.status === 'open' && (
                    <>
                      <Button variant="secondary" onClick={() => decide(c.id, 'continue')}>Continue</Button>
                      <Button variant="secondary" onClick={() => decide(c.id, 'hold')}>Hold</Button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={!!liftId} onClose={() => setLiftId(null)} title="Lift restriction" footer={<Button onClick={lift} disabled={!reason.trim()}>Lift</Button>}>
        <Textarea name="lift_reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
