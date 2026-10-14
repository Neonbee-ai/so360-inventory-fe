import React from 'react';
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

const inputClass = 'w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2.5 text-fg focus:outline-none focus:ring-2 focus:ring-focus/50 focus:border-primary transition-all placeholder:text-fg-subtle';
const labelClass = 'block text-sm font-medium text-fg-muted mb-1.5';

const PricingTab: React.FC<PricingTabProps> = ({
    price, cost, tax_class, tax_code_id, hsn_code, updateField, currencySymbol = '$', taxCodes = [], isTaxCodesLoading = false, taxCodesError = null
}) => {
    const hasTaxCodes = taxCodes.length > 0;

    return (
        <div className="space-y-8">
            <FormSection title="Pricing">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Selling Price ({currencySymbol})</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={price}
                            onChange={e => updateField('price', e.target.value)}
                            className={inputClass}
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Cost Price ({currencySymbol})</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cost}
                            onChange={e => updateField('cost', e.target.value)}
                            className={inputClass}
                            placeholder="0.00"
                        />
                    </div>
                </div>
                {price && cost && parseFloat(price) > 0 && parseFloat(cost) > 0 && (
                    <div className="mt-4 p-3 bg-surface-raised/50 border border-line-strong/50 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-fg-muted">Margin</span>
                            <span className="text-success font-semibold">
                                {(((parseFloat(price) - parseFloat(cost)) / parseFloat(price)) * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                )}
            </FormSection>

            <FormSection title="Tax Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Tax Code</label>
                        <select
                            value={tax_code_id}
                            onChange={e => updateField('tax_code_id', e.target.value)}
                            className={inputClass}
                            disabled={isTaxCodesLoading || !!taxCodesError}
                        >
                            {isTaxCodesLoading && <option value="">Loading tax codes...</option>}
                            {!isTaxCodesLoading && taxCodesError && <option value="">Unable to load tax codes</option>}
                            {!isTaxCodesLoading && !taxCodesError && (
                                <>
                                    <option value="">— No Tax —</option>
                                    {taxCodes.map(tc => (
                                        <option key={tc.id} value={tc.id}>
                                            {tc.name}{tc.code ? ` (${tc.code})` : ''} — {tc.rate}%
                                            {tc.jurisdiction ? ` · ${tc.jurisdiction}` : ''}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                        {!isTaxCodesLoading && !taxCodesError && !hasTaxCodes && (
                            <p className="text-xs text-fg-subtle mt-1">No tax codes configured. Add tax codes in Settings → Financial → Tax Codes.</p>
                        )}
                        {!isTaxCodesLoading && !!taxCodesError && (
                            <p className="text-xs text-rose-400 mt-1">{taxCodesError}</p>
                        )}
                        {tax_code_id && hasTaxCodes && (() => {
                            const selected = taxCodes.find(tc => tc.id === tax_code_id);
                            return selected ? (
                                <p className="text-xs text-warning mt-1">Rate: {selected.rate}% applied to purchase orders</p>
                            ) : null;
                        })()}
                    </div>
                    <div>
                        <label className={labelClass}>HSN / SAC Code</label>
                        <input
                            type="text"
                            value={hsn_code}
                            onChange={e => updateField('hsn_code', e.target.value)}
                            className={inputClass}
                            placeholder="e.g. 8471"
                        />
                    </div>
                </div>
            </FormSection>
        </div>
    );
};

export default PricingTab;
