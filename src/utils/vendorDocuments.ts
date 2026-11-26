/**
 * Vendor compliance documents + activity history helpers (Pulse 3fc12200,
 * 652f492e). Pure functions so the UI stays declarative and testable.
 */

export const VENDOR_DOCUMENT_TYPES: Array<{ value: string; label: string }> = [
    { value: 'gst_certificate', label: 'GST certificate' },
    { value: 'pan_card', label: 'PAN card' },
    { value: 'incorporation_certificate', label: 'Certificate of incorporation' },
    { value: 'msme_certificate', label: 'MSME / Udyam certificate' },
    { value: 'cancelled_cheque', label: 'Cancelled cheque' },
    { value: 'bank_letter', label: 'Bank letter' },
    { value: 'trade_license', label: 'Trade licence' },
    { value: 'tax_residency_certificate', label: 'Tax residency certificate' },
    { value: 'tds_declaration', label: 'TDS declaration' },
    { value: 'contract', label: 'Contract / agreement' },
    { value: 'insurance', label: 'Insurance certificate' },
    { value: 'iso_certificate', label: 'ISO / quality certificate' },
    { value: 'other', label: 'Other' },
];

export const ACCEPTED_DOCUMENT_FILES = '.pdf,.png,.jpg,.jpeg';
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export function documentTypeLabel(type: string | null | undefined): string {
    return VENDOR_DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? (type || 'Document');
}

export type ExpiryState = 'no_expiry' | 'valid' | 'expiring_soon' | 'expired';

/** Badge tone + text for a document's expiry state. */
export function expiryBadge(state: ExpiryState | string | undefined, days: number | null | undefined) {
    switch (state) {
        case 'expired':
            return { tone: 'danger' as const, label: 'Expired' };
        case 'expiring_soon':
            return { tone: 'warning' as const, label: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}` };
        case 'valid':
            return { tone: 'success' as const, label: 'Valid' };
        default:
            return { tone: 'neutral' as const, label: 'No expiry' };
    }
}

export function verificationBadge(status: string | undefined) {
    if (status === 'verified') return { tone: 'success' as const, label: 'Verified' };
    if (status === 'rejected') return { tone: 'danger' as const, label: 'Rejected' };
    return { tone: 'warning' as const, label: 'Pending review' };
}

export interface DocumentFormState {
    document_type: string;
    document_number: string;
    issue_date: string;
    expiry_date: string;
    notes: string;
    file: File | null;
}

export const emptyDocumentForm = (): DocumentFormState => ({
    document_type: '',
    document_number: '',
    issue_date: '',
    expiry_date: '',
    notes: '',
    file: null,
});

/** Client-side checks mirroring the API, so errors show before upload. */
export function validateDocumentForm(f: DocumentFormState): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!f.document_type) errors.document_type = 'Choose the document type.';
    if (!f.file) errors.file = 'Choose a file to upload.';
    else if (f.file.size > MAX_DOCUMENT_BYTES) errors.file = 'The file is larger than 5 MB.';
    else if (!/\.(pdf|png|jpe?g)$/i.test(f.file.name)) errors.file = 'Upload a PDF, PNG or JPG file.';
    if (f.issue_date && f.expiry_date && f.expiry_date < f.issue_date) {
        errors.expiry_date = 'Expiry date cannot be before the issue date.';
    }
    return errors;
}

export function toDocumentMeta(f: DocumentFormState): Record<string, string | undefined> {
    const t = (v: string) => (v.trim() ? v.trim() : undefined);
    return {
        document_type: f.document_type,
        document_number: t(f.document_number),
        issue_date: t(f.issue_date),
        expiry_date: t(f.expiry_date),
        notes: t(f.notes),
    };
}

const ACTION_LABELS: Record<string, string> = {
    created: 'Vendor created',
    updated: 'Vendor updated',
    activated: 'Vendor activated',
    deleted: 'Vendor deleted',
    document_uploaded: 'Document added',
    document_updated: 'Document details changed',
    document_verified: 'Document verified',
    document_rejected: 'Document rejected',
    document_archived: 'Document removed',
    bank_created: 'Bank account added',
    bank_updated: 'Bank account changed',
    bank_deactivated: 'Bank account deactivated',
    bank_set_primary: 'Primary bank account changed',
    bank_verified: 'Bank account verified',
    bank_revealed: 'Bank account number viewed',
};

export function activityLabel(action: string, description?: string): string {
    return ACTION_LABELS[action] ?? (description || action || 'Activity');
}

/** "vendor_profile.credit_days" → "credit days"; at most 4 then "+N more". */
export function changedFieldsText(fields: string[] | undefined): string {
    const names = (fields ?? []).map((f) => f.replace(/^vendor_profile\./, '').replace(/_/g, ' '));
    if (names.length === 0) return '';
    if (names.length <= 4) return names.join(', ');
    return `${names.slice(0, 4).join(', ')} +${names.length - 4} more`;
}
