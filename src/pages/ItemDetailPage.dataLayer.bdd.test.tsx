import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Data Layer Class B on Item Detail (inventory.item).
 * Shell renderers are hosted in named regions behind
 * submodule:data_layer:custom_fields. Values are saved by Inventory through the
 * native PATCH /items/:id (inventoryService.updateItem) with merged custom_fields.
 */

// One mutable state object, read lazily by the mock factories (vi.mock hoisting).
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
      <button type="button" onClick={() => props.onSave({ grade: 'A' })}>save-{props.registration.id}</button>
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
  useParams: () => ({ id: 'item-1' }),
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

describe('Given the data-layer flag is OFF', () => {
  it('When renderers are registered / Then the item page renders no slot regions, wrapper or injected tabs', async () => {
    dl.regs = [reg({}), reg({ id: 'r2', slot: 'detail.sidebar' }), reg({ id: 'r3', slot: 'detail.tab', label: 'History' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
    expect(container.querySelector('[data-dl-tab]')).toBeNull();
    expect(dl.layouts['inventory.item']).toBeUndefined();
    expect(screen.getByText('Identification')).toBeInTheDocument();
  });
});

describe('Given the data-layer flag is ON', () => {
  beforeEach(() => { dl.flag = true; });

  it('When the page loads / Then the inventory.item record layout is registered with History last', async () => {
    await renderLoaded();
    await waitFor(() => expect(dl.layouts['inventory.item']).toBeTruthy());
    expect(dl.layouts['inventory.item'].tabOrder.at(-1)).toBe('history');
  });

  it('When nothing is registered / Then the page renders without any data-layer DOM', async () => {
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
    expect(screen.getByText('Identification')).toBeInTheDocument();
  });

  it('When section, sidebar and actions renderers exist / Then each region carries inventory.item + record context', async () => {
    dl.regs = [reg({ id: 'sec' }), reg({ id: 'side', slot: 'detail.sidebar' }), reg({ id: 'act', slot: 'detail.actions' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-record-layout="inventory.item"]')?.getAttribute('data-record-id')).toBe('item-1');
    for (const [slot, region, id] of [['detail.section', 'main', 'sec'], ['detail.sidebar', 'sidebar', 'side'], ['detail.actions', 'actions', 'act']]) {
      const el = container.querySelector(`[data-dl-slot="${slot}"]`)!;
      expect(el.getAttribute('data-region')).toBe(region);
      expect(el.getAttribute('data-dl-entity')).toBe('inventory.item');
      expect(el.getAttribute('data-dl-record-id')).toBe('item-1');
      const probe = screen.getByTestId(`probe-${id}`);
      expect(probe.getAttribute('data-entity')).toBe('inventory.item');
      expect(probe.getAttribute('data-record-id')).toBe('item-1');
      expect(probe.getAttribute('data-version')).toBe('2026-09-30T08:00:00Z');
      expect(probe.getAttribute('data-save-mode')).toBe('native');
      expect(probe.getAttribute('data-can-edit')).toBe('true');
    }
  });

  it('When the user cannot update items / Then renderers receive canEdit=false', async () => {
    mockCanItemDetail.mockImplementation((a: string) => a !== 'items.update');
    dl.regs = [reg({ id: 'sec' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-sec').getAttribute('data-can-edit')).toBe('false');
  });

  it('When a registration targets another entity / Then it is ignored on the item page', async () => {
    dl.regs = [reg({ id: 'person-only', dataset_code: 'people.person' })];
    const { container } = await renderLoaded();
    expect(screen.queryByTestId('probe-person-only')).toBeNull();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
  });

  it('When a detail.tab renderer exists / Then an injected tab appears after the native tabs and renders on click (one tap, no modal)', async () => {
    dl.regs = [reg({ id: 'hist', slot: 'detail.tab', renderer: 'field_history', label: 'Field History' })];
    const { container } = await renderLoaded();
    const btn = container.querySelector('[data-dl-tab="dl:hist"]') as HTMLElement;
    expect(btn.textContent).toBe('Field History');
    expect(btn.previousElementSibling?.textContent).toContain('Sales History');
    expect(screen.queryByTestId('probe-hist')).toBeNull();
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('probe-hist').getAttribute('data-record-id')).toBe('item-1'));
    expect(screen.queryByText('Identification')).toBeNull();
    expect(screen.queryByTestId('modal')).toBeNull();
  });

  it('When registrations are hidden or admin-only and the user is not admin / Then neither is rendered', async () => {
    dl.regs = [reg({ id: 'shown' }), reg({ id: 'secret', visibility_profile: 'hidden' }), reg({ id: 'adm', visibility_profile: 'admin' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-shown')).toBeTruthy();
    expect(screen.queryByTestId('probe-secret')).toBeNull();
    expect(screen.queryByTestId('probe-adm')).toBeNull();
  });

  it('When the user is admin / Then admin-only renderers show but hidden ones still do not', async () => {
    dl.isAdmin = true;
    dl.regs = [reg({ id: 'secret', visibility_profile: 'hidden' }), reg({ id: 'adm', visibility_profile: 'admin' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-adm')).toBeTruthy();
    expect(screen.queryByTestId('probe-secret')).toBeNull();
  });

  it('When a renderer saves / Then the module PATCHes /items/:id with merged custom_fields only and the page reflects it', async () => {
    mockUpdateItem.mockResolvedValueOnce({ data: { ...item, custom_fields: { region: 'south', grade: 'A' } } });
    dl.regs = [reg({ id: 'sec' })];
    await renderLoaded();
    fireEvent.click(screen.getByText('save-sec'));
    await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { custom_fields: { region: 'south', grade: 'A' } }));
    await waitFor(() => expect(screen.getByTestId('probe-sec-value').textContent).toBe('A'));
  });

});
