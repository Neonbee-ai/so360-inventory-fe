/** Vendor payee / bank change control (Pulse 5d23afa0): flags, permissions, labels, request shape helpers. */
export const PAYEE_CONTROL_FLAG = 'action:inventory:vendor_payee_change_control';
export const FINANCE_SUMMARY_FLAG = 'submodule:inventory:vendor_finance_summary';

export const FINANCE_PERMS = {
    APPROVE: 'vendor_finance.approve',
    VERIFY: 'vendor_finance.verify',
    READ: 'vendor_finance.read',
} as const;

export type PayeeKind =
    | 'bank_add' | 'bank_change' | 'bank_deactivate' | 'set_primary'
    | 'payment_terms' | 'currency' | 'tax_registration';

export const PAYEE_KIND_LABELS: Record<PayeeKind, string> = {
    bank_add: 'Add bank account',
    bank_change: 'Change bank account',
    bank_deactivate: 'Deactivate bank account',
    set_primary: 'Make primary account',
    payment_terms: 'Payment terms',
    currency: 'Currency',
    tax_registration: 'Tax registration',
};

export const PAYEE_STATUS_LABELS: Record<string, string> = {
    submitted: 'Awaiting review',
    verification_pending: 'Awaiting review',
    approved: 'Approved',
    applied: 'Applied',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    failed: 'Failed',
};

export const PAYEE_STATUS_TONE: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
    submitted: 'warning',
    verification_pending: 'warning',
    approved: 'success',
    applied: 'success',
    rejected: 'danger',
    cancelled: 'neutral',
    failed: 'danger',
};

export const VERIFICATION_METHOD_OPTIONS = [
    { value: 'callback', label: 'Called the vendor on a known number' },
    { value: 'document', label: 'Checked a bank document' },
    { value: 'penny_drop', label: 'Test deposit confirmed' },
];

export const SETUP_STATE_LABELS: Record<string, string> = {
    not_set_up: 'Not set up',
    pending: 'Setting up',
    active: 'Active',
    blocked: 'Blocked',
    failed: 'Failed',
};

export const SETUP_STATE_TONE: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
    not_set_up: 'neutral',
    pending: 'warning',
    active: 'success',
    blocked: 'danger',
    failed: 'danger',
};

/** Feature-flag check through the shell bridge; never throws; off when unknown (rollout flag). */
export function isPayeeControlEnabled(shell: any): boolean {
    try {
        return shell?.isFeatureEnabled?.(PAYEE_CONTROL_FLAG) === true;
    } catch {
        return false;
    }
}

/** What the reviewer sees for one field of a masked before/after. */
export const FIELD_LABELS: Record<string, string> = {
    account_holder: 'Account holder', bank_name: 'Bank', account_number_masked: 'Account number', iban_masked: 'IBAN',
    ifsc: 'IFSC', swift_code: 'SWIFT', branch: 'Branch', account_type: 'Account type', currency: 'Currency',
    payment_method: 'Payment method', upi_id: 'UPI ID', notes: 'Notes', document_url: 'Document',
    payment_terms: 'Payment terms', gst_number: 'GST number', pan_number: 'PAN',
    is_active: 'Active', is_primary: 'Primary',
};

export interface DiffRow { key: string; label: string; before: string; after: string }

const show = (v: unknown): string => (v === undefined || v === null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));

/** Masked before/after rows for the fields that change. Never shows a value the API did not already mask. */
export function diffRows(current: Record<string, any> | null | undefined, proposed: Record<string, any> | null | undefined): DiffRow[] {
    const rows: DiffRow[] = [];
    for (const key of Object.keys(proposed ?? {})) {
        if (key === 'confirm_account_number') continue;
        rows.push({ key, label: FIELD_LABELS[key] ?? key.replace(/_/g, ' '), before: show(current?.[key]), after: show(proposed![key]) });
    }
    return rows;
}

/** Bank form -> change-request body (kind + target + changes + reason + date). */
export function buildPayeeRequest(
    kind: PayeeKind,
    targetAccountId: string | null,
    changes: Record<string, unknown>,
    reason: string,
    effectiveDate: string,
) {
    return {
        kind,
        target_account_id: targetAccountId,
        changes,
        reason: reason.trim(),
        effective_date: effectiveDate || undefined,
    };
}

export function validateReason(reason: string): string | null {
    return reason.trim().length < 3 ? 'Say why this change is needed.' : null;
}

/** Requester can never verify/approve their own request; verifier cannot approve. Mirrors the server rules for button state. */
export function reviewState(req: { requested_by: string; verified?: boolean; verification?: { verified_by?: string | null } | null; status: string; kind: PayeeKind }, userId: string | null | undefined) {
    const open = req.status === 'submitted' || req.status === 'verification_pending';
    const isRequester = !!userId && userId === req.requested_by;
    const needsVerification = req.kind === 'bank_add' || req.kind === 'bank_change' || req.kind === 'bank_deactivate';
    const isVerifier = !!userId && req.verification?.verified_by === userId;
    return {
        open,
        isRequester,
        canVerify: open && !isRequester && needsVerification && !req.verified,
        canDecide: open && !isRequester && !isVerifier && (!needsVerification || !!req.verified),
        blockedReason: isRequester ? 'You raised this request, so another person must review it.'
            : isVerifier ? 'You verified this request, so another person must approve it.'
            : needsVerification && !req.verified ? 'Verify the change first (callback or document check).' : null,
    };
}
