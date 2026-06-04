import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const mockGetItems = vi.fn();
const mockGetLocations = vi.fn();
const mockGetAdjustmentHistory = vi.fn();
const mockCreateAdjustment = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getItems: (...args: any[]) => mockGetItems(...args),
    getLocations: (...args: any[]) => mockGetLocations(...args),
    getAdjustmentHistory: (...args: any[]) => mockGetAdjustmentHistory(...args),
    createAdjustment: (...args: any[]) => mockCreateAdjustment(...args),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

const mockUseShellBridgeAdj = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: (...args: any[]) => mockUseShellBridgeAdj(...args),
  useQuota: () => ({ getQuota: () => null, isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (items: any[]) => items, isLimited: false }),
}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, isLoading, emptyMessage }: any) => (
    <div data-testid="table">
      {isLoading ? 'Loading...' : data.length === 0 ? emptyMessage : `${data.length} rows`}
    </div>
  ),
}));

vi.mock('../components/common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

vi.mock('../utils/formatters', () => ({
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

import StockAdjustmentsPage from './StockAdjustmentsPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItems.mockResolvedValue({ data: [{ id: 'item-1', name: 'Widget', sku: 'W-001' }] });
  mockGetLocations.mockResolvedValue([{ id: 'wh-1', name: 'Main WH' }]);
  mockGetAdjustmentHistory.mockResolvedValue([]);
  mockUseShellBridgeAdj.mockReturnValue({
    isFeatureEnabled: () => true,
    currentOrg: { id: 'org-1', name: 'Test Org' },
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
});

describe('StockAdjustmentsPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Stock Adjustments title', async () => {
      render(<StockAdjustmentsPage />);
      expect(screen.getByText('Stock Adjustments')).toBeInTheDocument();
    });

    it('When user has permission / Then shows New Adjustment button', async () => {
      render(<StockAdjustmentsPage />);
      expect(screen.getByText('New Adjustment')).toBeInTheDocument();
    });

    it('When no adjustments exist / Then shows empty message', async () => {
      render(<StockAdjustmentsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('table')).toHaveTextContent('No recent adjustments found');
      });
    });
  });

  describe('Given the adjustment modal', () => {
    it('When New Adjustment clicked / Then opens modal with form', async () => {
      render(<StockAdjustmentsPage />);
      fireEvent.click(screen.getByText('New Adjustment'));
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText('Manual Stock Adjustment')).toBeInTheDocument();
      });
    });

    it('When modal opens / Then shows item dropdown with fetched items', async () => {
      render(<StockAdjustmentsPage />);
      fireEvent.click(screen.getByText('New Adjustment'));
      await waitFor(() => {
        expect(screen.getByText('Widget (W-001)')).toBeInTheDocument();
      });
    });

    it('When modal opens / Then shows warehouse dropdown', async () => {
      render(<StockAdjustmentsPage />);
      fireEvent.click(screen.getByText('New Adjustment'));
      await waitFor(() => {
        expect(screen.getByText('Main WH')).toBeInTheDocument();
      });
    });

    it('When modal opens / Then shows Increase and Decrease buttons', async () => {
      render(<StockAdjustmentsPage />);
      fireEvent.click(screen.getByText('New Adjustment'));
      await waitFor(() => {
        expect(screen.getByText('Increase')).toBeInTheDocument();
        expect(screen.getByText('Decrease')).toBeInTheDocument();
      });
    });

    it('When modal opens / Then shows reason code dropdown with options', async () => {
      render(<StockAdjustmentsPage />);
      fireEvent.click(screen.getByText('New Adjustment'));
      await waitFor(() => {
        expect(screen.getByText('Damaged')).toBeInTheDocument();
        expect(screen.getByText('Lost / Stolen')).toBeInTheDocument();
        expect(screen.getByText('Inventory Count Correction')).toBeInTheDocument();
      });
    });
  });

  describe('Given fetch failure', () => {
    it('When data fetch fails / Then shows error message', async () => {
      mockGetItems.mockRejectedValue(new Error('fail'));
      render(<StockAdjustmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
      });
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then New Adjustment button is not shown', async () => {
      mockUseShellBridgeAdj.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        effectiveFlagsLoaded: false,
        getFeatureState: () => 'enabled',
      });
      render(<StockAdjustmentsPage />);
      await waitFor(() => expect(screen.getByText('Stock Adjustments')).toBeInTheDocument());
      expect(screen.queryByText('New Adjustment')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then New Adjustment button appears', async () => {
      mockUseShellBridgeAdj.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
      });
      render(<StockAdjustmentsPage />);
      await waitFor(() => expect(screen.getByText('New Adjustment')).toBeInTheDocument());
    });
  });
});
