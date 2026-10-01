import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Edge behaviour of the Data Layer wiring on Item Detail (inventory.item):
 * the silent row refetch after a save that did not advance the version,
 * the fail-open refetch paths, injected-tab activation styling and the
 * edit-mode fallback when an injected tab is the active view tab.
 *
 * Data Layer Class B on Item Detail (inventory.item).
 * Shell renderers are hosted in named regions behind
 * submodule:data_layer:custom_fields. Values are saved by Inventory through the
 * native PATCH /items/:id (inventoryService.updateItem) with only the changed
 * custom_fields plus the row's custom_fields_version.
 */

// One mutable state object, read lazily by the mock factories (vi.mock hoisting).
const route = vi.hoisted(() => ({ id: 'item-1' as string | undefined }));
const dl = vi.hoisted(() => ({
  flag: false,
  isAdmin: false,
  regs: [] as any[],
  layouts: {} as Record<string, any>,
}));

function ProbeRenderer(props: any) {
  return (
    <div
      data-testid={`probe-${props.registration.id}`}
      data-entity={props.datasetCode}
      data-record-id={props.recordId}
      data-version={String(props.version)}
      data-can-edit={String(props.canEdit)}
      data-save-mode={props.saveMode}
    >
      <span data-testid={`probe-${props.registration.id}-value`}>{String(props.record?.custom_fields?.grade ?? '')}</span>
      <span data-testid={`probe-${props.registration.id}-name`}>{String(props.record?.name ?? '')}</span>
      <button type="button" onClick={() => props.onSave({ grade: 'A' })}>save-{props.registration.id}</button>
      <button type="button" onClick={() => props.onChanged?.()}>changed-{props.registration.id}</button>
    </div>
  );
}

// Extends the aliased shell-context mock with the Shell dataLayer API, driven by `dl`.
vi.mock('@so360/shell-context', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true,
    isAdmin: dl.isAdmin,
    hasPermission: () => true,
    isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
    currentOrg: { id: 'org-1' },
  }),
  useDatasetSchema: () => ({ fields: [] }),
  useSlotRenderers: (code: string, slot: string) =>
    dl.regs
      .filter((r: any) => r.dataset_code === code && r.slot === slot)
      .map((r: any) => ({ registration: r, Renderer: ProbeRenderer, key: r.id })),
  registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
  getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

const mockGetItem = vi.fn();
const mockGetLedger = vi.fn();
const mockGetSettings = vi.fn();
const mockGetLocations = vi.fn();
const mockGetTaxCodes = vi.fn();
const mockUpdateItem = vi.fn();
const mockDeleteItem = vi.fn();
const mockGetItemSalesHistory = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getItem: (...args: any[]) => mockGetItem(...args),
    getLedger: (...args: any[]) => mockGetLedger(...args),
    getSettings: (...args: any[]) => mockGetSettings(...args),
    getLocations: (...args: any[]) => mockGetLocations(...args),
    getTaxCodes: (...args: any[]) => mockGetTaxCodes(...args),
    updateItem: (...args: any[]) => mockUpdateItem(...args),
    deleteItem: (...args: any[]) => mockDeleteItem(...args),
    getItemSalesHistory: (...args: any[]) => mockGetItemSalesHistory(...args),
    createUom: vi.fn().mockResolvedValue({ id: 'uom-new' }),
    transitionLifecycle: vi.fn().mockResolvedValue({}),
    getLifecycleGates: vi.fn().mockResolvedValue({ gates: [] }),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: route.id }),
  useNavigate: () => mockNavigate,
}));

const mockCanItemDetail = vi.hoisted(() => vi.fn((_action: string) => true));
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: mockCanItemDetail }),
}));

vi.mock('../components/common/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading...</div>,
  Skeleton: () => <div data-testid="skeleton-el">Loading...</div>,
}));

