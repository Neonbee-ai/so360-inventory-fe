import React from 'react';
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
}

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600';
const labelClass = 'block text-sm font-medium text-slate-400 mb-1.5';

const CategoryTab: React.FC<CategoryTabProps> = ({
    category_id, categories, updateField, onQuickAddCategory,
    attributeDefs = [], metadata = {},
}) => {
    const handleMetadataChange = (key: string, value: any) => {
        updateField('metadata', { ...metadata, [key]: value });
    };

    const renderAttributeField = (def: ItemAttributeDefinition) => {
        const value = metadata[def.attribute_key];

        switch (def.attribute_type) {
            case 'text':
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={e => handleMetadataChange(def.attribute_key, e.target.value)}
                        className={inputClass}
                        placeholder={def.attribute_label}
                    />
                );
            case 'number':
                return (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={value ?? ''}
                            onChange={e => handleMetadataChange(def.attribute_key, e.target.value ? parseFloat(e.target.value) : '')}
                            className={inputClass}
                            placeholder={def.attribute_label}
                        />
                        {def.unit && <span className="text-sm text-slate-500 whitespace-nowrap">{def.unit}</span>}
                    </div>
                );
            case 'boolean':
                return (
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={e => handleMetadataChange(def.attribute_key, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                            {def.attribute_label}
                        </span>
                    </label>
                );
            case 'select':
                return (
                    <select
                        value={value || ''}
                        onChange={e => handleMetadataChange(def.attribute_key, e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Select...</option>
                        {(def.options || []).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                );
            case 'multi_select': {
                const selected: string[] = Array.isArray(value) ? value : [];
                return (
                    <div className="flex flex-wrap gap-2">
                        {(def.options || []).map(opt => {
                            const checked = selected.includes(opt.value);
                            return (
                                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => {
                                            const next = e.target.checked
                                                ? [...selected, opt.value]
                                                : selected.filter(v => v !== opt.value);
                                            handleMetadataChange(def.attribute_key, next);
                                        }}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                                    />
                                    <span className="text-sm text-slate-300">{opt.label}</span>
                                </label>
                            );
                        })}
                    </div>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <FormSection title="Item Category" description="Assign this item to a category for organization and filtering. Categories support hierarchy.">
                <CategoryPicker
                    categories={categories}
                    value={category_id}
                    onChange={(id) => updateField('category_id', id)}
                    onQuickAdd={onQuickAddCategory}
                />

                {category_id && (
                    <div className="mt-4 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                        <p className="text-xs text-slate-500">
                            Selected: <span className="text-slate-300 font-medium">{categories.find(c => c.id === category_id)?.name || 'Unknown'}</span>
                        </p>
                    </div>
                )}
            </FormSection>

            {attributeDefs.length > 0 && (
                <FormSection
                    title="Category Attributes"
                    description="Fill in the custom fields defined for this category"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {attributeDefs.map(def => (
                            <div key={def.id}>
                                {def.attribute_type !== 'boolean' && (
                                    <label className={labelClass}>
                                        {def.attribute_label}
                                        {def.is_required && <span className="text-rose-400 ml-1">*</span>}
                                        {def.unit && def.attribute_type !== 'number' && (
                                            <span className="text-slate-600 ml-1">({def.unit})</span>
                                        )}
                                    </label>
                                )}
                                {renderAttributeField(def)}
                            </div>
                        ))}
                    </div>
                </FormSection>
            )}
        </div>
    );
};

export default CategoryTab;
