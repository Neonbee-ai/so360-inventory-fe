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

describe('ItemCreatePage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Register New Item heading', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => {
        expect(screen.getByText('Register New Item')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Save Item button(s)', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => {
        const saveButtons = screen.getAllByText('Save Item');
        expect(saveButtons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('When loaded / Then shows Back to Items link', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Items')).toBeInTheDocument();
      });
    });

    it('When Back to Items clicked / Then navigates to items list', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => screen.getByText('Back to Items'));
      fireEvent.click(screen.getByText('Back to Items'));
      expect(mockNavigate).toHaveBeenCalledWith('/inventory/items');
    });

    it('When loaded / Then shows basic tab by default', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => {
        expect(screen.getByTestId('basic-tab')).toBeInTheDocument();
      });
    });
  });

  describe('Given tab navigation', () => {
    it('When media tab clicked / Then shows media tab content', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => screen.getByTestId('tab-nav'));
      fireEvent.click(screen.getByTestId('tab-media'));
      await waitFor(() => {
        expect(screen.getByTestId('media-tab')).toBeInTheDocument();
      });
    });

    it('When pricing tab clicked / Then shows pricing tab content', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => screen.getByTestId('tab-nav'));
      fireEvent.click(screen.getByTestId('tab-pricing'));
      await waitFor(() => {
        expect(screen.getByTestId('pricing-tab')).toBeInTheDocument();
      });
    });

    it('When category tab clicked / Then shows category tab content', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => screen.getByTestId('tab-nav'));
      fireEvent.click(screen.getByTestId('tab-category'));
      await waitFor(() => {
        expect(screen.getByTestId('category-tab')).toBeInTheDocument();
      });
    });
  });

  describe('Given form validation', () => {
    it('When Save clicked without name / Then shows the field-level requirement', async () => {
      render(<ItemCreatePage />);
      // Wait for tax codes to finish loading so Save buttons become enabled
      await waitFor(() => expect(mockGetTaxCodes).toHaveBeenCalled());
      await waitFor(() => {
        const btns = screen.getAllByText('Save Item');
        expect(btns[0]).not.toBeDisabled();
      });
      fireEvent.click(screen.getAllByText('Save Item')[0]);
      await waitFor(() => {
        expect(screen.getByText('Item Name is required.')).toBeInTheDocument();
      });
    });

    it('When Save clicked without name / Then does not call createItem', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => expect(mockGetTaxCodes).toHaveBeenCalled());
      await waitFor(() => {
        const btns = screen.getAllByText('Save Item');
        expect(btns[0]).not.toBeDisabled();
      });
      fireEvent.click(screen.getAllByText('Save Item')[0]);
      expect(mockCreateItem).not.toHaveBeenCalled();
    });
  });

  describe('Given successful item creation', () => {
    it('When valid name entered and saved / Then calls createItem', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => expect(mockGetTaxCodes).toHaveBeenCalled());
      await waitFor(() => screen.getByTestId('item-name'));
      fireEvent.change(screen.getByTestId('item-name'), { target: { value: 'Test Widget' } });
      fireEvent.change(screen.getByTestId('item-sku'), { target: { value: 'TW-001' } });
      fireEvent.change(screen.getByTestId('item-unit'), { target: { value: 'uom-1' } });
      fireEvent.click(screen.getByTestId('tab-category'));
      fireEvent.change(screen.getByTestId('item-category'), { target: { value: 'cat-1' } });
      fireEvent.click(screen.getByTestId('tab-basic'));
      await waitFor(() => {
        const btns = screen.getAllByText('Save Item');
        expect(btns[0]).not.toBeDisabled();
      });
      fireEvent.click(screen.getAllByText('Save Item')[0]);
      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Widget' }));
      });
    });

    it('When item created / Then navigates to item detail', async () => {
      render(<ItemCreatePage />);
      await waitFor(() => expect(mockGetTaxCodes).toHaveBeenCalled());
      await waitFor(() => screen.getByTestId('item-name'));
      fireEvent.change(screen.getByTestId('item-name'), { target: { value: 'Test Widget' } });
      fireEvent.change(screen.getByTestId('item-sku'), { target: { value: 'TW-001' } });
      fireEvent.change(screen.getByTestId('item-unit'), { target: { value: 'uom-1' } });
      fireEvent.click(screen.getByTestId('tab-category'));
      fireEvent.change(screen.getByTestId('item-category'), { target: { value: 'cat-1' } });
      fireEvent.click(screen.getByTestId('tab-basic'));
      await waitFor(() => {
        const btns = screen.getAllByText('Save Item');
        expect(btns[0]).not.toBeDisabled();
      });
      fireEvent.click(screen.getAllByText('Save Item')[0]);
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/inventory/items/item-new');
      });
    });
  });

  describe('Given createItem API error', () => {
    it('When createItem fails / Then shows error message', async () => {
      mockCreateItem.mockRejectedValue(new Error('Duplicate SKU'));
      render(<ItemCreatePage />);
      await waitFor(() => expect(mockGetTaxCodes).toHaveBeenCalled());
      await waitFor(() => screen.getByTestId('item-name'));
      fireEvent.change(screen.getByTestId('item-name'), { target: { value: 'Test Widget' } });
      fireEvent.change(screen.getByTestId('item-sku'), { target: { value: 'TW-001' } });
      fireEvent.change(screen.getByTestId('item-unit'), { target: { value: 'uom-1' } });
      fireEvent.click(screen.getByTestId('tab-category'));
      fireEvent.change(screen.getByTestId('item-category'), { target: { value: 'cat-1' } });
      fireEvent.click(screen.getByTestId('tab-basic'));
      await waitFor(() => {
        const btns = screen.getAllByText('Save Item');
        expect(btns[0]).not.toBeDisabled();
      });
      fireEvent.click(screen.getAllByText('Save Item')[0]);
      await waitFor(() => {
        expect(screen.getByText('Duplicate SKU')).toBeInTheDocument();
      });
    });
  });
});
