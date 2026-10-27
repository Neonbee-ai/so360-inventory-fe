import React from 'react';
import FormSection from '../components/FormSection';
import { ITEM_CLASSIFICATIONS, ItemClassification } from '../../../types/itemTypes';
import { Unit } from '../../../types/inventory';
import { Badge, Button, Select, TextField, Textarea, FieldGrid, Grid } from '@so360/design-system';
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

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
    name, sku, type, brand, barcode, description, unit_id, uoms, product_type_id,
    showNewUom, newUomName, newUomAbbr, isCreatingUom,
    updateField, setShowNewUom, setNewUomName, setNewUomAbbr, onCreateUom,
    errors = {}, showErrors = false, isSkuAutoEnabled = true, isSkuManuallyEdited = false,
    onResetSku,
}) => {
    const errorFor = (field: string) => (showErrors ? errors[field] || undefined : undefined);

    return (
        <div className="space-y-nb-6">
            <FormSection title="Identification">
                <FieldGrid columns={3}>
                    <TextField
                        label="Item Name"
                        name="name"
                        required
                        value={name}
                        onChange={e => updateField('name', e.target.value)}
                        error={errorFor('name')}
                        placeholder="e.g. MacBook Pro 14"
                    />
                    <div>
                        {(isSkuAutoEnabled || (isSkuManuallyEdited && onResetSku)) && (
                            <div className="flex items-center justify-end gap-nb-2 mb-nb-1">
                                {isSkuAutoEnabled && (
                                    <span data-testid="sku-autogen-badge">
                                        <Badge tone={isSkuManuallyEdited ? 'neutral' : 'primary'} size="sm">
                                            {isSkuManuallyEdited ? 'Manual Override' : 'Auto-generated from Item Name'}
                                        </Badge>
                                    </span>
                                )}
                                {isSkuManuallyEdited && onResetSku && (
                                    <Button variant="ghost" size="sm" data-testid="sku-reset-btn" onClick={onResetSku}>
                                        Re-generate
                                    </Button>
                                )}
                            </div>
                        )}
                        <TextField
                            label="SKU"
                            name="sku"
                            required
                            value={sku}
                            onChange={e => updateField('sku', e.target.value)}
                            error={errorFor('sku')}
                            placeholder="e.g. LAP-001"
                        />
                    </div>
                    <TextField
                        label="Barcode / UPC"
                        name="barcode"
                        value={barcode}
                        onChange={e => updateField('barcode', e.target.value)}
                        error={errorFor('barcode')}
                        placeholder="e.g. 012345678905"
                    />
                </FieldGrid>
                <FieldGrid columns={2} className="mt-nb-4">
                    <TextField
                        label="Brand"
                        name="brand"
                        value={brand}
                        onChange={e => updateField('brand', e.target.value)}
                        error={errorFor('brand')}
                        placeholder="e.g. Apple"
                    />
                    {!showNewUom ? (
                        <Select
                            label="Unit of Measure"
                            name="unit_id"
                            required
                            value={unit_id}
                            onChange={(e: any) => {
                                if (e.target.value === '__new__') {
                                    setShowNewUom(true);
                                } else {
                                    updateField('unit_id', e.target.value);
                                }
                            }}
                            error={errorFor('unit_id')}
                            placeholder="Select unit..."
                            options={[
                                ...uoms.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })),
                                { value: '__new__', label: '+ Create new UoM' },
                            ]}
                        />
                    ) : (
                        <div className="space-y-nb-2 p-nb-3 bg-surface-raised border border-line-strong rounded-nb-md">
                            <TextField
                                name="new_uom_name"
                                value={newUomName}
                                onChange={e => setNewUomName(e.target.value)}
                                placeholder="Unit name *"
                                autoFocus
                            />
                            <TextField
                                name="new_uom_abbr"
                                value={newUomAbbr}
                                onChange={e => setNewUomAbbr(e.target.value)}
                                placeholder="Abbreviation * (e.g. pcs, kg)"
                            />
                            <div className="flex gap-nb-2">
                                <Button
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => { setShowNewUom(false); setNewUomName(''); setNewUomAbbr(''); }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1"
                                    onClick={onCreateUom}
                                    disabled={isCreatingUom || !newUomName.trim() || !newUomAbbr.trim()}
                                >
                                    {isCreatingUom ? 'Creating...' : 'Create'}
                                </Button>
                            </div>
                        </div>
                    )}
                </FieldGrid>
            </FormSection>

            <FormSection title="Classification *" description="Choose what kind of item this is">
                <Grid columns={3} gap="sm">
                    {ITEM_CLASSIFICATIONS.map(cls => {
                        const Icon = cls.icon;
                        const isSelected = type === cls.value;
                        return (
                            <button
                                key={cls.value}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => updateField('type', cls.value)}
                                className={`p-nb-3 rounded-nb-md border text-left ${
                                    isSelected ? 'border-primary bg-surface-raised' : 'border-line-strong bg-surface hover:bg-surface-raised'
                                }`}
                            >
                                <div className="flex items-center gap-nb-2 mb-nb-1">
                                    <Icon size={16} className={isSelected ? 'text-primary' : 'text-fg-subtle'} />
                                    <span className={`text-nb-body font-semibold ${isSelected ? 'text-primary' : 'text-fg-muted'}`}>{cls.label}</span>
                                </div>
                                <p className="text-nb-caption text-fg-subtle">{cls.description}</p>
                            </button>
                        );
                    })}
                </Grid>
                {errorFor('type') && <p role="alert" data-testid="error-type" className="text-danger text-nb-caption mt-nb-1">{errorFor('type')}</p>}
            </FormSection>

            <FormSection title="Product Type" description="Optional — assigns dynamic attribute fields in the Attributes tab">
                <ProductTypePicker
                    value={product_type_id}
                    onChange={(id) => updateField('product_type_id', id)}
                />
            </FormSection>

            <FormSection title="Description">
                <Textarea
                    name="description"
                    rows={4}
                    value={description}
                    onChange={e => updateField('description', e.target.value)}
                    placeholder="Product description for e-commerce listings..."
                />
            </FormSection>
        </div>
    );
};

export default BasicInfoTab;
