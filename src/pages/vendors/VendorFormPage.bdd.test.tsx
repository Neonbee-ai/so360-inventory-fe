import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/** BDD: Vendor Master form page — create, conditional fields, activation errors, edit (Pulse 3fc12200). */

const mockGetVendorDetail = vi.fn();
const mockCreateVendor = vi.fn();
const mockUpdateVendor = vi.fn();
const mockNavigate = vi.fn();
const params = vi.hoisted(() => ({ value: {} as { id?: string } }));

vi.mock('../../services/vendorService', () => ({
    vendorService: {
        getVendorDetail: (...a: any[]) => mockGetVendorDetail(...a),
        createVendor: (...a: any[]) => mockCreateVendor(...a),
        updateVendor: (...a: any[]) => mockUpdateVendor(...a),
    },
}));
vi.mock('react-router-dom', () => ({ useParams: () => params.value, useNavigate: () => mockNavigate }));

import VendorFormPage from './VendorFormPage';

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
const type = (name: string, value: string) => fireEvent.change(field(name)!, { target: { value } });

beforeEach(() => {
    vi.clearAllMocks();
    params.value = {};
    mockCreateVendor.mockResolvedValue({ id: 'new-id' });
    mockUpdateVendor.mockResolvedValue({ success: true });
});

describe('Given a new vendor', () => {
    it('When saved as a draft / Then createVendor gets the draft payload and the profile opens', async () => {
        render(<VendorFormPage />);
        type('name', 'Gulf Trading');
        type('primary_email', 'ap@gulf.ae');
        fireEvent.click(screen.getByText('Save as draft'));
        await waitFor(() => expect(mockCreateVendor).toHaveBeenCalled());
        const body = mockCreateVendor.mock.calls[0][0];
        expect(body).toMatchObject({ name: 'Gulf Trading', email: 'ap@gulf.ae', vendor_profile: { onboarding_status: 'draft', currency: 'USD' } });
        expect(mockNavigate).toHaveBeenCalledWith('/vendors/new-id');
    });

    it('When the API answers without an id / Then it returns to the list', async () => {
        mockCreateVendor.mockResolvedValue({});
        render(<VendorFormPage />);
        type('name', 'X');
        fireEvent.click(screen.getByText('Save & activate'));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/vendors'));
    });

    it('When saved without a name / Then it explains and does not call the API', async () => {
        render(<VendorFormPage />);
        fireEvent.click(screen.getByText('Save & activate'));
        expect(await screen.findByText('Vendor name is required.')).toBeInTheDocument();
        expect(mockCreateVendor).not.toHaveBeenCalled();
    });

    it('When activation is refused / Then the missing items are listed in plain words', async () => {
        mockCreateVendor.mockRejectedValue(Object.assign(new Error('Vendor cannot be activated yet'), {
            body: { missing: ['pan_number', 'registered_address'] },
        }));
        render(<VendorFormPage />);
        type('name', 'Cacooon');
        fireEvent.click(screen.getByText('Save & activate'));
        expect(await screen.findByText('Vendor cannot be activated yet')).toBeInTheDocument();
        expect(screen.getByText('Missing: PAN, Registered address (line 1, city, country).')).toBeInTheDocument();
    });

    it('When saving fails for another reason / Then the server message is shown', async () => {
        mockCreateVendor.mockRejectedValue(new Error('Vendor code ACME-1 is already in use.'));
        render(<VendorFormPage />);
        type('name', 'X');
        fireEvent.click(screen.getByText('Save & activate'));
        expect(await screen.findByText('Vendor code ACME-1 is already in use.')).toBeInTheDocument();
    });

    it('When cancelled / Then it returns to the vendor list', () => {
        render(<VendorFormPage />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockNavigate).toHaveBeenCalledWith('/vendors');
    });
});

describe('Given conditional fields', () => {
    it('When the vendor is Indian, GST registered and a private company / Then PAN, GSTIN and CIN appear (and VAT goes)', () => {
        render(<VendorFormPage />);
        expect(field('pan_number')).toBeNull();
        expect(field('vat_number')).not.toBeNull();
        type('registration_country', 'in');
        expect(field('registration_country')!.value).toBe('IN');
        expect(field('pan_number')).not.toBeNull();
        expect(field('vat_number')).toBeNull();
        expect(field('gst_number')).toBeNull();
        type('gst_treatment', 'registered_business');
        expect(field('gst_number')).not.toBeNull();
        type('legal_type', 'private_limited');
        expect(screen.getByLabelText('CIN')).toBeInTheDocument();
    });

    it('When the vendor is an individual / Then no legal-name or registration-number field is asked', () => {
        render(<VendorFormPage />);
        type('legal_type', 'individual');
        expect(field('legal_entity_name')).toBeNull();
        expect(field('registration_number')).toBeNull();
    });

    it('When type is Other or LLP / Then the description or LLPIN field appears', () => {
        render(<VendorFormPage />);
        type('legal_type', 'other');
        expect(field('legal_type_other')).not.toBeNull();
        type('legal_type', 'llp');
        expect(field('llpin')).not.toBeNull();
    });

    it('When MSME and TDS are switched on and addresses differ / Then their detail fields appear', () => {
        render(<VendorFormPage />);
        expect(field('udyam_number')).toBeNull();
        fireEvent.click(screen.getByRole('switch', { name: 'MSME / Udyam registered' }));
        expect(field('udyam_number')).not.toBeNull();
        fireEvent.click(screen.getByRole('switch', { name: 'TDS applicable' }));
        expect(field('tds_section')).not.toBeNull();
        fireEvent.click(field('billing_same')!);
        expect(field('billing_line1')).not.toBeNull();
        fireEvent.click(field('shipping_same')!);
        expect(field('shipping_city')).not.toBeNull();
    });

    it('When supply types are ticked / Then they reach the payload', async () => {
        render(<VendorFormPage />);
        type('name', 'X');
        fireEvent.click(screen.getByLabelText('Logistics / transport'));
        fireEvent.click(screen.getByText('Save as draft'));
        await waitFor(() => expect(mockCreateVendor).toHaveBeenCalled());
        expect(mockCreateVendor.mock.calls[0][0].vendor_profile.supply_types).toEqual(['logistics']);
    });
});

