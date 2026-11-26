import { normalizeTaxId } from './taxIdentifiers';
/**
 * Vendor Master form helpers (Pulse 3fc12200 + 652f492e).
 *
 * Maps the Add/Edit Vendor form to the inventory-be payload and back. The
 * backend (src/vendors/vendor-master.ts) validates and decides completeness;
 * these helpers only shape data and decide which conditional fields to show.
 * Nothing here ever claims a GSTIN/PAN is verified.
 */

export const VENDOR_MASTER_FLAG = 'submodule:inventory:vendor_master';

export function isVendorMasterEnabled(shell: any): boolean {
    try {
        return shell?.isFeatureEnabled?.(VENDOR_MASTER_FLAG) === true;
    } catch {
        return false;
    }
}

export const LEGAL_TYPE_OPTIONS = [
    { value: 'private_limited', label: 'Private limited company' },
    { value: 'public_limited', label: 'Public limited company' },
    { value: 'llp', label: 'LLP' },
    { value: 'partnership', label: 'Partnership firm' },
    { value: 'sole_proprietorship', label: 'Sole proprietorship' },
    { value: 'individual', label: 'Individual / freelancer' },
    { value: 'trust_society', label: 'Trust / society / association' },
    { value: 'government', label: 'Government / public sector' },
    { value: 'other', label: 'Other' },
];

export const SUPPLY_TYPE_OPTIONS = [
    { value: 'goods_supplier', label: 'Goods supplier' },
    { value: 'service_provider', label: 'Service provider' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'manufacturer', label: 'Manufacturer' },
    { value: 'distributor', label: 'Distributor / reseller' },
    { value: 'consultant', label: 'Consultant / professional' },
    { value: 'logistics', label: 'Logistics / transport' },
    { value: 'other', label: 'Other' },
];

export const GST_TREATMENT_OPTIONS = [
    { value: 'registered_business', label: 'Registered business' },
    { value: 'composition_dealer', label: 'Composition dealer' },
    { value: 'unregistered_business', label: 'Unregistered business' },
    { value: 'sez', label: 'SEZ unit' },
    { value: 'sez_developer', label: 'SEZ developer' },
    { value: 'overseas', label: 'Overseas' },
    { value: 'government_body', label: 'Government body' },
];

export const MSME_CATEGORY_OPTIONS = [
    { value: 'micro', label: 'Micro' },
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
];

const GST_REGISTERED = new Set(['registered_business', 'composition_dealer', 'sez', 'sez_developer']);
const COMPANY_TYPES = new Set(['private_limited', 'public_limited']);
const NATURAL_PERSON_TYPES = new Set(['individual', 'sole_proprietorship']);

/** Human labels for the backend's completeness keys. */
export const MISSING_FIELD_LABELS: Record<string, string> = {
    name: 'Vendor name',
    legal_type: 'Vendor type',
    legal_entity_name: 'Legal registered name',
    primary_contact: 'Primary contact (email or phone)',
    registered_address: 'Registered address (line 1, city, country)',
    payment_terms: 'Payment terms or credit days',
    pan_number: 'PAN',
    gst_number: 'GSTIN',
    gst_treatment: 'GST treatment',
    llpin: 'LLPIN',
    registration_number: 'CIN / company registration number',
    udyam_number: 'Udyam registration number',
    msme_category: 'MSME category',
    tds_section: 'TDS section',
    accounts_contact: 'Accounts contact',
    bank_account: 'Bank account',
    currency: 'Currency',
};

export const missingLabels = (keys: string[] | undefined): string[] =>
    (keys ?? []).map((k) => MISSING_FIELD_LABELS[k] ?? k);

export interface AddressForm {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
}

export interface ContactForm {
    name: string;
    designation: string;
    email: string;
    phone: string;
    alt_phone: string;
}

export interface VendorMasterForm {
    name: string;
    legal_entity_name: string;
    business_name: string;
    vendor_code: string;
    legal_type: string;
    legal_type_other: string;
    supply_types: string[];
    classification: string;
    industry: string;
    website: string;
    year_established: string;
    description: string;
    registration_country: string;
    registration_state: string;
    registration_number: string;
    llpin: string;
    registration_authority: string;
    registration_date: string;
    gst_treatment: string;
    gst_number: string;
    pan_number: string;
    vat_number: string;
    msme_registered: boolean;
    udyam_number: string;
    msme_category: string;
    registered_address: AddressForm;
    billing_same: boolean;
    billing_address: AddressForm;
    shipping_same: boolean;
    shipping_address: AddressForm;
    primary_contact: ContactForm;
    accounts_contact: ContactForm;
    payment_terms: string;
    credit_days: string;
    credit_limit: string;
    currency: string;
    tds_applicable: boolean;
    tds_section: string;
    opening_balance: string;
    opening_balance_date: string;
    is_preferred: boolean;
}

