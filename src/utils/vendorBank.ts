/**
 * Vendor bank details — shared client helpers.
 *
 * Mirrors so360-inventory-be/src/vendors/vendor-bank-validation.ts so the user
 * sees errors before submitting. The backend stays authoritative.
 * Account numbers never live here beyond the form: every API response is masked.
 */

export const VENDOR_BANK_FLAG = 'submodule:inventory:vendor_bank_details';

export const VENDOR_BANK_PERMS = {
    READ: 'vendor_bank_accounts.read',
    MANAGE: 'vendor_bank_accounts.manage',
    VERIFY: 'vendor_bank_accounts.verify',
    REVEAL: 'vendor_bank_accounts.reveal',
} as const;

export const ACCOUNT_TYPES = ['current', 'savings', 'other'] as const;
export const PAYMENT_METHODS = ['bank_transfer', 'neft', 'rtgs', 'imps', 'wire', 'upi'] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    bank_transfer: 'Bank transfer',
    neft: 'NEFT',
    rtgs: 'RTGS',
    imps: 'IMPS',
    wire: 'Wire (SWIFT)',
    upi: 'UPI',
};

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const SWIFT_RE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const ACCOUNT_NUMBER_RE = /^\d{9,18}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export interface VendorBankAccount {
    id: string;
    vendor_id: string;
    account_holder: string;
    bank_name: string;
    account_number_masked: string | null;
    iban_masked: string | null;
    ifsc?: string | null;
    swift_code?: string | null;
    branch?: string | null;
    account_type: string;
    currency: string;
    payment_method: string;
    upi_id?: string | null;
    notes?: string | null;
    document_url?: string | null;
    is_primary: boolean;
    is_active: boolean;
    verification_status: 'unverified' | 'verified';
    verified_by?: string | null;
    verified_at?: string | null;
    unverified: boolean;
    recently_changed: boolean;
    updated_at?: string;
}

export interface BankFormState {
    account_holder: string;
    bank_name: string;
    account_number: string;
    confirm_account_number: string;
    ifsc: string;
    swift_code: string;
    iban: string;
    branch: string;
    account_type: string;
    currency: string;
    payment_method: string;
    upi_id: string;
    notes: string;
    document_url: string;
    is_primary: boolean;
}

export function emptyBankForm(currency = ''): BankFormState {
    return {
        account_holder: '',
        bank_name: '',
        account_number: '',
        confirm_account_number: '',
        ifsc: '',
        swift_code: '',
        iban: '',
        branch: '',
        account_type: 'current',
        currency: (currency || '').toUpperCase(),
        payment_method: 'bank_transfer',
        upi_id: '',
        notes: '',
        document_url: '',
        is_primary: false,
    };
}

/** Prefill an edit form. Secrets are never prefilled — blank means "keep". */
export function formFromAccount(a: VendorBankAccount): BankFormState {
    return {
        ...emptyBankForm(a.currency),
        account_holder: a.account_holder ?? '',
        bank_name: a.bank_name ?? '',
        ifsc: a.ifsc ?? '',
        swift_code: a.swift_code ?? '',
        branch: a.branch ?? '',
        account_type: a.account_type ?? 'current',
        payment_method: a.payment_method ?? 'bank_transfer',
        upi_id: a.upi_id ?? '',
        notes: a.notes ?? '',
        document_url: a.document_url ?? '',
        is_primary: !!a.is_primary,
    };
}

export function isValidIban(raw: string): boolean {
    const iban = raw.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    let rem = 0;
    for (const ch of rearranged) {
        const code = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
        for (const d of code) rem = (rem * 10 + Number(d)) % 97;
    }
    return rem === 1;
}

export type BankFormErrors = Partial<Record<keyof BankFormState, string>>;

/**
 * @param mode 'create' requires an account number or IBAN; 'edit' treats blank
 *             secrets as "unchanged".
 */
export function validateBankForm(f: BankFormState, mode: 'create' | 'edit' = 'create'): BankFormErrors {
    const e: BankFormErrors = {};
    if (!f.account_holder.trim()) e.account_holder = 'Account holder is required.';
    if (!f.bank_name.trim()) e.bank_name = 'Bank name is required.';
    const acct = f.account_number.replace(/\s+/g, '');
    const iban = f.iban.replace(/\s+/g, '');
    if (mode === 'create' && !acct && !iban) e.account_number = 'Enter an account number or an IBAN.';
    if (acct && !ACCOUNT_NUMBER_RE.test(acct)) e.account_number = 'Account number must be 9–18 digits.';
    if (acct && f.confirm_account_number.replace(/\s+/g, '') !== acct) {
        e.confirm_account_number = 'Account numbers do not match.';
    }
    if (f.ifsc && !IFSC_RE.test(f.ifsc.trim().toUpperCase())) e.ifsc = 'IFSC must look like ABCD0123456.';
    if (f.swift_code && !SWIFT_RE.test(f.swift_code.trim().toUpperCase())) {
        e.swift_code = 'SWIFT/BIC must be 8 or 11 characters.';
    }
    if (iban && !isValidIban(iban)) e.iban = 'IBAN is not valid.';
    if (!CURRENCY_RE.test(f.currency.trim().toUpperCase())) e.currency = 'Use a 3-letter currency code.';
    if (f.payment_method === 'upi' && !UPI_RE.test(f.upi_id.trim())) e.upi_id = 'Enter a valid UPI ID (name@bank).';
    else if (f.upi_id.trim() && !UPI_RE.test(f.upi_id.trim())) e.upi_id = 'Enter a valid UPI ID (name@bank).';
    if (f.document_url.trim() && !/^https?:\/\//i.test(f.document_url.trim())) {
        e.document_url = 'Document link must start with http:// or https://.';
    }
    return e;
}

/** Build the API payload; blank optional fields are dropped, codes uppercased. */
export function toBankPayload(f: BankFormState, mode: 'create' | 'edit' = 'create'): Record<string, unknown> {
    const out: Record<string, unknown> = {
        account_holder: f.account_holder.trim(),
        bank_name: f.bank_name.trim(),
        account_type: f.account_type,
        currency: f.currency.trim().toUpperCase(),
        payment_method: f.payment_method,
    };
    const acct = f.account_number.replace(/\s+/g, '');
    if (acct) {
        out.account_number = acct;
        out.confirm_account_number = f.confirm_account_number.replace(/\s+/g, '');
    }
    const iban = f.iban.replace(/\s+/g, '').toUpperCase();
    if (iban) out.iban = iban;
    const opt: Array<[keyof BankFormState, (v: string) => string]> = [
        ['ifsc', (v) => v.toUpperCase()],
        ['swift_code', (v) => v.toUpperCase()],
        ['branch', (v) => v],
        ['upi_id', (v) => v],
        ['notes', (v) => v],
        ['document_url', (v) => v],
    ];
    for (const [k, fmt] of opt) {
        const v = String(f[k] ?? '').trim();
        if (v) out[k] = fmt(v);
        else if (mode === 'edit') out[k] = null;
    }
    if (mode === 'create' && f.is_primary) out.is_primary = true;
    return out;
}

/** Feature-flag check through the shell bridge; never throws. */
export function isVendorBankEnabled(shell: any): boolean {
    try {
        return shell?.isFeatureEnabled?.(VENDOR_BANK_FLAG) === true;
    } catch {
        return false;
    }
}
