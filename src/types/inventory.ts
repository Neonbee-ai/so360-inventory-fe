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
    /** Square 1:1 image shown on category tiles. */
    image_url?: string | null;
    /** Wide 16:5 hero at the top of the category page (absent until migration 052). */
    banner_url?: string | null;
    color?: string | null;
    sort_order?: number;
    /** Storefront URL segment (`/c/<slug>`); the DB derives one from the name when blank. */
    slug?: string | null;
    /** Search-result headline, ≤70 chars (absent until migration 057). */
    meta_title?: string | null;
    /** Search-result snippet, ≤160 chars (absent until migration 057). */
    meta_description?: string | null;
    /** Alt text for banner_url, ≤200 chars (absent until migration 057). */
    banner_alt?: string | null;
    /** Real-estate project details (submodule:inventory:property_units). */
    metadata?: CategoryMetadata | null;
}

/** Project-level details kept on a root category when property units are on. */
export interface CategoryMetadata {
    developer_partner_id?: string | null;
    location?: string | null;
    handover?: string | null;
    brochure_url?: string | null;
    // RFP §4 project fields (validated by the backend's category-metadata rules).
    project_code?: string | null;
    project_status?: ProjectStatus | null;
    launch_date?: string | null;
    completion_date?: string | null;
    city?: string | null;
    country?: string | null;
    property_types?: string[] | null;
    price_range?: { min?: number | null; max?: number | null } | null;
    /** Legacy free text — read-only once structured templates exist. */
    payment_plan?: string | null;
    /** Structured instalment templates (RE Phase C, max 10). */
    payment_plan_templates?: PaymentPlanTemplate[] | null;
    commission_percent?: number | null;
    description?: string | null;
    amenities?: string[] | null;
    images?: string[] | null;
    videos?: string[] | null;
    floor_plans?: string[] | null;
    documents?: string[] | null;
    map?: { lat?: number | null; lng?: number | null; url?: string | null } | null;
    assigned_user_ids?: string[] | null;
    assigned_team_ids?: string[] | null;
}

export const INSTALMENT_TRIGGERS = [
    'booking',
    'fixed_date',
    'days_after_booking',
    'milestone',
    'handover',
    'months_after_handover',
] as const;
export type InstalmentTrigger = (typeof INSTALMENT_TRIGGERS)[number];

export const PAYMENT_PLAN_LINE_TYPES = ['percent', 'fixed'] as const;
export type PaymentPlanLineType = (typeof PAYMENT_PLAN_LINE_TYPES)[number];

