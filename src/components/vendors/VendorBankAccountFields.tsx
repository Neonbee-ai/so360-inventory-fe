import React from 'react';
import { TextField, Select, Checkbox, Textarea, FieldGrid } from '@so360/design-system';
import {
    ACCOUNT_TYPES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS,
    type BankFormErrors, type BankFormState,
} from '../../utils/vendorBank';

interface Props {
    value: BankFormState;
    onChange: (next: BankFormState) => void;
    errors?: BankFormErrors;
    /** 'edit' leaves secrets blank = unchanged and hides the primary toggle. */
    mode?: 'create' | 'edit';
    /** Masked current number, shown as a hint in edit mode. */
    maskedNumber?: string | null;
    showPrimaryToggle?: boolean;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = { current: 'Current', savings: 'Savings', other: 'Other' };

/** Shared bank-account inputs for the profile drawer and the create-vendor form. */
export const VendorBankAccountFields: React.FC<Props> = ({
    value, onChange, errors = {}, mode = 'create', maskedNumber, showPrimaryToggle = true,
}) => {
    const set = (k: keyof BankFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        onChange({ ...value, [k]: e.target.value });
    const editing = mode === 'edit';

    return (
        <div className="flex flex-col gap-nb-4" data-testid="vendor-bank-fields">
            <FieldGrid>
                <TextField label="Account holder" name="bank_account_holder" required value={value.account_holder}
                    onChange={set('account_holder')} error={errors.account_holder} />
                <TextField label="Bank name" name="bank_name" required value={value.bank_name}
                    onChange={set('bank_name')} error={errors.bank_name} />
            </FieldGrid>
            <FieldGrid>
                <TextField label="Account number" name="bank_account_number" inputMode="numeric" autoComplete="off"
                    value={value.account_number} onChange={set('account_number')} error={errors.account_number}
                    hint={editing ? `Current: ${maskedNumber ?? 'none'} — leave blank to keep` : '9–18 digits'} />
                <TextField label="Confirm account number" name="bank_confirm_account_number" inputMode="numeric"
                    autoComplete="off" value={value.confirm_account_number}
                    onChange={set('confirm_account_number')} error={errors.confirm_account_number}
                    onPaste={(e) => e.preventDefault()} />
            </FieldGrid>
            <FieldGrid>
                <TextField label="IFSC" name="bank_ifsc" value={value.ifsc} onChange={set('ifsc')}
                    error={errors.ifsc} hint="Domestic (India), e.g. HDFC0001234" />
                <TextField label="Branch" name="bank_branch" value={value.branch} onChange={set('branch')} />
            </FieldGrid>
            <FieldGrid>
                <TextField label="SWIFT / BIC" name="bank_swift" value={value.swift_code} onChange={set('swift_code')}
                    error={errors.swift_code} hint="International, 8 or 11 characters" />
                <TextField label="IBAN" name="bank_iban" autoComplete="off" value={value.iban} onChange={set('iban')}
                    error={errors.iban} hint={editing ? 'Leave blank to keep the current IBAN' : undefined} />
            </FieldGrid>
            <FieldGrid>
                <Select label="Account type" name="bank_account_type" value={value.account_type} onChange={set('account_type')}
                    options={ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))} />
                <TextField label="Currency" name="bank_currency" required maxLength={3} value={value.currency}
                    onChange={set('currency')} error={errors.currency} />
            </FieldGrid>
            <FieldGrid>
                <Select label="Payment method" name="bank_payment_method" value={value.payment_method}
                    onChange={set('payment_method')}
                    options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
                <TextField label="UPI ID" name="bank_upi_id" value={value.upi_id} onChange={set('upi_id')}
                    error={errors.upi_id} required={value.payment_method === 'upi'} />
            </FieldGrid>
            <TextField label="Supporting document link" name="bank_document_url" type="url" value={value.document_url}
                onChange={set('document_url')} error={errors.document_url} hint="Cancelled cheque or bank letter" />
            <Textarea label="Notes" name="bank_notes" rows={2} value={value.notes} onChange={set('notes')} />
            {showPrimaryToggle && !editing && (
                <Checkbox label="Make this the primary account" name="bank_is_primary" checked={value.is_primary}
                    onChange={(e) => onChange({ ...value, is_primary: e.target.checked })} />
            )}
        </div>
    );
};

export default VendorBankAccountFields;
