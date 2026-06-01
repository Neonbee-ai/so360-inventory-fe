import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockUseShellBridgeWD = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: (...args: any[]) => mockUseShellBridgeWD(...args),
}));

const mockGetWarehouse = vi.fn();
const mockUpdateWarehouse = vi.fn();
const mockDeleteWarehouse = vi.fn();
const mockCreateLocation = vi.fn();
const mockUpdateLocation = vi.fn();
const mockDeleteLocation = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getWarehouse: (...args: any[]) => mockGetWarehouse(...args),
    updateWarehouse: (...args: any[]) => mockUpdateWarehouse(...args),
    deleteWarehouse: (...args: any[]) => mockDeleteWarehouse(...args),
    createLocation: (...args: any[]) => mockCreateLocation(...args),
    updateLocation: (...args: any[]) => mockUpdateLocation(...args),
    deleteLocation: (...args: any[]) => mockDeleteLocation(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'wh-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('../components/common/Modal', () => ({
  Modal: ({ isOpen, title, children, onClose }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <h3>{title}</h3>
        {children}
        <button onClick={onClose} data-testid="modal-close">Close</button>
      </div>
    ) : null,
}));

vi.mock('../components/common/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

import WarehouseDetailPage from './WarehouseDetailPage';

const makeWarehouse = (overrides: any = {}) => ({
  id: 'wh-1',
  name: 'Main Warehouse',
  code: 'MW-001',
  address: '123 Main St',
  is_active: true,
  warehouse_locations: [],
  stock_balances: [],
  ...overrides,
});

const makeLocation = (overrides: any = {}) => ({
  id: 'loc-1',
  name: 'Shelf A',
  code: 'SA-1',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWarehouse.mockResolvedValue(makeWarehouse());
  mockUpdateWarehouse.mockResolvedValue({});
  mockDeleteWarehouse.mockResolvedValue({});
  mockCreateLocation.mockResolvedValue({ id: 'loc-new' });
  mockUpdateLocation.mockResolvedValue({});
  mockDeleteLocation.mockResolvedValue({});
  mockUseShellBridgeWD.mockReturnValue({
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
});

describe('WarehouseDetailPage', () => {
  describe('Given loading state', () => {
    it('When page is loading / Then shows skeleton', () => {
      mockGetWarehouse.mockReturnValue(new Promise(() => {}));
      render(<WarehouseDetailPage />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });
  });

  describe('Given API error with no data', () => {
    it('When fetch fails / Then shows error message', async () => {
      mockGetWarehouse.mockRejectedValue(new Error('Warehouse not found'));
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Warehouse not found')).toBeInTheDocument();
      });
    });
  });

  describe('Given warehouse data loads', () => {
    it('When loaded / Then shows warehouse name', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows warehouse code', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('MW-001')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows back button with "Back to Warehouses" text', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Warehouses')).toBeInTheDocument();
      });
    });

    it('When loaded with address / Then shows address', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
      });
    });

    it('When loaded with active warehouse / Then shows Operational status', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Operational')).toBeInTheDocument();
      });
    });

    it('When loaded with inactive warehouse / Then shows Inactive status', async () => {
      mockGetWarehouse.mockResolvedValue(makeWarehouse({ is_active: false }));
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });
  });

  describe('Given storage locations', () => {
    it('When warehouse has locations / Then shows location names', async () => {
      mockGetWarehouse.mockResolvedValue(
        makeWarehouse({ warehouse_locations: [makeLocation()] })
      );
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Shelf A')).toBeInTheDocument();
      });
    });

    it('When Add Location clicked / Then shows location modal', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => expect(screen.getByText('Main Warehouse')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Location'));
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  describe('Given edit warehouse', () => {
    it('When Edit Warehouse icon button clicked / Then opens edit modal', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => expect(screen.getByText('Main Warehouse')).toBeInTheDocument());
      // Edit button has title="Edit Warehouse"
      fireEvent.click(screen.getByTitle('Edit Warehouse'));
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  describe('Given delete warehouse', () => {
    it('When Delete Warehouse icon button clicked / Then shows confirm dialog', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => expect(screen.getByText('Main Warehouse')).toBeInTheDocument());
      fireEvent.click(screen.getByTitle('Delete Warehouse'));
      await waitFor(() => {
        expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given back navigation', () => {
    it('When Back to Warehouses clicked / Then navigates to locations', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => expect(screen.getByText('Main Warehouse')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Back to Warehouses'));
      expect(mockNavigate).toHaveBeenCalledWith('/inventory/locations');
    });
  });

  describe('Given API getWarehouse on mount', () => {
    it('When component mounts / Then calls getWarehouse with id', async () => {
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(mockGetWarehouse).toHaveBeenCalledWith('wh-1');
      });
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then Edit and Delete warehouse buttons are not shown', async () => {
      mockUseShellBridgeWD.mockReturnValue({
        effectiveFlagsLoaded: false,
        getFeatureState: () => 'enabled',
      });
      render(<WarehouseDetailPage />);
      await waitFor(() => expect(screen.getByText('Main Warehouse')).toBeInTheDocument());
      expect(screen.queryByTitle('Edit Warehouse')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Delete Warehouse')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then Edit and Delete buttons appear', async () => {
      mockUseShellBridgeWD.mockReturnValue({
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
      });
      render(<WarehouseDetailPage />);
      await waitFor(() => {
        expect(screen.getByTitle('Edit Warehouse')).toBeInTheDocument();
        expect(screen.getByTitle('Delete Warehouse')).toBeInTheDocument();
      });
    });
  });
});
