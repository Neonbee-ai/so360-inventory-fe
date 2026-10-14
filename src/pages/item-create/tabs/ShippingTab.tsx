import React from 'react';
import FormSection from '../components/FormSection';

interface ShippingTabProps {
    weight: string;
    weight_unit: string;
    dimensions_length: string;
    dimensions_width: string;
    dimensions_height: string;
    dimensions_unit: string;
    updateField: (field: string, value: any) => void;
}

const inputClass = 'w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2.5 text-fg focus:outline-none focus:ring-2 focus:ring-focus/50 focus:border-primary transition-all placeholder:text-fg-subtle';
const labelClass = 'block text-sm font-medium text-fg-muted mb-1.5';

const ShippingTab: React.FC<ShippingTabProps> = ({
    weight, weight_unit, dimensions_length, dimensions_width, dimensions_height, dimensions_unit,
    updateField,
}) => {
    return (
        <div className="space-y-8">
            <FormSection title="Weight" description="Used for shipping cost calculations">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Weight</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={weight}
                            onChange={e => updateField('weight', e.target.value)}
                            className={inputClass}
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Weight Unit</label>
                        <select
                            value={weight_unit}
                            onChange={e => updateField('weight_unit', e.target.value)}
                            className={inputClass}
                        >
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="lb">lb</option>
                            <option value="oz">oz</option>
                        </select>
                    </div>
                </div>
            </FormSection>

            <FormSection title="Dimensions (L x W x H)" description="Package dimensions for shipping">
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <label className={labelClass}>Length</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={dimensions_length}
                            onChange={e => updateField('dimensions_length', e.target.value)}
                            className={inputClass}
                            placeholder="L"
                        />
                    </div>
                    <span className="text-fg-subtle pb-3">&times;</span>
                    <div className="flex-1">
                        <label className={labelClass}>Width</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={dimensions_width}
                            onChange={e => updateField('dimensions_width', e.target.value)}
                            className={inputClass}
                            placeholder="W"
                        />
                    </div>
                    <span className="text-fg-subtle pb-3">&times;</span>
                    <div className="flex-1">
                        <label className={labelClass}>Height</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={dimensions_height}
                            onChange={e => updateField('dimensions_height', e.target.value)}
                            className={inputClass}
                            placeholder="H"
                        />
                    </div>
                    <div className="w-20 flex-shrink-0">
                        <label className={labelClass}>Unit</label>
                        <select
                            value={dimensions_unit}
                            onChange={e => updateField('dimensions_unit', e.target.value)}
                            className={inputClass}
                        >
                            <option value="cm">cm</option>
                            <option value="in">in</option>
                            <option value="mm">mm</option>
                            <option value="m">m</option>
                        </select>
                    </div>
                </div>
            </FormSection>
        </div>
    );
};

export default ShippingTab;
