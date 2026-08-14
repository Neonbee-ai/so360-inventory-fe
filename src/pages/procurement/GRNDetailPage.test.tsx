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

  describe('Given a receipt where units were rejected', () => {
    const rejectedGRN = () => makeGRN({
      is_partial: true,
      inspection_status: 'failed',
      grn_lines: [makeGRNLine({
        quantity_received: 10,
        accepted_quantity: 7,
        rejected_quantity: 2,
        damaged_quantity: 1,
        rejection_reason: 'Torn bags',
        batch_number: 'B-2026-08',
        expiry_date: '2027-08-14',
        serial_numbers: ['SN-1', 'SN-2'],
      })],
    });

    it('When loaded / Then the accepted and rejected split is shown alongside received', async () => {
      mockGetGRNDetail.mockResolvedValue(rejectedGRN());
      render(<GRNDetailPage />);

      // 'Accepted' labels both the summary card and the line-table column.
      await waitFor(() => {
        expect(screen.getAllByText('Accepted').length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
      // 7 accepted, 3 rejected + damaged — each appears in the line and the footer.
      expect(screen.getAllByText('7').length).toBeGreaterThan(0);
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    });

    it('When loaded / Then value follows accepted units, not received units', async () => {
      mockGetGRNDetail.mockResolvedValue(rejectedGRN());
      render(<GRNDetailPage />);

      // 7 accepted x $500 = $3500 — a value of $5000 would mean rejected stock
      // was capitalised.
      await waitFor(() => {
        expect(screen.getAllByText('$3500').length).toBeGreaterThan(0);
      });
      expect(screen.queryByText('$5000')).not.toBeInTheDocument();
    });

    it('When loaded / Then batch, expiry, serials and the rejection reason are visible', async () => {
      mockGetGRNDetail.mockResolvedValue(rejectedGRN());
      render(<GRNDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/Batch B-2026-08/)).toBeInTheDocument();
      });
      expect(screen.getByText(/2 serials/)).toBeInTheDocument();
      expect(screen.getByText(/Rejected: Torn bags/)).toBeInTheDocument();
    });

    it('When the receipt is partial and inspection failed / Then both are badged', async () => {
      mockGetGRNDetail.mockResolvedValue(rejectedGRN());
      render(<GRNDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Partial')).toBeInTheDocument();
      });
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  describe('Given a receipt posted before the accepted/rejected split existed', () => {
    it('When accepted_quantity is absent / Then received is treated as accepted', async () => {
      mockGetGRNDetail.mockResolvedValue(makeGRN({
        grn_lines: [makeGRNLine({ quantity_received: 10 })],
      }));
      render(<GRNDetailPage />);

      // 10 x $500 = $5000 — the legacy receipt keeps its full value.
      await waitFor(() => {
        expect(screen.getAllByText('$5000').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given delivery paperwork was captured at the gate', () => {
    it('When loaded / Then the delivery note, vehicle, transporter and gate entry are shown', async () => {
      mockGetGRNDetail.mockResolvedValue(makeGRN({
        supplier_delivery_note: 'DN-99812',
        vehicle_number: 'KA-01-AB-1234',
        transporter: 'BlueDart',
        gate_entry_no: 'GE-771',
      }));
      render(<GRNDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Delivery Details')).toBeInTheDocument();
      });
      expect(screen.getByText('DN-99812')).toBeInTheDocument();
      expect(screen.getByText('KA-01-AB-1234')).toBeInTheDocument();
      expect(screen.getByText('BlueDart')).toBeInTheDocument();
      expect(screen.getByText('GE-771')).toBeInTheDocument();
    });
  });
});
