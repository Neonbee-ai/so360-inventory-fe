import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetPODetail = vi.fn();
const mockUpdatePOStatus = vi.fn();
const mockAcknowledgePO = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPODetail: (...args: any[]) => mockGetPODetail(...args),
    updatePOStatus: (...args: any[]) => mockUpdatePOStatus(...args),
    acknowledgePO: (...args: any[]) => mockAcknowledgePO(...args),
    // The document-trail panel on this page reads the chain.
    getDocumentTrace: () => Promise.resolve({ chain: [] }),
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

  describe('Given vendor acknowledgement', () => {
    it('When the PO is sent and unacknowledged / Then it invites the buyer to record a response', async () => {
      render(<PODetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Vendor Acknowledgement')).toBeInTheDocument();
      });
      expect(screen.getByText('Record acknowledgement')).toBeInTheDocument();
    });

    it('When a response is submitted / Then acknowledgePO is called with the vendor answer', async () => {
      mockAcknowledgePO.mockResolvedValue({});
      render(<PODetailPage />);
      await waitFor(() => screen.getByText('Record acknowledgement'));

      fireEvent.click(screen.getByText('Record acknowledgement'));
      fireEvent.change(screen.getByLabelText('Vendor response'), {
        target: { value: 'delayed' },
      });
      fireEvent.change(screen.getByLabelText('Promised delivery date'), {
        target: { value: '2026-09-20' },
      });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockAcknowledgePO).toHaveBeenCalledWith('po-1', expect.objectContaining({
          acknowledgement_status: 'delayed',
          promised_delivery_date: '2026-09-20',
        }));
      });
    });

    it('When the vendor has already responded / Then the recorded response and promised date are shown', async () => {
      mockGetPODetail.mockResolvedValue(makePO({
        status: 'acknowledged',
        acknowledgement_status: 'partially_accepted',
        acknowledged_at: '2026-08-14T10:00:00Z',
        acknowledged_by: 'Ravi',
        promised_delivery_date: '2026-09-20',
        acknowledgement_note: 'Only 8 of 10 available',
      }));
      render(<PODetailPage />);

      await waitFor(() => {
        expect(screen.getByText('partially accepted')).toBeInTheDocument();
      });
      expect(screen.getByText('Only 8 of 10 available')).toBeInTheDocument();
    });
  });
});
