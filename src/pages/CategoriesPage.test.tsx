import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const mockUseShellBridge = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: (...args: any[]) => mockUseShellBridge(...args),
}));

const mockGetSettings = vi.fn();
const mockCreateCategory = vi.fn();
const mockUpdateCategory = vi.fn();
const mockDeleteCategory = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    createCategory: (...args: any[]) => mockCreateCategory(...args),
    updateCategory: (...args: any[]) => mockUpdateCategory(...args),
    deleteCategory: (...args: any[]) => mockDeleteCategory(...args),
  },
}));

vi.mock('../services/mediaService', () => ({
  mediaService: {
    uploadFile: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/img.png' }),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('../components/categories/CategoryTreeView', () => ({
  __esModule: true,
  default: ({ tree, onAdd, onDelete, onSelect }: any) => (
    <div data-testid="category-tree">
      {tree.map((node: any) => (
        <div key={node.id}>
          <button data-testid={`select-${node.id}`} onClick={() => onSelect(node.id)}>
            {node.name}
          </button>
          <button data-testid={`delete-${node.id}`} onClick={() => onDelete(node.id)}>
            Delete
          </button>
        </div>
      ))}
      <button data-testid="add-category" onClick={() => onAdd('New Cat', '')}>
        Add
      </button>
    </div>
  ),
}));

vi.mock('../components/categories/CategoryIconLibrary', () => ({
  __esModule: true,
  default: () => <div data-testid="icon-library" />,
}));

vi.mock('../constants/categoryIcons', () => ({
  renderCategoryIcon: () => <span>icon</span>,
  isPresetUrl: () => false,
}));

vi.mock('../utils/categoryTree', () => ({
  buildCategoryTree: (cats: any[]) => cats.filter((c: any) => !c.parent_id),
}));

import CategoriesPage from './CategoriesPage';

const makeCategory = (overrides: any = {}) => ({
  id: 'cat-1',
  name: 'Electronics',
  description: 'Electronic items',
  parent_id: null,
  icon_url: null,
  image_url: null,
  color: null,
  sort_order: 0,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({ categories: [] });
  mockCreateCategory.mockResolvedValue({ id: 'cat-new', name: 'New Cat' });
  mockUpdateCategory.mockResolvedValue({});
  mockDeleteCategory.mockResolvedValue({});
  mockUseShellBridge.mockReturnValue({
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
  });
});

describe('CategoriesPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Product Categories heading', async () => {
      render(<CategoriesPage />);
      await waitFor(() => {
        expect(screen.getByText('Product Categories')).toBeInTheDocument();
      });
    });

    it('When user has manage permission / Then shows New Category button', async () => {
      render(<CategoriesPage />);
      await waitFor(() => {
        expect(screen.getByText('New Category')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Tree and Cards view toggles', async () => {
      render(<CategoriesPage />);
      await waitFor(() => {
        expect(screen.getByText('Tree')).toBeInTheDocument();
        expect(screen.getByText('Cards')).toBeInTheDocument();
      });
    });
  });

  describe('Given categories are fetched', () => {
    it('When categories exist / Then renders category tree', async () => {
      mockGetSettings.mockResolvedValue({ categories: [makeCategory()] });
      render(<CategoriesPage />);
      await waitFor(() => {
        expect(screen.getByText('Electronics')).toBeInTheDocument();
      });
    });

    it('When no categories / Then shows tree with no items', async () => {
      mockGetSettings.mockResolvedValue({ categories: [] });
      render(<CategoriesPage />);
      await waitFor(() => {
        expect(screen.getByTestId('category-tree')).toBeInTheDocument();
      });
    });
  });

  describe('Given category selection', () => {
    it('When category selected / Then shows detail editor', async () => {
      mockGetSettings.mockResolvedValue({ categories: [makeCategory()] });
      render(<CategoriesPage />);
      await waitFor(() => screen.getByTestId('select-cat-1'));
      fireEvent.click(screen.getByTestId('select-cat-1'));
      await waitFor(() => {
        expect(screen.getByText('Edit Category')).toBeInTheDocument();
      });
    });

    it('When category selected / Then pre-fills name input', async () => {
      mockGetSettings.mockResolvedValue({ categories: [makeCategory()] });
      render(<CategoriesPage />);
      await waitFor(() => screen.getByTestId('select-cat-1'));
      fireEvent.click(screen.getByTestId('select-cat-1'));
      await waitFor(() => {
        expect(screen.getByDisplayValue('Electronics')).toBeInTheDocument();
      });
    });

    it('When no category selected / Then shows placeholder message', async () => {
      mockGetSettings.mockResolvedValue({ categories: [] });
      render(<CategoriesPage />);
      await waitFor(() => {
        expect(screen.getByText(/Select a category from the tree/)).toBeInTheDocument();
      });
    });
  });

  describe('Given category deletion', () => {
    it('When delete clicked / Then calls deleteCategory service', async () => {
      mockGetSettings.mockResolvedValue({ categories: [makeCategory()] });
      render(<CategoriesPage />);
      await waitFor(() => screen.getByTestId('delete-cat-1'));
      fireEvent.click(screen.getByTestId('delete-cat-1'));
      await waitFor(() => {
        expect(mockDeleteCategory).toHaveBeenCalledWith('cat-1');
      });
    });
  });

  describe('Given fetch error', () => {
    it('When getSettings fails / Then shows error message', async () => {
      mockGetSettings.mockRejectedValue(new Error('Failed to load'));
      render(<CategoriesPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
      });
    });
  });

  describe('Given view mode switching', () => {
    it('When Cards button clicked / Then switches to cards view', async () => {
      mockGetSettings.mockResolvedValue({ categories: [makeCategory()] });
      render(<CategoriesPage />);
      await waitFor(() => screen.getByText('Cards'));
      fireEvent.click(screen.getByText('Cards'));
      // Cards view renders categories too (name shown)
      await waitFor(() => {
        expect(screen.getByText('Electronics')).toBeInTheDocument();
      });
    });

    it('When Tree button clicked after Cards / Then reverts to tree view', async () => {
      mockGetSettings.mockResolvedValue({ categories: [makeCategory()] });
      render(<CategoriesPage />);
      await waitFor(() => screen.getByText('Cards'));
      fireEvent.click(screen.getByText('Cards'));
      fireEvent.click(screen.getByText('Tree'));
      await waitFor(() => {
        expect(screen.getByTestId('category-tree')).toBeInTheDocument();
      });
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then New Category button is not shown', async () => {
      mockUseShellBridge.mockReturnValue({
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: false,
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
      });
      render(<CategoriesPage />);
      await waitFor(() => expect(screen.getByText('Product Categories')).toBeInTheDocument());
      expect(screen.queryByText('New Category')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then New Category button appears', async () => {
      mockUseShellBridge.mockReturnValue({
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, effectiveFlagsLoaded: true,
        permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, getFeatureState: () => 'enabled',
      });
      render(<CategoriesPage />);
      await waitFor(() => expect(screen.getByText('New Category')).toBeInTheDocument());
    });
  });
});
