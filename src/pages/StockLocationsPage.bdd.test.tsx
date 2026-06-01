/**
 * BDD spec — StockLocationsPage warehouse limit gating
 *
 * Invariants:
 *   - atWarehouseLimit is false when quotaData.is_unlimited is true,
 *     regardless of maxWarehouses / warehouses.length values
 *   - atWarehouseLimit is false when maxWarehouses is null
 *   - atWarehouseLimit is true only when NOT unlimited AND count >= limit
 *   - Warehouse usage label reads "{count} of {limit} used" (not "count / limit")
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mutable holders (must use vi.hoisted so they are accessible inside vi.mock factories)
const h = vi.hoisted(() => ({
  warehouses: [] as any[],
  maxWarehouses: null as number | null,
  quotaData: null as { current_usage: number; limit: number; is_unlimited: boolean } | null,
}));

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getLocations: vi.fn().mockImplementation(() => Promise.resolve(h.warehouses)),
    request: vi.fn().mockImplementation(() =>
      Promise.resolve({ max_warehouses: h.maxWarehouses }),
    ),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
    currentOrg: { id: 'org-1' },
  }),
  useActivity: () => ({ recordActivity: vi.fn() }),
  useQuota: () => ({
    getQuota: (key: string) => (key === 'max_warehouses' ? h.quotaData : null),
  }),
}));

vi.mock('@so360/design-system', () => ({
  QuotaBar: () => null,
  QuotaGate: ({ children }: any) => <>{children}</>,
  FeatureGate: ({ children }: any) => <>{children}</>,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('../components/common/Modal', () => ({
  Modal: () => null,
}));

vi.mock('../components/common/Skeleton', () => ({
  TableSkeleton: () => null,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import StockLocationsPage from './StockLocationsPage';

function renderPage() {
  return render(<StockLocationsPage />);
}

function makeWarehouse(i: number) {
  return { id: `w${i}`, name: `WH-${i}`, code: `WH${i}`, is_active: true, address: '', warehouse_locations: [] };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StockLocationsPage — atWarehouseLimit with is_unlimited=true', () => {
  describe('Given enterprise plan (is_unlimited=true) with 4 warehouses and stale limit of 3', () => {
    beforeEach(() => {
      h.warehouses = [0, 1, 2, 3].map(makeWarehouse);
      h.maxWarehouses = 3;
      h.quotaData = { current_usage: 4, limit: 3, is_unlimited: true };
    });

    it('does NOT disable the New Warehouse button', async () => {
      const { findByRole } = renderPage();
      const btn = await findByRole('button', { name: /New Warehouse/i });
      expect(btn).not.toBeDisabled();
    });

    it('does NOT render the usage limit banner', async () => {
      const { container } = renderPage();
      await waitFor(() => {
        // maxWarehouses=3 is returned but is_unlimited=true → banner should not render
        expect(container.querySelector('[data-testid="warehouse-limit-banner"]')).toBeNull();
      });
    });
  });
});

describe('StockLocationsPage — atWarehouseLimit with maxWarehouses=null', () => {
  describe('Given entitlement-limits returns null (unlimited by null sentinel)', () => {
    beforeEach(() => {
      h.warehouses = [0, 1, 2].map(makeWarehouse);
      h.maxWarehouses = null;
      h.quotaData = { current_usage: 3, limit: 0, is_unlimited: false };
    });

    it('does NOT disable the New Warehouse button', async () => {
      const { findByRole } = renderPage();
      const btn = await findByRole('button', { name: /New Warehouse/i });
      expect(btn).not.toBeDisabled();
    });
  });
});

describe('StockLocationsPage — atWarehouseLimit enforced (NOT unlimited)', () => {
  describe('Given plan limit is 3 and exactly 3 warehouses exist', () => {
    beforeEach(() => {
      h.warehouses = [0, 1, 2].map(makeWarehouse);
      h.maxWarehouses = 3;
      h.quotaData = { current_usage: 3, limit: 3, is_unlimited: false };
    });

    it('disables the New Warehouse button', async () => {
      const { findByRole } = renderPage();
      const btn = await findByRole('button', { name: /New Warehouse/i });
      expect(btn).toBeDisabled();
    });

    it('shows the "X of Y used" limit banner', async () => {
      const { findByText } = renderPage();
      const label = await findByText(/3 of 3 used/i);
      expect(label).toBeTruthy();
    });
  });
});

describe('StockLocationsPage — label format', () => {
  describe('Given 2 of 5 warehouses are used', () => {
    beforeEach(() => {
      h.warehouses = [0, 1].map(makeWarehouse);
      h.maxWarehouses = 5;
      h.quotaData = { current_usage: 2, limit: 5, is_unlimited: false };
    });

    it('displays "X of Y used" — not the old "X / Y" slash format', async () => {
      const { findByText } = renderPage();
      const label = await findByText(/2 of 5 used/i);
      expect(label.textContent).not.toMatch(/\d+ \/ \d+/);
    });
  });
});
