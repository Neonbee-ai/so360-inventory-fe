import type { CategoryMetadata, DeveloperProfile, ItemCategory } from '../types/inventory';

const text = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t ? t : null;
};

/** First non-blank string among the candidates. */
const pick = (...vals: unknown[]): string | null => {
    for (const v of vals) {
        const t = text(v);
        if (t) return t;
    }
    return null;
};

const ADDRESS_PARTS = ['line1', 'address_line1', 'street', 'line2', 'address_line2', 'city', 'state', 'postal_code', 'zip', 'country'];

/** Address columns are free text on older partners and a JSON object on newer ones. */
export function formatAddress(v: unknown): string | null {
    if (typeof v === 'string') return text(v);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const a = v as Record<string, unknown>;
    const parts = ADDRESS_PARTS.map((k) => text(a[k])).filter((x): x is string => !!x);
    return parts.length ? parts.join(', ') : null;
}

const addressCountry = (v: unknown): string | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? text((v as Record<string, unknown>).country) : null;

/**
 * Shape a Core partner row into the developer card. Core partners have no
 * dedicated logo / website / status / account-manager columns yet, so those
 * are read from the row when present and then from `metadata`.
 */
export function toDeveloperProfile(p: any, primaryContact?: any): DeveloperProfile {
    const row = p && typeof p === 'object' ? p : {};
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const contact = primaryContact && typeof primaryContact === 'object' ? primaryContact : {};
    const address = row.address ?? row.billing_address ?? meta.address;
    return {
        id: String(row.id ?? ''),
        name: pick(row.name, row.display_name, row.business_name) || 'Developer',
        company: pick(row.business_name, row.company_name, meta.company),
        contact_name: pick(contact.contact_name, contact.name, row.contact_person, meta.contact_name),
        email: pick(row.email, contact.contact_email),
        phone: pick(row.phone, contact.contact_phone),
        website: pick(row.website, meta.website),
        address: formatAddress(address),
        country: pick(row.country, meta.country, addressCountry(address)),
        description: pick(row.description, meta.description),
        logo_url: pick(row.logo_url, meta.logo_url),
        account_manager: pick(row.account_manager_name, meta.account_manager_name, meta.account_manager),
        status: pick(row.status, meta.status) || (row.is_active === false ? 'inactive' : row.is_active === true ? 'active' : null),
        notes: pick(row.notes, meta.notes),
        created_at: pick(row.created_at),
        updated_at: pick(row.updated_at),
    };
}

/** Root categories (projects) whose developer is this partner, by name. */
export function projectsOfDeveloper(
    categories: Pick<ItemCategory, 'id' | 'name' | 'parent_id' | 'metadata'>[],
    partnerId: string | null | undefined,
): { id: string; name: string; metadata?: CategoryMetadata | null }[] {
    if (!partnerId) return [];
    return (categories || [])
        .filter((c) => c && !c.parent_id && c.metadata?.developer_partner_id === partnerId)
        .map((c) => ({ id: c.id, name: c.name, metadata: c.metadata }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
