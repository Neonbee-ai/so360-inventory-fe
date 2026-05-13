import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetAll = vi.fn();

vi.mock('../../services/productTypeService', () => ({
  productTypeService: {
    getAll: (...args: any[]) => mockGetAll(...args),
  },
}));

import ProductTypePicker from './ProductTypePicker';

const makeProductType = (overrides: any = {}) => ({
  id: 'pt-1',
  name: 'Electronics',
  code: 'electronics',
  description: 'Electronic devices',
  is_system: false,
  attributes: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAll.mockResolvedValue([makeProductType()]);
});

describe('ProductTypePicker', () => {
  describe('Given loading state', () => {
    it('When loading / Then shows loading indicator', () => {
      mockGetAll.mockReturnValue(new Promise(() => {}));
      render(<ProductTypePicker value="" onChange={vi.fn()} />);
      expect(screen.getByText('Loading product types...')).toBeInTheDocument();
    });
  });

  describe('Given empty product types', () => {
    it('When no product types / Then shows empty state message', async () => {
      mockGetAll.mockResolvedValue([]);
      render(<ProductTypePicker value="" onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/No product types available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given product types loaded', () => {
    it('When loaded / Then shows None option', async () => {
      render(<ProductTypePicker value="" onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('None')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows product type names', async () => {
      render(<ProductTypePicker value="" onChange={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Electronics')).toBeInTheDocument();
      });
    });

    it('When product type clicked / Then calls onChange with id', async () => {
      const onChange = vi.fn();
      render(<ProductTypePicker value="" onChange={onChange} />);
      await waitFor(() => expect(screen.getByText('Electronics')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Electronics'));
      expect(onChange).toHaveBeenCalledWith('pt-1');
    });

    it('When None clicked / Then calls onChange with empty string', async () => {
      const onChange = vi.fn();
      render(<ProductTypePicker value="pt-1" onChange={onChange} />);
      await waitFor(() => expect(screen.getByText('None')).toBeInTheDocument());
      fireEvent.click(screen.getByText('None'));
      expect(onChange).toHaveBeenCalledWith('');
    });
  });
});
