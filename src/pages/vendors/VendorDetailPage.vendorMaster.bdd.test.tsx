import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

/** BDD: Vendor profile card on the vendor detail page (Pulse 3fc12200). */

const mockGetVendorDetail = vi.fn();
const mockNavigate = vi.fn();
const mockCan = vi.hoisted(() => vi.fn((_a: string) => true));
const mockFlag = vi.hoisted(() => vi.fn((_k: string) => true));

vi.mock('../../services/vendorService', () => ({
    vendorService: { getVendorDetail: (...a: any[]) => mockGetVendorDetail(...a), deleteVendor: vi.fn(), updateVendor: vi.fn(), rateVendor: vi.fn() },
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'vendor-1' }), useNavigate: () => mockNavigate }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));
vi.mock('@so360/shell-context', () => ({
    useActivity: () => ({ recordActivity: async () => {} }),
    useShellBridge: () => ({ isFeatureEnabled: mockFlag }),
    useBusinessSettings: () => ({ settings: { base_currency: 'USD' } }),
}));
vi.mock('../../components/vendors/VendorBankAccountsSection', () => ({ VendorBankAccountsSection: () => null }));
vi.mock('../../components/vendors/VendorDocumentsSection', () => ({
  VendorDocumentsSection: ({ vendorId }: any) => <div data-testid="vendor-documents-stub" data-vendor={vendorId} />,
}));
vi.mock('../../components/vendors/VendorActivitySection', () => ({
  VendorActivitySection: ({ vendorId }: any) => <div data-testid="vendor-activity-stub" data-vendor={vendorId} />,
}));
vi.mock('../../components/vendors/CreateInvoiceModal', () => ({ CreateInvoiceModal: () => null }));
vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}` }),
}));

import VendorDetailPage from './VendorDetailPage';

const vendor = (o: any = {}) => ({
    id: 'vendor-1', name: 'Acme Corp', email: 'a@x.com', phone: '1', gst_number: '32ABCDE1234F1Z9',
    vendor_profiles: [{ classification: 'supplier', vendor_code: 'VEN-00004', credit_days: 30, tds_applicable: true, tds_section: '194C' }],
    purchase_orders: [], vendor_invoices: [],
    onboarding: { status: 'active', missing: [] },
    ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockImplementation(() => true);
    mockFlag.mockImplementation(() => true);
});

describe('Given the Vendor Master flag is on', () => {
    it('When a complete vendor opens / Then code, tax ids and terms show with an Edit profile action', async () => {
        mockGetVendorDetail.mockResolvedValue(vendor());
        render(<VendorDetailPage />);
        expect(await screen.findByTestId('vendor-master-card')).toBeInTheDocument();
        expect(screen.getByText('VEN-00004')).toBeInTheDocument();
        expect(screen.getByText('32ABCDE1234F1Z9')).toBeInTheDocument();
        expect(screen.getByText('30 days')).toBeInTheDocument();
        expect(screen.getByText('194C')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Edit profile'));
        expect(mockNavigate).toHaveBeenCalledWith('/vendors/vendor-1/edit');
    });

    it('When a draft vendor has gaps / Then they are listed and the action reads Complete profile', async () => {
        mockGetVendorDetail.mockResolvedValue(vendor({
            vendor_profiles: [{}],
            gst_number: null,
            onboarding: { status: 'draft', missing: ['pan_number'] },
        }));
        render(<VendorDetailPage />);
        expect(await screen.findByText('Onboarding incomplete')).toBeInTheDocument();
        expect(screen.getByText('Missing: PAN.')).toBeInTheDocument();
        expect(screen.getByText('Complete profile')).toBeInTheDocument();
        expect(screen.getByText('Not assigned')).toBeInTheDocument();
        expect(screen.getByText('Not applicable')).toBeInTheDocument();
    });

    it('When an active vendor still has gaps / Then the warning says Profile incomplete', async () => {
        mockGetVendorDetail.mockResolvedValue(vendor({ onboarding: { status: 'active', missing: ['currency'] }, vendor_profiles: [{ tds_applicable: true, credit_days: 15 }] }));
        render(<VendorDetailPage />);
        expect(await screen.findByText('Profile incomplete')).toBeInTheDocument();
        expect(screen.getByText('Not set')).toBeInTheDocument();
    });

    it('When the user cannot update suppliers / Then no edit action is offered', async () => {
        mockCan.mockImplementation((a: string) => a !== 'suppliers.update');
        mockGetVendorDetail.mockResolvedValue(vendor());
        render(<VendorDetailPage />);
        await screen.findByTestId('vendor-master-card');
        expect(screen.queryByText('Edit profile')).not.toBeInTheDocument();
    });
});

describe('Given the Vendor Master flag is off', () => {
    it('When the vendor opens / Then the profile card is not shown', async () => {
        mockFlag.mockImplementation(() => false);
        mockGetVendorDetail.mockResolvedValue(vendor());
        render(<VendorDetailPage />);
        await screen.findAllByText('Acme Corp');
        expect(screen.queryByTestId('vendor-master-card')).not.toBeInTheDocument();
    });
});

describe('Given the vendor detail page (slice 2)', () => {
    it('When it loads / Then the documents card and the activity rail card get the vendor id', async () => {
        mockGetVendorDetail.mockResolvedValue(vendor());
        render(<VendorDetailPage />);
        expect(await screen.findByTestId('vendor-documents-stub')).toHaveAttribute('data-vendor', 'vendor-1');
        expect(screen.getByTestId('vendor-activity-stub')).toHaveAttribute('data-vendor', 'vendor-1');
    });
});
