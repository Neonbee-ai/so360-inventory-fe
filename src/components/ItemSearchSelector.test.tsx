import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetItems = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getItems: (...args: any[]) => mockGetItems(...args),
  },
}));

import ItemSearchSelector from './ItemSearchSelector';

const makeItem = (overrides: any = {}) => ({
  id: 'item-1',
  name: 'Widget Pro',
  sku: 'WGT-001',
  price: 99.99,
  unit_price: 99.99,
  tax_code_id: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItems.mockResolvedValue({ data: [makeItem()] });
});

describe('ItemSearchSelector', () => {
  describe('Given initial render', () => {
    it('When rendered / Then shows search input', () => {
      render(<ItemSearchSelector value="" onSelect={vi.fn()} />);
      expect(screen.getByPlaceholderText('Search item by name or SKU...')).toBeInTheDocument();
    });

    it('When selectedName provided / Then shows selectedName in input', () => {
      render(<ItemSearchSelector value="item-1" selectedName="Widget Pro (WGT-001)" onSelect={vi.fn()} />);
      expect(screen.getByDisplayValue('Widget Pro (WGT-001)')).toBeInTheDocument();
    });
  });

  describe('Given search interaction', () => {
    it('When input typed / Then calls getItems after debounce', async () => {
      render(<ItemSearchSelector value="" onSelect={vi.fn()} />);
      const input = screen.getByPlaceholderText('Search item by name or SKU...');
      fireEvent.change(input, { target: { value: 'Widget' } });
      // Wait for debounce (300ms) + async to resolve
      await waitFor(() => {
        expect(mockGetItems).toHaveBeenCalledWith({ search: 'Widget', limit: 20 });
      }, { timeout: 2000 });
    });

    it('When results appear / Then shows item name in dropdown', async () => {
      render(<ItemSearchSelector value="" onSelect={vi.fn()} />);
      const input = screen.getByPlaceholderText('Search item by name or SKU...');
      fireEvent.change(input, { target: { value: 'Widget' } });
      await waitFor(() => {
        expect(screen.getByText('Widget Pro')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('When item selected / Then calls onSelect with item data', async () => {
      const onSelect = vi.fn();
      render(<ItemSearchSelector value="" onSelect={onSelect} />);
      const input = screen.getByPlaceholderText('Search item by name or SKU...');
      fireEvent.change(input, { target: { value: 'Widget' } });
      await waitFor(() => expect(screen.getByText('Widget Pro')).toBeInTheDocument(), { timeout: 2000 });
      fireEvent.mouseDown(screen.getByText('Widget Pro'));
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1', name: 'Widget Pro', sku: 'WGT-001' }));
    });
  });

  describe('Given no results', () => {
    it('When search returns empty / Then shows No items found', async () => {
      mockGetItems.mockResolvedValue({ data: [] });
      render(<ItemSearchSelector value="" onSelect={vi.fn()} />);
      const input = screen.getByPlaceholderText('Search item by name or SKU...');
      fireEvent.change(input, { target: { value: 'xyz' } });
      await waitFor(() => {
        expect(screen.getByText('No items found.')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});
