import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetGRNDetail = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getGRNDetail: (...args: any[]) => mockGetGRNDetail(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'grn-1' }),
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

import GRNDetailPage from './GRNDetailPage';

const makeGRN = (overrides: any = {}) => ({
  id: 'grn-1',
  grn_number: 'GRN-2024-001',
  created_at: '2024-01-15T00:00:00Z',
  notes: 'All items received in good condition',
  warehouse: { id: 'wh-1', name: 'Main Warehouse' },
  po: {
    id: 'po-1',
    po_number: 'PO-2024-001',
    vendor: { id: 'v1', name: 'Acme Supplies', contact_email: 'acme@example.com' },
  },
  grn_lines: [],
  received_by: { full_name: 'John Doe' },
  ...overrides,
});

const makeGRNLine = (overrides: any = {}) => ({
  id: 'line-1',
  item_id: 'item-1',
  quantity_received: 10,
  po_line: {
    quantity: 15,
    unit_price: 500,
    description: 'Widget A',
    items: { name: 'Widget A', sku: 'WGT-001' },
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetGRNDetail.mockResolvedValue(makeGRN());
});

describe('GRNDetailPage', () => {
  describe('Given loading state', () => {
    it('When data is loading / Then shows loading spinner', () => {
      mockGetGRNDetail.mockReturnValue(new Promise(() => {}));
      const { container } = render(<GRNDetailPage />);
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Given API error', () => {
    it('When fetch fails / Then shows error message', async () => {
      mockGetGRNDetail.mockRejectedValue(new Error('GRN not found'));
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('GRN not found')).toBeInTheDocument();
      });
    });

    it('When fetch fails / Then shows Back to GRNs link', async () => {
      mockGetGRNDetail.mockRejectedValue(new Error('GRN not found'));
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to GRNs')).toBeInTheDocument();
      });
    });
  });

  describe('Given GRN data loads', () => {
    it('When loaded / Then shows GRN number', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('GRN-2024-001')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Received status badge', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        // "Received" appears in the status badge (and possibly other places)
        expect(screen.getAllByText('Received').length).toBeGreaterThan(0);
      });
    });

    it('When loaded / Then shows warehouse name', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows linked PO number', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('#PO-2024-001')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows vendor name', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows back navigation button', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Goods Receipt Notes')).toBeInTheDocument();
      });
    });

    it('When GRN has notes / Then shows notes text', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('All items received in good condition')).toBeInTheDocument();
      });
    });

    it('When GRN has received_by / Then shows receiver name', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Given GRN lines', () => {
    it('When GRN has lines / Then shows item name', async () => {
      mockGetGRNDetail.mockResolvedValue(makeGRN({ grn_lines: [makeGRNLine()] }));
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Widget A')).toBeInTheDocument();
      });
    });

    it('When GRN has lines / Then shows quantity received', async () => {
      mockGetGRNDetail.mockResolvedValue(makeGRN({ grn_lines: [makeGRNLine()] }));
      render(<GRNDetailPage />);
      await waitFor(() => {
        // quantity_received = 10 appears in the table
        expect(screen.getAllByText('10').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given API on mount', () => {
    it('When component mounts / Then calls getGRNDetail with id', async () => {
      render(<GRNDetailPage />);
      await waitFor(() => {
        expect(mockGetGRNDetail).toHaveBeenCalledWith('grn-1');
      });
    });
  });
});
