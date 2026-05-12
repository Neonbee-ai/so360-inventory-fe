import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetPOs = vi.fn();
const mockGetVendors = vi.fn();
const mockGetPRs = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPOs: (...args: any[]) => mockGetPOs(...args),
    getPRs: (...args: any[]) => mockGetPRs(...args),
    getConversionPayload: vi.fn(),
    createPO: vi.fn(),
  },
}));

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getVendors: (...args: any[]) => mockGetVendors(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/procurement/po', state: null }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', is_tax_inclusive_pricing: false } }),
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
  }),
}));

vi.mock('../../components/ItemSearchSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="item-search">Item Search</div>,
}));

import POListPage from './POListPage';

const makePO = (overrides: any = {}) => ({
  id: 'po-1',
  po_number: 'PO-2025-0001',
  vendor: { name: 'Acme Corp' },
  status: 'sent',
  total_amount: 1500,
  po_lines: [{ quantity: 10, received_quantity: 0 }],
  created_at: '2025-01-15T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPOs.mockResolvedValue([]);
  mockGetVendors.mockResolvedValue([]);
  mockGetPRs.mockResolvedValue([]);
});

describe('POListPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Purchase Orders heading', async () => {
      render(<POListPage />);
      expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
    });

    it('When loaded / Then shows New PO button', async () => {
      render(<POListPage />);
      expect(screen.getByText('New PO')).toBeInTheDocument();
    });
  });

  describe('Given PO data loaded', () => {
    it('When POs exist / Then renders PO number in table', async () => {
      mockGetPOs.mockResolvedValue([makePO()]);
      render(<POListPage />);
      await waitFor(() => {
        expect(screen.getByText('#PO-2025-0001')).toBeInTheDocument();
      });
    });

    it('When POs exist / Then shows vendor name', async () => {
      mockGetPOs.mockResolvedValue([makePO()]);
      render(<POListPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });
    });

    it('When PO has status / Then shows status badge', async () => {
      mockGetPOs.mockResolvedValue([makePO({ status: 'received' })]);
      render(<POListPage />);
      await waitFor(() => {
        expect(screen.getByText('received')).toBeInTheDocument();
      });
    });

    it('When PO has amount / Then shows formatted amount', async () => {
      mockGetPOs.mockResolvedValue([makePO({ total_amount: 2500 })]);
      render(<POListPage />);
      await waitFor(() => {
        expect(screen.getByText('$2500')).toBeInTheDocument();
      });
    });
  });

  describe('Given no POs exist', () => {
    it('When list is empty / Then shows empty message', async () => {
      render(<POListPage />);
      await waitFor(() => {
        expect(screen.getByText('No purchase orders found.')).toBeInTheDocument();
      });
    });
  });
});