vi.mock('../components/common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

vi.mock('../components/lifecycle/LifecycleStatusPanel', () => ({
  default: ({ productStatus }: any) => (
    <div data-testid="lifecycle-panel">Status: {productStatus}</div>
  ),
}));

vi.mock('./item-create/components/TabNavigation', () => ({
  default: ({ activeTab, onTabChange }: any) => (
    <div data-testid="tab-nav" data-active={activeTab}>
      <button onClick={() => onTabChange('basic')}>Basic</button>
      <button onClick={() => onTabChange('pricing')}>Pricing</button>
    </div>
  ),
}));

vi.mock('./item-create/components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

vi.mock('./item-create/tabs/BasicInfoTab', () => ({
  default: (props: any) => <div data-testid="basic-tab">Basic Tab</div>,
}));

vi.mock('./item-create/tabs/MediaTab', () => ({
  default: (props: any) => <div data-testid="media-tab">Media Tab</div>,
}));

vi.mock('./item-create/tabs/PricingTab', () => ({
  default: (props: any) => <div data-testid="pricing-tab">Pricing Tab</div>,
}));

vi.mock('./item-create/tabs/CategoryTab', () => ({
  default: (props: any) => <div data-testid="category-tab">Category Tab</div>,
}));

vi.mock('./item-create/tabs/ShippingTab', () => ({
  default: (props: any) => <div data-testid="shipping-tab">Shipping Tab</div>,
}));

vi.mock('./item-create/tabs/StockTrackingTab', () => ({
  default: (props: any) => <div data-testid="stock-tab">Stock Tracking Tab</div>,
}));

vi.mock('./item-create/tabs/AttributesTab', () => ({
  default: (props: any) => <div data-testid="attributes-tab">Attributes Tab</div>,
}));

vi.mock('../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    // Date-only primitives — this factory is a CLOSED LIST, so a component that
    // adopts formatters.businessToday()/toBusinessDate() throws here otherwise.
    toBusinessDate: (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)),
    businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`),
    endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
  useInventoryCurrencySymbol: () => '$',
}));

import ItemDetailPage from './ItemDetailPage';

const item = {
  id: 'item-1',
  name: 'Premium Widget',
  sku: 'WGT-001',
  type: 'product',
  price: 99.99,
  cost: 50,
  is_active: true,
  image_urls: [],
  is_batch_tracked: false,
  is_serial_tracked: false,
  units: { id: 'uom-1', name: 'Piece', abbreviation: 'PCS' },
  product_status: 'active',
  custom_attributes: { size: 'L' },
  custom_fields: { region: 'south' },
  updated_at: '2026-09-30T08:00:00Z',
};
const reg = (over: any) => ({ id: 'r1', dataset_code: 'inventory.item', slot: 'detail.section', renderer: 'custom_fields', ...over });

beforeEach(() => {
  vi.clearAllMocks();
  dl.flag = false;
  dl.isAdmin = false;
  dl.regs = [];
  dl.layouts = {};
  route.id = 'item-1';
  mockCanItemDetail.mockImplementation((_action: string) => true);
  mockGetItem.mockResolvedValue({ ...item });
  mockGetLedger.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue({ categories: [], uoms: [] });
  mockGetLocations.mockResolvedValue([]);
  mockGetTaxCodes.mockResolvedValue([]);
  mockUpdateItem.mockResolvedValue({ id: 'item-1' });
  mockGetItemSalesHistory.mockResolvedValue({ item_id: 'item-1', total_quantity_sold: 0, invoice_count: 0, recent_movements: [] });
});

async function renderLoaded() {
  const utils = render(<ItemDetailPage />);
  await waitFor(() => expect(screen.getAllByText('Premium Widget').length).toBeGreaterThan(0));
  return utils;
}


describe('Feature: Item Detail Data Layer edges', () => {
  beforeEach(() => { dl.flag = true; });

  describe('Scenario: a save returns the same custom_fields_version', () => {
    it('then the page silently refetches the row and the renderer gets the fresh version and fields', async () => {
      // Given a row at version 3 and a save whose response did not advance the version
      mockGetItem
        .mockResolvedValueOnce({ ...item, custom_fields_version: 3 })
        .mockResolvedValueOnce({ ...item, name: 'Fresh Widget', custom_fields: { grade: 'B' }, custom_fields_version: 5 });
      mockUpdateItem.mockResolvedValueOnce({ data: { ...item, custom_fields: { region: 'south', grade: 'A' }, custom_fields_version: 3 } });
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer saves
      fireEvent.click(screen.getByText('save-sec'));
      // Then the row is re-read (no full-page skeleton) and merged into the page state
      await waitFor(() => expect(mockGetItem).toHaveBeenCalledTimes(2));
      expect(mockGetItem).toHaveBeenLastCalledWith('item-1');
      await waitFor(() => expect(screen.getByTestId('probe-sec').getAttribute('data-version')).toBe('5'));
      expect(screen.getByTestId('probe-sec-name').textContent).toBe('Fresh Widget');
      expect(screen.getByTestId('probe-sec-value').textContent).toBe('B');
      expect(screen.queryByTestId('skeleton')).toBeNull();
    });
  });

  describe('Scenario: the save response carries no row at all', () => {
    it('then onSaved merges the changed values locally and a refetch is requested because the row was versioned', async () => {
      // Given a versioned row and a save that returns nothing usable
      mockGetItem
        .mockResolvedValueOnce({ ...item, custom_fields_version: 7 })
        .mockResolvedValueOnce({ ...item, custom_fields: { region: 'south', grade: 'A' }, custom_fields_version: 8 });
      mockUpdateItem.mockResolvedValueOnce(undefined);
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer saves
      fireEvent.click(screen.getByText('save-sec'));
      // Then the local merge shows the new value and the refetch advances the version
      await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { custom_fields: { grade: 'A' }, version: 7 }));
      await waitFor(() => expect(screen.getByTestId('probe-sec-value').textContent).toBe('A'));
      await waitFor(() => expect(screen.getByTestId('probe-sec').getAttribute('data-version')).toBe('8'));
      expect(mockGetItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scenario: a renderer asks the page to reload (onChanged)', () => {
    it('then the item row is refetched and merged', async () => {
      // Given a loaded page with a section renderer
      mockGetItem
        .mockResolvedValueOnce({ ...item })
        .mockResolvedValueOnce({ ...item, name: 'Reloaded Widget' });
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer signals a change (e.g. after a 409 conflict)
      fireEvent.click(screen.getByText('changed-sec'));
      // Then the fresh row reaches the renderer
      await waitFor(() => expect(screen.getByTestId('probe-sec-name').textContent).toBe('Reloaded Widget'));
      expect(mockGetItem).toHaveBeenCalledTimes(2);
    });

    it('then a refetch that returns nothing keeps the current row', async () => {
      // Given the refetch resolves to null
      mockGetItem.mockResolvedValueOnce({ ...item }).mockResolvedValueOnce(null);
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer signals a change
      fireEvent.click(screen.getByText('changed-sec'));
      // Then the row is unchanged and no "not found" state appears
      await waitFor(() => expect(mockGetItem).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId('probe-sec-name').textContent).toBe('Premium Widget');
      expect(screen.queryByText('Item not found')).toBeNull();
    });

    it('then a failing refetch fails open: the current row stays and no error banner is shown', async () => {
      // Given the refetch rejects
      mockGetItem.mockResolvedValueOnce({ ...item, custom_fields_version: 2 }).mockRejectedValueOnce(new Error('network'));
      dl.regs = [reg({ id: 'sec' })];
      await renderLoaded();
      // When the renderer signals a change
      fireEvent.click(screen.getByText('changed-sec'));
      // Then the row and its version are kept
      await waitFor(() => expect(mockGetItem).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId('probe-sec').getAttribute('data-version')).toBe('2');
      expect(screen.getByTestId('probe-sec-name').textContent).toBe('Premium Widget');
      expect(screen.queryByText('Failed to load item details')).toBeNull();
    });

    it('then a reload requested after the route lost its id does not call the API', async () => {
      // Given a loaded page whose route param then disappears
      dl.regs = [reg({ id: 'sec' })];
      const { rerender } = await renderLoaded();
      route.id = undefined;
      rerender(<ItemDetailPage />);
      // When the renderer signals a change
      fireEvent.click(screen.getByText('changed-sec'));
      // Then no refetch is attempted and the row stays rendered
      await new Promise((r) => setTimeout(r, 20));
      expect(mockGetItem).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('probe-sec-name').textContent).toBe('Premium Widget');
    });
  });

  describe('Scenario: an injected detail.tab is selected', () => {
    it('then its button is styled active while the others stay inactive', async () => {
      // Given two injected tabs
      dl.regs = [
        reg({ id: 'hist', slot: 'detail.tab', renderer: 'field_history', label: 'Field History' }),
        reg({ id: 'audit', slot: 'detail.tab', renderer: 'audit', label: 'Audit' }),
      ];
      const { container } = await renderLoaded();
      const hist = container.querySelector('[data-dl-tab="dl:hist"]') as HTMLElement;
      const audit = container.querySelector('[data-dl-tab="dl:audit"]') as HTMLElement;
      expect(hist.className).toContain('border-transparent');
      // When the first one is clicked
      fireEvent.click(hist);
      // Then only it carries the active style and only its renderer is shown
      await waitFor(() => expect(hist.className).toContain('text-blue-400'));
      expect(audit.className).toContain('border-transparent');
      expect(screen.getByTestId('probe-hist')).toBeTruthy();
      expect(screen.queryByTestId('probe-audit')).toBeNull();
    });

    it('then entering edit mode falls back to the Basic edit tab instead of the injected id', async () => {
      // Given the injected tab is the active view tab
      dl.regs = [reg({ id: 'hist', slot: 'detail.tab', renderer: 'field_history', label: 'Field History' })];
      const { container } = await renderLoaded();
      fireEvent.click(container.querySelector('[data-dl-tab="dl:hist"]') as HTMLElement);
      await waitFor(() => expect(screen.getByTestId('probe-hist')).toBeTruthy());
      // When the user clicks Edit
      fireEvent.click(screen.getByText('Edit'));
      // Then the edit form opens on the Basic tab
      await waitFor(() => expect(screen.getByTestId('tab-nav').getAttribute('data-active')).toBe('basic'));
      expect(screen.getByTestId('basic-tab')).toBeTruthy();
    });
  });
});
