import React, { useEffect, useState } from 'react';
import { Sliders } from 'lucide-react';
import { FieldGrid } from '@so360/design-system';
import { ProductType, ProductTypeAttribute } from '../../../types/productTypes';
import { productTypeService } from '../../../services/productTypeService';
import DynamicAttributeField from '../../../components/attributes/DynamicAttributeField';
import FormSection from '../components/FormSection';

interface AttributesTabProps {
    product_type_id: string;
    custom_attributes: Record<string, any>;
    updateField: (field: string, value: any) => void;
}

const AttributesTab: React.FC<AttributesTabProps> = ({ product_type_id, custom_attributes, updateField }) => {
    const [productType, setProductType] = useState<ProductType | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!product_type_id) {
            setProductType(null);
            return;
        }
        loadProductType(product_type_id);
    }, [product_type_id]);

    const loadProductType = async (id: string) => {
        setLoading(true);
        try {
            const data = await productTypeService.getOne(id);
            setProductType(data);
        } catch {
            setProductType(null);
        } finally {
            setLoading(false);
        }
    };

    const handleAttributeChange = (fieldName: string, value: any) => {
        updateField('custom_attributes', {
            ...custom_attributes,
            [fieldName]: value,
        });
    };

    if (!product_type_id) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Sliders size={48} className="text-fg-subtle mb-4" />
                <h3 className="text-lg font-semibold text-fg-muted mb-2">No Product Type Selected</h3>
                <p className="text-sm text-fg-subtle max-w-md">
                    Select a product type on the <span className="text-primary font-medium">Basic Info</span> tab to see
                    type-specific attributes here.
                </p>
            </div>
        );
    }

    if (loading) {
        return <div className="text-sm text-fg-subtle animate-pulse py-8 text-center">Loading attributes...</div>;
    }

    if (!productType || !productType.product_type_attributes || productType.product_type_attributes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Sliders size={48} className="text-fg-subtle mb-4" />
                <h3 className="text-lg font-semibold text-fg-muted mb-2">{productType?.name || 'Product Type'}</h3>
                <p className="text-sm text-fg-subtle">No attribute fields defined for this product type.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <FormSection
                title={`${productType.name} Attributes`}
                description={`Fill in the type-specific fields for ${productType.name.toLowerCase()}`}
            >
                <FieldGrid columns={2}>
                    {productType.product_type_attributes.map((attr: ProductTypeAttribute) => (
                        <DynamicAttributeField
                            key={attr.id}
                            attribute={attr}
                            value={custom_attributes[attr.field_name]}
                            onChange={handleAttributeChange}
                        />
                    ))}
                </FieldGrid>
            </FormSection>
        </div>
    );
};

export default AttributesTab;
