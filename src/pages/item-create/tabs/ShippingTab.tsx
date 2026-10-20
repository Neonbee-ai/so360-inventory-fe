import React from 'react';
import { Select, TextField, FieldGrid } from '@so360/design-system';
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

const ShippingTab: React.FC<ShippingTabProps> = ({
    weight, weight_unit, dimensions_length, dimensions_width, dimensions_height, dimensions_unit,
    updateField,
}) => {
    const dim = (label: string, field: string, value: string, ph: string) => (
        <div className="flex-1">
            <TextField
                label={label}
                name={field}
                type="number"
                step="0.1"
                min="0"
                value={value}
                onChange={e => updateField(field, e.target.value)}
                placeholder={ph}
            />
        </div>
    );
    return (
        <div className="space-y-nb-6">
            <FormSection title="Weight" description="Used for shipping cost calculations">
                <FieldGrid columns={2}>
                    <TextField
                        label="Weight"
                        name="weight"
                        type="number"
                        step="0.01"
                        min="0"
                        value={weight}
                        onChange={e => updateField('weight', e.target.value)}
                        placeholder="0.00"
                    />
                    <Select
                        label="Weight Unit"
                        name="weight_unit"
                        value={weight_unit}
                        onChange={(e: any) => updateField('weight_unit', e.target.value)}
                        options={['kg', 'g', 'lb', 'oz'].map(u => ({ value: u, label: u }))}
                    />
                </FieldGrid>
            </FormSection>

            <FormSection title="Dimensions (L x W x H)" description="Package dimensions for shipping">
                <div className="flex gap-nb-2 items-end">
                    {dim('Length', 'dimensions_length', dimensions_length, 'L')}
                    <span className="text-fg-subtle pb-nb-3">&times;</span>
                    {dim('Width', 'dimensions_width', dimensions_width, 'W')}
                    <span className="text-fg-subtle pb-nb-3">&times;</span>
                    {dim('Height', 'dimensions_height', dimensions_height, 'H')}
                    <div className="w-24 flex-shrink-0">
                        <Select
                            label="Unit"
                            name="dimensions_unit"
                            value={dimensions_unit}
                            onChange={(e: any) => updateField('dimensions_unit', e.target.value)}
                            options={['cm', 'in', 'mm', 'm'].map(u => ({ value: u, label: u }))}
                        />
                    </div>
                </div>
            </FormSection>
        </div>
    );
};

export default ShippingTab;
