import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

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
    formatCurrency: (v: number) => `$${v}`,
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
});
