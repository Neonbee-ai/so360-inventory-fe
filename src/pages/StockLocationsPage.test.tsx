import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetLocations = vi.fn();
const mockCreateWarehouse = vi.fn();
const mockUpdateWarehouse = vi.fn();
const mockDeleteWarehouse = vi.fn();
const mockRequest = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getLocations: (...args: any[]) => mockGetLocations(...args),
    createWarehouse: (...args: any[]) => mockCreateWarehouse(...args),
    updateWarehouse: (...args: any[]) => mockUpdateWarehouse(...args),
    deleteWarehouse: (...args: any[]) => mockDeleteWarehouse(...args),
    request: (...args: any[]) => mockRequest(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('../components/common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

vi.mock('../components/common/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

const mockUseShellBridgeLoc = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn() }),
  useShellBridge: (...args: any[]) => mockUseShellBridgeLoc(...args),
  useQuota: () => ({ getQuota: () => null, isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (items: any[]) => items, isLimited: false }),
}));

import StockLocationsPage from './StockLocationsPage';

const makeWarehouse = (overrides: any = {}) => ({
  id: 'wh-1',
  name: 'Main Warehouse',
  code: 'MWH',
  address: 'Dubai, UAE',
  is_active: true,
  warehouse_locations: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLocations.mockResolvedValue([]);
  mockCreateWarehouse.mockResolvedValue({ id: 'wh-new' });
  mockUpdateWarehouse.mockResolvedValue({});
  mockDeleteWarehouse.mockResolvedValue({});
  mockRequest.mockRejectedValue(new Error('no entitlement'));
  (global as any).fetch = vi.fn().mockResolvedValue({ ok: false });
  mockUseShellBridgeLoc.mockReturnValue({
    isFeatureEnabled: () => true,
    currentOrg: { id: 'org-1', name: 'Test Org' },
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
  });
});

describe('StockLocationsPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Warehouses heading', async () => {
      render(<StockLocationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });
    });

    it('When user has manage_locations permission / Then shows New Warehouse button', async () => {
      render(<StockLocationsPage />);
      await waitFor(() => {
        expect(screen.getByText('New Warehouse')).toBeInTheDocument();
      });
    });

    it('When loading / Then shows skeleton', () => {
      mockGetLocations.mockReturnValue(new Promise(() => {})); // never resolves
      render(<StockLocationsPage />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });
  });

  describe('Given warehouses are fetched', () => {
    it('When warehouses exist / Then renders warehouse cards', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse()]);
      render(<StockLocationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
      });
    });

    it('When warehouse has address / Then displays address', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse()]);
      render(<StockLocationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Dubai, UAE')).toBeInTheDocument();
      });
    });

    it('When warehouse is active / Then shows Operational badge', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse({ is_active: true })]);
      render(<StockLocationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Operational')).toBeInTheDocument();
      });
    });

    it('When warehouse is inactive / Then shows Inactive badge', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse({ is_active: false })]);
      render(<StockLocationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });

    it('When warehouse card has View link / Then navigates on click', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse()]);
      render(<StockLocationsPage />);
      await waitFor(() => screen.getByText('View'));
      fireEvent.click(screen.getByText('View'));
      expect(mockNavigate).toHaveBeenCalledWith('/inventory/warehouses/wh-1');
    });
  });

  describe('Given create warehouse flow', () => {
    it('When New Warehouse clicked / Then opens create modal', async () => {
      render(<StockLocationsPage />);
      await waitFor(() => screen.getByText('New Warehouse'));
      fireEvent.click(screen.getByText('New Warehouse'));
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText('Register New Warehouse')).toBeInTheDocument();
      });
    });

    it('When create modal open / Then shows name and code fields', async () => {
      render(<StockLocationsPage />);
      await waitFor(() => screen.getByText('New Warehouse'));
      fireEvent.click(screen.getByText('New Warehouse'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Dubai South Hub')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. DXB-01')).toBeInTheDocument();
      });
    });

    it('When form submitted / Then calls createWarehouse', async () => {
      render(<StockLocationsPage />);
      await waitFor(() => screen.getByText('New Warehouse'));
      fireEvent.click(screen.getByText('New Warehouse'));
      await waitFor(() => screen.getByPlaceholderText('e.g. Dubai South Hub'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Dubai South Hub'), { target: { value: 'South Hub' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. DXB-01'), { target: { value: 'SH-01' } });
      fireEvent.click(screen.getByText('Register Warehouse'));
      await waitFor(() => {
        expect(mockCreateWarehouse).toHaveBeenCalled();
      });
    });
  });

  describe('Given edit warehouse flow', () => {
    it('When Edit clicked / Then opens edit modal', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse()]);
      render(<StockLocationsPage />);
      await waitFor(() => screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText('Edit Warehouse')).toBeInTheDocument();
      });
    });

    it('When edit modal opens / Then pre-fills warehouse name', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse()]);
      render(<StockLocationsPage />);
      await waitFor(() => screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => {
        expect(screen.getByDisplayValue('Main Warehouse')).toBeInTheDocument();
      });
    });
  });

  describe('Given delete warehouse flow', () => {
    it('When Delete clicked / Then shows confirm dialog', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse()]);
      render(<StockLocationsPage />);
      await waitFor(() => screen.getByText('Delete'));
      fireEvent.click(screen.getByText('Delete'));
      await waitFor(() => {
        expect(screen.getByText('Delete Warehouse')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
      });
    });

    it('When confirm delete clicked / Then calls deleteWarehouse', async () => {
      mockGetLocations.mockResolvedValue([makeWarehouse()]);
      render(<StockLocationsPage />);
      await waitFor(() => screen.getByText('Delete'));
      fireEvent.click(screen.getByText('Delete'));
      await waitFor(() => screen.getByText('Delete Warehouse'));
      // Click the delete button in the dialog (the one with Trash icon text)
      const deleteButtons = screen.getAllByText('Delete');
      // last Delete button in dialog is the confirm
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      await waitFor(() => {
        expect(mockDeleteWarehouse).toHaveBeenCalledWith('wh-1');
      });
    });
  });

  describe('Given fetch error', () => {
    it('When getLocations fails / Then shows error message', async () => {
      mockGetLocations.mockRejectedValue(new Error('fail'));
      render(<StockLocationsPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load warehouses.')).toBeInTheDocument();
      });
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then New Warehouse button is not shown', async () => {
      mockUseShellBridgeLoc.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: false,
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
      });
      render(<StockLocationsPage />);
      await waitFor(() => expect(screen.getByText('Warehouses')).toBeInTheDocument());
      expect(screen.queryByText('New Warehouse')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then New Warehouse button appears', async () => {
      mockUseShellBridgeLoc.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: true,
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
      });
      render(<StockLocationsPage />);
      await waitFor(() => expect(screen.getByText('New Warehouse')).toBeInTheDocument());
    });
  });
});
