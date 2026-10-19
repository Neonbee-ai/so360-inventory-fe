import React from 'react';
import { Checkbox, Select, Textarea, TextField } from '@so360/design-system';
import { ProductTypeAttribute } from '../../types/productTypes';

interface DynamicAttributeFieldProps {
    attribute: ProductTypeAttribute;
    value: any;
    onChange: (fieldName: string, value: any) => void;
}

const DynamicAttributeField: React.FC<DynamicAttributeFieldProps> = ({ attribute, value, onChange }) => {
    const handleChange = (val: any) => {
        onChange(attribute.field_name, val);
    };

    const name = `attr-${attribute.field_name}`;
    const required = !!attribute.is_required;
    const unitHint = attribute.unit && attribute.field_type !== 'number' ? `(${attribute.unit})` : undefined;

    switch (attribute.field_type) {
        case 'number':
            return (
                <div className="flex items-end gap-nb-2">
                    <div className="flex-1">
                        <TextField
                            type="number"
                            label={attribute.label}
                            name={name}
                            required={required}
                            value={value || ''}
                            onChange={e => handleChange(e.target.value ? parseFloat(e.target.value) : '')}
                            placeholder={attribute.placeholder || ''}
                        />
                    </div>
                    {attribute.unit && (
                        <span className="pb-nb-2 text-nb-body text-fg-subtle whitespace-nowrap">{attribute.unit}</span>
                    )}
                </div>
            );

        case 'select':
            return (
                <Select
                    label={attribute.label}
                    name={name}
                    required={required}
                    hint={unitHint}
                    value={value || ''}
                    placeholder="Select..."
                    options={(attribute.options || []).map(opt => ({ value: opt, label: opt }))}
                    onChange={e => handleChange(e.target.value)}
                />
            );

        case 'boolean':
            return (
                <Checkbox
                    label={attribute.label}
                    name={name}
                    checked={!!value}
                    onChange={e => handleChange(e.target.checked)}
                />
            );

        case 'date':
            return (
                <TextField
                    type="date"
                    label={attribute.label}
                    name={name}
                    required={required}
                    hint={unitHint}
                    value={value || ''}
                    onChange={e => handleChange(e.target.value)}
                />
            );

        case 'textarea':
            return (
                <Textarea
                    rows={3}
                    label={attribute.label}
                    name={name}
                    required={required}
                    hint={unitHint}
                    value={value || ''}
                    onChange={e => handleChange(e.target.value)}
                    placeholder={attribute.placeholder || ''}
                />
            );

        case 'text':
        default:
            return (
                <TextField
                    type="text"
                    label={attribute.label}
                    name={name}
                    required={required}
                    hint={unitHint}
                    value={value || ''}
                    onChange={e => handleChange(e.target.value)}
                    placeholder={attribute.field_type === 'text' ? attribute.placeholder || '' : undefined}
                />
            );
    }
};

export default DynamicAttributeField;
