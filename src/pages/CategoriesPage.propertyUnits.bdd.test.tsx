import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const mockUseShellBridge = vi.fn();
const mockRecordActivity = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
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
  mediaService: { uploadFile: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/x.png' }) },
}));

const mockCan = vi.fn<(perm: string) => boolean>();
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: (perm: string) => mockCan(perm) }) }));

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
vi.mock('../components/categories/CategoryIconLibrary', () => ({ __esModule: true, default: () => <div /> }));
vi.mock('../components/categories/CategoryChannelsPanel', () => ({ __esModule: true, default: () => <div /> }));
vi.mock('../constants/categoryIcons', () => ({ renderCategoryIcon: () => <span>icon</span>, isPresetUrl: () => false }));
// Flat tree so towers (children) are selectable too.
vi.mock('../utils/categoryTree', () => ({ buildCategoryTree: (cats: any[]) => cats }));

// The new components have their own specs; stub them to observe wiring.
vi.mock('../components/categories/ProjectDetailsSection', () => ({
  __esModule: true,
  default: ({ value, onChange, disabled }: any) => (
    <div data-testid="project-details" data-disabled={String(!!disabled)}>
      <span data-testid="project-details-value">{JSON.stringify(value)}</span>
      <button onClick={() => onChange({ ...value, location: 'Dubai Marina' })}>set-location</button>
    </div>
  ),
}));
vi.mock('../components/categories/GenerateUnitsDialog', () => ({
  __esModule: true,
  default: ({ isOpen, tower, onClose, onGenerated }: any) =>
    isOpen ? (
      <div data-testid="generate-dialog">
        {tower.id}
        <button onClick={() => onGenerated({ created: 4, skipped: 0 })}>fake-generate</button>
        <button onClick={onClose}>fake-close</button>
      </div>
    ) : null,
}));
vi.mock('../components/categories/AvailabilityMatrix', () => ({
  __esModule: true,
  default: ({ categoryId, refreshKey }: any) => (
    <div data-testid="availability-matrix">{`${categoryId}:${refreshKey}`}</div>
  ),
}));

import CategoriesPage from './CategoriesPage';

const project = {
  id: 'p1', name: 'Marina Heights', description: '', parent_id: null, icon_url: null, image_url: null,
  color: null, sort_order: 0, metadata: { developer_partner_id: 'dev-1', handover: '2027-Q4' },
};
const tower = { id: 't1', name: 'Tower A', description: '', parent_id: 'p1', icon_url: null, image_url: null, color: null, sort_order: 0 };

const shellWith = (flagOn: boolean) => ({
  permissionsLoaded: true,
  hasPermission: () => true,
  hasAnyPermission: () => true,
  effectiveFlagsLoaded: true,
  getFeatureState: () => 'enabled',
  ...(flagOn ? { isFeatureEnabled: (k: string) => k === 'submodule:inventory:property_units' } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockRecordActivity.mockResolvedValue(undefined);
  mockGetSettings.mockResolvedValue({ categories: [project, tower] });
  mockUpdateCategory.mockResolvedValue({});
});

describe('Given the property_units flag is off', () => {
  beforeEach(() => mockUseShellBridge.mockReturnValue(shellWith(false)));

  describe('When the page renders and a root category is selected', () => {
    it('Then the classic vocabulary and no real-estate panel show', async () => {
      render(<CategoriesPage />);
      expect(await screen.findByText('Product Categories')).toBeTruthy();
      expect(screen.getByText('New Category')).toBeTruthy();
      fireEvent.click(screen.getByTestId('select-p1'));
      expect(await screen.findByText('Edit Category')).toBeTruthy();
      expect(screen.queryByTestId('property-units-panel')).toBeNull();
      expect(screen.queryByTestId('project-details')).toBeNull();
    });
  });

  describe('When the user saves', () => {
    it('Then metadata is not sent', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      fireEvent.click(await screen.findByRole('button', { name: /Save/ }));
      await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
      expect(mockUpdateCategory.mock.calls[0][1]).not.toHaveProperty('metadata');
    });
  });
});

