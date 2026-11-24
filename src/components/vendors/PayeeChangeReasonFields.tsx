import React from 'react';
import { TextField, Textarea } from '@so360/design-system';

export interface PayeeReasonState { reason: string; effectiveDate: string }
export const emptyPayeeReason = (): PayeeReasonState => ({ reason: '', effectiveDate: '' });

/** Reason + effective date every Finance-controlled change request needs (Pulse 5d23afa0). */
export const PayeeChangeReasonFields: React.FC<{
    value: PayeeReasonState;
    onChange: (v: PayeeReasonState) => void;
    error?: string | null;
}> = ({ value, onChange, error }) => (
    <div className="flex flex-col gap-nb-3" data-testid="payee-reason-fields">
        <Textarea
            label="Why is this change needed?"
            name="payee-reason"
            required
            value={value.reason}
            error={error ?? undefined}
            onChange={(e) => onChange({ ...value, reason: e.target.value })}
        />
        <TextField
            label="Effective from (optional)"
            name="payee-effective-date"
            type="date"
            value={value.effectiveDate}
            onChange={(e) => onChange({ ...value, effectiveDate: e.target.value })}
        />
    </div>
);

export default PayeeChangeReasonFields;
