import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetLocations = vi.fn();
const mockCan = vi.fn((_: string) => true);
const mockNavigate = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getLocations: (...a: any[]) => mockGetLocations(...a),
    createWarehouse: vi.fn().mockResolvedValue({ id: 'wh-new' }),
    updateWarehouse: vi.fn().mockResolvedValue({}),
    deleteWarehouse: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: (p: string) => mockCan(p) }) }));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({
    currentOrg: { id: 'org-1', name: 'Test Org' },
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
    effectiveFlagsLoaded: true, getFeatureState: () => 'enabled',
  }),
  useQuota: () => ({ getQuota: () => null, isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (i: any[]) => i, isLimited: false }),
}));

import StockLocationsPage from './StockLocationsPage';

const wh = (o: any = {}) => ({ id: 'wh-1', name: 'Dubai South Hub', code: 'DXB-01', address: 'Jebel Ali', is_active: true, warehouse_locations: [], ...o });

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockGetLocations.mockResolvedValue([wh()]);
});

describe('StockLocationsPage on the Comb list floorplan', () => {
  it('Given the page renders / When loaded / Then the title and New Warehouse primary action show', async () => {
    render(<StockLocationsPage />);
    expect(screen.getByRole('heading', { name: 'Warehouses' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Dubai South Hub')).toBeInTheDocument());
    expect(document.querySelector('[data-slot="primary"]')).toHaveTextContent('New Warehouse');
  });

  it('Given the fetch is pending / When rendered / Then a loading state shows', () => {
    mockGetLocations.mockReturnValue(new Promise(() => {}));
    render(<StockLocationsPage />);
    expect(screen.getByTestId('datatable-loading')).toBeInTheDocument();
  });

  it('Given no warehouses / When loaded / Then the empty state offers Add New Warehouse', async () => {
    mockGetLocations.mockResolvedValue([]);
    render(<StockLocationsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(screen.getByTestId('empty-state-add-warehouse')).toHaveTextContent('Add New Warehouse');
  });

  it('Given a warehouse row / When View is clicked / Then navigates to its detail page', async () => {
    render(<StockLocationsPage />);
    await waitFor(() => screen.getByText('View'));
    fireEvent.click(screen.getByText('View'));
    expect(mockNavigate).toHaveBeenCalledWith('/inventory/warehouses/wh-1');
  });

  it('Given New Warehouse is clicked / When the modal opens / Then Cancel and Register Warehouse form the footer', async () => {
    render(<StockLocationsPage />);
    await waitFor(() => screen.getByText('New Warehouse'));
    fireEvent.click(screen.getByText('New Warehouse'));
    const dialog = await screen.findByRole('dialog', { name: 'Register New Warehouse' });
    expect(dialog).toHaveTextContent('Cancel');
    expect(dialog).toHaveTextContent('Register Warehouse');
  });

  it('Given the user lacks warehouses.create / When loaded / Then no create, edit or delete controls show', async () => {
    mockCan.mockReturnValue(false);
    render(<StockLocationsPage />);
    await waitFor(() => screen.getByText('Dubai South Hub'));
    expect(screen.queryByText('New Warehouse')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
