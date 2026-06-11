import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const mockUseShellBridgeOv = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useShellBridge: (...args: any[]) => mockUseShellBridgeOv(...args),
}));

const mockGetStockOverview = vi.fn();
const mockGetGLInventoryValuation = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getStockOverview: (...args: any[]) => mockGetStockOverview(...args),
    getGLInventoryValuation: (...args: any[]) => mockGetGLInventoryValuation(...args),
  },
}));

vi.mock('../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, isLoading, emptyMessage }: any) => (
    <div data-testid="table">
      {isLoading ? 'Loading...' : data.length === 0 ? emptyMessage : `${data.length} rows`}
    </div>
  ),
}));

import StockOverviewPage from './StockOverviewPage';

const makeBalance = (overrides: any = {}) => ({
  id: 'sb-1',
  item_id: 'item-1',
  warehouse_id: 'wh-1',
  quantity: 100,
  valuation: 5000,
  last_updated_at: '2025-01-01T00:00:00Z',
  items: { name: 'Widget A', sku: 'WA-001', min_stock_threshold: 50, units: { abbreviation: 'PCS' } },
  warehouses: { name: 'Main Warehouse' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockGetStockOverview.mockResolvedValue([]);
  mockGetGLInventoryValuation.mockResolvedValue({ gl_balance: 0, source: 'none' });
  mockUseShellBridgeOv.mockReturnValue({
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StockOverviewPage', () => {
  describe('Given the page header', () => {
    it('When rendered / Then shows Stock Overview title', async () => {
      render(<StockOverviewPage />);
      expect(screen.getByText('Stock Overview')).toBeInTheDocument();
    });

    it('When rendered / Then shows refresh button', async () => {
      render(<StockOverviewPage />);
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('Given stock data loaded', () => {
    it('When balances exist / Then shows total positions count', async () => {
      mockGetStockOverview.mockResolvedValue([makeBalance(), makeBalance({ id: 'sb-2' })]);
      render(<StockOverviewPage />);
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('When balances exist / Then shows total stock value', async () => {
      mockGetStockOverview.mockResolvedValue([makeBalance({ valuation: 3000 }), makeBalance({ id: 'sb-2', valuation: 2000 })]);
      render(<StockOverviewPage />);
      await waitFor(() => {
        expect(screen.getByText('$5000')).toBeInTheDocument();
      });
    });

    it('When items are below min threshold / Then shows low stock count', async () => {
      mockGetStockOverview.mockResolvedValue([
        makeBalance({ quantity: 10 }),
        makeBalance({ id: 'sb-2', quantity: 200 }),
      ]);
      render(<StockOverviewPage />);
      await waitFor(() => {
        const lowStockLabel = screen.getByText('Low Stock');
        expect(lowStockLabel.parentElement).toHaveTextContent('1');
      });
    });

    it('When items have zero stock / Then shows stock out count', async () => {
      mockGetStockOverview.mockResolvedValue([
        makeBalance({ quantity: 0 }),
        makeBalance({ id: 'sb-2', quantity: 100 }),
      ]);
      render(<StockOverviewPage />);
      await waitFor(() => {
        const stockOutLabel = screen.getByText('Stock Out');
        expect(stockOutLabel.parentElement).toHaveTextContent('1');
      });
    });
  });

  describe('Given GL valuation data', () => {
    it('When GL balance available / Then shows In sync label', async () => {
      mockGetStockOverview.mockResolvedValue([makeBalance({ valuation: 5000 })]);
      mockGetGLInventoryValuation.mockResolvedValue({ gl_balance: 5000, source: 'accounting_gl' });
      render(<StockOverviewPage />);
      await waitFor(() => {
        expect(screen.getByText('In sync')).toBeInTheDocument();
      });
    });

    it('When GL unavailable / Then shows Unavailable', async () => {
      mockGetGLInventoryValuation.mockResolvedValue({ gl_balance: 0, source: 'none' });
      render(<StockOverviewPage />);
      await waitFor(() => {
        expect(screen.getByText('Unavailable')).toBeInTheDocument();
      });
    });
  });

  describe('Given no stock balances', () => {
    it('When response is empty / Then shows empty message', async () => {
      render(<StockOverviewPage />);
      await waitFor(() => {
        expect(screen.getByTestId('table')).toHaveTextContent('No stock balances found');
      });
    });
  });

  describe('Given API error', () => {
    it('When fetch fails / Then displays error banner', async () => {
      mockGetStockOverview.mockRejectedValue(new Error('fail'));
      render(<StockOverviewPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load stock data. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Given the 60s background poll', () => {
    it('When a poll tick fires / Then the table refreshes WITHOUT flashing the loading skeleton', async () => {
      mockGetStockOverview.mockResolvedValue([makeBalance()]);
      render(<StockOverviewPage />);
      // First load resolves and renders rows (not the skeleton).
      await waitFor(() => expect(screen.getByTestId('table')).toHaveTextContent('1 rows'));

      // Second tick returns more data; the poll passes showSkeleton=false.
      mockGetStockOverview.mockResolvedValue([makeBalance(), makeBalance({ id: 'sb-2' })]);
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      // Table never shows 'Loading...' on a poll tick — it updates in place.
      await waitFor(() => expect(screen.getByTestId('table')).toHaveTextContent('2 rows'));
      expect(screen.getByTestId('table')).not.toHaveTextContent('Loading...');
    });

    it('When the tab is hidden / Then the poll tick is skipped (no refetch)', async () => {
      mockGetStockOverview.mockResolvedValue([makeBalance()]);
      const hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      render(<StockOverviewPage />);
      await waitFor(() => expect(screen.getByTestId('table')).toHaveTextContent('1 rows'));
      mockGetStockOverview.mockClear();

      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      expect(mockGetStockOverview).not.toHaveBeenCalled();
      hiddenSpy.mockRestore();
    });

    it('When the tab is visible / Then the poll tick refetches', async () => {
      mockGetStockOverview.mockResolvedValue([makeBalance()]);
      const hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
      render(<StockOverviewPage />);
      await waitFor(() => expect(screen.getByTestId('table')).toHaveTextContent('1 rows'));
      mockGetStockOverview.mockClear();

      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      await waitFor(() => expect(mockGetStockOverview).toHaveBeenCalledTimes(1));
      hiddenSpy.mockRestore();
    });
  });

  describe('Given the manual Refresh button', () => {
    it('When clicked / Then it DOES show the loading skeleton (showSkeleton defaults true)', async () => {
      mockGetStockOverview.mockResolvedValue([makeBalance()]);
      render(<StockOverviewPage />);
      await waitFor(() => expect(screen.getByTestId('table')).toHaveTextContent('1 rows'));

      // Make the next fetch hang so we can observe the in-flight loading state.
      let resolveFetch: (v: any) => void = () => {};
      mockGetStockOverview.mockImplementation(
        () => new Promise((res) => { resolveFetch = res; }),
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Refresh'));
      });
      // Manual refresh flips the table to the skeleton while in flight.
      expect(screen.getByTestId('table')).toHaveTextContent('Loading...');

      await act(async () => {
        resolveFetch([makeBalance(), makeBalance({ id: 'sb-2' })]);
      });
      await waitFor(() => expect(screen.getByTestId('table')).toHaveTextContent('2 rows'));
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then GL Balance card is not shown', async () => {
      mockUseShellBridgeOv.mockReturnValue({
        effectiveFlagsLoaded: false,
        getFeatureState: () => 'enabled',
      });
      render(<StockOverviewPage />);
      await waitFor(() => expect(screen.getByText('Stock Overview')).toBeInTheDocument());
      expect(screen.queryByText('GL Balance')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then GL Balance card appears', async () => {
      mockUseShellBridgeOv.mockReturnValue({
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
      });
      render(<StockOverviewPage />);
      await waitFor(() => expect(screen.getByText('GL Balance')).toBeInTheDocument());
    });
  });
});