describe('Given the property_units flag is on', () => {
  beforeEach(() => mockUseShellBridge.mockReturnValue(shellWith(true)));

  describe('When the page renders', () => {
    it('Then it speaks Projects', async () => {
      render(<CategoriesPage />);
      expect(await screen.findByRole('heading', { level: 1 })).toHaveProperty('textContent', expect.stringContaining('Projects'));
      expect(screen.getByText('New Project')).toBeTruthy();
    });
  });

  describe('When a project (root) is selected', () => {
    it('Then project details show, seeded from metadata, without Generate units', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      expect(await screen.findByText('Edit Project')).toBeTruthy();
      expect(screen.getByTestId('project-details-value').textContent).toContain('dev-1');
      expect(screen.queryByRole('button', { name: /Generate units/ })).toBeNull();
    });

    it('Then Save sends merged metadata', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      fireEvent.click(await screen.findByText('set-location'));
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
      await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
      const [id, body] = mockUpdateCategory.mock.calls[0];
      expect(id).toBe('p1');
      expect(body.metadata).toEqual({ developer_partner_id: 'dev-1', handover: '2027-Q4', location: 'Dubai Marina' });
    });

    it('Then Availability toggles the matrix inline for the project', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      fireEvent.click(await screen.findByRole('button', { name: /Availability/ }));
      expect(screen.getByTestId('availability-matrix').textContent).toBe('p1:0');
      fireEvent.click(screen.getByRole('button', { name: /Hide availability/ }));
      expect(screen.queryByTestId('availability-matrix')).toBeNull();
    });
  });

  describe('When a tower (child) is selected', () => {
    it('Then it reads Edit Tower and shows no project details', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      expect(await screen.findByText('Edit Tower')).toBeTruthy();
      expect(screen.queryByTestId('project-details')).toBeNull();
    });

    it('Then Generate units opens the dialog for that tower', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      expect(screen.queryByTestId('generate-dialog')).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: /Generate units/ }));
      expect(screen.getByTestId('generate-dialog').textContent).toContain('t1');
      fireEvent.click(screen.getByText('fake-close'));
      expect(screen.queryByTestId('generate-dialog')).toBeNull();
    });

    it('Then a successful generation refreshes the open matrix and logs activity', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      fireEvent.click(await screen.findByRole('button', { name: /Availability/ }));
      expect(screen.getByTestId('availability-matrix').textContent).toBe('t1:0');
      fireEvent.click(screen.getByRole('button', { name: /Generate units/ }));
      fireEvent.click(screen.getByText('fake-generate'));
      expect(screen.getByTestId('availability-matrix').textContent).toBe('t1:1');
      expect(mockRecordActivity).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'inventory.category.units_generated', resourceId: 't1' }),
      );
    });

    it('Then Save does not send metadata for a tower', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      fireEvent.click(await screen.findByRole('button', { name: /^Save$/ }));
      await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
      expect(mockUpdateCategory.mock.calls[0][1]).not.toHaveProperty('metadata');
    });
  });
});

describe('CategoriesPage property units edge branches', () => {
  beforeEach(() => mockUseShellBridge.mockReturnValue(shellWith(true)));

  describe('Given the flag is on and nothing is selected', () => {
    it('Then the empty state speaks of a project', async () => {
      render(<CategoriesPage />);
      expect(await screen.findByText(/Select a project from the tree/)).toBeTruthy();
    });
  });

  describe('Given a project with no metadata', () => {
    it('Then details are seeded empty and Save sends an empty metadata object', async () => {
      const bare = { ...project, id: 'p2', name: 'Bare Project', metadata: undefined };
      mockGetSettings.mockResolvedValue({ categories: [bare] });
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p2'));
      expect((await screen.findByTestId('project-details-value')).textContent).toBe('{}');
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
      await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
      expect(mockUpdateCategory.mock.calls[0][1].metadata).toEqual({});
    });
  });

  describe('Given the user may manage categories', () => {
    it('Then project details are editable', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      expect((await screen.findByTestId('project-details')).getAttribute('data-disabled')).toBe('false');
    });
  });

  describe('Given the user may not update categories', () => {
    it('Then project details are read-only', async () => {
      mockCan.mockReturnValue(false);
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      expect((await screen.findByTestId('project-details')).getAttribute('data-disabled')).toBe('true');
      expect(mockCan).toHaveBeenCalledWith('items.update');
    });
  });

  describe('Given the user lacks items.create', () => {
    it('Then a tower shows Availability but no Generate units', async () => {
      mockUseShellBridge.mockReturnValue({
        ...shellWith(true),
        hasPermission: (perm: string) => perm !== 'items.create',
      });
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      expect(await screen.findByRole('button', { name: /Availability/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Generate units/ })).toBeNull();
    });
  });

  describe('Given the create action flag is not enabled', () => {
    it('Then Generate units is hidden', async () => {
      mockUseShellBridge.mockReturnValue({ ...shellWith(true), getFeatureState: () => 'disabled' });
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      expect(await screen.findByText('Edit Tower')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Generate units/ })).toBeNull();
    });
  });

  describe('Given logging the generation fails', () => {
    it('Then the failure is swallowed and the matrix still refreshes', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      fireEvent.click(await screen.findByRole('button', { name: /Availability/ }));
      fireEvent.click(screen.getByRole('button', { name: /Generate units/ }));
      mockRecordActivity.mockRejectedValueOnce(new Error('activity down'));
      fireEvent.click(screen.getByText('fake-generate'));
      expect(screen.getByTestId('availability-matrix').textContent).toBe('t1:1');
      await waitFor(() => expect(mockRecordActivity).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Generated 4 units in "Tower A"' }),
      ));
    });
  });

  describe('Given availability is open for one category', () => {
    it('Then selecting another category closes it and the dialog', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      fireEvent.click(await screen.findByRole('button', { name: /Availability/ }));
      fireEvent.click(screen.getByRole('button', { name: /Generate units/ }));
      expect(screen.getByTestId('availability-matrix')).toBeTruthy();
      fireEvent.click(screen.getByTestId('select-p1'));
      expect(await screen.findByText('Edit Project')).toBeTruthy();
      expect(screen.queryByTestId('availability-matrix')).toBeNull();
      expect(screen.queryByTestId('generate-dialog')).toBeNull();
      expect(screen.getByRole('button', { name: /Availability/ }).getAttribute('aria-pressed')).toBe('false');
    });
  });
});
