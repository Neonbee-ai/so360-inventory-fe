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
  mockUpdateItem.mockResolvedValue({ id: 'item-1' });
  mockDeleteItem.mockResolvedValue({});
  mockGetItemSalesHistory.mockResolvedValue({
    item_id: 'item-1',
    total_quantity_sold: 0,
    invoice_count: 0,
    recent_movements: [],
  });
});

describe('ItemDetailPage (Comb)', () => {
  it('Given an item / When loaded / Then shows title, catalog trail and Edit primary action', async () => {
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Premium Widget' })[0]).toBeInTheDocument());
    expect(screen.getByLabelText('Back to Catalog')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('Given an item in view mode / When loaded / Then the section tabs live in the template tabs slot and switch content', async () => {
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Premium Widget' })[0]).toBeInTheDocument());
    const slot = document.querySelector('[data-slot="tabs"]') as HTMLElement;
    expect(slot).toBeInTheDocument();
    for (const label of ['Basic Info', 'Pricing', 'Category', 'Stock', 'Attributes', 'Ledger']) {
      expect(slot.textContent).toContain(label);
    }
    fireEvent.click(screen.getByRole('tab', { name: /Pricing/ }));
    await waitFor(() => expect(screen.getByTestId('pricing-tab')).toBeInTheDocument());
  });

  it('Given edit mode / When Edit is clicked / Then the view tab slot is hidden', async () => {
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(document.querySelector('[data-slot="tabs"]')).not.toBeInTheDocument());
  });

  it('Given pending requests / When loading / Then shows the template skeleton', () => {
    mockGetItem.mockReturnValue(new Promise(() => {}));
    mockGetLedger.mockReturnValue(new Promise(() => {}));
    render(<ItemDetailPage />);
    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('Given no movements / When opening the Ledger tab / Then shows the empty state', async () => {
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Premium Widget' })[0]).toBeInTheDocument());
    fireEvent.click(screen.getByText('Ledger'));
    await waitFor(() => expect(screen.getByText('No movements recorded for this item.')).toBeInTheDocument());
  });

  it('Given an item / When Delete is clicked / Then a confirm dialog opens and Cancel closes it', async () => {
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Premium Widget' })[0]).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Item' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete Item' })).not.toBeInTheDocument());
  });

  it('Given edit mode / When Edit is clicked / Then footer shows Cancel and Save Changes, not in header', async () => {
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Premium Widget' })[0]).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="header"]')?.textContent).not.toContain('Save Changes');
  });

  it('Given items.update denied / When loaded / Then Edit is hidden but Delete stays', async () => {
    mockCanItemDetail.mockImplementation((a: string) => a !== 'items.update');
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Premium Widget' })[0]).toBeInTheDocument());
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('Given a load error / When no item / Then shows error with Back to Items', async () => {
    mockGetItem.mockRejectedValue(new Error('boom'));
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getByText(/Back to Items/i)).toBeInTheDocument());
  });

  it('Given edit mode, When Cancel Editing is clicked, Then the page returns to view mode with Edit available', async () => {
    render(<ItemDetailPage />);
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Premium Widget' })[0]).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Cancel Editing')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel Editing'));
    await waitFor(() => expect(screen.queryByText('Cancel Editing')).not.toBeInTheDocument());
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
  });
});
