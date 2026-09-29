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
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

import CategoriesPage, { CATEGORY_SEO_LIMITS } from './CategoriesPage';

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
const nameInput = () => screen.getByPlaceholderText('Category name') as HTMLInputElement;
const renameTo = (value: string) => fireEvent.change(nameInput(), { target: { value } });
const collapsedHint = () => seoToggle().querySelector('span.ml-auto');
const invokeDisabledSave = async () => {
  // The Save button is disabled while the slug is invalid, so a real click never
  // reaches handleSaveDetail. Invoke React's onClick prop directly to prove the
  // defensive guard inside the handler still blocks the write.
  const btn = saveButton();
  const propsKey = Object.keys(btn).find(k => k.startsWith('__reactProps$')) as string;
  await act(async () => {
    await (btn as any)[propsKey].onClick();
  });
};
const savedPayload = async () => {
  fireEvent.click(saveButton());
  await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
  return mockUpdateCategory.mock.calls[0][1];
};

describe('Given a category is open in the editor', () => {
  describe('When the editor first renders', () => {
    it('Then the search engine listing is collapsed', async () => {
      await openEditor();
      expect(seoToggle()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText(/meta title/i)).not.toBeInTheDocument();
    });

    it('Then the collapsed header shows a right chevron and not a down chevron', async () => {
      await openEditor();
      expect(seoToggle().querySelector('[data-testid="icon-ChevronRight"]')).not.toBeNull();
      expect(seoToggle().querySelector('[data-testid="icon-ChevronDown"]')).toBeNull();
    });

    it('Then the collapsed header previews the saved /c/<slug>', async () => {
      await openEditor();
      expect(collapsedHint()).toHaveTextContent('/c/summer-shoes');
    });
  });

  describe('When the search engine listing header is clicked', () => {
    it('Then the slug and meta fields appear', async () => {
      await openEditor();
      openSeo();
      expect(seoToggle()).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByLabelText(/url slug/i)).toHaveValue('summer-shoes');
      expect(screen.getByLabelText(/meta title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/meta description/i)).toBeInTheDocument();
    });

    it('Then the chevron turns down and the collapsed /c/ hint is hidden', async () => {
      await openEditor();
      openSeo();
      expect(seoToggle().querySelector('[data-testid="icon-ChevronDown"]')).not.toBeNull();
      expect(seoToggle().querySelector('[data-testid="icon-ChevronRight"]')).toBeNull();
      expect(collapsedHint()).toBeNull();
    });
  });

  describe('When the header is clicked a second time', () => {
    it('Then the section collapses again', async () => {
      await openEditor();
      openSeo();
      openSeo();
      expect(seoToggle()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('seo-snippet-preview')).not.toBeInTheDocument();
    });
  });

  describe('When the meta inputs render', () => {
    it('Then they cap input at the storefront limits', async () => {
      await openEditor();
      openSeo();
      expect(screen.getByLabelText(/meta title/i)).toHaveAttribute('maxLength', String(CATEGORY_SEO_LIMITS.metaTitle));
      expect(screen.getByLabelText(/meta description/i)).toHaveAttribute('maxLength', String(CATEGORY_SEO_LIMITS.metaDescription));
      expect(screen.getByLabelText(/url slug/i)).toHaveAttribute('maxLength', String(CATEGORY_SEO_LIMITS.slug));
    });
  });
});

