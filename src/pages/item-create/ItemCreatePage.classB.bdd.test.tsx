import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Item create — Data Layer (Class B) custom fields.
 * Required custom fields block the save with a "Please fill in" message
 * (label, else the field key); filled values ride the native create payload as
 * `custom_fields`, and only when the data layer is enabled and something was
 * entered.
 */

const dl = vi.hoisted(() => ({
  enabled: false,
  fields: [] as any[],
  sectionProps: null as any,
}));

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

// The data-layer state is driven by `dl`; the create section is a stub that
// exposes the values contract. missingRequiredCustomFields stays real.
vi.mock('../../dataLayer/inventoryDataLayer', async (orig) => ({
  ...(await orig<any>()),
  useInventoryDataLayer: () => ({ enabled: dl.enabled, fields: dl.fields }),
  InventoryCreateSection: (props: any) => {
    dl.sectionProps = props;
    return (
      <div data-testid="dl-create-section" data-mode={props.mode}>
        <button type="button" onClick={() => props.onValuesChange({ ...props.values, grade: 'A' })}>fill-grade</button>
        <button type="button" onClick={() => props.onValuesChange({ ...props.values, lot: 'L-1' })}>fill-lot</button>
      </div>
    );
  },
}));

import ItemCreatePage from './ItemCreatePage';

beforeEach(() => {
  vi.clearAllMocks();
  dl.enabled = false;
  dl.fields = [];
  dl.sectionProps = null;
  mockGetSettings.mockResolvedValue({ categories: [], uoms: [] });
  mockGetLocations.mockResolvedValue([]);
  mockGetTaxCodes.mockResolvedValue([]);
  mockCreateItem.mockResolvedValue({ id: 'item-new' });
});

async function fillNativeForm() {
  render(<ItemCreatePage />);
  await waitFor(() => expect(mockGetTaxCodes).toHaveBeenCalled());
  await waitFor(() => screen.getByTestId('item-name'));
  fireEvent.change(screen.getByTestId('item-name'), { target: { value: 'Test Widget' } });
  fireEvent.change(screen.getByTestId('item-sku'), { target: { value: 'TW-001' } });
  fireEvent.change(screen.getByTestId('item-unit'), { target: { value: 'uom-1' } });
  fireEvent.click(screen.getByTestId('tab-category'));
  fireEvent.change(screen.getByTestId('item-category'), { target: { value: 'cat-1' } });
  fireEvent.click(screen.getByTestId('tab-basic'));
  await waitFor(() => expect(screen.getAllByText('Save Item')[0]).not.toBeDisabled());
}

const save = () => fireEvent.click(screen.getAllByText('Save Item')[0]);
const REQUIRED = [
  { field_key: 'grade', label: 'Grade', required: true },
  { field_key: 'lot', required: true },
  { field_key: 'note', label: 'Note', required: false },
];

describe('Feature: Item create with Data Layer custom fields', () => {
  describe('Scenario: required custom fields are empty', () => {
    it('then the save is blocked with their labels (key when unlabelled) and nothing is created', async () => {
      // Given the data layer is on with two required fields
      dl.enabled = true;
      dl.fields = REQUIRED;
      await fillNativeForm();
      // When the user saves without filling them
      save();
      // Then the message lists the label and the bare key, and no API call is made
      await waitFor(() => expect(screen.getByText('Please fill in: Grade, lot')).toBeInTheDocument());
      expect(mockCreateItem).not.toHaveBeenCalled();
    });

    it('then filling only one still blocks the save naming the remaining field', async () => {
      // Given one required field filled
      dl.enabled = true;
      dl.fields = REQUIRED;
      await fillNativeForm();
      fireEvent.click(screen.getByText('fill-grade'));
      // When the user saves
      save();
      // Then only the missing field is named
      await waitFor(() => expect(screen.getByText('Please fill in: lot')).toBeInTheDocument());
      expect(mockCreateItem).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: required custom fields are filled', () => {
    it('then the create payload carries custom_fields and the user lands on the new item', async () => {
      // Given both required fields filled in the create section
      dl.enabled = true;
      dl.fields = REQUIRED;
      await fillNativeForm();
      expect(screen.getByTestId('dl-create-section').getAttribute('data-mode')).toBe('create');
      fireEvent.click(screen.getByText('fill-grade'));
      fireEvent.click(screen.getByText('fill-lot'));
      expect(dl.sectionProps.values).toEqual({ grade: 'A', lot: 'L-1' });
      // When the user saves
      save();
      // Then custom_fields ride the native create call
      await waitFor(() => expect(mockCreateItem).toHaveBeenCalledTimes(1));
      expect(mockCreateItem.mock.calls[0][0]).toEqual(expect.objectContaining({
        name: 'Test Widget',
        custom_fields: { grade: 'A', lot: 'L-1' },
      }));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/inventory/items/item-new'));
    });
  });

  describe('Scenario: the data layer is on but nothing was entered', () => {
    it('then the payload has no custom_fields key', async () => {
      // Given only optional custom fields and no values
      dl.enabled = true;
      dl.fields = [{ field_key: 'note', label: 'Note', required: false }];
      await fillNativeForm();
      // When the user saves
      save();
      // Then the native payload is unchanged
      await waitFor(() => expect(mockCreateItem).toHaveBeenCalledTimes(1));
      expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty('custom_fields');
    });
  });

  describe('Scenario: the data layer is off', () => {
    it('then values are never sent and required fields never block the save', async () => {
      // Given the flag off (fields defined, values somehow present)
      dl.enabled = false;
      dl.fields = REQUIRED;
      await fillNativeForm();
      fireEvent.click(screen.getByText('fill-grade'));
      // When the user saves
      save();
      // Then the item is created without custom_fields
      await waitFor(() => expect(mockCreateItem).toHaveBeenCalledTimes(1));
      expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty('custom_fields');
      expect(screen.queryByText(/Please fill in:/)).toBeNull();
    });
  });
});
