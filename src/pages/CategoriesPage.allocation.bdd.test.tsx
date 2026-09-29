/**
 * CategoriesPage — tower agent override (action:crm:unit_allocation), project
 * payment-plan save guard and developer edit wiring (G1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const mockUseShellBridge = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: () => Promise.resolve() }),
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
vi.mock('../services/mediaService', () => ({ mediaService: { uploadFile: vi.fn() } }));

const mockCan = vi.fn<(perm: string) => boolean>();
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: (perm: string) => mockCan(perm) }) }));

vi.mock('../components/categories/CategoryTreeView', () => ({
  __esModule: true,
  default: ({ tree, onSelect }: any) => (
    <div>
      {tree.map((node: any) => (
        <button key={node.id} data-testid={`select-${node.id}`} onClick={() => onSelect(node.id)}>{node.name}</button>
      ))}
    </div>
  ),
}));
vi.mock('../components/categories/CategoryIconLibrary', () => ({ __esModule: true, default: () => <div /> }));
vi.mock('../components/categories/CategoryChannelsPanel', () => ({ __esModule: true, default: () => <div /> }));
vi.mock('../constants/categoryIcons', () => ({ renderCategoryIcon: () => <span>icon</span>, isPresetUrl: () => false }));
vi.mock('../utils/categoryTree', () => ({ buildCategoryTree: (cats: any[]) => cats }));

const badPlan = [{ id: 'x', name: 'Bad', is_default: true, billing_mode: null, allowed_modes: null,
  lines: [{ label: 'Down', type: 'percent', value: 40, trigger: 'booking', offset: null, date: null, milestone: null }] }];
const goodPlan = [{ id: 'y', name: ' 60/40 ', is_default: true, billing_mode: null, allowed_modes: null,
  lines: [
    { label: ' Down ', type: 'percent', value: 60, trigger: 'booking', offset: null, date: null, milestone: null },
    { label: 'Slab', type: 'percent', value: 40, trigger: 'milestone', offset: null, date: null, milestone: ' Roof ' },
  ] }];

vi.mock('../components/categories/ProjectDetailsSection', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <div data-testid="project-details">
      <button onClick={() => onChange({ ...value, payment_plan_templates: badPlan })}>set-bad-plan</button>
      <button onClick={() => onChange({ ...value, payment_plan_templates: goodPlan })}>set-good-plan</button>
    </div>
  ),
}));
vi.mock('../components/categories/GenerateUnitsDialog', () => ({ __esModule: true, default: () => null }));
vi.mock('../components/categories/AvailabilityMatrix', () => ({
  __esModule: true,
  default: ({ allocationEnabled, categories }: any) => (
    <div data-testid="availability-matrix">{`${String(allocationEnabled)}:${categories.length}`}</div>
  ),
}));
vi.mock('../components/categories/DeveloperCard', () => ({
  __esModule: true,
  default: ({ canEdit }: any) => <div data-testid="developer-card-stub" data-can-edit={String(canEdit)} />,
}));
vi.mock('../components/categories/AssignedAgentsPanel', () => ({
  __esModule: true,
  default: ({ scope, value, inherited, disabled, onChange }: any) => (
    <div data-testid="agents-panel" data-scope={scope} data-disabled={String(!!disabled)}>
      <span data-testid="agents-value">{JSON.stringify(value)}</span>
      <span data-testid="agents-inherited">{JSON.stringify(inherited)}</span>
      <button onClick={() => onChange({ assigned_user_ids: ['u9'], assigned_team_ids: null })}>set-agents</button>
    </div>
  ),
}));

import CategoriesPage from './CategoriesPage';

const project = {
  id: 'p1', name: 'Marina Heights', description: '', parent_id: null, icon_url: null, image_url: null,
  color: null, sort_order: 0,
  metadata: { developer_partner_id: 'dev-1', assigned_user_ids: ['u1'], assigned_team_ids: ['team-1'] },
};
const tower = {
  id: 't1', name: 'Tower A', description: '', parent_id: 'p1', icon_url: null, image_url: null, color: null,
  sort_order: 0, metadata: { note: 'keep', assigned_team_ids: ['team-2'] },
};

const shellWith = (flags: string[]) => ({
  permissionsLoaded: true,
  hasPermission: () => true,
  hasAnyPermission: () => true,
  effectiveFlagsLoaded: true,
  getFeatureState: () => 'enabled',
  isFeatureEnabled: (k: string) => flags.includes(k),
});
const PROPERTY = 'submodule:inventory:property_units';
const ALLOC = 'action:crm:unit_allocation';

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockGetSettings.mockResolvedValue({ categories: [project, tower] });
  mockUpdateCategory.mockResolvedValue({});
  mockUseShellBridge.mockReturnValue(shellWith([PROPERTY, ALLOC]));
});

const saveBody = async () => {
  fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
  await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalled());
  return mockUpdateCategory.mock.calls[0][1];
};

describe('Given real-estate mode with unit allocation on', () => {
  describe('When a tower is selected', () => {
    it('Then the agents panel shows its own override and what it inherits from the project', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      const panel = await screen.findByTestId('agents-panel');
      expect(panel.getAttribute('data-scope')).toBe('tower');
      expect(panel.getAttribute('data-disabled')).toBe('false');
      expect(JSON.parse(screen.getByTestId('agents-value').textContent!)).toEqual({ assigned_user_ids: null, assigned_team_ids: ['team-2'] });
      expect(JSON.parse(screen.getByTestId('agents-inherited').textContent!)).toEqual({
        users: { ids: ['u1'], from: 'Marina Heights' },
        teams: { ids: ['team-1'], from: 'Marina Heights' },
      });
    });

    it('Then Save sends the tower metadata with only the override changed', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      fireEvent.click(await screen.findByText('set-agents'));
      const body = await saveBody();
      expect(body.metadata).toEqual({ note: 'keep', assigned_user_ids: ['u9'], assigned_team_ids: null });
    });

    it('Then a tower with no metadata saves both lists as null', async () => {
      mockGetSettings.mockResolvedValue({ categories: [project, { ...tower, metadata: undefined }] });
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      await screen.findByTestId('agents-panel');
      const body = await saveBody();
      expect(body.metadata).toEqual({ assigned_user_ids: null, assigned_team_ids: null });
    });

    it('Then a read-only user sees the panel disabled', async () => {
      mockCan.mockReturnValue(false);
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      expect((await screen.findByTestId('agents-panel')).getAttribute('data-disabled')).toBe('true');
    });

    it('Then the availability matrix gets the flag and the category list', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-t1'));
      fireEvent.click(await screen.findByRole('button', { name: /Availability/ }));
      expect(screen.getByTestId('availability-matrix').textContent).toBe('true:2');
    });
  });

  describe('When a project is selected', () => {
    it('Then no tower agents panel shows and the developer card may edit', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      expect((await screen.findByTestId('developer-card-stub')).getAttribute('data-can-edit')).toBe('true');
      expect(screen.queryByTestId('agents-panel')).toBeNull();
    });
  });
});

describe('Given real-estate mode with unit allocation off', () => {
  beforeEach(() => mockUseShellBridge.mockReturnValue(shellWith([PROPERTY])));

  it('When a tower is selected Then no agents panel shows, Save sends no metadata and the matrix is told the flag is off', async () => {
    render(<CategoriesPage />);
    fireEvent.click(await screen.findByTestId('select-t1'));
    expect(await screen.findByText('Edit Tower')).toBeTruthy();
    expect(screen.queryByTestId('agents-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Availability/ }));
    expect(screen.getByTestId('availability-matrix').textContent).toBe('false:2');
    const body = await saveBody();
    expect(body).not.toHaveProperty('metadata');
  });

  it('When the user cannot update Then the developer card is read-only', async () => {
    mockCan.mockReturnValue(false);
    render(<CategoriesPage />);
    fireEvent.click(await screen.findByTestId('select-p1'));
    expect((await screen.findByTestId('developer-card-stub')).getAttribute('data-can-edit')).toBe('false');
  });
});

describe('Given a project with payment plans', () => {
  describe('When a plan does not add up to 100%', () => {
    it('Then Save is blocked with the plan error and nothing is sent', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      fireEvent.click(await screen.findByText('set-bad-plan'));
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
      expect(await screen.findByText('Payment plan "Bad": Percentages add up to 40% — they must total 100%')).toBeTruthy();
      expect(mockUpdateCategory).not.toHaveBeenCalled();
    });
  });

  describe('When the plans are valid', () => {
    it('Then Save sends them trimmed inside the project metadata', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      fireEvent.click(await screen.findByText('set-good-plan'));
      const body = await saveBody();
      expect(body.metadata.developer_partner_id).toBe('dev-1');
      expect(body.metadata.payment_plan_templates[0].name).toBe('60/40');
      expect(body.metadata.payment_plan_templates[0].lines.map((l: any) => [l.label, l.milestone])).toEqual([['Down', null], ['Slab', 'Roof']]);
    });
  });

  describe('When the project has no plans key', () => {
    it('Then Save does not add one', async () => {
      render(<CategoriesPage />);
      fireEvent.click(await screen.findByTestId('select-p1'));
      await screen.findByTestId('project-details');
      const body = await saveBody();
      expect(body.metadata).not.toHaveProperty('payment_plan_templates');
    });
  });
});
