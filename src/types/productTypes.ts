export type AttributeFieldType = 'text' | 'number' | 'select' | 'boolean' | 'date' | 'textarea';

/**
 * Where an attribute group appears: surface key → shown.
 *
 * The keys are open-ended on purpose — the storefront ignores a surface it does
 * not know, so a new one (quick view, compare) needs no schema change. The two
 * the admin editor renders today are `card` and `pdp_specs`.
 */
export type SurfacePlacements = Record<string, boolean>;

export interface ProductTypeAttribute {
    id: string;
    product_type_id: string;
    field_name: string;
    label: string;
    field_type: AttributeFieldType;
    options?: string[];
    default_value?: string;
    is_required: boolean;
    sort_order: number;
    unit?: string;
    placeholder?: string;
    validation?: Record<string, any>;
    /** Group heading this attribute sits under; null/undefined = ungrouped. */
    group_id?: string | null;
}

export interface AttributeGroup {
    id: string;
    product_type_id: string;
    group_key: string;
    label: string;
    sort_order: number;
    placements: SurfacePlacements;
    layout?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

export interface CreateAttributeGroupInput {
    label: string;
    /** Derived from the label server-side when omitted; immutable afterwards. */
    group_key?: string;
    sort_order?: number;
    placements?: SurfacePlacements;
    layout?: Record<string, unknown>;
}

/**
 * `group_key` is deliberately not updatable — a key is a stable identifier.
 * Every field is optional because the endpoint is a PATCH: the editor sends
 * `{ placements }` to flip one surface switch and `{ sort_order }` to renumber,
 * never a whole group.
 */
export type UpdateAttributeGroupInput = Partial<Omit<CreateAttributeGroupInput, 'group_key'>>;

export interface ProductType {
    id: string;
    org_id?: string;
    name: string;
    code: string;
    description?: string;
    icon?: string;
    is_system: boolean;
    is_active: boolean;
    created_at: string;
    product_type_attributes?: ProductTypeAttribute[];
}
