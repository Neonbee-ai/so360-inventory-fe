import React from 'react';
import FormSection from '../components/FormSection';
import { ITEM_CLASSIFICATIONS, ItemClassification } from '../../../types/itemTypes';
import { Unit } from '../../../types/inventory';
import ProductTypePicker from '../../../components/attributes/ProductTypePicker';

export type FieldErrors = Record<string, string | null>;

interface BasicInfoTabProps {
    name: string;
    sku: string;
    type: ItemClassification;
    brand: string;
    product_type_id: string;
    barcode: string;
    description: string;
    unit_id: string;
    uoms: Unit[];
    showNewUom: boolean;
    newUomName: string;
    newUomAbbr: string;
    isCreatingUom: boolean;
    updateField: (field: string, value: any) => void;
    setShowNewUom: (show: boolean) => void;
    setNewUomName: (name: string) => void;
    setNewUomAbbr: (abbr: string) => void;
    onCreateUom: () => void;
    errors?: FieldErrors;
    showErrors?: boolean;
    isSkuAutoEnabled?: boolean;
    isSkuManuallyEdited?: boolean;
    onResetSku?: () => void;
}

const inputClass = 'w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2.5 text-fg focus:outline-none focus:ring-2 focus:ring-focus/50 focus:border-primary transition-all placeholder:text-fg-subtle';
const labelClass = 'block text-sm font-medium text-fg-muted mb-1.5';

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
    name, sku, type, brand, barcode, description, unit_id, uoms, product_type_id,
    showNewUom, newUomName, newUomAbbr, isCreatingUom,
    updateField, setShowNewUom, setNewUomName, setNewUomAbbr, onCreateUom,
    errors = {}, showErrors = false, isSkuAutoEnabled = true, isSkuManuallyEdited = false,
    onResetSku,
}) => {
    const errorFor = (field: string) => (showErrors ? errors[field] || null : null);
    const cls = (field: string) =>
        errorFor(field) ? inputClass.replace('border-line-strong', 'border-rose-500/60') : inputClass;
    const FieldError = ({ field }: { field: string }) => {
        const message = errorFor(field);
        return message ? (
            <p role="alert" data-testid={`error-${field}`} className="text-rose-400 text-xs mt-1">{message}</p>
        ) : null;
    };

    return (
        <div className="space-y-8">
            <FormSection title="Identification">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className={labelClass}>Item Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => updateField('name', e.target.value)}
                            className={cls('name')}
                            placeholder="e.g. MacBook Pro 14"
                        />
                        <FieldError field="name" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-medium text-fg-muted">SKU *</label>
                            <div className="flex items-center gap-1.5">
                                {isSkuAutoEnabled && (
                                    <span
                                        data-testid="sku-autogen-badge"
                                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                            isSkuManuallyEdited
                                                ? 'bg-surface-raised text-fg-muted border border-line-strong'
                                                : 'bg-primary/10 text-primary border border-primary/20'
                                        }`}
                                    >
                                        {isSkuManuallyEdited ? 'Manual Override' : 'Auto-generated from Item Name'}
                                    </span>
                                )}
                                {isSkuManuallyEdited && onResetSku && (
                                    <button
                                        type="button"
                                        data-testid="sku-reset-btn"
                                        onClick={onResetSku}
                                        className="text-[10px] text-primary hover:text-primary underline focus:outline-none"
                                    >
                                        Re-generate
                                    </button>
                                )}
                            </div>
                        </div>
                        <input
                            type="text"
                            value={sku}
                            onChange={e => updateField('sku', e.target.value)}
                            className={cls('sku')}
                            placeholder="e.g. LAP-001"
                        />
                        <FieldError field="sku" />
                    </div>
                    <div>
                        <label className={labelClass}>Barcode / UPC</label>
                        <input
                            type="text"
                            value={barcode}
                            onChange={e => updateField('barcode', e.target.value)}
                            className={cls('barcode')}
                            placeholder="e.g. 012345678905"
                        />
                        <FieldError field="barcode" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className={labelClass}>Brand</label>
                        <input
                            type="text"
                            value={brand}
                            onChange={e => updateField('brand', e.target.value)}
                            className={cls('brand')}
                            placeholder="e.g. Apple"
                        />
                        <FieldError field="brand" />
                    </div>
                    <div>
                        <label className={labelClass}>Unit of Measure *</label>
                        {!showNewUom ? (
                            <select
                                value={unit_id}
                                onChange={e => {
                                    if (e.target.value === '__new__') {
                                        setShowNewUom(true);
                                    } else {
                                        updateField('unit_id', e.target.value);
                                    }
                                }}
                                className={cls('unit_id')}
                            >
                                <option value="">Select unit...</option>
                                {uoms.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                                ))}
                                <option value="__new__">+ Create new UoM</option>
                            </select>
                        ) : (
                            <div className="space-y-2 p-3 bg-surface-raised/50 border border-line-strong rounded-lg">
                                <input
                                    type="text"
                                    value={newUomName}
                                    onChange={e => setNewUomName(e.target.value)}
                                    className={inputClass}
                                    placeholder="Unit name *"
                                    autoFocus
                                />
                                <input
                                    type="text"
                                    value={newUomAbbr}
                                    onChange={e => setNewUomAbbr(e.target.value)}
                                    className={inputClass}
                                    placeholder="Abbreviation * (e.g. pcs, kg)"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setShowNewUom(false); setNewUomName(''); setNewUomAbbr(''); }}
                                        className="flex-1 px-3 py-1.5 rounded-lg border border-line-strong text-fg-muted hover:bg-surface-raised text-sm transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onCreateUom}
                                        disabled={isCreatingUom || !newUomName.trim() || !newUomAbbr.trim()}
                                        className="flex-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium transition-all"
                                    >
                                        {isCreatingUom ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        )}
                        <FieldError field="unit_id" />
                    </div>
                </div>
            </FormSection>

            <FormSection title="Classification *" description="Choose what kind of item this is">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {ITEM_CLASSIFICATIONS.map(cls => {
                        const Icon = cls.icon;
                        const isSelected = type === cls.value;
                        return (
                            <button
                                key={cls.value}
                                type="button"
                                onClick={() => updateField('type', cls.value)}
                                className={`
                                    p-3 rounded-xl border text-left transition-all
                                    ${isSelected
                                        ? 'border-primary bg-primary/10 ring-1 ring-focus/30'
                                        : 'border-line-strong bg-surface-raised/50 hover:border-line-strong hover:bg-surface-raised'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon size={16} className={isSelected ? 'text-primary' : 'text-fg-subtle'} />
                                    <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-fg-muted'}`}>{cls.label}</span>
                                </div>
                                <p className="text-xs text-fg-subtle leading-tight">{cls.description}</p>
                            </button>
                        );
                    })}
                </div>
                <FieldError field="type" />
            </FormSection>

            <FormSection title="Product Type" description="Optional — assigns dynamic attribute fields in the Attributes tab">
                <ProductTypePicker
                    value={product_type_id}
                    onChange={(id) => updateField('product_type_id', id)}
                />
            </FormSection>

            <FormSection title="Description">
                <textarea
                    rows={4}
                    value={description}
                    onChange={e => updateField('description', e.target.value)}
                    className={inputClass + ' resize-none'}
                    placeholder="Product description for e-commerce listings..."
                />
            </FormSection>
        </div>
    );
};

export default BasicInfoTab;
