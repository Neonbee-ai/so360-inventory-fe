import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getMovements: vi.fn(),
    getLocations: vi.fn(),
    getOrgDefaultLogic: vi.fn(),
    searchProjects: vi.fn(),
    searchWorkOrders: vi.fn(),
    getItems: vi.fn(),
    getStockAvailability: vi.fn(),
    createAdjustment: vi.fn(),
    createTransfer: vi.fn(),
  },
}));
vi.mock('@so360/shell-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@so360/shell-context')>();
  return {
    ...actual,
    useShellBridge: () => ({
      effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true,
      hasAnyPermission: () => true, getFeatureState: () => 'enabled', currentOrg: { id: 'org-1' },
    }),
  };
});
const mockCan = vi.hoisted(() => vi.fn((_a: string) => true));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));

import StockMovementRegisterPage from './StockMovementRegisterPage';
import { inventoryService } from '../services/inventoryService';

const inv = inventoryService as any;
const page = (rows: any[]) => ({ data: rows, total: rows.length, limit: 100, offset: 0, has_more: false });
const renderPage = () => render(<MemoryRouter><StockMovementRegisterPage /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mockCan.mockImplementation(() => true);
  inv.getMovements.mockResolvedValue(page([]));
  inv.getLocations.mockResolvedValue([{ id: 'wh-1', name: 'Main WH' }]);
  inv.getOrgDefaultLogic.mockResolvedValue({
    allow_negative_stock: false, auto_approve_transfers: false, allow_backdated_transactions: false,
    backdate_max_days: 0, allow_future_dated_transactions: false,
  });
  inv.searchProjects.mockResolvedValue([]);
  inv.searchWorkOrders.mockResolvedValue([]);
  inv.getItems.mockResolvedValue({ data: [] });
});

describe('StockMovementRegisterPage (Comb)', () => {
  it('Given the page / When rendered / Then title and New Transaction action show', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Stock Transactions' })).toBeInTheDocument();
    expect(await screen.findByText('New Transaction')).toBeInTheDocument();
  });

  it('Given a pending fetch / When rendered / Then the loading skeleton shows', () => {
    inv.getMovements.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('Given no movements / When loaded / Then the empty state shows', async () => {
    renderPage();
    expect(await screen.findByText('No stock movements found.')).toBeInTheDocument();
  });

  it('Given the filters drawer / When a movement type is chosen / Then it is sent to the API', async () => {
    renderPage();
    await waitFor(() => expect(inv.getMovements).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('filters-button'));
    fireEvent.change(screen.getByLabelText('Movement Type'), { target: { value: 'transfer' } });
    await waitFor(() =>
      expect(inv.getMovements).toHaveBeenLastCalledWith(expect.objectContaining({ movement_type: 'transfer' })),
    );
  });

  it('Given New Transaction clicked / When the modal opens / Then the footer has Cancel and Record Transaction', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('New Transaction'));
    expect(await screen.findByRole('dialog', { name: 'Record Stock Transaction' })).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Record Transaction')).toBeInTheDocument();
  });

  it('Given no stock.adjust permission / When rendered / Then New Transaction is hidden', async () => {
    mockCan.mockImplementation(() => false);
    renderPage();
    await waitFor(() => expect(inv.getMovements).toHaveBeenCalled());
    expect(screen.queryByText('New Transaction')).not.toBeInTheDocument();
  });
});
