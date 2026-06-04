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

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('../../components/common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

vi.mock('../../components/common/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

vi.mock('../../components/vendors/CreateInvoiceModal', () => ({
  CreateInvoiceModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="invoice-modal">Invoice Modal</div> : null,
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
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

const makeVendor = (overrides: any = {}) => ({
  id: 'vendor-1',
  name: 'Acme Corp',
  email: 'acme@example.com',
  phone: '+971500000001',
  address: 'Dubai, UAE',
  vendor_profiles: [{
    classification: 'supplier',
    is_preferred: false,
    performance_rating: 4,
    rating_count: 10,
    payment_terms: 'Net 30',
  }],
  purchase_orders: [],
  vendor_invoices: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetVendorDetail.mockResolvedValue(makeVendor());
  mockUpdateVendor.mockResolvedValue({});
  mockDeleteVendor.mockResolvedValue({});
  mockRateVendor.mockResolvedValue({ average: 4, count: 11 });
});

describe('VendorDetailPage', () => {
  describe('Given loading state', () => {
    it('When data is loading / Then shows skeleton', () => {
      mockGetVendorDetail.mockReturnValue(new Promise(() => {}));
      render(<VendorDetailPage />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });
  });

  describe('Given API error', () => {
    it('When fetch fails / Then shows error message', async () => {
      mockGetVendorDetail.mockRejectedValue(new Error('Vendor not found'));
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Vendor not found')).toBeInTheDocument();
      });
    });

    it('When fetch fails / Then shows Back to Vendors link', async () => {
      mockGetVendorDetail.mockRejectedValue(new Error('Vendor not found'));
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Vendors')).toBeInTheDocument();
      });
    });
  });

  describe('Given vendor data loads', () => {
    it('When loaded / Then shows vendor name', async () => {
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows vendor email', async () => {
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('acme@example.com')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows vendor phone', async () => {
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('+971500000001')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows vendor address', async () => {
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Dubai, UAE')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Back to Vendors button', async () => {
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Vendors')).toBeInTheDocument();
      });
    });

    it('When vendor is preferred / Then shows Preferred badge', async () => {
      mockGetVendorDetail.mockResolvedValue(
        makeVendor({
          vendor_profiles: [{ classification: 'supplier', is_preferred: true, performance_rating: 5, rating_count: 3 }]
        })
      );
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Preferred')).toBeInTheDocument();
      });
    });
  });

  describe('Given purchase orders section', () => {
    it('When vendor has POs / Then shows PO number', async () => {
      mockGetVendorDetail.mockResolvedValue(
        makeVendor({
          purchase_orders: [{
            id: 'po-1', po_number: 'PO-2024-001', status: 'open', total_amount: 5000, created_at: '2024-01-01T00:00:00Z'
          }]
        })
      );
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      });
    });
  });

  describe('Given back navigation', () => {
    it('When Back to Vendors clicked / Then navigates to /vendors', async () => {
      render(<VendorDetailPage />);
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
      // Click the first "Back to Vendors" button
      fireEvent.click(screen.getAllByText('Back to Vendors')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/vendors');
    });
  });

  describe('Given API getVendorDetail on mount', () => {
    it('When component mounts / Then calls getVendorDetail with id', async () => {
      render(<VendorDetailPage />);
      await waitFor(() => {
        expect(mockGetVendorDetail).toHaveBeenCalledWith('vendor-1');
      });
    });
  });
});