describe('Given an existing vendor', () => {
    const active = {
        id: 'v1', name: 'Gulf Trading', email: 'ap@gulf.ae',
        vendor_profiles: [{ vendor_code: 'VEN-00001', onboarding_status: 'active', legal_type: 'public_limited' }],
        onboarding: { status: 'active', missing: [] },
    };

    it('When an active vendor is edited / Then it is prefilled, draft is not offered and Save updates in place', async () => {
        params.value = { id: 'v1' };
        mockGetVendorDetail.mockResolvedValue(active);
        render(<VendorFormPage />);
        await waitFor(() => expect(field('name')!.value).toBe('Gulf Trading'));
        expect(field('vendor_code')!.value).toBe('VEN-00001');
        expect(screen.queryByText('Save as draft')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(mockUpdateVendor).toHaveBeenCalledWith('v1', expect.objectContaining({ name: 'Gulf Trading' })));
        expect(mockUpdateVendor.mock.calls[0][1].vendor_profile).toMatchObject({ onboarding_status: 'active', vendor_code: 'VEN-00001' });
        expect(mockNavigate).toHaveBeenCalledWith('/vendors/v1');
    });

    it('When a draft vendor with gaps is opened / Then the gaps are shown and both saves are offered', async () => {
        params.value = { id: 'v1' };
        mockGetVendorDetail.mockResolvedValue({
            ...active,
            vendor_profiles: [{ onboarding_status: 'draft' }],
            onboarding: { status: 'draft', missing: ['gst_number'] },
        });
        render(<VendorFormPage />);
        expect(await screen.findByText('Still needed before this vendor can be used: GSTIN.')).toBeInTheDocument();
        expect(screen.getByText('Save as draft')).toBeInTheDocument();
        expect(screen.getByText('Save & activate')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockNavigate).toHaveBeenCalledWith('/vendors/v1');
    });

    it('When the vendor cannot be loaded / Then the error is shown', async () => {
        params.value = { id: 'v1' };
        mockGetVendorDetail.mockRejectedValue(new Error('Vendor not found'));
        render(<VendorFormPage />);
        expect(await screen.findByText('Vendor not found')).toBeInTheDocument();
    });

    it('When the detail has no onboarding block (older API) / Then the profile status is used', async () => {
        params.value = { id: 'v1' };
        mockGetVendorDetail.mockResolvedValue({ id: 'v1', name: 'Old', vendor_profiles: [{ onboarding_status: 'draft' }] });
        render(<VendorFormPage />);
        await waitFor(() => expect(field('name')!.value).toBe('Old'));
        expect(screen.getByText('Save as draft')).toBeInTheDocument();
    });
});

describe('Given an Indian GST-registered vendor (Pulse 086d33b1)', () => {
    const indianRegistered = () => {
        render(<VendorFormPage />);
        type('name', 'Velnir');
        type('registration_country', 'IN');
        type('gst_treatment', 'registered_business');
    };

    it('When a valid GSTIN and its own PAN are pasted with spaces and lower case / Then the save sends the normalised pair', async () => {
        indianRegistered();
        type('gst_number', '27 aapfu 0939f 1zv');
        type('pan_number', 'aapfu 0939f');
        expect(field('gst_number')!.value).toBe('27AAPFU0939F1ZV');
        fireEvent.click(screen.getByText('Save as draft'));
        await waitFor(() => expect(mockCreateVendor).toHaveBeenCalled());
        expect(mockCreateVendor.mock.calls[0][0]).toMatchObject({ gst_number: '27AAPFU0939F1ZV', pan_number: 'AAPFU0939F' });
    });

    it('When the PAN does not match the GSTIN / Then the PAN field names the embedded PAN and nothing is sent', async () => {
        indianRegistered();
        type('gst_number', '27AAPFU0939F1ZV');
        type('pan_number', 'ABCDE1234F');
        fireEvent.click(screen.getByText('Save & activate'));
        expect((await screen.findAllByText(/does not match the PAN embedded in this GSTIN \(AAPFU0939F\)/)).length).toBeGreaterThan(0);
        expect(mockCreateVendor).not.toHaveBeenCalled();
    });

    it('When a GSTIN is still being typed / Then no format error is shown until it is complete or saved', async () => {
        indianRegistered();
        type('gst_number', '27AAPFU');
        expect(screen.queryByText('Enter a valid 15-character GSTIN.')).toBeNull();
        fireEvent.click(screen.getByText('Save as draft'));
        expect((await screen.findAllByText('Enter a valid 15-character GSTIN.')).length).toBeGreaterThan(0);
        expect(mockCreateVendor).not.toHaveBeenCalled();
    });

    it('When the server rejects one field / Then the message is attached to that field', async () => {
        mockCreateVendor.mockRejectedValue(Object.assign(new Error('Enter a valid 10-character PAN.'), {
            body: { field: 'pan_number', code: 'pan_format', missing: [] },
        }));
        indianRegistered();
        type('pan_number', 'AAPFU0939F');
        fireEvent.click(screen.getByText('Save as draft'));
        expect((await screen.findAllByText('Enter a valid 10-character PAN.')).length).toBe(2);
    });
});
