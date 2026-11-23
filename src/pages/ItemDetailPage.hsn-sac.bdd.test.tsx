import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

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
  default: (props: any) => (
    <div data-testid="pricing-tab" data-master={String(props.hsnSacMaster)} data-kind={props.hsn_sac_kind}>Pricing Tab</div>
  ),
}));
let flagOn = true;
const mockWarn = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({ isFeatureEnabled: () => flagOn }),
}));
vi.mock('@so360/design-system', async (orig) => {
  const mod: any = await orig();
  return { ...mod, toast: { ...mod.toast, warning: (...a: any[]) => mockWarn(...a) } };
});

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

const makeItem = (overrides: any = {}) => ({
  id: 'item-1',
  name: 'Premium Widget',
  sku: 'WGT-001',
  type: 'product',
  brand: 'WidgetCo',
  description: 'A premium quality widget',
  price: 99.99,
  cost: 50.00,
  is_active: true,
  image_urls: [],
  tax_class: null,
  min_stock_threshold: 10,
  reorder_level: 20,
  is_batch_tracked: false,
  is_serial_tracked: false,
  category_id: 'cat-1',
  unit_id: 'uom-1',
  units: { id: 'uom-1', name: 'Piece', abbreviation: 'PCS' },
  product_status: 'active',
  ...overrides,
});

const makeLedgerEntry = (overrides: any = {}) => ({
  id: 'mov-1',
  type: 'inbound',
  quantity: 50,
  created_at: '2024-01-15T00:00:00Z',
  warehouses: { name: 'Main Warehouse' },
  reason_code: 'PURCHASE',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCanItemDetail.mockImplementation((_action: string) => true);
  mockGetItem.mockResolvedValue(makeItem());
  mockGetLedger.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue({ categories: [], uoms: [] });
  mockGetLocations.mockResolvedValue([]);
  mockGetTaxCodes.mockResolvedValue([]);
  flagOn = true;
  mockUpdateItem.mockResolvedValue({ id: 'item-1' });
  mockDeleteItem.mockResolvedValue({});
  mockGetItemSalesHistory.mockResolvedValue({
    item_id: 'item-1',
    total_quantity_sold: 0,
    invoice_count: 0,
    recent_movements: [],
  });
});


async function openPricingEdit() {
  render(<ItemDetailPage />);
  await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Edit'));
  await waitFor(() => expect(screen.getByText('Cancel Editing')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Pricing'));
}

describe('ItemDetailPage — HSN/SAC master flag', () => {
  it('Given the flag is on and the item has a kind / When editing pricing / Then the tab gets picker mode and the kind', async () => {
    mockGetItem.mockResolvedValue(makeItem({ hsn_code: '9403', hsn_sac_kind: 'goods' }));
    await openPricingEdit();
    const tab = await screen.findByTestId('pricing-tab');
    expect(tab.getAttribute('data-master')).toBe('true');
    expect(tab.getAttribute('data-kind')).toBe('goods');
  });
  it('Given the flag is off / When editing pricing / Then free-text mode', async () => {
    flagOn = false;
    await openPricingEdit();
    expect((await screen.findByTestId('pricing-tab')).getAttribute('data-master')).toBe('false');
  });
  it('Given the flag is on / When saved / Then hsn_sac_kind is sent (null when auto)', async () => {
    mockGetItem.mockResolvedValue(makeItem({ hsn_code: '9403' }));
    render(<ItemDetailPage />);
    await waitFor(() => fireEvent.click(screen.getByText('Edit')));
    await waitFor(() => screen.getByText('Save Changes'));
    fireEvent.click(screen.getAllByText('Save Changes')[0]);
    await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledWith('item-1', expect.objectContaining({ hsn_code: '9403', hsn_sac_kind: null })));
  });
  it('Given the flag is off / When saved / Then hsn_sac_kind is not sent', async () => {
    flagOn = false;
    mockGetItem.mockResolvedValue(makeItem({ hsn_code: '9403', hsn_sac_kind: 'goods' }));
    render(<ItemDetailPage />);
    await waitFor(() => fireEvent.click(screen.getByText('Edit')));
    await waitFor(() => screen.getByText('Save Changes'));
    fireEvent.click(screen.getAllByText('Save Changes')[0]);
    await waitFor(() => expect(mockUpdateItem).toHaveBeenCalled());
    expect(mockUpdateItem.mock.calls[0][1]).not.toHaveProperty('hsn_sac_kind');
  });
  it('Given the server saved without checking the code / Then the warning is shown', async () => {
    mockUpdateItem.mockResolvedValue({ id: 'item-1', hsn_validation_warning: 'Could not check the code.' });
    render(<ItemDetailPage />);
    await waitFor(() => fireEvent.click(screen.getByText('Edit')));
    await waitFor(() => screen.getByText('Save Changes'));
    fireEvent.click(screen.getAllByText('Save Changes')[0]);
    await waitFor(() => expect(mockWarn).toHaveBeenCalledWith('Could not check the code.'));
  });
  it('Given a clean save / Then no warning is shown', async () => {
    render(<ItemDetailPage />);
    await waitFor(() => fireEvent.click(screen.getByText('Edit')));
    await waitFor(() => screen.getByText('Save Changes'));
    fireEvent.click(screen.getAllByText('Save Changes')[0]);
    await waitFor(() => expect(mockUpdateItem).toHaveBeenCalled());
    expect(mockWarn).not.toHaveBeenCalled();
  });
  it('Given the flag is on and the item has a kind / Then the read-only view shows it', async () => {
    mockGetItem.mockResolvedValue(makeItem({ hsn_code: '9403', hsn_sac_kind: 'service' }));
    render(<ItemDetailPage />);
    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Pricing'));
    expect(await screen.findByText('Service (SAC)')).toBeInTheDocument();
  });
});
