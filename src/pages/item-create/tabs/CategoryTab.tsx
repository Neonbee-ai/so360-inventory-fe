import React from 'react';
import { TextField, Textarea, Select, Checkbox, RadioGroup, Alert, FieldGrid } from '@so360/design-system';
import FormSection from '../components/FormSection';
import CategoryPicker from '../../../components/categories/CategoryPicker';
import { ItemCategory, ItemAttributeDefinition } from '../../../types/inventory';

interface CategoryTabProps {
    category_id: string;
    categories: ItemCategory[];
    updateField: (field: string, value: any) => void;
    onQuickAddCategory: (name: string) => Promise<void>;
    attributeDefs?: ItemAttributeDefinition[];
    metadata?: Record<string, any>;
    error?: string | null;
}


/**
 * Numeric range check shared between the inline per-field error and the
 * parent's save-gating logic. Returns null when the value is unset, not a
 * number, or has no configured min_value/max_value bound (regression guard —
 * attributes with no bound configured must never be forced into range).
 */
export const getAttributeRangeError = (
    def: ItemAttributeDefinition,
    rawValue: any,
): string | null => {
    if (def.attribute_type !== 'number' && def.attribute_type !== 'currency') return null;
    if (rawValue === undefined || rawValue === null || rawValue === '') return null;

    const value = Number(rawValue);
    if (Number.isNaN(value)) return null;

    if (def.min_value !== null && def.min_value !== undefined && value < def.min_value) {
        return `${def.attribute_label} must be greater than ${def.min_value}.`;
    }
    if (def.max_value !== null && def.max_value !== undefined && value > def.max_value) {
        return `${def.attribute_label} must be less than ${def.max_value}.`;
    }
    return null;
};

