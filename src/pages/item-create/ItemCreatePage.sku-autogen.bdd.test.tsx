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

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    getLocations: (...args: any[]) => mockGetLocations(...args),
    getTaxCodes: (...args: any[]) => mockGetTaxCodes(...args),
    getNumberingSettings: (...args: any[]) => mockGetNumberingSettings(...args),
    getNextNumber: (...args: any[]) => mockGetNextNumber(...args),
    getAttributeDefinitions: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: 'item-1' }),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
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
        prefix: 'SKU-',
        start_number: 1,
        padding: 5,
        separator: '-',
        reset_frequency: 'never',
        enabled: true,
      },
    });
    mockGetNextNumber.mockResolvedValue({ number: 'SKU-00042' });
  });

  describe('Given SKU auto-generation is enabled in Core Settings', () => {
    it('When user enters an item name / Then SKU is automatically assigned from centralized numbering', async () => {
      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(mockGetNumberingSettings).toHaveBeenCalled();
      });

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'Ergonomic Desk Chair' } });

      await waitFor(() => {
        expect(mockGetNextNumber).toHaveBeenCalledWith('sku');
      });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      await waitFor(() => {
        expect((skuInput as HTMLInputElement).value).toBe('SKU-00042');
      });

      // Auto-generated badge should be visible
      expect(screen.getByTestId('sku-autogen-badge')).toBeDefined();
      expect(screen.getByTestId('sku-autogen-badge').textContent).toBe('Auto-generated');
    });
  });

  describe('Given user manually overrides the auto-generated SKU', () => {
    it('When SKU is typed directly / Then manual override is preserved and not overwritten by item name updates', async () => {
      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(mockGetNumberingSettings).toHaveBeenCalled();
      });

      // User first types item name -> auto-generates
      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'Standing Desk Pro' } });

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      await waitFor(() => {
        expect((skuInput as HTMLInputElement).value).toBe('SKU-00042');
      });

      // User manually overrides SKU
      fireEvent.change(skuInput, { target: { value: 'CUSTOM-DESK-99' } });
      expect((skuInput as HTMLInputElement).value).toBe('CUSTOM-DESK-99');

      // Badge updates to Manual Override
      expect(screen.getByTestId('sku-autogen-badge').textContent).toBe('Manual Override');

      // User changes Item Name again
      fireEvent.change(nameInput, { target: { value: 'Standing Desk Pro V2' } });

      // SKU remains the custom override!
      expect((skuInput as HTMLInputElement).value).toBe('CUSTOM-DESK-99');
    });
  });

  describe('Given SKU auto-generation is disabled in Core Settings', () => {
    it('When item name is entered / Then SKU is NOT auto-generated and stays empty for manual input', async () => {
      mockGetNumberingSettings.mockResolvedValue({
        sku: {
          enabled: false,
          prefix: 'SKU-',
        },
      });

      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(mockGetNumberingSettings).toHaveBeenCalled();
      });

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      fireEvent.change(nameInput, { target: { value: 'Manual SKU Item' } });

      expect(mockGetNextNumber).not.toHaveBeenCalled();

      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      expect((skuInput as HTMLInputElement).value).toBe('');
      expect(screen.queryByTestId('sku-autogen-badge')).toBeNull();
    });
  });
});
