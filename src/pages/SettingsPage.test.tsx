import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetSettings = vi.fn();
const mockCreateUom = vi.fn();
const mockDeleteUom = vi.fn();
const mockCreateCategory = vi.fn();
const mockDeleteCategory = vi.fn();
const mockGetOrgDefaultLogic = vi.fn();
const mockUpdateOrgDefaultLogic = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    createUom: (...args: any[]) => mockCreateUom(...args),
    deleteUom: (...args: any[]) => mockDeleteUom(...args),
    createCategory: (...args: any[]) => mockCreateCategory(...args),
    deleteCategory: (...args: any[]) => mockDeleteCategory(...args),
    getOrgDefaultLogic: (...args: any[]) => mockGetOrgDefaultLogic(...args),
    updateOrgDefaultLogic: (...args: any[]) => mockUpdateOrgDefaultLogic(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('../components/categories/CategoryTreeView', () => ({
  default: ({ categories }: any) => (
    <div data-testid="category-tree">{categories?.length || 0} categories</div>
  ),
}));

vi.mock('../components/settings/ItemAttributeSettingsSection', () => ({
  default: () => <div data-testid="item-attribute-settings">ItemAttributeSettings</div>,
}));

import SettingsPage from './SettingsPage';

const makeSettings = (overrides: any = {}) => ({
  uoms: [
    { id: 'uom-1', name: 'Kilogram', abbreviation: 'kg' },
    { id: 'uom-2', name: 'Piece', abbreviation: 'pcs' },
  ],
  categories: [
    { id: 'cat-1', name: 'Electronics', description: 'Electronic items' },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue(makeSettings());
  mockCreateUom.mockResolvedValue({ id: 'uom-new' });
  mockDeleteUom.mockResolvedValue({});
  mockCreateCategory.mockResolvedValue({ id: 'cat-new' });
  mockDeleteCategory.mockResolvedValue({});
  mockGetOrgDefaultLogic.mockResolvedValue({ allow_negative_stock: false, auto_approve_transfers: false });
  mockUpdateOrgDefaultLogic.mockResolvedValue({ allow_negative_stock: true, auto_approve_transfers: false });
});

describe('SettingsPage', () => {
  describe('Given loading state', () => {
    it('When settings are loading / Then shows loading indicator', () => {
      mockGetSettings.mockReturnValue(new Promise(() => {}));
      const { container } = render(<SettingsPage />);
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Given settings load successfully', () => {
    it('When loaded / Then shows Inventory Settings heading', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Inventory Settings')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Units of Measure section', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText(/Units of Measure/i)).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows UoM items', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Kilogram (kg)')).toBeInTheDocument();
        expect(screen.getByText('Piece (pcs)')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Item Categories section heading', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Item Categories')).toBeInTheDocument();
      });
    });

    it('When loaded / Then calls getSettings on mount', async () => {
      render(<SettingsPage />);
      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Given API error', () => {
    it('When getSettings fails / Then shows error message', async () => {
      mockGetSettings.mockRejectedValue(new Error('Failed to load settings'));
      render(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load settings')).toBeInTheDocument();
      });
    });
  });

  describe('Given Add UoM flow', () => {
    it('When Add Unit button clicked / Then shows name and abbreviation inputs', async () => {
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('Inventory Settings')).toBeInTheDocument());
      // Button text is "Add Unit" (with Plus icon)
      fireEvent.click(screen.getByText('Add Unit'));
      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Abbr')).toBeInTheDocument();
    });

    it('When UoM name and abbreviation entered and saved / Then calls createUom', async () => {
      render(<SettingsPage />);
      await waitFor(() => expect(screen.getByText('Inventory Settings')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Add Unit'));
      fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Liter' } });
      fireEvent.change(screen.getByPlaceholderText('Abbr'), { target: { value: 'L' } });
      fireEvent.click(screen.getByText('Add'));
      await waitFor(() => {
        expect(mockCreateUom).toHaveBeenCalledWith('Liter', 'L');
      });
    });
  });
});
