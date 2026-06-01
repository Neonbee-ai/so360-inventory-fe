/**
 * BDD — StockLocationsPage warehouse-quota gating (single source of truth).
 *
 * Covers the resolver-driven limit logic introduced when the page was collapsed
 * onto `quotaData` (from useQuota -> resolve_quota_limit), the SAME resolver the
 * backend enforces with. Asserts the derivation:
 *   whUnlimited = quotaData.is_unlimited
 *   whLimit     = (unlimited | null quota | limit <= 0) ? null : limit   // 0 = unlimited sentinel
 *   whUsed      = live warehouse count (ground truth for a count quota)
 *   atWarehouseLimit = whLimit !== null && whUsed >= whLimit
 *
 * design-system gates are stubbed to passthroughs so the test isolates THIS
 * component's logic (the gates themselves are covered in design-system).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetLocations = vi.fn();
const mockGetQuota = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getLocations: (...a: any[]) => mockGetLocations(...a),
    createWarehouse: vi.fn().mockResolvedValue({ id: 'wh-new' }),
    updateWarehouse: vi.fn().mockResolvedValue({}),
    deleteWarehouse: vi.fn().mockResolvedValue({}),
    request: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock('../components/common/Modal', () => ({
  Modal: ({ isOpen, children }: any) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}));
vi.mock('../components/common/Skeleton', () => ({ TableSkeleton: () => <div data-testid="skeleton" /> }));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn() }),
  useShellBridge: () => ({
    currentOrg: { id: 'org-1', name: 'Test Org' },
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  }),
  useQuota: () => ({ getQuota: (k: string) => mockGetQuota(k), isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (i: any[]) => i, isLimited: false }),
}));

// Passthrough gates — isolate the page's own limit logic.
vi.mock('@so360/design-system', () => ({
  FeatureGate: ({ children }: any) => <>{children}</>,
  QuotaGate: ({ children }: any) => <>{children}</>,
  QuotaBar: () => <div data-testid="quota-bar" />,
}));

import StockLocationsPage from './StockLocationsPage';

const quota = (over: Partial<Record<string, any>> = {}) => ({
  module_code: 'inventory',
  quota_key: 'max_warehouses',
  limit: -1,
  current_usage: 0,
  remaining: -1,
  is_unlimited: true,
  percentage_used: 0,
  ...over,
});
const warehouses = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `wh-${i}`, name: `WH ${i}`, is_active: true, warehouse_locations: [] }));

// The header "New Warehouse" create button (anchored to exclude "Add New Warehouse").
const createBtn = () => screen.getByRole('button', { name: /^New Warehouse/ });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLocations.mockResolvedValue([]);
  mockGetQuota.mockReturnValue(null);
  (global as any).fetch = vi.fn().mockResolvedValue({ ok: false });
});

describe('Given StockLocationsPage warehouse-quota gating', () => {
  describe('Given an enterprise/unlimited quota', () => {
    it('When is_unlimited / Then no limit banner and the create button is enabled', async () => {
      mockGetQuota.mockReturnValue(quota({ is_unlimited: true, limit: -1 }));
      mockGetLocations.mockResolvedValue(warehouses(4));
      render(<StockLocationsPage />);
      await waitFor(() => expect(screen.getByText('Warehouses')).toBeInTheDocument());
      expect(screen.queryByTestId('warehouse-limit-banner')).not.toBeInTheDocument();
      expect(createBtn()).toBeEnabled();
    });
  });

  describe('Given a finite limit with headroom', () => {
    it('When used < limit / Then banner shows "used of limit" and button stays enabled', async () => {
      mockGetQuota.mockReturnValue(quota({ is_unlimited: false, limit: 5, current_usage: 3 }));
      mockGetLocations.mockResolvedValue(warehouses(3));
      render(<StockLocationsPage />);
      const banner = await screen.findByTestId('warehouse-limit-banner');
      expect(banner.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 of 5 used');
      expect(createBtn()).toBeEnabled();
    });
  });

  describe('Given a finite limit reached', () => {
    it('When used >= limit / Then banner shows it and the create button is disabled', async () => {
      mockGetQuota.mockReturnValue(quota({ is_unlimited: false, limit: 2, current_usage: 2 }));
      mockGetLocations.mockResolvedValue(warehouses(2));
      render(<StockLocationsPage />);
      const banner = await screen.findByTestId('warehouse-limit-banner');
      expect(banner.textContent?.replace(/\s+/g, ' ').trim()).toBe('2 of 2 used');
      expect(createBtn()).toBeDisabled();
    });
  });

  describe('Given the limit=0 unlimited sentinel', () => {
    it('When limit is 0 / Then treated as unlimited (no banner, button enabled)', async () => {
      mockGetQuota.mockReturnValue(quota({ is_unlimited: false, limit: 0, current_usage: 3 }));
      mockGetLocations.mockResolvedValue(warehouses(3));
      render(<StockLocationsPage />);
      await waitFor(() => expect(screen.getByText('Warehouses')).toBeInTheDocument());
      expect(screen.queryByTestId('warehouse-limit-banner')).not.toBeInTheDocument();
      expect(createBtn()).toBeEnabled();
    });
  });

  describe('Given quota data has not resolved yet', () => {
    it('When quotaData is null / Then no banner and button is enabled (fail-open UX)', async () => {
      mockGetQuota.mockReturnValue(null);
      mockGetLocations.mockResolvedValue(warehouses(1));
      render(<StockLocationsPage />);
      await waitFor(() => expect(screen.getByText('Warehouses')).toBeInTheDocument());
      expect(screen.queryByTestId('warehouse-limit-banner')).not.toBeInTheDocument();
      expect(createBtn()).toBeEnabled();
    });
  });
});
