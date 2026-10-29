import { describe, it, expect } from 'vitest';
import {
    VENDOR_BANK_FLAG, emptyBankForm, formFromAccount, isValidIban, isVendorBankEnabled,
    toBankPayload, validateBankForm, type BankFormState,
} from './vendorBank';

const domestic = (o: Partial<BankFormState> = {}): BankFormState => ({
    ...emptyBankForm('inr'),
    account_holder: 'Acme Pvt Ltd', bank_name: 'HDFC Bank',
    account_number: '123456789012', confirm_account_number: '123456789012',
    ifsc: 'HDFC0001234', ...o,
});

describe('vendorBank utils', () => {
    describe('Given an empty form', () => {
        it('When built with a currency / Then it is uppercased and defaults are current + bank_transfer', () => {
            const f = emptyBankForm('aed');
            expect(f).toMatchObject({ currency: 'AED', account_type: 'current', payment_method: 'bank_transfer', is_primary: false });
        });
        it('When built without a currency / Then currency is blank', () => {
            expect(emptyBankForm().currency).toBe('');
        });
    });

    describe('Given a valid domestic account', () => {
        it('When validated / Then there are no errors', () => {
            expect(validateBankForm(domestic())).toEqual({});
        });
        it('When converted to a payload / Then codes are uppercased and blank optionals dropped', () => {
            const p = toBankPayload(domestic({ ifsc: 'hdfc0001234', is_primary: true }));
            expect(p).toMatchObject({ ifsc: 'HDFC0001234', currency: 'INR', account_number: '123456789012', is_primary: true });
            expect(p).not.toHaveProperty('iban');
            expect(p).not.toHaveProperty('branch');
        });
    });

    describe('Given invalid input', () => {
        it('When holder and bank are blank / Then both are required', () => {
            const e = validateBankForm(domestic({ account_holder: ' ', bank_name: '' }));
            expect(e.account_holder).toBeTruthy();
            expect(e.bank_name).toBeTruthy();
        });
        it('When neither account number nor IBAN is given on create / Then account number is required', () => {
            const e = validateBankForm(domestic({ account_number: '', confirm_account_number: '' }));
            expect(e.account_number).toMatch(/account number or an IBAN/);
        });
        it('When the account number has 8 digits / Then it is rejected', () => {
            expect(validateBankForm(domestic({ account_number: '12345678', confirm_account_number: '12345678' })).account_number).toMatch(/9–18/);
        });
        it('When the confirmation differs / Then a mismatch error is shown', () => {
            expect(validateBankForm(domestic({ confirm_account_number: '123456789013' })).confirm_account_number).toMatch(/do not match/);
        });
        it('When IFSC has no 0 in the 5th place / Then it is rejected', () => {
            expect(validateBankForm(domestic({ ifsc: 'HDFC1001234' })).ifsc).toBeTruthy();
        });
        it('When SWIFT is 9 characters / Then it is rejected; 8 and 11 pass', () => {
            expect(validateBankForm(domestic({ swift_code: 'DEUTDEFF5' })).swift_code).toBeTruthy();
            expect(validateBankForm(domestic({ swift_code: 'DEUTDEFF' })).swift_code).toBeUndefined();
            expect(validateBankForm(domestic({ swift_code: 'DEUTDEFF500' })).swift_code).toBeUndefined();
        });
        it('When the IBAN checksum fails / Then it is rejected', () => {
            expect(validateBankForm(domestic({ iban: 'GB82WEST12345698765433' })).iban).toBeTruthy();
        });
        it('When currency is not 3 letters / Then it is rejected', () => {
            expect(validateBankForm(domestic({ currency: 'RUPEE' })).currency).toBeTruthy();
        });
        it('When payment method is UPI without a UPI ID / Then UPI ID is required', () => {
            expect(validateBankForm(domestic({ payment_method: 'upi' })).upi_id).toBeTruthy();
        });
        it('When a malformed UPI ID is entered for bank transfer / Then it is still rejected', () => {
            expect(validateBankForm(domestic({ upi_id: 'no-at-sign' })).upi_id).toBeTruthy();
        });
        it('When the document link is not http(s) / Then it is rejected', () => {
            expect(validateBankForm(domestic({ document_url: 'ftp://x' })).document_url).toBeTruthy();
        });
    });

    describe('Given an international account with only an IBAN', () => {
        it('When validated / Then a valid IBAN passes without an account number', () => {
            const f = domestic({ account_number: '', confirm_account_number: '', ifsc: '', iban: 'GB82 WEST 1234 5698 7654 32', swift_code: 'NWBKGB2L' });
            expect(validateBankForm(f)).toEqual({});
            expect(toBankPayload(f)).toMatchObject({ iban: 'GB82WEST12345698765432' });
            expect(toBankPayload(f)).not.toHaveProperty('account_number');
        });
        it('When checking IBANs directly / Then structure and mod-97 are enforced', () => {
            expect(isValidIban('DE89370400440532013000')).toBe(true);
            expect(isValidIban('DE89')).toBe(false);
        });
    });

    describe('Given an edit form', () => {
        const account: any = {
            id: 'a1', currency: 'INR', account_holder: 'Acme', bank_name: 'HDFC', ifsc: 'HDFC0001234',
            swift_code: null, branch: null, account_type: 'savings', payment_method: 'neft', upi_id: null,
            notes: null, document_url: null, is_primary: true,
        };
        it('When prefilled / Then secrets stay blank and other fields copy across', () => {
            const f = formFromAccount(account);
            expect(f).toMatchObject({ account_number: '', iban: '', ifsc: 'HDFC0001234', account_type: 'savings', is_primary: true, branch: '' });
        });
        it('When validated with blank secrets / Then no account-number error (blank = keep)', () => {
            expect(validateBankForm(formFromAccount(account), 'edit')).toEqual({});
        });
        it('When converted / Then cleared optionals are sent as null and is_primary/secrets are omitted', () => {
            const p = toBankPayload(formFromAccount(account), 'edit');
            expect(p.branch).toBeNull();
            expect(p).not.toHaveProperty('is_primary');
            expect(p).not.toHaveProperty('account_number');
        });
        it('When prefilled from a sparse record / Then defaults fill the gaps', () => {
            const f = formFromAccount({ id: 'x', currency: 'usd' } as any);
            expect(f).toMatchObject({ account_holder: '', account_type: 'current', payment_method: 'bank_transfer', currency: 'USD', is_primary: false });
        });
    });

    describe('Given the shell bridge', () => {
        it('When the flag is on / Then the feature is enabled and the right key is asked for', () => {
            const asked: string[] = [];
            expect(isVendorBankEnabled({ isFeatureEnabled: (k: string) => { asked.push(k); return true; } })).toBe(true);
            expect(asked).toEqual([VENDOR_BANK_FLAG]);
        });
        it('When the flag is off, missing, or the bridge throws / Then it is disabled', () => {
            expect(isVendorBankEnabled({ isFeatureEnabled: () => false })).toBe(false);
            expect(isVendorBankEnabled(undefined)).toBe(false);
            expect(isVendorBankEnabled({ isFeatureEnabled: () => { throw new Error('x'); } })).toBe(false);
        });
    });
});
