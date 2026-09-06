import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import ItemCreatePage from './ItemCreatePage';
import { inventoryService } from '../../services/inventoryService';

const mockGetNumberingSettings = vi.fn();
const mockGetNextNumber = vi.fn();
const mockGetSettings = vi.fn();
const mockGetLocations = vi.fn();
const mockGetTaxCodes = vi.fn();
const mockCheckSkuAvailable = vi.fn();

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    getLocations: (...args: any[]) => mockGetLocations(...args),
    getTaxCodes: (...args: any[]) => mockGetTaxCodes(...args),
    getNumberingSettings: (...args: any[]) => mockGetNumberingSettings(...args),
    getNextNumber: (...args: any[]) => mockGetNextNumber(...args),
    checkSkuAvailable: (...args: any[]) => mockCheckSkuAvailable(...args),
    getAttributeDefinitions: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: 'item-1' }),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/inventory/items/new', search: '', hash: '' }),
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryCurrencySymbol: () => '$',
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn() }),
}));

describe('ItemCreatePage — SKU Auto-Generation & Manual Override (P0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ categories: [], uoms: [] });
    mockGetLocations.mockResolvedValue([]);
    mockGetTaxCodes.mockResolvedValue([]);
    mockGetNumberingSettings.mockResolvedValue({
      sku: {
        entity_type: 'sku',
        module: 'inventory',
        name: 'Item SKU',
        enabled: true,
      },
    });
    mockCheckSkuAvailable.mockResolvedValue({ sku: '', available: true });
  });

  describe('Given SKU auto-generation is enabled', () => {
    it('When user enters an item name / Then SKU is automatically derived from Item Name', async () => {
      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(mockGetNumberingSettings).toHaveBeenCalled();
      });

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'ABC Office Chair' } });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      expect((skuInput as HTMLInputElement).value).toBe('ABC-OFFICE-CHAIR');

      // Auto-generated badge should be visible
      const badge = screen.getByTestId('sku-autogen-badge');
      expect(badge).toBeDefined();
      expect(badge.textContent).toBe('Auto-generated from Item Name');
    });

    it('When user enters special characters in Item Name / Then SKU is normalized cleanly', async () => {
      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(mockGetNumberingSettings).toHaveBeenCalled();
      });

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'LED Light 24W / Cool White (V2)' } });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      expect((skuInput as HTMLInputElement).value).toBe('LED-LIGHT-24W-COOL-WHITE-V2');
    });

    it('When duplicate SKU is detected in organization / Then debounced check resolves unique suffix', async () => {
      mockCheckSkuAvailable.mockResolvedValue({
        sku: 'ABC-OFFICE-CHAIR',
        available: false,
        suggestedSku: 'ABC-OFFICE-CHAIR-001',
      });

      render(<ItemCreatePage />);

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'ABC Office Chair' } });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      await waitFor(() => {
        expect((skuInput as HTMLInputElement).value).toBe('ABC-OFFICE-CHAIR-001');
      });
    });
  });

  describe('Given user manually overrides the auto-generated SKU', () => {
    it('When SKU is typed directly / Then manual override is preserved and not overwritten by item name updates', async () => {
      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(mockGetNumberingSettings).toHaveBeenCalled();
      });

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'Standing Desk Pro' } });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      expect((skuInput as HTMLInputElement).value).toBe('STANDING-DESK-PRO');

      // User manually overrides SKU
      fireEvent.change(skuInput, { target: { value: 'CUSTOM-DESK-99' } });
      expect((skuInput as HTMLInputElement).value).toBe('CUSTOM-DESK-99');

      // Badge updates to Manual Override
      expect(screen.getByTestId('sku-autogen-badge').textContent).toBe('Manual Override');

      // Re-generate button appears
      expect(screen.getByTestId('sku-reset-btn')).toBeDefined();

      // User changes Item Name again
      fireEvent.change(nameInput, { target: { value: 'Standing Desk Pro V2' } });

      // SKU remains the custom override!
      expect((skuInput as HTMLInputElement).value).toBe('CUSTOM-DESK-99');
    });

    it('When user clicks Re-generate button / Then SKU re-syncs with Item Name', async () => {
      render(<ItemCreatePage />);

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'Modern Sofa' } });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      fireEvent.change(skuInput, { target: { value: 'MY-CUSTOM-SOFA' } });
      expect((skuInput as HTMLInputElement).value).toBe('MY-CUSTOM-SOFA');

      // Click Re-generate
      const resetBtn = screen.getByTestId('sku-reset-btn');
      fireEvent.click(resetBtn);

      expect((skuInput as HTMLInputElement).value).toBe('MODERN-SOFA');
      expect(screen.getByTestId('sku-autogen-badge').textContent).toBe('Auto-generated from Item Name');
    });

    it('When user completely clears manual SKU / Then auto-generation mode is restored', async () => {
      render(<ItemCreatePage />);

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'Wireless Mouse' } });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      fireEvent.change(skuInput, { target: { value: 'CUSTOM-MOUSE' } });
      expect((skuInput as HTMLInputElement).value).toBe('CUSTOM-MOUSE');

      // User clears the SKU input
      fireEvent.change(skuInput, { target: { value: '' } });

      expect((skuInput as HTMLInputElement).value).toBe('WIRELESS-MOUSE');
      expect(screen.getByTestId('sku-autogen-badge').textContent).toBe('Auto-generated from Item Name');
    });
  });

  describe('Given SKU auto-generation is disabled in Core Settings', () => {
    it('When item name is entered / Then SKU is NOT auto-generated and stays empty for manual input', async () => {
      mockGetNumberingSettings.mockResolvedValue({
        sku: {
          enabled: false,
        },
      });

      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(mockGetNumberingSettings).toHaveBeenCalled();
      });

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'Manual SKU Item' } });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      expect((skuInput as HTMLInputElement).value).toBe('');
      expect(screen.queryByTestId('sku-autogen-badge')).toBeNull();
    });
  });
});
