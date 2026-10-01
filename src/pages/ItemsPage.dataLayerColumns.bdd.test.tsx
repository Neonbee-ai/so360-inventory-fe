import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

/**
 * Items grid — Data Layer (Class B) custom-field columns.
 * One column per custom field, placed before Status so the status pill stays
 * last; values come from item.custom_fields and are formatted by the shared
 * formatter. With no columns the grid is exactly the native grid.
 */

const dl = vi.hoisted(() => ({
  enabled: false,
  columns: [] as Array<{ key: string; label: string }>,
  lastEntity: '' as string,
}));

const mockGetItems = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: { getItems: (...args: any[]) => mockGetItems(...args) },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: () => true }) }));

// Table stub that renders headers and runs every accessor, so column wiring is observable.
vi.mock('../components/common/Table', () => ({
  Table: ({ data, columns, isLoading }: any) => (
    <table data-testid="table">
      <thead><tr>{columns.map((c: any) => <th key={c.header}>{c.header}</th>)}</tr></thead>
      <tbody>
        {isLoading ? null : data.map((d: any) => (
          <tr key={d.id} data-testid={`row-${d.id}`}>
            {columns.map((c: any) => <td key={c.header}>{c.accessor(d)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock('@so360/shell-context', () => ({
  useModules: () => ({ isModuleEnabled: () => true }),
  useActivity: () => ({ recordActivity: vi.fn() }),
  useShellBridge: () => ({
    isFeatureEnabled: () => true, currentOrg: { id: 'org-1' }, effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
  }),
  useShell: () => ({ currentOrg: { id: 'org-1', name: 'Test Org' } }),
  useQuota: () => ({ getQuota: () => null, isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (i: any[]) => i, isLimited: false }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', is_tax_inclusive_pricing: false } }),
}));

// Real formatter + entity constants; the hook pair is driven by `dl`.
vi.mock('../dataLayer/inventoryDataLayer', async (orig) => ({
  ...(await orig<any>()),
  useInventoryDataLayer: (entity: string) => { dl.lastEntity = entity; return { enabled: dl.enabled, fields: [] }; },
  useInventoryCustomColumns: (state: any) => (state.enabled ? dl.columns : []),
}));

import ItemsPage from './ItemsPage';

const makeItem = (over: any = {}) => ({
  id: 'item-1', name: 'Widget A', sku: 'WA-001', type: 'product', is_active: true,
  is_batch_tracked: false, is_serial_tracked: false, item_categories: { name: 'Parts' }, units: { abbreviation: 'PCS' },
  ...over,
});

const headers = () => screen.getAllByRole('columnheader').map((h) => h.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  dl.enabled = false;
  dl.columns = [];
  dl.lastEntity = '';
});

describe('Feature: Items grid custom-field columns', () => {
  describe('Scenario: the data-layer is off', () => {
    it('then the grid shows only the native columns with Status last', async () => {
      // Given the flag is off and an item exists
      mockGetItems.mockResolvedValue({ data: [makeItem()] });
      // When the page renders
      render(<ItemsPage />);
      await waitFor(() => expect(screen.getByTestId('row-item-1')).toBeTruthy());
      // Then no data-layer column is present
      expect(headers()).toEqual(['Item & SKU', 'Type', 'Category', 'UoM', 'Tracking', 'Status']);
      expect(document.querySelector('[data-dl-column]')).toBeNull();
      expect(dl.lastEntity).toBe('inventory.item');
    });
  });

  describe('Scenario: the data-layer is on with custom fields', () => {
    it('then each field becomes a column placed before Status, in order', async () => {
      // Given two custom-field columns
      dl.enabled = true;
      dl.columns = [{ key: 'grade', label: 'Grade' }, { key: 'origin', label: 'Origin' }];
      mockGetItems.mockResolvedValue({ data: [makeItem()] });
      // When the page renders
      render(<ItemsPage />);
      await waitFor(() => expect(screen.getByTestId('row-item-1')).toBeTruthy());
      // Then they sit between Tracking and Status
      expect(headers()).toEqual(['Item & SKU', 'Type', 'Category', 'UoM', 'Tracking', 'Grade', 'Origin', 'Status']);
    });

    it('then cells show formatted custom_fields values and a dash when the item has none', async () => {
      // Given one item with values and one item without custom_fields
      dl.enabled = true;
      dl.columns = [{ key: 'grade', label: 'Grade' }, { key: 'certified', label: 'Certified' }];
      mockGetItems.mockResolvedValue({
        data: [
          makeItem({ id: 'with', custom_fields: { grade: 'A', certified: true } }),
          makeItem({ id: 'without', name: 'Bare' }),
        ],
      });
      // When the page renders
      render(<ItemsPage />);
      await waitFor(() => expect(screen.getByTestId('row-without')).toBeTruthy());
      // Then values are formatted per item
      const withRow = screen.getByTestId('row-with');
      expect(withRow.querySelector('[data-dl-column="grade"]')?.textContent).toBe('A');
      expect(withRow.querySelector('[data-dl-column="certified"]')?.textContent).toBe('Yes');
      const bare = screen.getByTestId('row-without');
      expect(bare.querySelector('[data-dl-column="grade"]')?.textContent).toBe('—');
      expect(bare.querySelector('[data-dl-column="certified"]')?.textContent).toBe('—');
      // And the Status pill is still rendered in the last cell
      const cells = within(withRow).getAllByRole('cell');
      expect(cells.at(-1)?.querySelector('[data-dl-column]')).toBeNull();
    });
  });

  describe('Scenario: the data-layer is on but no field is defined', () => {
    it('then the grid is exactly the native grid', async () => {
      // Given the flag on with no columns
      dl.enabled = true;
      dl.columns = [];
      mockGetItems.mockResolvedValue({ data: [makeItem()] });
      // When the page renders
      render(<ItemsPage />);
      await waitFor(() => expect(screen.getByTestId('row-item-1')).toBeTruthy());
      // Then only native headers exist
      expect(headers()).toEqual(['Item & SKU', 'Type', 'Category', 'UoM', 'Tracking', 'Status']);
    });
  });
});
