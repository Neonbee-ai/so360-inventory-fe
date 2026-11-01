import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockCan = vi.hoisted(() => vi.fn((_a: string) => true));
const mockNavigate = vi.fn();
const mockGetWarehouse = vi.fn();

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({
    permissionsLoaded: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  }),
}));
vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getWarehouse: (...a: any[]) => mockGetWarehouse(...a),
    updateWarehouse: vi.fn(),
    deleteWarehouse: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    deleteLocation: vi.fn(),
  },
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'wh-1' }),
  useNavigate: () => mockNavigate,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));

import WarehouseDetailPage from './WarehouseDetailPage';

const WH = {
  id: 'wh-1', name: 'Dubai Hub', code: 'DXB', address: '1 Park', is_active: true,
  warehouse_locations: [], stock_balances: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockImplementation(() => true);
  mockGetWarehouse.mockResolvedValue(WH);
});

describe('WarehouseDetailPage (Comb)', () => {
  it('Given a loaded warehouse / When rendered / Then title and Operational status show', async () => {
    render(<WarehouseDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Dubai Hub' })).toBeInTheDocument();
    expect(screen.getByText('Operational')).toBeInTheDocument();
  });

  it('Given a pending fetch / When rendered / Then the template skeleton shows', () => {
    mockGetWarehouse.mockReturnValue(new Promise(() => {}));
    const { container } = render(<WarehouseDetailPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('Given no locations / When rendered / Then the empty state offers the first location', async () => {
    render(<WarehouseDetailPage />);
    expect(await screen.findByText('No storage locations defined')).toBeInTheDocument();
    expect(screen.getByText('Add your first location')).toBeInTheDocument();
  });

  it('Given Edit Warehouse clicked / When the modal opens / Then Cancel and Save Changes are in the footer', async () => {
    render(<WarehouseDetailPage />);
    fireEvent.click(await screen.findByLabelText('Edit Warehouse'));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Warehouse' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('Given the Warehouses trail / When back is clicked / Then it navigates to locations', async () => {
    render(<WarehouseDetailPage />);
    fireEvent.click(await screen.findByLabelText('Back to Warehouses'));
    expect(mockNavigate).toHaveBeenCalledWith('/inventory/locations');
  });

  it('Given no create permission / When rendered / Then manage actions are hidden', async () => {
    mockCan.mockImplementation(() => false);
    render(<WarehouseDetailPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dubai Hub' })).toBeInTheDocument());
    expect(screen.queryByLabelText('Edit Warehouse')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Location')).not.toBeInTheDocument();
  });
});