export const emptyAddress = (): AddressForm => ({
    line1: '', line2: '', city: '', state: '', postal_code: '', country: '',
});

export const emptyContact = (): ContactForm => ({
    name: '', designation: '', email: '', phone: '', alt_phone: '',
});

export function emptyVendorMasterForm(baseCurrency = ''): VendorMasterForm {
    return {
        name: '', legal_entity_name: '', business_name: '', vendor_code: '',
        legal_type: '', legal_type_other: '', supply_types: [], classification: 'supplier',
        industry: '', website: '', year_established: '', description: '',
        registration_country: '', registration_state: '', registration_number: '', llpin: '',
        registration_authority: '', registration_date: '',
        gst_treatment: '', gst_number: '', pan_number: '', vat_number: '',
        msme_registered: false, udyam_number: '', msme_category: '',
        registered_address: emptyAddress(),
        billing_same: true, billing_address: emptyAddress(),
        shipping_same: true, shipping_address: emptyAddress(),
        primary_contact: emptyContact(), accounts_contact: emptyContact(),
        payment_terms: 'Net 30', credit_days: '', credit_limit: '', currency: baseCurrency.toUpperCase(),
        tds_applicable: false, tds_section: '', opening_balance: '', opening_balance_date: '',
        is_preferred: false,
    };
}

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

function toAddressForm(a: any): AddressForm {
    return {
        line1: s(a?.line1), line2: s(a?.line2), city: s(a?.city), state: s(a?.state),
        postal_code: s(a?.postal_code), country: s(a?.country),
    };
}

function toContactForm(c: any): ContactForm {
    return {
        name: s(c?.name), designation: s(c?.designation), email: s(c?.email),
        phone: s(c?.phone), alt_phone: s(c?.alt_phone),
    };
}

const sameAddress = (a: AddressForm, b: AddressForm) =>
    (Object.keys(a) as Array<keyof AddressForm>).every((k) => a[k].trim() === b[k].trim());

const isBlankAddress = (a: AddressForm) => Object.values(a).every((v) => v.trim() === '');

/** GET /vendors/detail/:id response → form state (edit mode). */
export function vendorToForm(vendor: any, baseCurrency = ''): VendorMasterForm {
    const p = vendor?.vendor_profiles?.[0] ?? {};
    const contacts: any[] = Array.isArray(p.contacts) ? p.contacts : [];
    const primary = contacts.find((c) => c?.role === 'primary');
    const accounts = contacts.find((c) => c?.role === 'accounts');
    const registered = toAddressForm(p.registered_address);
    const billing = toAddressForm(vendor?.billing_address);
    const shipping = toAddressForm(vendor?.shipping_address);
    return {
        ...emptyVendorMasterForm(baseCurrency),
        name: s(vendor?.name),
        legal_entity_name: s(vendor?.legal_entity_name),
        business_name: s(vendor?.business_name),
        vendor_code: s(p.vendor_code),
        legal_type: s(p.legal_type),
        legal_type_other: s(p.legal_type_other),
        supply_types: Array.isArray(p.supply_types) ? p.supply_types : [],
        classification: s(p.classification) || 'supplier',
        industry: s(p.industry),
        website: s(vendor?.website),
        year_established: s(p.year_established),
        description: s(p.description),
        registration_country: s(p.registration_country),
        registration_state: s(p.registration_state),
        registration_number: s(p.registration_number),
        llpin: s(p.llpin),
        registration_authority: s(p.registration_authority),
        registration_date: s(p.registration_date),
        gst_treatment: s(vendor?.gst_treatment),
        gst_number: s(vendor?.gst_number),
        pan_number: s(vendor?.pan_number),
        vat_number: s(vendor?.vat_number),
        msme_registered: p.msme_registered === true,
        udyam_number: s(p.udyam_number),
        msme_category: s(p.msme_category),
        registered_address: registered,
        billing_same: isBlankAddress(billing) || sameAddress(billing, registered),
        billing_address: billing,
        shipping_same: isBlankAddress(shipping) || sameAddress(shipping, registered),
        shipping_address: shipping,
        primary_contact: primary
            ? toContactForm(primary)
            : { ...emptyContact(), name: '', email: s(vendor?.email), phone: s(vendor?.phone) },
        accounts_contact: toContactForm(accounts),
        payment_terms: s(p.payment_terms) || 'Net 30',
        credit_days: s(p.credit_days),
        credit_limit: s(p.credit_limit),
        currency: s(p.currency) || baseCurrency.toUpperCase(),
        tds_applicable: p.tds_applicable === true,
        tds_section: s(p.tds_section),
        opening_balance: s(p.opening_balance),
        opening_balance_date: s(p.opening_balance_date),
        is_preferred: p.is_preferred === true,
    };
}

