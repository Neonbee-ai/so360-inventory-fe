/**
 * Category SEO fields (Pulse P5.2) — CategoriesPage editor BDD specs.
 *
 * Invariants:
 *   - "Search engine listing" is collapsed by default and toggles open.
 *   - Slug edits show a live /c/<slug> preview; an invalid slug blocks Save.
 *   - Meta title / description show n/70 and n/160 counters and feed the
 *     Google-style snippet preview (falling back to name / description).
 *   - Banner alt text sits under the banner and is used as the image alt.
 *   - Only changed SEO fields are sent; untouched ones are never named.
 */
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
const mockUpdateCategory = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    createCategory: vi.fn(),
    updateCategory: (...args: any[]) => mockUpdateCategory(...args),
    deleteCategory: vi.fn(),
    getCategoryChannels: vi.fn().mockResolvedValue([]),
    setCategoryChannels: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/mediaService', () => ({
  mediaService: { uploadFile: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/img.png' }) },
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: () => true }) }));

vi.mock('../components/categories/CategoryTreeView', () => ({
  __esModule: true,
  default: ({ tree, onSelect }: any) => (
    <div data-testid="category-tree">
      {tree.map((node: any) => (
        <button key={node.id} data-testid={`select-${node.id}`} onClick={() => onSelect(node.id)}>
          {node.name}
        </button>
      ))}
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
  name: 'Summer Shoes',
  description: 'Sandals and canvas shoes',
  parent_id: null,
  icon_url: null,
  image_url: null,
  color: null,
  sort_order: 0,
  slug: 'summer-shoes',
  meta_title: null,
  meta_description: null,
  banner_alt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateCategory.mockResolvedValue({});
  mockUseShellBridge.mockReturnValue({
    permissionsLoaded: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
});

const openEditor = async (overrides: any = {}) => {
  mockGetSettings.mockResolvedValue({ categories: [makeCategory(overrides)] });
  render(<CategoriesPage />);
  await waitFor(() => screen.getByTestId('select-cat-1'));
  fireEvent.click(screen.getByTestId('select-cat-1'));
  await waitFor(() => screen.getByText('Edit Category'));
};
const seoToggle = () => screen.getByRole('button', { name: /search engine listing/i });
const openSeo = () => fireEvent.click(seoToggle());
const saveButton = () => screen.getByText('Save', { selector: 'button' }) as HTMLButtonElement;
const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const savedPayload = async () => {
  fireEvent.click(saveButton());
  await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
  return mockUpdateCategory.mock.calls[0][1];
};

describe('Given a category is open in the editor', () => {
  it('When the editor renders / Then the search engine listing is collapsed', async () => {
    await openEditor();
    expect(seoToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText(/meta title/i)).not.toBeInTheDocument();
  });

  it('When the search engine listing header is clicked / Then the slug and meta fields appear', async () => {
    await openEditor();
    openSeo();
    expect(seoToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/url slug/i)).toHaveValue('summer-shoes');
    expect(screen.getByLabelText(/meta title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/meta description/i)).toBeInTheDocument();
  });

  it('When the slug is edited / Then the /c/<slug> preview follows it', async () => {
    await openEditor();
    openSeo();
    type(/url slug/i, 'beach-sandals');
    expect(screen.getByTestId('seo-snippet-url')).toHaveTextContent('/c/beach-sandals');
  });

  it('When a meta title is typed / Then the counter shows n/70', async () => {
    await openEditor();
    openSeo();
    type(/meta title/i, 'Summer shoes sale');
    expect(screen.getByTestId('meta-title-count')).toHaveTextContent('17/70');
  });

  it('When a meta description is typed / Then the counter shows n/160', async () => {
    await openEditor();
    openSeo();
    type(/meta description/i, 'Light shoes for hot days.');
    expect(screen.getByTestId('meta-description-count')).toHaveTextContent('25/160');
  });

  it('When no meta title or description is set / Then the snippet falls back to name and description', async () => {
    await openEditor();
    openSeo();
    expect(screen.getByTestId('seo-snippet-title')).toHaveTextContent('Summer Shoes');
    expect(screen.getByTestId('seo-snippet-description')).toHaveTextContent('Sandals and canvas shoes');
  });

  it('When a meta title is typed / Then the snippet preview uses it as the headline', async () => {
    await openEditor();
    openSeo();
    type(/meta title/i, 'Summer Shoes | Naiz');
    expect(screen.getByTestId('seo-snippet-title')).toHaveTextContent('Summer Shoes | Naiz');
  });

  it('When the meta inputs render / Then they cap input at the storefront limits', async () => {
    await openEditor();
    openSeo();
    expect(screen.getByLabelText(/meta title/i)).toHaveAttribute('maxLength', '70');
    expect(screen.getByLabelText(/meta description/i)).toHaveAttribute('maxLength', '160');
  });

  it('When the slug is not kebab-case / Then an error shows and Save is disabled', async () => {
    await openEditor();
    openSeo();
    type(/url slug/i, 'Summer Shoes');
    expect(screen.getByTestId('slug-error')).toHaveTextContent(/lowercase letters, numbers and single hyphens/i);
    expect(saveButton()).toBeDisabled();
  });

  it('When SEO fields are edited and saved / Then only the changed fields are sent', async () => {
    await openEditor();
    openSeo();
    type(/url slug/i, 'beach-sandals');
    type(/meta title/i, '  Beach Sandals  ');
    const payload = await savedPayload();
    expect(payload).toMatchObject({ slug: 'beach-sandals', meta_title: 'Beach Sandals' });
    expect(payload).not.toHaveProperty('meta_description');
    expect(payload).not.toHaveProperty('banner_alt');
  });

  it('When nothing SEO-related is touched / Then no SEO keys are sent', async () => {
    await openEditor();
    const payload = await savedPayload();
    for (const key of ['slug', 'meta_title', 'meta_description', 'banner_alt']) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it('When a saved meta description is cleared / Then null is sent', async () => {
    await openEditor({ meta_description: 'Old copy' });
    openSeo();
    type(/meta description/i, '');
    expect((await savedPayload()).meta_description).toBeNull();
  });

  it('When the slug is cleared / Then an empty slug is sent so the server regenerates it', async () => {
    await openEditor();
    openSeo();
    type(/url slug/i, '');
    expect((await savedPayload()).slug).toBe('');
  });
});

describe('Given the category banner', () => {
  it('When the editor renders / Then a banner alt text field sits with the banner', async () => {
    await openEditor();
    expect(screen.getByLabelText(/banner alt text/i)).toHaveAttribute('maxLength', '200');
  });

  it('When banner alt text is typed and saved / Then banner_alt is sent', async () => {
    await openEditor();
    type(/banner alt text/i, 'Sandals on a beach towel');
    expect((await savedPayload()).banner_alt).toBe('Sandals on a beach towel');
  });

  it('When a banner has saved alt text / Then the preview image uses it as alt', async () => {
    await openEditor({ banner_url: 'https://cdn.example.com/banner.png', banner_alt: 'Sandals on sand' });
    const banner = Array.from(document.querySelectorAll('img')).find(
      i => (i as HTMLImageElement).src === 'https://cdn.example.com/banner.png',
    );
    expect(banner).toHaveAttribute('alt', 'Sandals on sand');
  });
});
