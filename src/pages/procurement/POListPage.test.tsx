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

const mockUseShellBridgePO = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', is_tax_inclusive_pricing: false } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: (...args: any[]) => mockUseShellBridgePO(...args),
  useQuota: () => ({ getQuota: () => null, isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (items: any[]) => items, isLimited: false }),
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
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
  mockUseShellBridgePO.mockReturnValue({
    isFeatureEnabled: () => true,
    currentOrg: { id: 'org-1', name: 'Test Org' },
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
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

  describe('Given New PO form', () => {
    it('When New PO button clicked / Then shows Create Purchase Order heading', async () => {
      render(<POListPage />);
      fireEvent.click(screen.getByText('New PO'));
      const headings = screen.getAllByText('Create Purchase Order');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('When New PO form shown / Then shows Select Vendor option', async () => {
      render(<POListPage />);
      fireEvent.click(screen.getByText('New PO'));
      await waitFor(() => {
        expect(screen.getByText('Select Vendor')).toBeInTheDocument();
      });
    });

    it('When New PO form shown / Then shows PO Number input', async () => {
      render(<POListPage />);
      fireEvent.click(screen.getByText('New PO'));
      const poInputs = screen.getAllByRole('textbox');
      expect(poInputs.length).toBeGreaterThan(0);
    });

    it('When × clicked in form / Then hides form', async () => {
      render(<POListPage />);
      fireEvent.click(screen.getByText('New PO'));
      const headings = screen.getAllByText('Create Purchase Order');
      expect(headings.length).toBeGreaterThan(0);
      // Close button is the × character
      fireEvent.click(screen.getByText('×'));
      expect(screen.queryAllByText('Create Purchase Order').length).toBe(0);
    });

    it('When Add Item Line clicked / Then shows item search row', async () => {
      render(<POListPage />);
      fireEvent.click(screen.getByText('New PO'));
      await waitFor(() => {
        const headings = screen.getAllByText('Create Purchase Order');
        expect(headings.length).toBeGreaterThan(0);
      });
      fireEvent.click(screen.getByText('+ Add Item'));
      await waitFor(() => {
        expect(screen.getByTestId('item-search')).toBeInTheDocument();
      });
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then New PO button is not shown', async () => {
      mockUseShellBridgePO.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        effectiveFlagsLoaded: false,
        getFeatureState: () => 'enabled',
      });
      render(<POListPage />);
      await waitFor(() => expect(screen.getByText('Purchase Orders')).toBeInTheDocument());
      expect(screen.queryByText('New PO')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then New PO button appears', async () => {
      mockUseShellBridgePO.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
      });
      render(<POListPage />);
      await waitFor(() => expect(screen.getByText('New PO')).toBeInTheDocument());
    });
  });
});
