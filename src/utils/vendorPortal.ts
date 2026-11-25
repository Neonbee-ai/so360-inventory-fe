/** Vendor portal admin (Pulse 0bf7c806): flags, permission, labels and diff helpers. */
export const PORTAL_FLAG = 'submodule:inventory:vendor_portal';
export const PORTAL_INVITE_FLAG = 'action:inventory:vendor_portal_invite';
export const PORTAL_PERMISSION = 'vendors.portal.manage';
export const CHANGE_APPROVE_PERMISSION = 'vendors.approve';

export const PORTAL_ROLE_OPTIONS = [
    { value: 'vendor_admin', label: 'Vendor administrator' },
    { value: 'document_contributor', label: 'Document contributor' },
    { value: 'rfq_responder', label: 'RFQ responder' },
    { value: 'po_viewer', label: 'PO viewer' },
    { value: 'po_acknowledger', label: 'PO acknowledger' },
    { value: 'delivery_contributor', label: 'Delivery commitment contributor' },
    { value: 'capa_responder', label: 'Corrective action responder' },
] as const;

export const PORTAL_ROLE_LABELS: Record<string, string> = Object.fromEntries(PORTAL_ROLE_OPTIONS.map((r) => [r.value, r.label]));

export const PORTAL_STATUS_LABELS: Record<string, string> = {
    invited: 'Invited',
    active: 'Active',
    read_only: 'Read only',
    suspended: 'Suspended',
    deactivated: 'Deactivated',
    revoked: 'Access removed',
};

export const PORTAL_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    invited: 'warning',
    active: 'success',
    read_only: 'warning',
    suspended: 'danger',
    deactivated: 'danger',
    revoked: 'danger',
};

export const CHANGE_KIND_LABELS: Record<string, string> = {
    profile: 'Company profile',
    contact: 'Contacts',
    location: 'Addresses',
    capability: 'Capability',
    category_application: 'Category application',
    portal_user: 'Portal user',
};

export const CHANGE_STATUS_LABELS: Record<string, string> = {
    submitted: 'Awaiting review',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    forwarded: 'Sent to qualification',
};

export const CHANGE_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    submitted: 'warning', approved: 'success', rejected: 'danger', cancelled: 'neutral', forwarded: 'neutral',
};

export interface ChangeDiffRow { field: string; before: string; after: string }

const show = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
};

/** { path: { old, new } } -> table rows. */
export function changeDiffRows(fields: Record<string, { old?: unknown; new?: unknown }> | null | undefined): ChangeDiffRow[] {
    return Object.entries(fields ?? {}).map(([field, v]) => ({ field: field.replace(/_/g, ' '), before: show(v?.old), after: show(v?.new) }));
}

/** A request can be decided here unless the viewer raised it or it is handled by qualification. */
export function changeDecisionState(req: { status: string; kind: string; requested_by?: string }, userId?: string | null) {
    const open = req.status === 'submitted';
    const elsewhere = ['capability', 'category_application', 'portal_user'].includes(req.kind);
    const own = !!userId && req.requested_by === userId;
    return {
        open,
        canDecide: open && !elsewhere && !own,
        reason: !open ? null : elsewhere ? 'This request is decided in the qualification workflow.' : own ? 'You cannot decide a request you raised.' : null,
    };
}

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
