import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetPODetail = vi.fn();
const mockUpdatePOStatus = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPODetail: (...args: any[]) => mockGetPODetail(...args),
    updatePOStatus: (...args: any[]) => mockUpdatePOStatus(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'po-1' }),
  useNavigate: () => mockNavigate,
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

import PODetailPage from './PODetailPage';

const makePO = (overrides: any = {}) => ({
  id: 'po-1',
  po_number: 'PO-2024-001',
  status: 'sent',
  total_amount: 10000,
  subtotal_amount: 9000,
  tax_amount: 1000,
  created_at: '2024-01-15T00:00:00Z',
  expected_delivery_date: '2024-02-01T00:00:00Z',
  vendor: { id: 'v1', name: 'Acme Supplies', contact_email: 'acme@example.com' },
  po_lines: [],
  ...overrides,
});

const makePOLine = (overrides: any = {}) => ({
  id: 'line-1',
  item_id: 'item-1',
  description: 'Widget A',
  quantity: 10,
  unit_price: 500,
  received_quantity: 5,
  items: { name: 'Widget A', sku: 'WGT-001' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPODetail.mockResolvedValue(makePO());
  mockUpdatePOStatus.mockResolvedValue({});
});

describe('PODetailPage', () => {
  describe('Given loading state', () => {
    it('When data is loading / Then shows loading spinner', () => {
      mockGetPODetail.mockReturnValue(new Promise(() => {}));
      const { container } = render(<PODetailPage />);
      // Loading spinner is an animated div
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Given API error', () => {
    it('When fetch fails / Then shows error message', async () => {
      mockGetPODetail.mockRejectedValue(new Error('PO not found'));
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('PO not found')).toBeInTheDocument();
      });
    });

    it('When fetch fails / Then shows Back to Purchase Orders link', async () => {
      mockGetPODetail.mockRejectedValue(new Error('PO not found'));
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Purchase Orders')).toBeInTheDocument();
      });
    });
  });

  describe('Given PO data loads', () => {
    it('When loaded / Then shows PO number with hash prefix', async () => {
      render(<PODetailPage />);
      await waitFor(() => {
        // Rendered as #PO-2024-001
        expect(screen.getByText('#PO-2024-001')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows vendor name', async () => {
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Back to Purchase Orders button', async () => {
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Purchase Orders')).toBeInTheDocument();
      });
    });

    it('When loaded with "sent" status / Then shows status badge text', async () => {
      render(<PODetailPage />);
      await waitFor(() => {
        // Status is rendered as lowercase (CSS handles uppercasing)
        expect(screen.getByText('sent')).toBeInTheDocument();
      });
    });

    it('When loaded with "received" status / Then shows status badge text', async () => {
      mockGetPODetail.mockResolvedValue(makePO({ status: 'received' }));
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('received')).toBeInTheDocument();
      });
    });

    it('When loaded with "cancelled" status / Then shows status badge text', async () => {
      mockGetPODetail.mockResolvedValue(makePO({ status: 'cancelled' }));
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('cancelled')).toBeInTheDocument();
      });
    });
  });

  describe('Given PO lines', () => {
    it('When PO has lines / Then shows item name', async () => {
      mockGetPODetail.mockResolvedValue(makePO({ po_lines: [makePOLine()] }));
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Widget A')).toBeInTheDocument();
      });
    });

    it('When PO has lines / Then shows SKU', async () => {
      mockGetPODetail.mockResolvedValue(makePO({ po_lines: [makePOLine()] }));
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('WGT-001')).toBeInTheDocument();
      });
    });
  });

  describe('Given API on mount', () => {
    it('When component mounts / Then calls getPODetail with id', async () => {
      render(<PODetailPage />);
      await waitFor(() => {
        expect(mockGetPODetail).toHaveBeenCalledWith('po-1');
      });
    });
  });
});
