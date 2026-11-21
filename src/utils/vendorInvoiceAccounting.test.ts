import { describe, it, expect } from 'vitest';
import { accountingLabel, accountingNotice, accountingStateOf } from './vendorInvoiceAccounting';

/** BDD: how the Accounting bill hand-off reads on the Vendor profile (Pulse a4e95994). */
const synced = { sync_status: 'synced' as const, bill_id: 'b1', bill_number: 'INV-9', bill_status: 'pending' };

describe('Given a vendor invoice', () => {
    it('When its state is on metadata or on a create response / Then it is found either way', () => {
        expect(accountingStateOf({ metadata: { accounting: synced } })).toBe(synced);
        expect(accountingStateOf({ accounting: synced })).toBe(synced);
        expect(accountingStateOf(null)).toBeNull();
    });
    it('When it has no state / Then the table says it is not in Accounting', () => {
        expect(accountingLabel(null)).toBe('Not in Accounting');
    });
    it('When pending, posted, draft or failed / Then each has its own label', () => {
        expect(accountingLabel(synced)).toBe('Bill pending approval');
        expect(accountingLabel({ ...synced, bill_status: 'approved' })).toBe('Bill posted');
        expect(accountingLabel({ ...synced, sync_status: 'needs_accounting_details' })).toBe('Bill draft — needs details');
        expect(accountingLabel({ ...synced, sync_status: 'failed' })).toBe('Sync failed');
    });
    it('When the bill was created / Then the notice names it and says the journal posts on approval', () => {
        expect(accountingNotice(synced)).toEqual({
            variant: 'success',
            message: 'Bill INV-9 is in Accounting → Bills, pending approval. Its journal entry posts when the bill is approved.',
        });
    });
    it('When the bill needs details / Then the notice lists them in plain words', () => {
        expect(accountingNotice({ ...synced, bill_number: null, sync_status: 'needs_accounting_details', needs_accounting_details: ['tax_code', 'expense_account', 'x'] })).toEqual({
            variant: 'warning',
            message: 'The bill was saved as a draft in Accounting → Bills. Before approval an accountant needs to add: GST / tax code, expense account, x.',
        });
    });
    it('When the hand-off failed or returned nothing / Then an error notice, with the reason when known', () => {
        expect(accountingNotice({ ...synced, sync_status: 'failed', error: 'down' }).message).toContain('could not create its bill: down.');
        expect(accountingNotice(null).variant).toBe('error');
    });
});
