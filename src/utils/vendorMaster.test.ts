import { describe, it, expect } from 'vitest';
import {
    VENDOR_MASTER_FLAG, emptyVendorMasterForm, formToPayload, isIndianVendor, isVendorMasterEnabled,
    missingLabels, vendorToForm, visibleFields,
} from './vendorMaster';

/** BDD: Vendor Master form helpers (Pulse 3fc12200 + 652f492e). */

const ADDR = { line1: '12 MG Road', line2: '', city: 'Kochi', state: 'Kerala', postal_code: '682001', country: 'IN' };

describe('isVendorMasterEnabled', () => {
    it('Given the flag on / Then true; off, missing shell or a throwing shell / Then false', () => {
        expect(isVendorMasterEnabled({ isFeatureEnabled: (k: string) => k === VENDOR_MASTER_FLAG })).toBe(true);
        expect(isVendorMasterEnabled({ isFeatureEnabled: () => false })).toBe(false);
        expect(isVendorMasterEnabled(null)).toBe(false);
        expect(isVendorMasterEnabled({ isFeatureEnabled: () => { throw new Error('x'); } })).toBe(false);
    });
});

describe('missingLabels', () => {
    it('Given backend keys / Then human labels, unknown keys pass through', () => {
        expect(missingLabels(['pan_number', 'mystery'])).toEqual(['PAN', 'mystery']);
        expect(missingLabels(undefined)).toEqual([]);
    });
});

describe('emptyVendorMasterForm', () => {
    it('Given the org currency / Then the form starts with it, Net 30 and both addresses same as registered', () => {
        const f = emptyVendorMasterForm('inr');
        expect(f).toMatchObject({ currency: 'INR', payment_terms: 'Net 30', billing_same: true, shipping_same: true, classification: 'supplier' });
        expect(emptyVendorMasterForm().currency).toBe('');
    });
});

describe('isIndianVendor / visibleFields', () => {
    it('Given an Indian GST-registered private company / Then GSTIN, PAN, CIN show and VAT hides', () => {
        const f = { ...emptyVendorMasterForm(), registration_country: 'IN', gst_treatment: 'registered_business', legal_type: 'private_limited' };
        expect(visibleFields(f)).toMatchObject({ india: true, gstin: true, cin: true, vat: false, legalName: true, llpin: false });
    });

    it('Given India only via the registered address (name) / Then India rules apply', () => {
        expect(isIndianVendor({ ...emptyVendorMasterForm(), registered_address: { ...ADDR, country: 'India' } })).toBe(true);
        expect(isIndianVendor({ ...emptyVendorMasterForm(), registered_address: { ...ADDR, country: 'IND' } })).toBe(true);
    });

    it('Given a foreign individual / Then no India ids, no legal name, VAT shown', () => {
        const f = { ...emptyVendorMasterForm(), registration_country: 'AE', legal_type: 'individual' };
        expect(visibleFields(f)).toMatchObject({ india: false, gstin: false, cin: false, vat: true, legalName: false });
    });

    it('Given an unregistered Indian vendor / Then no GSTIN', () => {
        expect(visibleFields({ ...emptyVendorMasterForm(), registration_country: 'IN', gst_treatment: 'unregistered_business' }).gstin).toBe(false);
    });

    it('Given other type, LLP, MSME, TDS and separate addresses / Then their dependent fields show', () => {
        expect(visibleFields({ ...emptyVendorMasterForm(), legal_type: 'other' }).legalTypeOther).toBe(true);
        const f = { ...emptyVendorMasterForm(), legal_type: 'llp', msme_registered: true, tds_applicable: true, billing_same: false, shipping_same: false };
        expect(visibleFields(f)).toMatchObject({ llpin: true, msmeDetails: true, tdsSection: true, billingAddress: true, shippingAddress: true });
    });
});