export const BILLING_MODES = ['full_invoice', 'invoice_per_instalment', 'schedule_only'] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export const PAYMENT_MODES = ['cash', 'cheque', 'pdc', 'bank_transfer', 'mortgage', 'card', 'escrow'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/**
 * One instalment. `offset` is days (days_after_booking) or months
 * (months_after_handover); `date` is an ISO date (fixed_date); `milestone`
 * is free text (milestone). Each is null for any other trigger.
 */
export interface PaymentPlanLine {
    label: string;
    type: PaymentPlanLineType;
    value: number;
    trigger: InstalmentTrigger;
    offset: number | null;
    date: string | null;
    milestone: string | null;
}

export interface PaymentPlanTemplate {
    id: string;
    name: string;
    is_default: boolean;
    /** null = the org default. */
    billing_mode: BillingMode | null;
    /** null = every mode the org allows. */
    allowed_modes: PaymentMode[] | null;
    lines: PaymentPlanLine[];
}

export const PROJECT_STATUSES = ['planned', 'launched', 'under_construction', 'ready', 'completed', 'on_hold'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** A Core partner in the developer role, shaped for the project views. */
export interface DeveloperProfile {
    id: string;
    name: string;
    company: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    country: string | null;
    description: string | null;
    logo_url: string | null;
    account_manager: string | null;
    /** User id of the account manager (Core partners.account_manager_user_id). */
    account_manager_user_id: string | null;
    status: string | null;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface UnitStackSpec {
    stack: string;
    bedrooms?: number | null;
    area_sqft?: number | null;
    view?: string | null;
    price?: number | null;
}

export interface GenerateUnitsDto {
    floor_from: number;
    floor_to: number;
    units_per_floor: number;
    numbering_pattern: string;
    sku_prefix: string;
    stacks: UnitStackSpec[];
}

export interface GenerateUnitsResult {
    created: number;
    skipped: number;
}

/** Manual statuses that win over the stock/reservation-derived one. */
export const UNIT_STATUS_OVERRIDES = ['blocked', 'cancelled', 'unavailable'] as const;
export type UnitStatusOverride = (typeof UNIT_STATUS_OVERRIDES)[number];
export type UnitStatus = 'available' | 'on_hold' | 'sold' | UnitStatusOverride;

export interface UnitStatusCounts {
    total: number;
    available: number;
    on_hold: number;
    sold: number;
    blocked: number;
    cancelled: number;
    unavailable: number;
}

export interface AvailabilityTower extends UnitStatusCounts {
    category_id: string;
    name: string;
}

/** The reservation tying a unit to a sale; buyer and agent live on the referenced record. */
export interface UnitDealRef {
    reference_type: string;
    reference_id: string;
    reservation_status: 'active' | 'committed';
    reserved_at: string | null;
    sold_at: string | null;
}

export interface AvailabilityUnit {
    item_id: string;
    /** Tower the unit belongs to (absent on a single-tower response). */
    category_id?: string;
    unit_number: string;
    floor: number;
    stack: string;
    bedrooms?: number | null;
    price?: number | null;
    status: UnitStatus;
    hold?: { reference_type: string; reference_id: string; expires_at: string | null } | null;
    area_sqft?: number | null;
    view?: string | null;
    property_type?: string | null;
    bathrooms?: number | null;
    built_up_area?: number | null;
    plot_area?: number | null;
    original_price?: number | null;
    discount?: number | null;
    final_price?: number | null;
    /** Blank means the org currency. */
    currency?: string | null;
    status_override?: UnitStatusOverride | null;
    status_override_reason?: string | null;
    deal_ref?: UnitDealRef | null;
}

/** A unit's own agent / team override (items.custom_attributes). */
export interface UnitAllocation {
    assigned_user_ids: string[] | null;
    assigned_team_ids: string[] | null;
}

/** Partner roles offered by the project Developer picker. */
export type DeveloperRole = 'developer' | 'property_owner';

/** A user or team offered by the agent pickers. */
export interface AgentOption {
    id: string;
    name: string;
    detail?: string;
}

export interface DeveloperOption {
    id: string;
    name: string;
    role: DeveloperRole;
}

/** Fields the developer card may change on the Core partner. */
export interface DeveloperUpdate {
    website?: string;
    logo_url?: string;
    status?: 'active' | 'inactive';
    account_manager_user_id?: string;
}

export interface ProjectAvailability {
    /** Whole-project counts from the backend; absent on an older backend. */
    totals?: UnitStatusCounts;
    towers: AvailabilityTower[];
    units: AvailabilityUnit[];
}

export interface UnitStatusOverrideResult {
    item_id: string;
    status_override: UnitStatusOverride | null;
    status_override_reason: string | null;
    status_override_at: string | null;
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
    /** Natural size of each photo (absent until migration 051 / first save). */
    image_meta?: Array<{ url: string; width: number; height: number }>;
    /** Server-derived: a photo is under 800px or far from square. */
    image_needs_attention?: boolean;
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
    /** Data Layer Class B values (org-defined custom fields for inventory.item). */
    custom_fields?: Record<string, unknown>;
    /** Optimistic-concurrency version when the backend exposes one (else updated_at). */
    version?: number;
    /** Class B optimistic-concurrency token (bumped on every custom_fields write). */
    custom_fields_version?: number;
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
    min_value?: number | null;
    max_value?: number | null;
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
