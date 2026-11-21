/**
 * How a vendor invoice's Accounting bill hand-off reads on the Vendor profile
 * (Pulse a4e95994). The state comes from inventory-be
 * `vendor_invoices.metadata.accounting`.
 */
export interface AccountingSyncState {
    sync_status: 'synced' | 'needs_accounting_details' | 'failed';
    bill_id: string | null;
    bill_number: string | null;
    bill_status: string | null;
    needs_accounting_details?: string[];
    error?: string | null;
}

const DETAIL_LABELS: Record<string, string> = {
    tax_code: 'GST / tax code',
    expense_account: 'expense account',
};

export const accountingStateOf = (invoice: any): AccountingSyncState | null =>
    invoice?.metadata?.accounting ?? invoice?.accounting ?? null;

/** Short status for the invoices table. */
export function accountingLabel(state: AccountingSyncState | null): string {
    if (!state) return 'Not in Accounting';
    if (state.sync_status === 'failed') return 'Sync failed';
    if (state.sync_status === 'needs_accounting_details') return 'Bill draft — needs details';
    if (state.bill_status === 'approved' || state.bill_status === 'paid' || state.bill_status === 'partially_paid') return 'Bill posted';
    return 'Bill pending approval';
}

/** The sentence shown right after an invoice is created. */
export function accountingNotice(state: AccountingSyncState | null): { variant: 'success' | 'warning' | 'error'; message: string } {
    if (!state || state.sync_status === 'failed') {
        return {
            variant: 'error',
            message: `The invoice was saved, but Accounting could not create its bill${state?.error ? `: ${state.error}` : ''}. Retry from the invoice before paying it.`,
        };
    }
    const ref = state.bill_number ? `Bill ${state.bill_number}` : 'The bill';
    if (state.sync_status === 'needs_accounting_details') {
        const missing = (state.needs_accounting_details ?? []).map((m) => DETAIL_LABELS[m] ?? m);
        return {
            variant: 'warning',
            message: `${ref} was saved as a draft in Accounting → Bills. Before approval an accountant needs to add: ${missing.join(', ')}.`,
        };
    }
    return {
        variant: 'success',
        message: `${ref} is in Accounting → Bills, pending approval. Its journal entry posts when the bill is approved.`,
    };
}
