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
    // Channel visibility panel (migration 050) loads on category select.
    getCategoryChannels: vi.fn().mockResolvedValue([]),
    setCategoryChannels: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/mediaService', () => ({
  mediaService: {
    uploadFile: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/img.png' }),
  },
}));

const mockCanCat = vi.hoisted(() => vi.fn((_action: string) => true));
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: mockCanCat }),
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
  mockCanCat.mockImplementation((_action: string) => true);
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

  describe('Given RBAC gates category management on items.update', () => {
    it('When can("items.update") is denied / Then New Category button is hidden', async () => {
      mockCanCat.mockImplementation((action: string) => action !== 'items.update');
      render(<CategoriesPage />);
      await waitFor(() => expect(screen.getByText('Product Categories')).toBeInTheDocument());
      expect(screen.queryByText('New Category')).not.toBeInTheDocument();
    });

    it('When can("items.update") is granted / Then New Category button is shown', async () => {
      mockCanCat.mockImplementation((action: string) => action === 'items.update');
      render(<CategoriesPage />);
      await waitFor(() => expect(screen.getByText('New Category')).toBeInTheDocument());
    });
  });
});

describe('CategoriesPage — category image and banner slots', () => {
  const openEditor = async (overrides: any = {}) => {
    mockGetSettings.mockResolvedValue({ categories: [makeCategory(overrides)] });
    render(<CategoriesPage />);
    await waitFor(() => screen.getByTestId('select-cat-1'));
    fireEvent.click(screen.getByTestId('select-cat-1'));
    await waitFor(() => screen.getByText('Edit Category'));
  };
  const saveButton = () => screen.getByText('Save', { selector: 'button' });

  it('Given a category is being edited / When the editor renders / Then it asks for a square 1600×1600 image and a 16:5 2400×750 banner', async () => {
    await openEditor();
    expect(screen.getByText('Category image — square 1:1, 1600×1600')).toBeInTheDocument();
    expect(screen.getByText('Category banner — 16:5, 2400×750')).toBeInTheDocument();
    expect(screen.queryByText(/1200×400/)).not.toBeInTheDocument();
  });

  it('Given a banner is uploaded / When Save is clicked / Then banner_url is sent separately from image_url', async () => {
    await openEditor({ image_url: 'https://cdn.example.com/square.png' });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    // First slot is the banner.
    fireEvent.change(fileInputs[0], {
      target: { files: [new File(['x'], 'banner.png', { type: 'image/png' })] },
    });
    await waitFor(() =>
      expect((document.querySelectorAll('img')[0] as HTMLImageElement).src).toBe('https://cdn.example.com/img.png'),
    );
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
    expect(mockUpdateCategory).toHaveBeenCalledWith(
      'cat-1',
      expect.objectContaining({
        banner_url: 'https://cdn.example.com/img.png',
        image_url: 'https://cdn.example.com/square.png',
      }),
    );
  });

  it('Given the banner was not touched / When Save is clicked / Then banner_url is not sent at all', async () => {
    await openEditor();
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
    expect(mockUpdateCategory.mock.calls[0][1]).not.toHaveProperty('banner_url');
  });

  it('Given a WebP file / When dropped on a slot / Then it is accepted (not rejected as a wrong type)', async () => {
    await openEditor();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect((fileInputs[0] as HTMLInputElement).accept).toContain('image/webp');
    fireEvent.change(fileInputs[0], {
      target: { files: [new File(['x'], 'banner.webp', { type: 'image/webp' })] },
    });
    await waitFor(() =>
      expect((document.querySelectorAll('img')[0] as HTMLImageElement).src).toBe('https://cdn.example.com/img.png'),
    );
    expect(screen.queryByText(/PNG, JPG, SVG or WebP only/)).not.toBeInTheDocument();
  });

  it('Given a saved square image that is actually banner-shaped / When it loads / Then the slot badge warns about its shape', async () => {
    await openEditor({ image_url: 'https://cdn.example.com/old-wide.png' });
    const img = Array.from(document.querySelectorAll('img')).find(
      i => (i as HTMLImageElement).src === 'https://cdn.example.com/old-wide.png',
    ) as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 1200 });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 400 });
    fireEvent.load(img);
    const badge = await screen.findByTestId('slot-size-badge');
    expect(badge).toHaveTextContent('⚠ 1200×400');
    expect(badge.getAttribute('title')).toMatch(/this slot is 1:1/);
  });
});
