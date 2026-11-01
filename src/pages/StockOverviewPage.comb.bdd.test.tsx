import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
const mockShell = vi.fn();
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => mockShell() }));
const mockOverview = vi.fn();
const mockGl = vi.fn();
vi.mock('../services/inventoryService', () => ({
  inventoryService: { getStockOverview: (...a: any[]) => mockOverview(...a), getGLInventoryValuation: (...a: any[]) => mockGl(...a) },
}));
vi.mock('../utils/formatters', () => ({
  useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}` }),
}));

import StockOverviewPage from './StockOverviewPage';

const bal = (o: any = {}) => ({ id: 'b1', quantity: 100, valuation: 1000, last_updated_at: '2025-01-01', items: { name: 'Widget', sku: 'W-1', min_stock_threshold: 10, units: { abbreviation: 'PCS' } }, warehouses: { name: 'Main' }, ...o });

beforeEach(() => {
  vi.clearAllMocks();
  mockShell.mockReturnValue({ effectiveFlagsLoaded: true, getFeatureState: () => 'enabled' });
  mockOverview.mockResolvedValue([bal()]);
  mockGl.mockResolvedValue({ source: 'none', gl_balance: 0 });
});

describe('StockOverviewPage on the Comb list floorplan', () => {
  it('Given the page renders / When data loads / Then title, Refresh action and KPI strip are present', async () => {
    render(<StockOverviewPage />);
    expect(screen.getByRole('heading', { name: 'Stock Overview' })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(1));
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Total Positions')).toBeInTheDocument();
  });

  it('Given the fetch is pending / When rendered / Then the table shows its loading state', () => {
    mockOverview.mockReturnValue(new Promise(() => {}));
    render(<StockOverviewPage />);
    expect(screen.getByTestId('datatable-loading')).toBeInTheDocument();
  });

  it('Given no balances / When loaded / Then the empty state is shown', async () => {
    mockOverview.mockResolvedValue([]);
    render(<StockOverviewPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toHaveTextContent('No stock balances found'));
  });

  it('Given two warehouses / When the Warehouse filter is chosen in the drawer / Then only that warehouse is listed', async () => {
    mockOverview.mockResolvedValue([bal(), bal({ id: 'b2', warehouses: { name: 'Annex' } })]);
    render(<StockOverviewPage />);
    await waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(2));
    fireEvent.click(screen.getByTestId('filters-button'));
    fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: 'Annex' } });
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('Given the GL valuation flag is hidden / When rendered / Then the GL Balance KPI is not shown', async () => {
    mockShell.mockReturnValue({ effectiveFlagsLoaded: true, getFeatureState: () => 'hidden' });
    render(<StockOverviewPage />);
    await waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(1));
    expect(screen.queryByText('GL Balance')).not.toBeInTheDocument();
  });
});
