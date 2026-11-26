import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetVendorDetail = vi.fn();
const mockUpdateVendor = vi.fn();
const mockDeleteVendor = vi.fn();
const mockRateVendor = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getVendorDetail: (...args: any[]) => mockGetVendorDetail(...args),
    updateVendor: (...args: any[]) => mockUpdateVendor(...args),
    deleteVendor: (...args: any[]) => mockDeleteVendor(...args),
    rateVendor: (...args: any[]) => mockRateVendor(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'vendor-1' }),
  useNavigate: () => mockNavigate,
}));

const mockCanVendorDetail = vi.hoisted(() => vi.fn((_action: string) => true));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ can: mockCanVendorDetail }),
}));

// Bank Details section has its own BDD spec; stub it so this page spec stays focused.
vi.mock('../../components/vendors/VendorBankAccountsSection', () => ({
  VendorBankAccountsSection: ({ vendorId }: any) => <div data-testid="vendor-bank-section-stub" data-vendor={vendorId} />,
}));
vi.mock('../../components/vendors/VendorDocumentsSection', () => ({
  VendorDocumentsSection: ({ vendorId }: any) => <div data-testid="vendor-documents-stub" data-vendor={vendorId} />,
}));
vi.mock('../../components/vendors/VendorActivitySection', () => ({
  VendorActivitySection: ({ vendorId }: any) => <div data-testid="vendor-activity-stub" data-vendor={vendorId} />,
}));
vi.mock('../../components/common/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

const modalResult = vi.hoisted(() => ({ value: null as any }));
vi.mock('../../components/vendors/CreateInvoiceModal', () => ({
  CreateInvoiceModal: ({ isOpen, onSuccess }: any) =>
    isOpen ? <button onClick={() => onSuccess(modalResult.value)}>finish-invoice</button> : null,
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    // Date-only primitives — this factory is a CLOSED LIST, so a component that
    // adopts formatters.businessToday()/toBusinessDate() throws here otherwise.
    toBusinessDate: (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)),
    businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`),
    endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
  useInventoryCurrencySymbol: () => '$',
}));

import VendorDetailPage from './VendorDetailPage';

/** BDD: the Vendor profile shows each invoice's Accounting bill state (Pulse a4e95994). */
const vendor = (invoices: any[]) => ({
  id: 'vendor-1', name: 'Velnir', vendor_profiles: [{ classification: 'supplier' }],
  purchase_orders: [], vendor_invoices: invoices,
});

beforeEach(() => { vi.clearAllMocks(); modalResult.value = null; });

describe('Given a vendor with invoices', () => {
  it('When one invoice has a pending bill and one never reached Accounting / Then the Accounting column says so', async () => {
    mockGetVendorDetail.mockResolvedValue(vendor([
      { id: 'i1', invoice_number: 'INV-1', status: 'pending_verification', total_amount: 10, metadata: { accounting: { sync_status: 'synced', bill_id: 'b1', bill_status: 'pending' } } },
      { id: 'i2', invoice_number: 'INV-2', status: 'pending_verification', total_amount: 20, metadata: null },
    ]));
    render(<VendorDetailPage />);
    expect(await screen.findByText('Bill pending approval')).toBeInTheDocument();
    expect(screen.getByText('Not in Accounting')).toBeInTheDocument();
  });

  it('When an invoice is created and its bill needs details / Then a warning names what the accountant must add', async () => {
    mockGetVendorDetail.mockResolvedValue(vendor([]));
    modalResult.value = { accounting: { sync_status: 'needs_accounting_details', bill_id: 'b1', bill_number: 'INV-9', needs_accounting_details: ['tax_code'] } };
    render(<VendorDetailPage />);
    fireEvent.click(await screen.findByText('Create Invoice'));
    fireEvent.click(screen.getByText('finish-invoice'));
    expect(await screen.findByText(/Bill INV-9 was saved as a draft in Accounting → Bills\. Before approval an accountant needs to add: GST \/ tax code\./)).toBeInTheDocument();
    await waitFor(() => expect(mockGetVendorDetail).toHaveBeenCalledTimes(2));
  });
});
