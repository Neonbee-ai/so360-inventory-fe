import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetItems = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getItems: (...args: any[]) => mockGetItems(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, isLoading, emptyMessage, onRowClick }: any) => (
    <div data-testid="table">
      {isLoading ? 'Loading...' : data.length === 0 ? emptyMessage : data.map((d: any) => (
        <div key={d.id} data-testid={`row-${d.id}`} onClick={() => onRowClick?.(d)}>
          {d.name} | {d.sku || 'NO-SKU'} | {d.type}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@so360/shell-context', () => ({
  useModules: () => ({ isModuleEnabled: () => true }),
  useActivity: () => ({ recordActivity: vi.fn() }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, currentOrg: { id: 'org-1', name: 'Test Org' } }),
  useShell: () => ({ currentOrg: { id: 'org-1', name: 'Test Org' } }),
  useQuota: () => ({ getQuota: () => null, isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (items: any[]) => items, isLimited: false }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', is_tax_inclusive_pricing: false } }),
}));

import ItemsPage from './ItemsPage';

const makeItem = (overrides: any = {}) => ({
  id: 'item-1',
  name: 'Widget A',
  sku: 'WA-001',
  type: 'product',
  is_active: true,
  is_batch_tracked: false,
  is_serial_tracked: false,
  item_categories: { name: 'Parts' },
  units: { abbreviation: 'PCS' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItems.mockResolvedValue({ data: [] });
});

describe('ItemsPage', () => {
  describe('Given the page is loading', () => {
    it('When rendered / Then shows header text', () => {
      render(<ItemsPage />);
      expect(screen.getByText('Items')).toBeInTheDocument();
    });

    it('When rendered / Then shows subtitle', () => {
      render(<ItemsPage />);
      expect(screen.getByText('Manage physical products and trackable assets')).toBeInTheDocument();
    });

    it('When user has create permission / Then shows Register Item button', () => {
      render(<ItemsPage />);
      expect(screen.getByText('Register Item')).toBeInTheDocument();
    });
  });

  describe('Given items loaded successfully', () => {
    it('When items exist / Then renders item rows', async () => {
      mockGetItems.mockResolvedValue({ data: [makeItem(), makeItem({ id: 'item-2', name: 'Widget B', sku: 'WB-002' })] });
      render(<ItemsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('row-item-1')).toHaveTextContent('Widget A');
        expect(screen.getByTestId('row-item-2')).toHaveTextContent('Widget B');
      });
    });

    it('When item has no SKU / Then displays NO-SKU', async () => {
      mockGetItems.mockResolvedValue({ data: [makeItem({ sku: null })] });
      render(<ItemsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('row-item-1')).toHaveTextContent('NO-SKU');
      });
    });

    it('When row clicked / Then navigates to item detail', async () => {
      mockGetItems.mockResolvedValue({ data: [makeItem()] });
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-item-1'));
      fireEvent.click(screen.getByTestId('row-item-1'));
      expect(mockNavigate).toHaveBeenCalledWith('/inventory/items/item-1');
    });
  });

  describe('Given no items exist', () => {
    it('When response is empty / Then shows empty message', async () => {
      mockGetItems.mockResolvedValue({ data: [] });
      render(<ItemsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('table')).toHaveTextContent('No items found');
      });
    });
  });

  describe('Given API error', () => {
    it('When fetch fails / Then displays error banner', async () => {
      mockGetItems.mockRejectedValue(new Error('Network error'));
      render(<ItemsPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load items. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Given search filter', () => {
    it('When typing a name / Then filters items by name', async () => {
      mockGetItems.mockResolvedValue({ data: [makeItem(), makeItem({ id: 'item-2', name: 'Gadget Z', sku: 'GZ-003' })] });
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-item-1'));
      fireEvent.change(screen.getByPlaceholderText('Search SKU or Item Name...'), { target: { value: 'Gadget' } });
      expect(screen.queryByTestId('row-item-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('row-item-2')).toBeInTheDocument();
    });

    it('When typing a SKU / Then filters items by SKU', async () => {
      mockGetItems.mockResolvedValue({ data: [makeItem(), makeItem({ id: 'item-2', name: 'Gadget Z', sku: 'GZ-003' })] });
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-item-1'));
      fireEvent.change(screen.getByPlaceholderText('Search SKU or Item Name...'), { target: { value: 'WA-001' } });
      expect(screen.getByTestId('row-item-1')).toBeInTheDocument();
      expect(screen.queryByTestId('row-item-2')).not.toBeInTheDocument();
    });
  });

  describe('Given type filter', () => {
    it('When filtering by product / Then hides service items', async () => {
      mockGetItems.mockResolvedValue({ data: [makeItem(), makeItem({ id: 'item-2', name: 'Consulting', type: 'service' })] });
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-item-1'));
      fireEvent.change(screen.getByDisplayValue('All Types'), { target: { value: 'product' } });
      expect(screen.getByTestId('row-item-1')).toBeInTheDocument();
      expect(screen.queryByTestId('row-item-2')).not.toBeInTheDocument();
    });
  });
});
