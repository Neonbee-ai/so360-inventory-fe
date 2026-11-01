import React from 'react';
import { Select, TextField, FieldGrid } from '@so360/design-system';
import FormSection from '../components/FormSection';

export interface TaxCodeOption {
    id: string;
    name: string;
    code?: string;
    rate: number;
    jurisdiction?: string;
}

interface PricingTabProps {
    price: string;
    cost: string;
    tax_class: string;
    tax_code_id: string;
    hsn_code: string;
    updateField: (field: string, value: any) => void;
    currencySymbol?: string;
    taxCodes?: TaxCodeOption[];
    isTaxCodesLoading?: boolean;
    taxCodesError?: string | null;
}

const PricingTab: React.FC<PricingTabProps> = ({
    price, cost, tax_class, tax_code_id, hsn_code, updateField, currencySymbol = '$', taxCodes = [], isTaxCodesLoading = false, taxCodesError = null
}) => {
    const hasTaxCodes = taxCodes.length > 0;
    const taxOptions = isTaxCodesLoading
        ? [{ value: '', label: 'Loading tax codes...' }]
        : taxCodesError
            ? [{ value: '', label: 'Unable to load tax codes' }]
            : [
                { value: '', label: '— No Tax —' },
                ...taxCodes.map(tc => ({
                    value: tc.id,
                    label: `${tc.name}${tc.code ? ` (${tc.code})` : ''} — ${tc.rate}%${tc.jurisdiction ? ` · ${tc.jurisdiction}` : ''}`,
                })),
            ];
    const selectedTax = tax_code_id && hasTaxCodes ? taxCodes.find(tc => tc.id === tax_code_id) : undefined;

    return (
        <div className="space-y-nb-6">
            <FormSection title="Pricing">
                <FieldGrid columns={2}>
                    <TextField
                        label={`Selling Price (${currencySymbol})`}
                        name="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={e => updateField('price', e.target.value)}
                        placeholder="0.00"
                    />
                    <TextField
                        label={`Cost Price (${currencySymbol})`}
                        name="cost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={cost}
                        onChange={e => updateField('cost', e.target.value)}
                        placeholder="0.00"
                    />
                </FieldGrid>
                {price && cost && parseFloat(price) > 0 && parseFloat(cost) > 0 && (
                    <div className="mt-nb-4 p-nb-3 bg-surface-raised border border-line rounded-nb-md">
                        <div className="flex items-center justify-between text-nb-body">
                            <span className="text-fg-muted">Margin</span>
                            <span className="text-success font-semibold">
                                {(((parseFloat(price) - parseFloat(cost)) / parseFloat(price)) * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                )}
            </FormSection>

            <FormSection title="Tax Information">
                <FieldGrid columns={2}>
                    <div>
                        <Select
                            label="Tax Code"
                            name="tax_code_id"
                            value={tax_code_id}
                            onChange={(e: any) => updateField('tax_code_id', e.target.value)}
                            disabled={isTaxCodesLoading || !!taxCodesError}
                            options={taxOptions}
                        />
                        {!isTaxCodesLoading && !taxCodesError && !hasTaxCodes && (
                            <p className="text-nb-caption text-fg-subtle mt-nb-1">No tax codes configured. Add tax codes in Settings → Financial → Tax Codes.</p>
                        )}
                        {!isTaxCodesLoading && !!taxCodesError && (
                            <p className="text-nb-caption text-danger mt-nb-1">{taxCodesError}</p>
                        )}
                        {selectedTax && (
                            <p className="text-nb-caption text-warning mt-nb-1">Rate: {selectedTax.rate}% applied to purchase orders</p>
                        )}
                    </div>
                    <TextField
                        label="HSN / SAC Code"
                        name="hsn_code"
                        value={hsn_code}
                        onChange={e => updateField('hsn_code', e.target.value)}
                        placeholder="e.g. 8471"
                    />
                </FieldGrid>
            </FormSection>
        </div>
    );
};

export default PricingTab;
