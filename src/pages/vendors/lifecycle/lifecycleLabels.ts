/** Display labels for vendor lifecycle states and risk tiers (Pulse 97d03c26). */
export const STATE_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  registration_submitted: 'Registration submitted',
  screening: 'Screening',
  information_required: 'Information required',
  under_qualification: 'Under qualification',
  pending_approval: 'Pending approval',
  conditionally_approved: 'Conditionally approved',
  approved_active: 'Approved',
  under_review: 'Under review',
  corrective_action: 'Corrective action',
  restricted: 'Restricted',
  suspended: 'Suspended',
  renewal_due: 'Renewal due',
  rejected: 'Rejected',
  offboarded: 'Offboarded',
};

export const RISK_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const stateLabel = (s?: string | null) => (s ? STATE_LABELS[s] ?? s : '—');

export interface GateResult { gate: string; ok: boolean; message: string }

/** Pulls the server's gate list out of a 422 so the dialog can show it verbatim. */
export function gatesFromError(e: any): GateResult[] | null {
  const body = e?.body;
  const gates = body?.gates ?? body?.message?.gates;
  return Array.isArray(gates) ? gates : null;
}
