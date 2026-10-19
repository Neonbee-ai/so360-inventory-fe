import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetItems = vi.fn();
const mockNavigate = vi.fn();
const mockCan = vi.fn((_: string) => true);
const mockShell = vi.fn();

vi.mock('../services/inventoryService', () => ({ inventoryService: { getItems: (...a: any[]) => mockGetItems(...a) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: (p: string) => mockCan(p) }) }));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockShell(),
  useQuota: () => ({ getQuota: () => null }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, isLimited: () => false }),
}));

import ItemsPage from './ItemsPage';

const item = (o: any = {}) => ({ id: 'i1', name: 'Widget A', sku: 'WA-1', type: 'product', is_active: true, item_categories: { name: 'Parts' }, units: { abbreviation: 'PCS' }, ...o });

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockGetItems.mockResolvedValue({ data: [item()] });
  mockShell.mockReturnValue({ currentOrg: { id: 'o1' }, permissionsLoaded: true, hasPermission: () => true, effectiveFlagsLoaded: true, getFeatureState: () => 'enabled' });
});

describe('ItemsPage on the Comb list floorplan', () => {
  it('Given the page renders / When loaded / Then the ListPageTemplate shows the title and Register Item as primary action', async () => {
    render(<ItemsPage />);
    expect(screen.getByRole('heading', { name: 'Items' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('row-i1')).toBeInTheDocument());
    expect(document.querySelector('[data-slot="primary"]')).toHaveTextContent('Register Item');
  });

  it('Given the fetch is pending / When rendered / Then a loading state is shown instead of rows', () => {
    mockGetItems.mockReturnValue(new Promise(() => {}));
    render(<ItemsPage />);
    expect(screen.getByTestId('datatable-loading')).toBeInTheDocument();
  });

  it('Given no items exist / When loaded / Then the empty state is shown', async () => {
    mockGetItems.mockResolvedValue({ data: [] });
    render(<ItemsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toHaveTextContent('No items found'));
  });

  it('Given a row / When clicked / Then navigates to the item detail', async () => {
    render(<ItemsPage />);
    await waitFor(() => screen.getByTestId('row-i1'));
    fireEvent.click(screen.getByTestId('row-i1'));
    expect(mockNavigate).toHaveBeenCalledWith('/inventory/items/i1');
  });

  it('Given the type filter drawer / When a type is chosen / Then non-matching items are hidden', async () => {
    mockGetItems.mockResolvedValue({ data: [item(), item({ id: 'i2', name: 'Consulting', type: 'service' })] });
    render(<ItemsPage />);
    await waitFor(() => screen.getByTestId('row-i2'));
    fireEvent.click(screen.getByTestId('filters-button'));
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'product' } });
    expect(screen.queryByTestId('row-i2')).not.toBeInTheDocument();
    expect(screen.getByTestId('row-i1')).toBeInTheDocument();
  });

  it('Given the user lacks items.create / When rendered / Then Register Item is hidden', async () => {
    mockCan.mockImplementation((p: string) => p !== 'items.create');
    render(<ItemsPage />);
    await waitFor(() => screen.getByTestId('row-i1'));
    expect(screen.queryByText('Register Item')).not.toBeInTheDocument();
  });

  it('Given the bulk-import feature flag is hidden / When rendered / Then Bulk Import is not offered', async () => {
    mockShell.mockReturnValue({ currentOrg: { id: 'o1' }, permissionsLoaded: true, hasPermission: () => true, effectiveFlagsLoaded: true, getFeatureState: (k: string) => (k.includes('bulk_import') ? 'hidden' : 'enabled') });
    render(<ItemsPage />);
    await waitFor(() => screen.getByTestId('row-i1'));
    expect(screen.queryByText('Bulk Import')).not.toBeInTheDocument();
  });
});
