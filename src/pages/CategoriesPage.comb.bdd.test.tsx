import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const mockUseShellBridge = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: (...a: any[]) => mockUseShellBridge(...a),
}));

const mockGetSettings = vi.fn();
const mockUpdateCategory = vi.fn();
vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...a: any[]) => mockGetSettings(...a),
    createCategory: vi.fn(),
    updateCategory: (...a: any[]) => mockUpdateCategory(...a),
    deleteCategory: vi.fn(),
    getCategoryChannels: vi.fn().mockResolvedValue([]),
    setCategoryChannels: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../services/mediaService', () => ({ mediaService: { uploadFile: vi.fn() } }));

let canManage = true;
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: () => canManage }) }));

vi.mock('../components/categories/CategoryTreeView', () => ({
  __esModule: true,
  default: ({ tree, onSelect }: any) => (
    <div data-testid="category-tree">
      {tree.map((n: any) => <button key={n.id} data-testid={`select-${n.id}`} onClick={() => onSelect(n.id)}>{n.name}</button>)}
    </div>
  ),
}));
vi.mock('../components/categories/CategoryIconLibrary', () => ({ __esModule: true, default: () => <div data-testid="icon-library" /> }));
vi.mock('../constants/categoryIcons', () => ({ renderCategoryIcon: () => <span>icon</span>, isPresetUrl: (u?: string | null) => !!u && u.startsWith('preset:') }));
vi.mock('../utils/categoryTree', () => ({ buildCategoryTree: (c: any[]) => c.filter(x => !x.parent_id) }));

import CategoriesPage from './CategoriesPage';

const cat = { id: 'cat-1', name: 'Summer Shoes', description: '', parent_id: null, icon_url: null, image_url: null, banner_url: null, color: null, sort_order: 0 };

const setShell = (over: any = {}) =>
  mockUseShellBridge.mockReturnValue({
    permissionsLoaded: true,
    effectiveFlagsLoaded: true,
    hasPermission: () => true,
    getFeatureState: () => 'enabled',
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  canManage = true;
  setShell();
  mockGetSettings.mockResolvedValue({ categories: [cat] });
});

describe('CategoriesPage (Comb)', () => {
  it('Given a pending load, When rendered, Then the loading text shows', () => {
    mockGetSettings.mockReturnValue(new Promise(() => {}));
    render(<CategoriesPage />);
    expect(screen.getByText('Loading categories...')).toBeInTheDocument();
  });

  it('Given loaded categories, When rendered, Then the title and New Category action show', async () => {
    render(<CategoriesPage />);
    expect(await screen.findByText('Product Categories')).toBeInTheDocument();
    expect(screen.getByText('New Category')).toBeInTheDocument();
  });

  it('Given no selection, When rendered, Then the select-a-category hint shows', async () => {
    render(<CategoriesPage />);
    expect(await screen.findByText(/Select a category from the tree/)).toBeInTheDocument();
  });

  it('Given a failed load, When rendered, Then an error alert shows the message', async () => {
    mockGetSettings.mockRejectedValue(new Error('Failed to load'));
    render(<CategoriesPage />);
    expect(await screen.findByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('Given a category, When selected and Save clicked, Then updateCategory is called with the name', async () => {
    mockUpdateCategory.mockResolvedValue({});
    render(<CategoriesPage />);
    fireEvent.click(await screen.findByTestId('select-cat-1'));
    expect(await screen.findByText('Edit Category')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
    expect(mockUpdateCategory.mock.calls[0][0]).toBe('cat-1');
    expect(mockUpdateCategory.mock.calls[0][1]).toMatchObject({ name: 'Summer Shoes' });
  });

  it('Given no manage permission, When rendered, Then New Category is hidden', async () => {
    canManage = false;
    render(<CategoriesPage />);
    await screen.findByText('Product Categories');
    expect(screen.queryByText('New Category')).not.toBeInTheDocument();
  });
});

describe('CategoriesPage icon removal (Comb IconButton)', () => {
  it('Given a category with a preset icon, When Remove icon is clicked, Then the upload zone replaces the preview', async () => {
    mockGetSettings.mockResolvedValue({ categories: [{ ...cat, icon_url: 'preset:tag' }] });
    render(<CategoriesPage />);
    fireEvent.click(await screen.findByTestId('select-cat-1'));
    const btn = await screen.findByRole('button', { name: 'Remove icon' });
    expect(btn).toHaveAttribute('data-comb', 'icon-button');
    fireEvent.click(btn);
    expect(screen.queryByRole('button', { name: 'Remove icon' })).not.toBeInTheDocument();
  });
});
