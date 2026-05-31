import React from 'react';
import { ProductTypeAttribute } from '../../types/productTypes';

interface DynamicAttributeFieldProps {
    attribute: ProductTypeAttribute;
    value: any;
    onChange: (fieldName: string, value: any) => void;
}

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600';
const labelClass = 'block text-sm font-medium text-slate-400 mb-1.5';

const DynamicAttributeField: React.FC<DynamicAttributeFieldProps> = ({ attribute, value, onChange }) => {
    const handleChange = (val: any) => {
        onChange(attribute.field_name, val);
    };

    const renderField = () => {
        switch (attribute.field_type) {
            case 'text':
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={e => handleChange(e.target.value)}
                        className={inputClass}
                        placeholder={attribute.placeholder || ''}
                    />
                );

            case 'number':
                return (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={value || ''}
                            onChange={e => handleChange(e.target.value ? parseFloat(e.target.value) : '')}
                            className={inputClass}
                            placeholder={attribute.placeholder || ''}
                        />
                        {attribute.unit && (
                            <span className="text-sm text-slate-500 whitespace-nowrap">{attribute.unit}</span>
                        )}
                    </div>
                );

            case 'select':
                return (
                    <select
                        value={value || ''}
                        onChange={e => handleChange(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Select...</option>
                        {(attribute.options || []).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );

            case 'boolean':
                return (
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={e => handleChange(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-slate-50 transition-colors">
                            {attribute.label}
                        </span>
                    </label>
                );

            case 'date':
                return (
                    <input
                        type="date"
                        value={value || ''}
                        onChange={e => handleChange(e.target.value)}
                        className={inputClass}
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        rows={3}
                        value={value || ''}
                        onChange={e => handleChange(e.target.value)}
                        className={inputClass + ' resize-none'}
                        placeholder={attribute.placeholder || ''}
                    />
                );

            default:
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={e => handleChange(e.target.value)}
                        className={inputClass}
                    />
                );
        }
    };

    return (
        <div>
            {attribute.field_type !== 'boolean' && (
                <label className={labelClass}>
                    {attribute.label}
                    {attribute.is_required && <span className="text-rose-400 ml-1">*</span>}
                    {attribute.unit && attribute.field_type !== 'number' && (
                        <span className="text-slate-600 ml-1">({attribute.unit})</span>
                    )}
                </label>
            )}
            {renderField()}
        </div>
    );
};

export default DynamicAttributeField;
