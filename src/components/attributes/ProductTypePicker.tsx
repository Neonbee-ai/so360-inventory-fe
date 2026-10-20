import React, { useState, useEffect } from 'react';
import { Cpu, Shirt, Armchair, Monitor, Tv, Smartphone, UtensilsCrossed, Car, Hammer, Paperclip, Package, LucideIcon } from 'lucide-react';
import { Button, EmptyState } from '@so360/design-system';
import { ProductType } from '../../types/productTypes';
import { productTypeService } from '../../services/productTypeService';

const ICON_MAP: Record<string, LucideIcon> = {
    Cpu, Shirt, Armchair, Monitor, Tv, Smartphone, UtensilsCrossed, Car, Hammer, Paperclip,
};

interface ProductTypePickerProps {
    value: string;
    onChange: (id: string) => void;
}

const ProductTypePicker: React.FC<ProductTypePickerProps> = ({ value, onChange }) => {
    const [types, setTypes] = useState<ProductType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTypes();
    }, []);

    const loadTypes = async () => {
        try {
            const data = await productTypeService.getAll();
            setTypes(data);
        } catch {
            // Silently fail — product types are optional
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <p className="text-nb-body text-fg-subtle" aria-busy="true">Loading product types...</p>;
    }

    if (types.length === 0) {
        return <EmptyState title="No product types available. Create them in Settings." />;
    }

    return (
        <div className="grid grid-cols-2 wc-md:grid-cols-3 wc-lg:grid-cols-4 gap-nb-3">
            <Button
                type="button"
                variant={!value ? 'tonal' : 'secondary'}
                className="h-auto justify-start text-left py-nb-3"
                aria-pressed={!value}
                onClick={() => onChange('')}
            >
                <span className="flex flex-col items-start gap-nb-1">
                    <span className="flex items-center gap-nb-2">
                        <Package size={16} />
                        <span className="text-nb-body font-semibold">None</span>
                    </span>
                    <span className="text-nb-caption text-fg-subtle">No product type</span>
                </span>
            </Button>

            {types.map(pt => {
                const Icon = (pt.icon && ICON_MAP[pt.icon]) || Package;
                const isSelected = value === pt.id;
                return (
                    <Button
                        key={pt.id}
                        type="button"
                        variant={isSelected ? 'tonal' : 'secondary'}
                        className="h-auto justify-start text-left py-nb-3"
                        aria-pressed={isSelected}
                        onClick={() => onChange(pt.id)}
                    >
                        <span className="flex flex-col items-start gap-nb-1">
                            <span className="flex items-center gap-nb-2">
                                <Icon size={16} />
                                <span className="text-nb-body font-semibold">{pt.name}</span>
                            </span>
                            <span className="text-nb-caption text-fg-subtle line-clamp-2">{pt.description || pt.code}</span>
                            {pt.is_system && <span className="text-nb-caption text-fg-subtle">System</span>}
                        </span>
                    </Button>
                );
            })}
        </div>
    );
};

export default ProductTypePicker;
