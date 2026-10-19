import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Checkbox, IconButton, Select, TextField } from '@so360/design-system';
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
        <div className="p-nb-4 bg-surface-raised border border-line-strong rounded-nb-md flex flex-col gap-nb-3">
            <div className="grid grid-cols-1 wc-md:grid-cols-2 gap-nb-3">
                <TextField
                    label="Label *"
                    name="attr-label"
                    value={label}
                    onChange={e => handleLabelChange(e.target.value)}
                    placeholder="e.g. Screen Size"
                    autoFocus
                />
                <TextField
                    label="Field Name *"
                    name="attr-field-name"
                    value={fieldName}
                    onChange={e => setFieldName(e.target.value)}
                    placeholder="e.g. screen_size"
                />
            </div>

            <div className="grid grid-cols-1 wc-md:grid-cols-3 gap-nb-3">
                <Select
                    label="Type"
                    name="attr-type"
                    value={fieldType}
                    options={FIELD_TYPES}
                    onChange={e => setFieldType(e.target.value as AttributeFieldType)}
                />
                <TextField label="Placeholder" name="attr-placeholder" value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder="e.g. Enter value" />
                <TextField label="Unit" name="attr-unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. inches, kg" />
            </div>

            {fieldType === 'select' && (
                <div className="flex flex-col gap-nb-2">
                    <span className="text-nb-caption font-medium text-fg-muted">Options</span>
                    <div className="flex flex-wrap gap-nb-2">
                        {options.map((opt, i) => (
                            <span key={i} className="inline-flex items-center gap-nb-1">
                                <span className="bg-surface-high text-fg-muted px-nb-2 rounded-nb-sm text-nb-caption">{opt}</span>
                                <IconButton label={`Remove ${opt}`} size="sm" icon={<X size={10} />} onClick={() => removeOption(i)} />
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-nb-2 items-end">
                        <div className="flex-1">
                            <TextField
                                name="attr-new-option"
                                aria-label="New option"
                                value={newOption}
                                onChange={e => setNewOption(e.target.value)}
                                placeholder="Add option..."
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                            />
                        </div>
                        <IconButton label="Add option" icon={<Plus size={14} />} onClick={addOption} />
                    </div>
                </div>
            )}

            <Checkbox label="Required field" name="attr-required" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} />

            <div className="flex gap-nb-2 pt-nb-1 justify-end">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="button" variant="primary" onClick={handleSave} disabled={isSaving || !label.trim() || !fieldName.trim()}>
                    {isSaving ? 'Saving...' : initialData ? 'Update' : 'Add Attribute'}
                </Button>
            </div>
        </div>
    );
};

export default AttributeEditor;
