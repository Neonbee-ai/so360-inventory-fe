export const VCA_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  containment: 'Containment',
  awaiting_vendor: 'Awaiting vendor',
  under_review: 'Under review',
  effectiveness_check: 'Checking effectiveness',
  closed: 'Closed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const VCA_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  open: 'warning',
  containment: 'warning',
  awaiting_vendor: 'primary',
  under_review: 'primary',
  effectiveness_check: 'primary',
  closed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

/** Next internal steps from a status (mirrors the backend machine). */
export const VCA_NEXT: Record<string, { to: string; label: string }[]> = {
  open: [{ to: 'containment', label: 'Start containment' }],
  containment: [{ to: 'awaiting_vendor', label: 'Request vendor response' }],
  awaiting_vendor: [{ to: 'under_review', label: 'Record response received' }],
  under_review: [{ to: 'effectiveness_check', label: 'Accept plan, check effectiveness' }, { to: 'awaiting_vendor', label: 'Send back to vendor' }],
  effectiveness_check: [],
};

export const SEVERITY_LABELS: Record<string, string> = { minor: 'Minor', major: 'Major', critical: 'Critical' };
