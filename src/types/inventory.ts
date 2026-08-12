export interface Unit {
    id: string;
    name: string;
    abbreviation: string;
}

export interface ItemCategory {
    id: string;
    name: string;
    description?: string;
    parent_id?: string;
    children?: ItemCategory[];
    icon_url?: string | null;
    image_url?: string | null;
    color?: string | null;
    sort_order?: number;
}

export interface Item {
    id: string;
    sku: string;
    name: string;
    type: 'product' | 'service' | 'raw_material' | 'finished_good' | 'consumable' | 'fixed_asset';
    is_active: boolean;
    is_batch_tracked: boolean;
    is_serial_tracked: boolean;
    min_stock_threshold: number;
    unit_id?: string;
    category_id?: string;
    units?: Unit;
    item_categories?: ItemCategory;
    price?: number;
    cost?: number;
    description?: string;
    image_urls?: string[];
    barcode?: string;
    brand?: string;
    hsn_code?: string;
    tax_class?: string;
    weight?: number;
    weight_unit?: string;
    dimensions?: { length?: number; width?: number; height?: number; unit?: string };
    reorder_level?: number;
    product_type_id?: string;
    custom_attributes?: Record<string, any>;
    product_types?: {
        id: string;
        name: string;
        code: string;
        icon?: string;
        product_type_attributes?: Array<{
            id: string;
            field_name: string;
            label: string;
            field_type: string;
            options?: string[];
            unit?: string;
            sort_order: number;
        }>;
    };
    metadata?: Record<string, any>;
    cost_center_id?: string;
    default_warehouse_id?: string;
    is_online_visible?: boolean;
    lifecycle_flow_instance_id?: string;
    tax_code_id?: string;
    product_status?: string;
    created_at?: string;
    updated_at?: string;
}

export interface WarehouseBin {
    id: string;
    location_id: string;
    code: string;
    capacity_metadata?: Record<string, any>;
    is_active: boolean;
    created_at?: string;
}

export interface WarehouseLocation {
    id: string;
    warehouse_id: string;
    name: string;
    code: string;
    is_active: boolean;
    created_at?: string;
    warehouse_bins?: WarehouseBin[];
}

export interface Warehouse {
    id: string;
    name: string;
    code: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    contact_person?: string;
    contact_phone?: string;
    warehouse_type?: string;
    is_active: boolean;
    warehouse_locations?: WarehouseLocation[];
}

export interface StockBalance {
    id: string;
    item_id: string;
    warehouse_id: string;
    location_id?: string;
    batch_id?: string;
    quantity: number;
    valuation: number;
    last_updated_at: string;
    items: Item;
    warehouses: Warehouse;
    warehouse_locations?: { name: string };
}

export interface StockMovement {
    id: string;
    item_id: string;
    warehouse_id: string;
    type: 'inbound' | 'outbound' | 'transfer' | 'adjustment';
    movement_type?: string;
    quantity: number;
    reason_code?: string;
    reference_type?: string;
    created_at: string;
    items: Item;
    warehouses: Warehouse;
    // Movement register fields (migration 042) — null on pre-migration rows
    reference_number?: string | null;
    project_id?: string | null;
    work_order_id?: string | null;
    project_name_snapshot?: string | null;
    work_order_number_snapshot?: string | null;
    source_type?: string | null;
    source_ref_id?: string | null;
    source_label?: string | null;
    balance_before?: number | null;
    balance_after?: number | null;
    remarks?: string | null;
    transaction_date?: string | null;
    is_backdated?: boolean;
    created_by?: string | null;
}

export interface ItemAttributeDefinition {
    id: string;
    org_id: string;
    tenant_id: string;
    category_id?: string | null;
    attribute_key: string;
    attribute_label: string;
    attribute_type: 'text' | 'number' | 'currency' | 'select' | 'multi_select' | 'date' | 'boolean' | 'radio' | 'textarea' | 'file';
    options?: { value: string; label: string }[] | null;
    unit?: string | null;
    description?: string | null;
    is_required: boolean;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
}

export interface InventorySettings {
    uoms: string[];
    categories: string[];
}

export interface User {
    id: string;
    full_name: string;
    email: string;
    role?: 'Inventory Admin' | 'Inventory User' | 'View Only' | 'Admin';
}
