import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AttributeFieldType } from '../../../types/productTypes';

interface AttributeEditorProps {
    onSave: (data: {
        field_name: string;
        label: string;
        field_type: AttributeFieldType;
        options?: string[];
        placeholder?: string;
        unit?: string;
        is_required?: boolean;
        sort_order?: number;
    }) => Promise<void>;
    onCancel: () => void;
    initialData?: {
        field_name: string;
        label: string;
        field_type: AttributeFieldType;
        options?: string[];
        placeholder?: string;
        unit?: string;
        is_required?: boolean;
        sort_order?: number;
    };
}

const inputClass = 'w-full bg-surface-raised border border-line-strong rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-focus/50 focus:border-primary transition-all placeholder:text-fg-subtle';
const labelClass = 'block text-xs font-medium text-fg-muted mb-1';

const FIELD_TYPES: { value: AttributeFieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'select', label: 'Dropdown' },
    { value: 'boolean', label: 'Yes/No' },
    { value: 'date', label: 'Date' },
    { value: 'textarea', label: 'Long Text' },
];

const AttributeEditor: React.FC<AttributeEditorProps> = ({ onSave, onCancel, initialData }) => {
    const [label, setLabel] = useState(initialData?.label || '');
    const [fieldName, setFieldName] = useState(initialData?.field_name || '');
    const [fieldType, setFieldType] = useState<AttributeFieldType>(initialData?.field_type || 'text');
    const [placeholder, setPlaceholder] = useState(initialData?.placeholder || '');
    const [unit, setUnit] = useState(initialData?.unit || '');
    const [isRequired, setIsRequired] = useState(initialData?.is_required || false);
    const [options, setOptions] = useState<string[]>(initialData?.options || []);
    const [newOption, setNewOption] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const autoFieldName = (lbl: string) => {
        return lbl.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    };

    const handleLabelChange = (val: string) => {
        setLabel(val);
        if (!initialData) {
            setFieldName(autoFieldName(val));
        }
    };

    const addOption = () => {
        if (newOption.trim() && !options.includes(newOption.trim())) {
            setOptions([...options, newOption.trim()]);
            setNewOption('');
        }
    };

    const removeOption = (index: number) => {
        setOptions(options.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!label.trim() || !fieldName.trim()) return;
        setIsSaving(true);
        try {
            await onSave({
                field_name: fieldName,
                label: label.trim(),
                field_type: fieldType,
                options: fieldType === 'select' ? options : undefined,
                placeholder: placeholder || undefined,
                unit: unit || undefined,
                is_required: isRequired,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 bg-surface-raised/50 border border-line-strong rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>Label *</label>
                    <input
                        type="text"
                        value={label}
                        onChange={e => handleLabelChange(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Screen Size"
                        autoFocus
                    />
                </div>
                <div>
                    <label className={labelClass}>Field Name *</label>
                    <input
                        type="text"
                        value={fieldName}
                        onChange={e => setFieldName(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. screen_size"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className={labelClass}>Type</label>
                    <select value={fieldType} onChange={e => setFieldType(e.target.value as AttributeFieldType)} className={inputClass}>
                        {FIELD_TYPES.map(ft => (
                            <option key={ft.value} value={ft.value}>{ft.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Placeholder</label>
                    <input type="text" value={placeholder} onChange={e => setPlaceholder(e.target.value)} className={inputClass} placeholder="e.g. Enter value" />
                </div>
                <div>
                    <label className={labelClass}>Unit</label>
                    <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} placeholder="e.g. inches, kg" />
                </div>
            </div>

            {fieldType === 'select' && (
                <div>
                    <label className={labelClass}>Options</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {options.map((opt, i) => (
                            <span key={i} className="bg-line-strong text-fg-muted px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                {opt}
                                <button type="button" onClick={() => removeOption(i)} className="text-fg-subtle hover:text-rose-400"><X size={10} /></button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newOption}
                            onChange={e => setNewOption(e.target.value)}
                            className={inputClass}
                            placeholder="Add option..."
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                        />
                        <button type="button" onClick={addOption} className="px-3 py-1 bg-line-strong hover:bg-line-strong rounded text-xs text-fg-muted">
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="w-3.5 h-3.5 rounded border-line-strong bg-surface-raised text-primary" />
                <span className="text-xs text-fg-muted">Required field</span>
            </label>

            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onCancel} className="flex-1 px-3 py-1.5 rounded-lg border border-line-strong text-fg-muted hover:bg-surface-raised text-sm transition-all">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !label.trim() || !fieldName.trim()}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg text-sm font-medium transition-all"
                >
                    {isSaving ? 'Saving...' : initialData ? 'Update' : 'Add Attribute'}
                </button>
            </div>
        </div>
    );
};

export default AttributeEditor;
