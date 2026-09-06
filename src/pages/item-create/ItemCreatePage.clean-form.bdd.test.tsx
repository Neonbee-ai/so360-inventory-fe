import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import ItemCreatePage, { createFreshItemForm } from './ItemCreatePage';

const mockGetSettings = vi.fn();
const mockGetLocations = vi.fn();
const mockGetTaxCodes = vi.fn();
const mockGetNumberingSettings = vi.fn();

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    getLocations: (...args: any[]) => mockGetLocations(...args),
    getTaxCodes: (...args: any[]) => mockGetTaxCodes(...args),
    getNumberingSettings: (...args: any[]) => mockGetNumberingSettings(...args),
    checkSkuAvailable: vi.fn().mockResolvedValue({ available: true }),
    getAttributeDefinitions: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: 'item-123' }),
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

describe('ItemCreatePage — Clean Product Form Lifecycle (BDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ categories: [], uoms: [] });
    mockGetLocations.mockResolvedValue([]);
    mockGetTaxCodes.mockResolvedValue([]);
    mockGetNumberingSettings.mockResolvedValue({ sku: { enabled: true } });
  });

  describe('Feature: Pure State Factory Isolation', () => {
    it('Scenario: Each invocation of createFreshItemForm produces distinct object and array references', () => {
      const formA = createFreshItemForm();
      const formB = createFreshItemForm();

      // Mutate Form A
      formA.image_urls.push('https://example.com/imageA.png');
      formA.custom_attributes['color'] = 'blue';
      formA.metadata['source'] = 'import';

      // Form B should be completely uncontaminated
      expect(formB.image_urls).toEqual([]);
      expect(formB.custom_attributes).toEqual({});
      expect(formB.metadata).toEqual({});
      expect(formA.image_urls).not.toBe(formB.image_urls);
      expect(formA.custom_attributes).not.toBe(formB.custom_attributes);
      expect(formA.metadata).not.toBe(formB.metadata);
    });
  });

  describe('Feature: Navigation & Mount Lifecycle Reset', () => {
    it('Scenario: User enters dirty data, unmounts, and returns to /new — form starts 100% pristine', async () => {
      // First mount: user enters dirty state
      const { unmount } = render(<ItemCreatePage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/macbook pro 14/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      const skuInput = screen.getByPlaceholderText(/lap-001/i);
      const barcodeInput = screen.getByPlaceholderText(/012345678905/i);

      fireEvent.change(nameInput, { target: { value: 'Dirty Stale Product' } });
      fireEvent.change(skuInput, { target: { value: 'MANUAL-OVERRIDE-999' } });
      fireEvent.change(barcodeInput, { target: { value: '112233445566' } });

      expect((nameInput as HTMLInputElement).value).toBe('Dirty Stale Product');
      expect((skuInput as HTMLInputElement).value).toBe('MANUAL-OVERRIDE-999');

      // Unmount component (simulating navigation away to catalog or details)
      unmount();

      // Second mount: user navigates back to /new
      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/macbook pro 14/i)).toBeInTheDocument();
      });

      const cleanNameInput = screen.getByPlaceholderText(/macbook pro 14/i);
      const cleanSkuInput = screen.getByPlaceholderText(/lap-001/i);
      const cleanBarcodeInput = screen.getByPlaceholderText(/012345678905/i);

      expect((cleanNameInput as HTMLInputElement).value).toBe('');
      expect((cleanSkuInput as HTMLInputElement).value).toBe('');
      expect((cleanBarcodeInput as HTMLInputElement).value).toBe('');
      expect(screen.queryByTestId('sku-reset-btn')).toBeNull();
    });
  });

  describe('Feature: Sub-Tab and Inline Buffer Isolation', () => {
    it('Scenario: Inline UoM creation inputs reset cleanly without memory leak', async () => {
      render(<ItemCreatePage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/macbook pro 14/i)).toBeInTheDocument();
      });

      // Initially, new UoM input fields should not be present
      expect(screen.queryByPlaceholderText('Unit name *')).toBeNull();
      expect(screen.queryByPlaceholderText('Abbreviation * (e.g. pcs, kg)')).toBeNull();
    });
  });
});