describe('Given the URL slug field', () => {
  describe('When the slug is edited', () => {
    it('Then the /c/<slug> preview follows it', async () => {
      await openEditor();
      openSeo();
      type(/url slug/i, 'beach-sandals');
      expect(screen.getByTestId('seo-snippet-url')).toHaveTextContent('/c/beach-sandals');
    });
  });

  describe('When a valid slug is shown', () => {
    it('Then the "leave blank" hint shows and the input is not marked invalid', async () => {
      await openEditor();
      openSeo();
      expect(screen.getByText(/leave blank to generate it from the name/i)).toBeInTheDocument();
      expect(screen.queryByTestId('slug-error')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/url slug/i)).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('When the slug is not kebab-case', () => {
    it('Then an error shows, the input is marked invalid and Save is disabled', async () => {
      await openEditor();
      openSeo();
      type(/url slug/i, 'Summer Shoes');
      expect(screen.getByTestId('slug-error')).toHaveTextContent(/lowercase letters, numbers and single hyphens/i);
      expect(screen.getByLabelText(/url slug/i)).toHaveAttribute('aria-invalid', 'true');
      expect(saveButton()).toBeDisabled();
    });
  });

  describe('When the save handler runs anyway with an invalid slug and the section collapsed', () => {
    it('Then the section re-opens, the error is shown next to Save and nothing is written', async () => {
      await openEditor();
      openSeo();
      type(/url slug/i, 'bad--slug');
      openSeo(); // collapse
      expect(seoToggle()).toHaveAttribute('aria-expanded', 'false');
      await invokeDisabledSave();
      expect(seoToggle()).toHaveAttribute('aria-expanded', 'true');
      // one copy under the slug input, one beside the Save button
      expect(screen.getAllByText(/lowercase letters, numbers and single hyphens/i)).toHaveLength(2);
      expect(mockUpdateCategory).not.toHaveBeenCalled();
    });
  });

  describe('When the slug is cleared on a category with a saved slug', () => {
    it('Then the preview keeps the saved slug rather than deriving one from the name', async () => {
      await openEditor();
      openSeo();
      renameTo('Winter Boots');
      type(/url slug/i, '   ');
      expect(screen.getByTestId('seo-snippet-url')).toHaveTextContent('/c/summer-shoes');
    });

    it('Then an empty slug is sent so the server regenerates it', async () => {
      await openEditor();
      openSeo();
      type(/url slug/i, '');
      expect((await savedPayload()).slug).toBe('');
    });
  });

  describe('When the category has no saved slug', () => {
    it('Then the preview and placeholder derive a kebab-case slug from the name', async () => {
      await openEditor({ slug: null, name: '  Beach & Pool Toys! ' });
      expect(collapsedHint()).toHaveTextContent('/c/beach-pool-toys');
      openSeo();
      expect(screen.getByLabelText(/url slug/i)).toHaveValue('');
      expect(screen.getByLabelText(/url slug/i)).toHaveAttribute('placeholder', 'beach-pool-toys');
    });

    it('Then a name with no letters or digits falls back to "category"', async () => {
      await openEditor({ slug: null, name: '***' });
      expect(collapsedHint()).toHaveTextContent('/c/category');
    });

    it('Then saving without touching the slug sends no slug key', async () => {
      await openEditor({ slug: null });
      expect(await savedPayload()).not.toHaveProperty('slug');
    });

    it('Then typing a slug sends it', async () => {
      await openEditor({ slug: null });
      openSeo();
      type(/url slug/i, '  new-slug ');
      expect((await savedPayload()).slug).toBe('new-slug');
    });
  });
});

describe('Given the meta title and description counters', () => {
  describe('When a meta title is typed', () => {
    it('Then the counter shows n/70', async () => {
      await openEditor();
      openSeo();
      type(/meta title/i, 'Summer shoes sale');
      expect(screen.getByTestId('meta-title-count')).toHaveTextContent('17/70');
    });
  });

  describe('When a meta description is typed', () => {
    it('Then the counter shows n/160', async () => {
      await openEditor();
      openSeo();
      type(/meta description/i, 'Light shoes for hot days.');
      expect(screen.getByTestId('meta-description-count')).toHaveTextContent('25/160');
    });
  });

  describe('When the value is well under the limit', () => {
    it('Then the counter is neutral (slate)', async () => {
      await openEditor();
      openSeo();
      type(/meta title/i, 'Short');
      expect(screen.getByTestId('meta-title-count').className).toContain('text-slate-500');
    });
  });

  describe('When the value is above 90% of the limit', () => {
    it('Then the counter warns (amber)', async () => {
      await openEditor();
      openSeo();
      type(/meta title/i, 'x'.repeat(64));
      const counter = screen.getByTestId('meta-title-count');
      expect(counter).toHaveTextContent('64/70');
      expect(counter.className).toContain('text-amber-400');
    });
  });

  describe('When the value exceeds the limit (e.g. a saved legacy value)', () => {
    it('Then the counter turns red (rose)', async () => {
      await openEditor({ meta_description: 'y'.repeat(161) });
      openSeo();
      const counter = screen.getByTestId('meta-description-count');
      expect(counter).toHaveTextContent('161/160');
      expect(counter.className).toContain('text-rose-400');
    });
  });
});

describe('Given the search snippet preview', () => {
  describe('When no meta title or description is set', () => {
    it('Then the snippet falls back to the name and description', async () => {
      await openEditor();
      openSeo();
      expect(screen.getByTestId('seo-snippet-title')).toHaveTextContent('Summer Shoes');
      expect(screen.getByTestId('seo-snippet-description')).toHaveTextContent('Sandals and canvas shoes');
    });
  });

  describe('When a meta title and description are typed', () => {
    it('Then the snippet uses them', async () => {
      await openEditor();
      openSeo();
      type(/meta title/i, 'Summer Shoes | Naiz');
      type(/meta description/i, 'Shop breezy sandals.');
      expect(screen.getByTestId('seo-snippet-title')).toHaveTextContent('Summer Shoes | Naiz');
      expect(screen.getByTestId('seo-snippet-description')).toHaveTextContent('Shop breezy sandals.');
    });
  });

  describe('When the name, description and meta fields are all blank', () => {
    it('Then the title falls back to "Category" and the description to the guidance text', async () => {
      await openEditor({ description: '' });
      openSeo();
      renameTo('   ');
      expect(screen.getByTestId('seo-snippet-title')).toHaveTextContent(/^Category$/);
      expect(screen.getByTestId('seo-snippet-description')).toHaveTextContent(/add a meta description/i);
    });

    it('Then the meta title placeholder falls back to "Category name"', async () => {
      await openEditor();
      openSeo();
      expect(screen.getByLabelText(/meta title/i)).toHaveAttribute('placeholder', 'Summer Shoes');
      renameTo('');
      expect(screen.getByLabelText(/meta title/i)).toHaveAttribute('placeholder', 'Category name');
    });
  });
});

describe('Given the save payload', () => {
  describe('When SEO fields are edited and saved', () => {
    it('Then only the changed fields are sent, trimmed', async () => {
      await openEditor();
      openSeo();
      type(/url slug/i, 'beach-sandals');
      type(/meta title/i, '  Beach Sandals  ');
      const payload = await savedPayload();
      expect(payload).toMatchObject({ slug: 'beach-sandals', meta_title: 'Beach Sandals' });
      expect(payload).not.toHaveProperty('meta_description');
      expect(payload).not.toHaveProperty('banner_alt');
    });
  });

  describe('When nothing SEO-related is touched', () => {
    it('Then no SEO keys are sent', async () => {
      await openEditor();
      const payload = await savedPayload();
      for (const key of ['slug', 'meta_title', 'meta_description', 'banner_alt']) {
        expect(payload).not.toHaveProperty(key);
      }
    });
  });

  describe('When saved SEO values are left unchanged', () => {
    it('Then they are not re-sent', async () => {
      await openEditor({ meta_title: 'Saved title', meta_description: 'Saved copy', banner_alt: 'Saved alt' });
      const payload = await savedPayload();
      for (const key of ['meta_title', 'meta_description', 'banner_alt']) {
        expect(payload).not.toHaveProperty(key);
      }
    });
  });

  describe('When a saved meta description is cleared', () => {
    it('Then null is sent', async () => {
      await openEditor({ meta_description: 'Old copy' });
      openSeo();
      type(/meta description/i, '');
      expect((await savedPayload()).meta_description).toBeNull();
    });
  });

  describe('When a blank-only value is typed into an empty meta field', () => {
    it('Then it counts as unchanged and is not sent', async () => {
      await openEditor();
      openSeo();
      type(/meta title/i, '    ');
      expect(await savedPayload()).not.toHaveProperty('meta_title');
    });
  });

  describe('When the category has no SEO keys at all (pre-migration row)', () => {
    it('Then untouched fields are still omitted and typed ones are sent', async () => {
      await openEditor({ slug: undefined, meta_title: undefined, meta_description: undefined, banner_alt: undefined });
      openSeo();
      type(/meta description/i, 'Fresh copy');
      const payload = await savedPayload();
      expect(payload.meta_description).toBe('Fresh copy');
      expect(payload).not.toHaveProperty('slug');
      expect(payload).not.toHaveProperty('meta_title');
      expect(payload).not.toHaveProperty('banner_alt');
    });
  });
});

describe('Given the category banner', () => {
  describe('When the editor renders', () => {
    it('Then a banner alt text field with a 200 cap and counter sits with the banner', async () => {
      await openEditor();
      expect(screen.getByLabelText(/banner alt text/i)).toHaveAttribute('maxLength', String(CATEGORY_SEO_LIMITS.bannerAlt));
      expect(screen.getByTestId('banner-alt-count')).toHaveTextContent('0/200');
    });

    it('Then the alt placeholder names the category', async () => {
      await openEditor();
      expect(screen.getByLabelText(/banner alt text/i)).toHaveAttribute(
        'placeholder',
        'Describe the banner, e.g. "Summer Shoes collection on display"',
      );
    });
  });

  describe('When the category name is cleared', () => {
    it('Then the alt placeholder falls back to "Category"', async () => {
      await openEditor();
      renameTo('');
      expect(screen.getByLabelText(/banner alt text/i)).toHaveAttribute(
        'placeholder',
        'Describe the banner, e.g. "Category collection on display"',
      );
    });
  });

  describe('When banner alt text is typed and saved', () => {
    it('Then the counter updates and banner_alt is sent', async () => {
      await openEditor();
      type(/banner alt text/i, 'Sandals on a beach towel');
      expect(screen.getByTestId('banner-alt-count')).toHaveTextContent('24/200');
      expect((await savedPayload()).banner_alt).toBe('Sandals on a beach towel');
    });
  });

  describe('When a banner has saved alt text', () => {
    it('Then the preview image uses it as alt', async () => {
      await openEditor({ banner_url: 'https://cdn.example.com/banner.png', banner_alt: 'Sandals on sand' });
      const banner = Array.from(document.querySelectorAll('img')).find(
        i => (i as HTMLImageElement).src === 'https://cdn.example.com/banner.png',
      );
      expect(banner).toHaveAttribute('alt', 'Sandals on sand');
    });
  });

  describe('When the category image zone renders without an alt prop', () => {
    it('Then its preview image defaults to an empty alt', async () => {
      await openEditor({ image_url: 'https://cdn.example.com/tile.png' });
      // The editor's upload-zone preview (not a grid card, which uses the name) carries alt="".
      const zonePreview = Array.from(document.querySelectorAll('img')).filter(
        i => (i as HTMLImageElement).src === 'https://cdn.example.com/tile.png' && !i.classList.contains('absolute'),
      );
      expect(zonePreview).toHaveLength(1);
      expect(zonePreview[0]).toHaveAttribute('alt', '');
    });
  });
});