/** True when India-specific identifiers apply (registration or address country India). */
export function isIndianVendor(f: VendorMasterForm): boolean {
    const c = (f.registration_country || f.registered_address.country).trim().toUpperCase();
    return c === 'IN' || c === 'IND' || c === 'INDIA';
}

/** Which conditional fields the form shows, so India/company-only fields never burden others. */
export function visibleFields(f: VendorMasterForm) {
    const india = isIndianVendor(f);
    return {
        india,
        legalTypeOther: f.legal_type === 'other',
        legalName: !NATURAL_PERSON_TYPES.has(f.legal_type),
        gstin: india && GST_REGISTERED.has(f.gst_treatment),
        cin: india && COMPANY_TYPES.has(f.legal_type),
        llpin: f.legal_type === 'llp',
        vat: !india,
        msmeDetails: f.msme_registered,
        tdsSection: f.tds_applicable,
        billingAddress: !f.billing_same,
        shippingAddress: !f.shipping_same,
    };
}

const t = (v: string) => (v.trim() === '' ? null : v.trim());
const num = (v: string) => (v.trim() === '' ? null : Number(v));

function addressPayload(a: AddressForm): Record<string, string> | null {
    const out: Record<string, string> = {};
    (Object.keys(a) as Array<keyof AddressForm>).forEach((k) => {
        if (a[k].trim()) out[k] = a[k].trim();
    });
    return Object.keys(out).length ? out : null;
}

function contactPayload(role: 'primary' | 'accounts', c: ContactForm) {
    if (!c.name.trim()) return null;
    const out: Record<string, string> = { role, name: c.name.trim() };
    (['designation', 'email', 'phone', 'alt_phone'] as const).forEach((k) => {
        if (c[k].trim()) out[k] = c[k].trim();
    });
    return out;
}

/**
 * Form → POST/PATCH body. Hidden conditional fields are sent as null so a
 * switch (e.g. MSME off, foreign vendor) clears stale values instead of
 * keeping them. `status` is the onboarding state the user asked for.
 */
export function formToPayload(f: VendorMasterForm, status: 'draft' | 'active') {
    const v = visibleFields(f);
    const registered = addressPayload(f.registered_address);
    const primary = contactPayload('primary', f.primary_contact);
    const accounts = contactPayload('accounts', f.accounts_contact);
    return {
        name: f.name.trim(),
        legal_entity_name: v.legalName ? t(f.legal_entity_name) : null,
        business_name: t(f.business_name),
        // The partner row keeps the primary contact's email/phone as the
        // vendor's own, which lists, POs and search already read.
        email: t(f.primary_contact.email),
        phone: t(f.primary_contact.phone),
        website: t(f.website),
        gst_treatment: v.india ? t(f.gst_treatment) : null,
        gst_number: v.gstin ? normalizeTaxId(f.gst_number) : null,
        pan_number: v.india ? normalizeTaxId(f.pan_number) : null,
        vat_number: v.vat ? t(f.vat_number) : null,
        billing_address: v.billingAddress ? addressPayload(f.billing_address) : registered,
        shipping_address: v.shippingAddress ? addressPayload(f.shipping_address) : registered,
        vendor_profile: {
            ...(t(f.vendor_code) ? { vendor_code: f.vendor_code.trim() } : {}),
            legal_type: t(f.legal_type),
            legal_type_other: v.legalTypeOther ? t(f.legal_type_other) : null,
            supply_types: f.supply_types,
            classification: t(f.classification),
            industry: t(f.industry),
            year_established: num(f.year_established),
            description: t(f.description),
            registration_country: t(f.registration_country)?.toUpperCase() ?? null,
            registration_state: t(f.registration_state),
            registration_number: t(f.registration_number),
            llpin: v.llpin ? t(f.llpin) : null,
            registration_authority: t(f.registration_authority),
            registration_date: t(f.registration_date),
            msme_registered: f.msme_registered,
            udyam_number: v.msmeDetails ? t(f.udyam_number) : null,
            msme_category: v.msmeDetails ? t(f.msme_category) : null,
            registered_address: registered,
            contacts: [primary, accounts].filter(Boolean),
            payment_terms: t(f.payment_terms),
            credit_days: num(f.credit_days),
            credit_limit: num(f.credit_limit),
            currency: t(f.currency)?.toUpperCase() ?? null,
            tds_applicable: f.tds_applicable,
            tds_section: v.tdsSection ? t(f.tds_section) : null,
            opening_balance: num(f.opening_balance),
            opening_balance_date: t(f.opening_balance_date),
            is_preferred: f.is_preferred,
            onboarding_status: status,
        },
    };
}
