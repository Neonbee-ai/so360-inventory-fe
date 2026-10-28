import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetVendorDetail = vi.fn();
const mockDeleteVendor = vi.fn();
const mockNavigate = vi.fn();
const mockCan = vi.hoisted(() => vi.fn((_a: string) => true));

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getVendorDetail: (...a: any[]) => mockGetVendorDetail(...a),
    deleteVendor: (...a: any[]) => mockDeleteVendor(...a),
    updateVendor: vi.fn(),
    rateVendor: vi.fn(),
  },
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'vendor-1' }), useNavigate: () => mockNavigate }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));
// Bank Details section has its own BDD spec; stub it so this page spec stays focused.
vi.mock('../../components/vendors/VendorBankAccountsSection', () => ({
  VendorBankAccountsSection: ({ vendorId }: any) => <div data-testid="vendor-bank-section-stub" data-vendor={vendorId} />,
}));
vi.mock('../../components/vendors/CreateInvoiceModal', () => ({
  CreateInvoiceModal: ({ isOpen }: any) => (isOpen ? <div data-testid="invoice-modal" /> : null),
}));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}` }),
}));

import VendorDetailPage from './VendorDetailPage';

const vendor = (o: any = {}) => ({
  id: 'vendor-1', name: 'Acme Corp', email: 'a@x.com', phone: '1', address: 'Dubai',
  vendor_profiles: [{ classification: 'supplier', is_preferred: true, performance_rating: 4, rating_count: 2, payment_terms: 'Net 30' }],
  purchase_orders: [], vendor_invoices: [], ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockImplementation(() => true);
  mockGetVendorDetail.mockResolvedValue(vendor());
  mockDeleteVendor.mockResolvedValue({});
});

describe('VendorDetailPage (Comb)', () => {
  it('Given a vendor / When loaded / Then it uses the detail template with the vendor name as title and Preferred status', async () => {
    const { container } = render(<VendorDetailPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Corp' })).toBeInTheDocument();
    expect(container.querySelector('[data-template="detail"]')).toBeInTheDocument();
    expect(screen.getByText('Preferred')).toBeInTheDocument();
  });

  it('Given a loaded vendor / When the page renders / Then the Bank Details section is mounted for that vendor', async () => {
    render(<VendorDetailPage />);
    expect(await screen.findByTestId('vendor-bank-section-stub')).toHaveAttribute('data-vendor', 'vendor-1');
  });

  it('Given a pending request / When loading / Then the template shows a loading state without vendor content', () => {
    mockGetVendorDetail.mockReturnValue(new Promise(() => {}));
    render(<VendorDetailPage />);
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('Given no POs or invoices / When loaded / Then both empty states show', async () => {
    render(<VendorDetailPage />);
    expect(await screen.findByText('No purchase orders yet')).toBeInTheDocument();
    expect(screen.getByText('No invoices yet')).toBeInTheDocument();
  });

  it('Given the API fails / When loaded / Then an error alert and Back to Vendors action show', async () => {
    mockGetVendorDetail.mockRejectedValue(new Error('boom'));
    render(<VendorDetailPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    fireEvent.click(screen.getByText('Back to Vendors'));
    expect(mockNavigate).toHaveBeenCalledWith('/vendors');
  });

  it('Given Create Invoice / When clicked / Then the invoice modal opens', async () => {
    render(<VendorDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Create Invoice/ }));
    expect(screen.getByTestId('invoice-modal')).toBeInTheDocument();
  });

  it('Given Delete Vendor / When confirmed / Then the vendor is deleted and the list route opens', async () => {
    render(<VendorDetailPage />);
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByText('Delete Vendor'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog.querySelectorAll('button')[1]);
    await waitFor(() => expect(mockDeleteVendor).toHaveBeenCalledWith('vendor-1'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/vendors'));
  });

  it('Given Edit Vendor / When chosen / Then the edit dialog opens with Cancel and Save Changes', async () => {
    render(<VendorDetailPage />);
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByText('Edit Vendor'));
    expect(screen.getByRole('dialog', { name: 'Edit Vendor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toHaveAttribute('form', 'edit-vendor-form');
  });

  it('Given suppliers.create is denied / When loaded / Then manage actions are hidden', async () => {
    mockCan.mockImplementation(() => false);
    render(<VendorDetailPage />);
    await screen.findByText('Acme Corp');
    expect(screen.queryByText('Edit Vendor')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Vendor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create Invoice/ })).not.toBeInTheDocument();
  });
});
