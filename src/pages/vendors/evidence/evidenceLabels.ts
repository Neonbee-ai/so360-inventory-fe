export const REVIEW_LABELS: Record<string, string> = {
  submitted: 'Waiting for review',
  under_review: 'Under review',
  verified: 'Verified',
  rejected: 'Rejected',
  expired: 'Expired',
  superseded: 'Replaced by a newer version',
  exempt: 'Exempt',
};

export const REVIEW_BADGE: Record<string, string> = {
  submitted: 'pending', under_review: 'pending', verified: 'success', rejected: 'error', expired: 'error', superseded: 'default', exempt: 'info',
};

export const CONFIDENTIALITY_LABELS: Record<string, string> = {
  internal: 'Internal', confidential: 'Confidential', restricted: 'Restricted',
};

export const REVIEW_DECISIONS = [
  { value: 'verified', label: 'Verify' },
  { value: 'rejected', label: 'Reject (note required)' },
  { value: 'exempt', label: 'Exempt (note required)' },
  { value: 'under_review', label: 'Mark under review' },
];

export const NOTIFICATION_LABELS: Record<string, string> = {
  submission_ack: 'Submission received',
  info_requested: 'More information requested',
  rejected: 'Document rejected',
  expiry_warning: 'Expiry warning',
  expired: 'Document expired',
  renewal_overdue: 'Renewal overdue',
  approval_escalation: 'Approval escalation',
  status_restricted: 'Vendor restricted',
  status_suspended: 'Vendor suspended',
  corrective_action_reminder: 'Corrective action reminder',
};

export const typeLabel = (t: string) => t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
