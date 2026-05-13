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
    createUom: vi.fn().mockResolvedValue({ id: 'uom-new' }),
    transitionLifecycle: vi.fn().mockResolvedValue({}),
    getLifecycleGates: vi.fn().mockResolvedValue({ gates: [] }),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'item-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
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
  mockGetItem.mockResolvedValue(makeItem());
  mockGetLedger.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue({ categories: [], uoms: [] });
  mockGetLocations.mockResolvedValue([]);
  mockGetTaxCodes.mockResolvedValue([]);
  mockUpdateItem.mockResolvedValue({ id: 'item-1' });
  mockDeleteItem.mockResolvedValue({});
});

describe('ItemDetailPage', () => {
  describe('Given loading state', () => {
    it('When data is loading / Then shows skeleton', () => {
      mockGetItem.mockReturnValue(new Promise(() => {}));
      mockGetLedger.mockReturnValue(new Promise(() => {}));
      render(<ItemDetailPage />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });
  });

  describe('Given API error (no item)', () => {
    it('When fetch fails / Then shows error message', async () => {
      mockGetItem.mockRejectedValue(new Error('Item not found'));
      mockGetLedger.mockResolvedValue([]);
      render(<ItemDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/Back to Items/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given item data loads', () => {
    it('When loaded / Then shows item name', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => {
        // Name appears in both hero header and edit form; check at least one exists
        expect(screen.getAllByText('Premium Widget').length).toBeGreaterThan(0);
      });
    });

    it('When loaded / Then shows item SKU', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('WGT-001').length).toBeGreaterThan(0);
      });
    });

    it('When loaded / Then shows Back to Catalog button', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Catalog')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Edit button', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows lifecycle panel', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('lifecycle-panel')).toBeInTheDocument();
      });
    });
  });

  describe('Given item with ledger entries', () => {
    it('When item has stock movements / Then displays movement type', async () => {
      mockGetLedger.mockResolvedValue([makeLedgerEntry()]);
      render(<ItemDetailPage />);
      // First wait for page to load
      await waitFor(() => expect(screen.getAllByText('Premium Widget').length).toBeGreaterThan(0));
      // Click the Ledger tab to show movements
      fireEvent.click(screen.getByText('Ledger'));
      await waitFor(() => {
        expect(screen.getByText(/inbound/i)).toBeInTheDocument();
      });
    });

    it('When item has stock movements / Then shows total stock count', async () => {
      mockGetLedger.mockResolvedValue([
        makeLedgerEntry({ quantity: 100 }),
        makeLedgerEntry({ id: 'mov-2', quantity: -30, type: 'outbound' }),
      ]);
      render(<ItemDetailPage />);
      await waitFor(() => {
        // totalStock = 100 + (-30) = 70
        expect(screen.getByText('70')).toBeInTheDocument();
      });
    });
  });

  describe('Given Edit mode', () => {
    it('When Edit button clicked / Then enters edit mode with Cancel option', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => expect(screen.getAllByText('Premium Widget').length).toBeGreaterThan(0));
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => {
        expect(screen.getByText('Cancel Editing')).toBeInTheDocument();
      });
    });

    it('When Cancel Editing clicked / Then returns to view mode', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => expect(screen.getAllByText('Premium Widget').length).toBeGreaterThan(0));
      fireEvent.click(screen.getByText('Edit'));
      await waitFor(() => expect(screen.getByText('Cancel Editing')).toBeInTheDocument());
      // Click "Cancel" button (short form next to Save Changes in editing mode)
      const cancelBtn = screen.getAllByText('Cancel').find(el => el.tagName === 'BUTTON');
      if (cancelBtn) fireEvent.click(cancelBtn);
      await waitFor(() => {
        expect(screen.getByText('Back to Catalog')).toBeInTheDocument();
      });
    });
  });

  describe('Given delete item', () => {
    it('When Delete button clicked / Then shows confirm dialog', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => expect(screen.getAllByText('Premium Widget').length).toBeGreaterThan(0));
      fireEvent.click(screen.getByText('Delete'));
      await waitFor(() => {
        expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given back navigation', () => {
    it('When Back to Catalog clicked / Then navigates to items list', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => expect(screen.getAllByText('Premium Widget').length).toBeGreaterThan(0));
      fireEvent.click(screen.getByText('Back to Catalog'));
      expect(mockNavigate).toHaveBeenCalledWith('/inventory/items');
    });
  });

  describe('Given API calls on mount', () => {
    it('When component mounts / Then calls getItem with id', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => {
        expect(mockGetItem).toHaveBeenCalledWith('item-1');
      });
    });

    it('When component mounts / Then calls getLedger with id', async () => {
      render(<ItemDetailPage />);
      await waitFor(() => {
        expect(mockGetLedger).toHaveBeenCalledWith('item-1');
      });
    });
  });
});