const CategoryTab: React.FC<CategoryTabProps> = ({
    category_id, categories, updateField, onQuickAddCategory,
    attributeDefs = [], metadata = {}, error = null,
}) => {
    const handleMetadataChange = (key: string, value: any) => {
        updateField('metadata', { ...metadata, [key]: value });
    };

    const fieldLabel = (def: ItemAttributeDefinition) =>
        def.unit && def.attribute_type !== 'number' ? `${def.attribute_label} (${def.unit})` : def.attribute_label;

    const rangeAlert = (def: ItemAttributeDefinition, rangeError: string | null) =>
        rangeError ? (
            <div data-testid={`error-attr-${def.attribute_key}`} className="mt-1.5">
                <Alert variant="error">{rangeError}</Alert>
            </div>
        ) : null;

    const renderAttributeField = (def: ItemAttributeDefinition) => {
        const value = metadata[def.attribute_key];
        const common = { name: def.attribute_key, label: fieldLabel(def), required: def.is_required };

        switch (def.attribute_type) {
            case 'text':
                return (
                    <TextField
                        {...common}
                        type="text"
                        value={value || ''}
                        onChange={e => handleMetadataChange(def.attribute_key, e.target.value)}
                        placeholder={def.attribute_label}
                    />
                );
            case 'number': {
                const rangeError = getAttributeRangeError(def, value);
                return (
                    <div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                                <TextField
                                    {...common}
                                    type="number"
                                    min={def.min_value ?? undefined}
                                    max={def.max_value ?? undefined}
                                    value={value ?? ''}
                                    onChange={e => handleMetadataChange(def.attribute_key, e.target.value ? parseFloat(e.target.value) : '')}
                                    placeholder={def.attribute_label}
                                />
                            </div>
                            {/* comb-exception: TextField has no suffix/unit node slot */}
                            {def.unit && <span className="pb-2 text-sm text-fg-subtle whitespace-nowrap">{def.unit}</span>}
                        </div>
                        {rangeAlert(def, rangeError)}
                    </div>
                );
            }
            case 'boolean':
                return (
                    <Checkbox
                        name={def.attribute_key}
                        label={def.attribute_label}
                        checked={!!value}
                        onChange={e => handleMetadataChange(def.attribute_key, e.target.checked)}
                    />
                );
            case 'currency': {
                const rangeError = getAttributeRangeError(def, value);
                return (
                    <div>
                        <div className="flex items-end gap-2">
                            {/* comb-exception: TextField has no prefix/unit node slot */}
                            {def.unit && <span className="pb-2 text-sm text-fg-subtle whitespace-nowrap">{def.unit}</span>}
                            <div className="flex-1 min-w-0">
                                <TextField
                                    {...common}
                                    type="number"
                                    step="0.01"
                                    min={def.min_value ?? undefined}
                                    max={def.max_value ?? undefined}
                                    value={value ?? ''}
                                    onChange={e => handleMetadataChange(def.attribute_key, e.target.value ? parseFloat(e.target.value) : '')}
                                    placeholder={def.attribute_label}
                                />
                            </div>
                        </div>
                        {rangeAlert(def, rangeError)}
                    </div>
                );
            }
            case 'date':
                return (
                    <TextField
                        {...common}
                        type="date"
                        value={value || ''}
                        onChange={e => handleMetadataChange(def.attribute_key, e.target.value)}
                    />
                );
            case 'textarea':
                return (
                    <Textarea
                        {...common}
                        rows={3}
                        value={value || ''}
                        onChange={e => handleMetadataChange(def.attribute_key, e.target.value)}
                        placeholder={def.attribute_label}
                    />
                );
            case 'file':
                return (
                    <TextField
                        {...common}
                        type="text"
                        value={value || ''}
                        onChange={e => handleMetadataChange(def.attribute_key, e.target.value)}
                        placeholder="File URL"
                    />
                );
            case 'radio':
                return (
                    <RadioGroup
                        name={def.attribute_key}
                        label={fieldLabel(def)}
                        required={def.is_required}
                        orientation="horizontal"
                        value={value ?? ''}
                        options={(def.options || []).map(opt => ({ value: opt.value, label: opt.label }))}
                        onChange={v => handleMetadataChange(def.attribute_key, v)}
                    />
                );
            case 'select':
                return (
                    <Select
                        {...common}
                        value={value || ''}
                        onChange={e => handleMetadataChange(def.attribute_key, e.target.value)}
                        placeholder="Select..."
                        options={(def.options || []).map(opt => ({ value: opt.value, label: opt.label }))}
                    />
                );
            case 'multi_select': {
                const selected: string[] = Array.isArray(value) ? value : [];
                return (
                    <div>
                        {/* comb-exception: no DS multi-select group; a labelled Checkbox cluster is used */}
                        <p className="mb-1.5 text-sm font-medium text-fg-muted">
                            {fieldLabel(def)}
                            {def.is_required && <span className="ml-1 text-danger">*</span>}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {(def.options || []).map(opt => {
                                const checked = selected.includes(opt.value);
                                return (
                                    <Checkbox
                                        key={opt.value}
                                        name={`${def.attribute_key}-${opt.value}`}
                                        label={opt.label}
                                        checked={checked}
                                        onChange={e => {
                                            const next = e.target.checked
                                                ? [...selected, opt.value]
                                                : selected.filter(v => v !== opt.value);
                                            handleMetadataChange(def.attribute_key, next);
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <FormSection title="Item Category *" description="Assign this item to a category for organization and filtering. Categories support hierarchy.">
                <CategoryPicker
                    categories={categories}
                    value={category_id}
                    onChange={(id) => updateField('category_id', id)}
                    onQuickAdd={onQuickAddCategory}
                />

                {error && (
                    <div data-testid="error-category_id" className="mt-2">
                        <Alert variant="error">{error}</Alert>
                    </div>
                )}

                {category_id && (
                    <p className="mt-4 text-xs text-fg-subtle">
                        Selected: <span className="text-fg-muted font-medium">{categories.find(c => c.id === category_id)?.name || 'Unknown'}</span>
                    </p>
                )}
            </FormSection>

            {attributeDefs.length > 0 && (
                <FormSection
                    title="Category Attributes"
                    description="Fill in the custom fields defined for this category"
                >
                    <FieldGrid columns={2}>
                        {attributeDefs.map(def => (
                            <div key={def.id}>{renderAttributeField(def)}</div>
                        ))}
                    </FieldGrid>
                </FormSection>
            )}
        </div>
    );
};

export default CategoryTab;
