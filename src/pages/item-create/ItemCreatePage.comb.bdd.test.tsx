import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetSettings = vi.fn();
const mockGetLocations = vi.fn();
const mockGetTaxCodes = vi.fn();
const mockCreateItem = vi.fn();
const mockCreateCategory = vi.fn();
const mockCreateUom = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    getLocations: (...args: any[]) => mockGetLocations(...args),
    getTaxCodes: (...args: any[]) => mockGetTaxCodes(...args),
    createItem: (...args: any[]) => mockCreateItem(...args),
    createCategory: (...args: any[]) => mockCreateCategory(...args),
    createUom: (...args: any[]) => mockCreateUom(...args),
    // Selecting a category triggers an attribute-definition lookup.
    getAttributeDefinitions: vi.fn().mockResolvedValue([]),
    getNumberingSettings: vi.fn().mockResolvedValue({ sku: { enabled: true, prefix: 'SKU-', padding: 5, separator: '-' } }),
    getNextNumber: vi.fn().mockResolvedValue({ number: 'SKU-00001' }),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/inventory/items/new', search: '', hash: '' }),
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryCurrencySymbol: () => '$',
}));

// Stub tab components to keep test focused on page orchestration
vi.mock('./components/TabNavigation', () => ({
  __esModule: true,
  default: ({ activeTab, onTabChange }: any) => (
    <div data-testid="tab-nav">
      {['basic', 'media', 'pricing', 'category', 'stock', 'shipping', 'attributes'].map(tab => (
        <button
          key={tab}
          data-testid={`tab-${tab}`}
          onClick={() => onTabChange(tab)}
          className={activeTab === tab ? 'active' : ''}
        >
          {tab}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./tabs/BasicInfoTab', () => ({
  __esModule: true,
  default: ({ name, sku, unit_id, updateField }: any) => (
    <div data-testid="basic-tab">
      <input
        data-testid="item-name"
        value={name}
        placeholder="Item name"
        onChange={(e) => updateField('name', e.target.value)}
      />
      <input
        data-testid="item-sku"
        value={sku}
        placeholder="SKU"
        onChange={(e) => updateField('sku', e.target.value)}
      />
      <input
        data-testid="item-unit"
        value={unit_id}
        placeholder="Unit"
        onChange={(e) => updateField('unit_id', e.target.value)}
      />
    </div>
  ),
}));

vi.mock('./tabs/MediaTab', () => ({
  __esModule: true,
  default: () => <div data-testid="media-tab">Media Tab</div>,
}));

vi.mock('./tabs/PricingTab', () => ({
  __esModule: true,
  default: () => <div data-testid="pricing-tab">Pricing Tab</div>,
}));

vi.mock('./tabs/CategoryTab', () => ({
  __esModule: true,
  default: ({ category_id, updateField }: any) => (
    <div data-testid="category-tab">
      <input
        data-testid="item-category"
        value={category_id}
        placeholder="Category"
        onChange={(e) => updateField('category_id', e.target.value)}
      />
    </div>
  ),
}));

vi.mock('./tabs/StockTrackingTab', () => ({
  __esModule: true,
  default: () => <div data-testid="stock-tab">Stock Tab</div>,
}));

vi.mock('./tabs/ShippingTab', () => ({
  __esModule: true,
  default: () => <div data-testid="shipping-tab">Shipping Tab</div>,
}));

vi.mock('./tabs/AttributesTab', () => ({
  __esModule: true,
  default: () => <div data-testid="attributes-tab">Attributes Tab</div>,
}));

import ItemCreatePage from './ItemCreatePage';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({ categories: [], uoms: [] });
  mockGetLocations.mockResolvedValue([]);
  mockGetTaxCodes.mockResolvedValue([]);
  mockCreateItem.mockResolvedValue({ id: 'item-new' });
  mockCreateCategory.mockResolvedValue({ id: 'cat-new', name: 'New Cat' });
  mockCreateUom.mockResolvedValue({ id: 'uom-new', name: 'Kilogram', abbreviation: 'KG' });
});

describe('ItemCreatePage (Comb)', () => {
  describe('Given the page renders inside the Comb form template', () => {
    it('When loaded / Then shows the heading, Back control and Save Item', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => expect(screen.getByText('Register New Item')).toBeInTheDocument());
      expect(screen.getByLabelText('Back to Items')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save Item/ })).toBeInTheDocument();
    });

    it('When loaded / Then the basic tab is the default content', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => expect(screen.getByTestId('basic-tab')).toBeInTheDocument());
    });
  });

  describe('Given the user switches tab', () => {
    it('When Pricing is chosen / Then the pricing tab content shows', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => expect(screen.getByTestId('tab-pricing')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('tab-pricing'));
      expect(screen.getByTestId('pricing-tab')).toBeInTheDocument();
    });
  });

  describe('Given the tax codes fail to load', () => {
    it('When loaded / Then the page still renders', async () => {
      mockGetTaxCodes.mockRejectedValue(new Error('boom'));
      render(<ItemCreatePage />);
      await waitFor(() => expect(screen.getByText('Register New Item')).toBeInTheDocument());
    });
  });
});
