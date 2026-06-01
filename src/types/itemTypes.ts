import { Package, Wrench, Layers, Factory, Flame, Building2, Boxes, LucideIcon } from 'lucide-react';

export type ItemClassification = 'product' | 'service' | 'raw_material' | 'finished_good' | 'consumable' | 'fixed_asset' | 'bundle';

export interface ClassificationOption {
    value: ItemClassification;
    label: string;
    description: string;
    icon: LucideIcon;
}

export const ITEM_CLASSIFICATIONS: ClassificationOption[] = [
    { value: 'product', label: 'Product', description: 'Finished product for sale', icon: Package },
    { value: 'service', label: 'Service', description: 'Intangible service offering', icon: Wrench },
    { value: 'raw_material', label: 'Raw Material', description: 'Input material for production', icon: Layers },
    { value: 'finished_good', label: 'Finished Good', description: 'Manufactured output ready for sale', icon: Factory },
    { value: 'consumable', label: 'Consumable', description: 'Supplies consumed during operations', icon: Flame },
    { value: 'fixed_asset', label: 'Fixed Asset', description: 'Long-term tangible asset', icon: Building2 },
    { value: 'bundle', label: 'Bundle', description: 'Kit of multiple component items sold together', icon: Boxes },
];

export type TabId = 'basic' | 'media' | 'pricing' | 'category' | 'stock' | 'shipping' | 'attributes';

export interface TabConfig {
    id: TabId;
    label: string;
    icon: LucideIcon;
}

export const TAB_CONFIG: TabConfig[] = [
    { id: 'basic', label: 'Basic Info', icon: Package },
    { id: 'media', label: 'Media', icon: Package },
    { id: 'pricing', label: 'Pricing', icon: Package },
    { id: 'category', label: 'Category', icon: Package },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'shipping', label: 'Shipping', icon: Package },
    { id: 'attributes', label: 'Attributes', icon: Package },
];
