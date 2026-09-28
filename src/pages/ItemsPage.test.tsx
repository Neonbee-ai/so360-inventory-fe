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

const mockUseShellBridge = vi.fn();

vi.mock('@so360/shell-context', () => ({
  useModules: () => ({ isModuleEnabled: () => true }),
  useActivity: () => ({ recordActivity: vi.fn() }),
  useShellBridge: (...args: any[]) => mockUseShellBridge(...args),
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
  mockUseShellBridge.mockReturnValue({
    isFeatureEnabled: () => true,
    currentOrg: { id: 'org-1', name: 'Test Org' },
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
  });
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

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then Register Item button is not shown', async () => {
      mockUseShellBridge.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: false,
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
      });
      render(<ItemsPage />);
      await waitFor(() => expect(screen.getByText('Items')).toBeInTheDocument());
      expect(screen.queryByText('Register Item')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then Register Item button appears', async () => {
      mockUseShellBridge.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: true,
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
      });
      render(<ItemsPage />);
      await waitFor(() => expect(screen.getByText('Register Item')).toBeInTheDocument());
    });
  });
});

// ── Role-permission gating (RBAC action-level) ─────────────────────────────
// Register Item was gated only on the plan feature-state; it now also requires
// items.create via the live Shell entitlements, fail-closed.
describe('ItemsPage — Register Item permission gating', () => {
  it('Given the user lacks items.create / Then Register Item is hidden', () => {
    mockUseShellBridge.mockReturnValue({
      currentOrg: { id: 'org-1' }, effectiveFlagsLoaded: true, getFeatureState: () => 'enabled',
      permissionsLoaded: true, hasPermission: (c: string) => c !== 'items.create', hasAnyPermission: () => true,
    });
    render(<ItemsPage />);
    expect(screen.queryByText('Register Item')).not.toBeInTheDocument();
  });

  it('Given entitlements have not resolved / Then Register Item fails closed (hidden)', () => {
    mockUseShellBridge.mockReturnValue({
      currentOrg: { id: 'org-1' }, effectiveFlagsLoaded: true, getFeatureState: () => 'enabled',
      permissionsLoaded: false, hasPermission: () => true, hasAnyPermission: () => true,
    });
    render(<ItemsPage />);
    expect(screen.queryByText('Register Item')).not.toBeInTheDocument();
  });
});

describe('ItemsPage — Photos need attention filter', () => {
  it('Given the page loads / When the filter is off / Then the plain item list is requested', async () => {
    render(<ItemsPage />);
    await waitFor(() => expect(mockGetItems).toHaveBeenCalledTimes(1));
    expect(mockGetItems.mock.calls[0]).toEqual([]);
  });

  it('Given flagged and unflagged items / When the filter is turned on / Then the API is asked for flagged items and only those are shown', async () => {
    mockGetItems.mockResolvedValue({
      data: [
        makeItem({ id: 'bad', name: 'Blurry', image_needs_attention: true }),
        makeItem({ id: 'ok', name: 'Sharp', image_needs_attention: false }),
      ],
    });
    render(<ItemsPage />);
    await waitFor(() => expect(screen.getByTestId('row-ok')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Photos need attention/i }));

    await waitFor(() =>
      expect(mockGetItems).toHaveBeenLastCalledWith(expect.objectContaining({ imageNeedsAttention: true })),
    );
    await waitFor(() => expect(screen.queryByTestId('row-ok')).not.toBeInTheDocument());
    expect(screen.getByTestId('row-bad')).toBeInTheDocument();
  });

  it('Given the API does not know the flag yet (returns everything) / When the filter is on / Then no unflagged item is shown as needing attention', async () => {
    mockGetItems.mockResolvedValue({ data: [makeItem({ id: 'legacy', name: 'Legacy' })] });
    render(<ItemsPage />);
    await waitFor(() => expect(screen.getByTestId('row-legacy')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Photos need attention/i }));

    await waitFor(() =>
      expect(screen.getByText('No items with photos that need attention.')).toBeInTheDocument(),
    );
  });

  it('Given the filter is on / When clicked again / Then the full list is requested again', async () => {
    render(<ItemsPage />);
    const toggle = screen.getByRole('button', { name: /Photos need attention/i });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'false'));
    await waitFor(() => expect(mockGetItems.mock.calls[mockGetItems.mock.calls.length - 1]).toEqual([]));
  });
});
