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
        expect(screen.getByText(/No items found/)).toBeInTheDocument();
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
    it('When typing a name / Then the term is sent to the API (whole catalogue) after the debounce', async () => {
      mockGetItems.mockResolvedValue({ data: [makeItem()], pagination: { total: 1 } });
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-item-1'));
      fireEvent.change(screen.getByPlaceholderText('Search SKU or Item Name...'), { target: { value: 'Gadget' } });
      await waitFor(() =>
        expect(mockGetItems).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Gadget', page: 1 })),
      );
    });

    it('When the search is cleared / Then the search param is dropped again', async () => {
      render(<ItemsPage />);
      const box = screen.getByPlaceholderText('Search SKU or Item Name...');
      fireEvent.change(box, { target: { value: 'abc' } });
      await waitFor(() => expect(mockGetItems).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'abc' })));
      fireEvent.change(box, { target: { value: '' } });
      await waitFor(() => expect(mockGetItems.mock.calls[mockGetItems.mock.calls.length - 1][0]).not.toHaveProperty('search'));
    });
  });

  describe('Given type filter', () => {
    it('When filtering by product / Then the API is asked for type=product', async () => {
      mockGetItems.mockResolvedValue({ data: [makeItem()], pagination: { total: 1 } });
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-item-1'));
      fireEvent.click(screen.getByTestId('filters-button'));
      fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'product' } });
      await waitFor(() =>
        expect(mockGetItems).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'product', page: 1 })),
      );
    });
  });

  describe('Given more items than one page (65 items, 50 per page)', () => {
    const pageOf = (n: number, from: number) =>
      Array.from({ length: n }, (_, i) => makeItem({ id: `p${from + i}`, name: `Item ${from + i}`, sku: `S${from + i}` }));

    beforeEach(() => {
      mockGetItems.mockImplementation(async (p: any) =>
        p?.page === 2
          ? { data: pageOf(15, 51), pagination: { page: 2, limit: 50, total: 65, totalPages: 2 } }
          : { data: pageOf(50, 1), pagination: { page: 1, limit: 50, total: 65, totalPages: 2 } },
      );
    });

    it('When the page loads / Then the first page is requested with an explicit limit and the total is shown', async () => {
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-p1'));
      expect(mockGetItems.mock.calls[0][0]).toMatchObject({ page: 1, limit: 50 });
      expect(screen.getByTestId('pagination')).toHaveAttribute('data-total', '65');
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.queryByTestId('row-p51')).not.toBeInTheDocument();
    });

    it('When the next page is chosen / Then items 51-65 are fetched and shown', async () => {
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-p1'));
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => expect(screen.getByTestId('row-p65')).toBeInTheDocument());
      expect(mockGetItems).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 50 }));
      expect(screen.queryByTestId('row-p1')).not.toBeInTheDocument();
    });

    it('When on page 2 and a search is typed / Then it returns to page 1', async () => {
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-p1'));
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => screen.getByTestId('row-p65'));
      fireEvent.change(screen.getByPlaceholderText('Search SKU or Item Name...'), { target: { value: 'x' } });
      await waitFor(() =>
        expect(mockGetItems).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'x', page: 1 })),
      );
    });
  });

  describe('Given 3 pages of items and the user is on page 3', () => {
    const rows = (from: number) => Array.from({ length: 50 }, (_, i) => makeItem({ id: `q${from + i}`, name: `Item ${from + i}`, sku: `Q${from + i}` }));

    beforeEach(() => {
      mockGetItems.mockImplementation(async (p: any) => {
        const page = p?.page ?? 1;
        return { data: rows((page - 1) * 50 + 1), pagination: { page, limit: 50, total: 150, totalPages: 3 } };
      });
    });

    it('When a search is typed / Then exactly one request is made and it asks for page 1 (no stale page-3 request)', async () => {
      render(<ItemsPage />);
      await waitFor(() => screen.getByTestId('row-q1'));
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => screen.getByTestId('row-q51'));
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => screen.getByTestId('row-q101'));
      mockGetItems.mockClear();

      fireEvent.change(screen.getByPlaceholderText('Search SKU or Item Name...'), { target: { value: 'x' } });
      await waitFor(() => expect(mockGetItems).toHaveBeenCalled());
      // Let any extra effect-driven fetch settle before counting.
      await new Promise((r) => setTimeout(r, 50));

      expect(mockGetItems).toHaveBeenCalledTimes(1);
      expect(mockGetItems).toHaveBeenCalledWith(expect.objectContaining({ search: 'x', page: 1 }));
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
  it('Given the page loads / When the filter is off / Then the first server page is requested', async () => {
    render(<ItemsPage />);
    await waitFor(() => expect(mockGetItems).toHaveBeenCalledTimes(1));
    expect(mockGetItems.mock.calls[0][0]).toEqual({ page: 1, limit: 50, sortBy: 'created_at', sortOrder: 'desc' });
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

    fireEvent.click(screen.getByTestId('filters-button'));
    fireEvent.click(screen.getByTestId('filter-attention'));

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

    fireEvent.click(screen.getByTestId('filters-button'));
    fireEvent.click(screen.getByTestId('filter-attention'));

    await waitFor(() =>
      expect(screen.getByText('No items with photos that need attention.')).toBeInTheDocument(),
    );
  });

  it('Given the filter is on / When clicked again / Then the full list is requested again', async () => {
    render(<ItemsPage />);
    fireEvent.click(screen.getByTestId('filters-button'));
    const toggle = screen.getByTestId('filter-attention');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    await waitFor(() => expect(mockGetItems.mock.calls[mockGetItems.mock.calls.length - 1][0]).toMatchObject({ page: 1, limit: 50 }));
  });
});