describe('formToPayload', () => {
    const indian = () => ({
        ...emptyVendorMasterForm('INR'),
        name: ' Cacooon ', legal_entity_name: 'Cacooon Collections LLP', legal_type: 'llp', llpin: 'aab-1234',
        registration_country: 'in', gst_treatment: 'registered_business', gst_number: '32ABCDE1234F1Z5', pan_number: 'ABCDE1234F',
        vat_number: 'should-not-send', registered_address: ADDR,
        primary_contact: { name: 'Asha', designation: '', email: 'asha@c.in', phone: '+91 1', alt_phone: '' },
        accounts_contact: { name: '', designation: '', email: 'ignored@c.in', phone: '', alt_phone: '' },
        credit_days: '30', credit_limit: '', year_established: '2001', msme_registered: false, udyam_number: 'stale',
        supply_types: ['goods_supplier'],
    });

    it('Given an Indian LLP / Then partner tax ids, profile ids and the contacts are shaped for the API', () => {
        const p = formToPayload(indian(), 'active');
        expect(p).toMatchObject({
            name: 'Cacooon', legal_entity_name: 'Cacooon Collections LLP', email: 'asha@c.in', phone: '+91 1',
            gst_treatment: 'registered_business', gst_number: '32ABCDE1234F1Z5', pan_number: 'ABCDE1234F', vat_number: null,
            billing_address: { line1: '12 MG Road', city: 'Kochi', state: 'Kerala', postal_code: '682001', country: 'IN' },
            shipping_address: { line1: '12 MG Road', city: 'Kochi', state: 'Kerala', postal_code: '682001', country: 'IN' },
        });
        expect(p.vendor_profile).toMatchObject({
            legal_type: 'llp', llpin: 'aab-1234', registration_country: 'IN', credit_days: 30, credit_limit: null,
            year_established: 2001, udyam_number: null, msme_category: null, currency: 'INR', onboarding_status: 'active',
            contacts: [{ role: 'primary', name: 'Asha', email: 'asha@c.in', phone: '+91 1' }],
            supply_types: ['goods_supplier'],
        });
        expect(p.vendor_profile).not.toHaveProperty('vendor_code');
    });

    it('Given a typed vendor code, separate billing/shipping and an accounts contact / Then they are sent', () => {
        const f = {
            ...indian(), vendor_code: ' ACME-1 ', billing_same: false, shipping_same: false,
            billing_address: { ...ADDR, line1: 'Billing St' }, shipping_address: { line1: '', line2: '', city: '', state: '', postal_code: '', country: '' },
            accounts_contact: { name: 'Ravi', designation: '', email: 'ap@c.in', phone: '', alt_phone: '' },
        };
        const p = formToPayload(f, 'draft');
        expect(p.vendor_profile).toMatchObject({ vendor_code: 'ACME-1', onboarding_status: 'draft' });
        expect(p.billing_address).toMatchObject({ line1: 'Billing St' });
        expect(p.shipping_address).toBeNull();
        expect(p.vendor_profile.contacts).toEqual([
            { role: 'primary', name: 'Asha', email: 'asha@c.in', phone: '+91 1' },
            { role: 'accounts', name: 'Ravi', email: 'ap@c.in' },
        ]);
    });

    it('Given a foreign individual / Then India ids and legal name are cleared (null) and VAT is sent', () => {
        const f = {
            ...emptyVendorMasterForm(), name: 'Joe', legal_type: 'individual', legal_entity_name: 'stale', registration_country: 'US',
            gst_number: 'stale', pan_number: 'stale', vat_number: 'US-123', tds_applicable: false, tds_section: 'stale',
            legal_type_other: 'stale',
        };
        const p = formToPayload(f, 'active');
        expect(p).toMatchObject({ legal_entity_name: null, gst_number: null, pan_number: null, gst_treatment: null, vat_number: 'US-123', billing_address: null });
        expect(p.vendor_profile).toMatchObject({ tds_section: null, legal_type_other: null, contacts: [], registration_country: 'US' });
    });

    it('Given empty optional values / Then they are sent as null, not empty strings', () => {
        const p = formToPayload({ ...emptyVendorMasterForm(), name: 'X', currency: '', payment_terms: '' }, 'draft');
        expect(p.vendor_profile).toMatchObject({ currency: null, payment_terms: null, legal_type: null, registration_country: null, year_established: null });
        expect(p.email).toBeNull();
    });

    it('Given other type, MSME and TDS on / Then their dependent values are sent', () => {
        const p = formToPayload({
            ...emptyVendorMasterForm(), name: 'X', legal_type: 'other', legal_type_other: 'Co-op',
            msme_registered: true, udyam_number: 'UDYAM-KL-01-0000001', msme_category: 'micro', tds_applicable: true, tds_section: '194C',
        }, 'active');
        expect(p.vendor_profile).toMatchObject({ legal_type_other: 'Co-op', udyam_number: 'UDYAM-KL-01-0000001', msme_category: 'micro', tds_section: '194C', msme_registered: true, tds_applicable: true });
    });
});

describe('vendorToForm', () => {
    it('Given a saved vendor master / Then the form is prefilled and same-as-registered is detected', () => {
        const f = vendorToForm({
            name: 'Cacooon', legal_entity_name: 'Cacooon LLP', gst_number: 'G', pan_number: 'P', gst_treatment: 'registered_business',
            website: 'c.in', billing_address: { line1: '12 MG Road', city: 'Kochi', state: 'Kerala', postal_code: '682001', country: 'IN' },
            shipping_address: { line1: 'Warehouse 4', city: 'Kochi', country: 'IN' },
            vendor_profiles: [{
                vendor_code: 'VEN-00001', legal_type: 'llp', supply_types: ['logistics'], registered_address: ADDR,
                contacts: [{ role: 'primary', name: 'Asha', email: 'a@c.in' }, { role: 'accounts', name: 'Ravi' }],
                credit_days: 30, credit_limit: 1000, currency: 'INR', tds_applicable: true, tds_section: '194C',
                msme_registered: true, msme_category: 'small', is_preferred: true, year_established: 2001,
            }],
        }, 'USD');
        expect(f).toMatchObject({
            name: 'Cacooon', vendor_code: 'VEN-00001', legal_type: 'llp', supply_types: ['logistics'], credit_days: '30', credit_limit: '1000',
            currency: 'INR', tds_applicable: true, msme_registered: true, is_preferred: true, year_established: '2001',
            billing_same: true, shipping_same: false,
        });
        expect(f.primary_contact.name).toBe('Asha');
        expect(f.accounts_contact.name).toBe('Ravi');
        expect(f.shipping_address.line1).toBe('Warehouse 4');
    });

    it('Given a legacy vendor with no profile / Then email/phone seed the primary contact and defaults fill the rest', () => {
        const f = vendorToForm({ name: 'Old', email: 'o@x', phone: '+1 2', vendor_profiles: [] }, 'aed');
        expect(f).toMatchObject({ name: 'Old', classification: 'supplier', payment_terms: 'Net 30', currency: 'AED', billing_same: true, shipping_same: true, supply_types: [] });
        expect(f.primary_contact).toMatchObject({ email: 'o@x', phone: '+1 2' });
    });

    it('Given nothing / Then an empty form', () => {
        expect(vendorToForm(undefined).name).toBe('');
    });
});
