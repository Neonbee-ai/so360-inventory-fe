import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>() }));
const route = vi.hoisted(() => ({ params: new URLSearchParams(), setParams: vi.fn() }));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ isFeatureEnabled: (k: string) => flags.on.has(k) }),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [route.params, route.setParams],
}));
vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getSettings: vi.fn().mockResolvedValue({ uoms: [], categories: [{ id: 'c1', name: 'Fresh' }] }),
    getOrgDefaultLogic: vi.fn().mockResolvedValue({ allow_negative_stock: false, auto_approve_transfers: false }),
  },
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock('../components/categories/CategoryTreeView', () => ({ default: () => <div /> }));
vi.mock('../components/settings/ItemAttributeSettingsSection', () => ({ default: () => <div /> }));
vi.mock('../components/settings/ItemOptionsSettingsSection', () => ({
  default: (p: any) => (
    <div data-testid="options-section">
      {p.categories.map((c: any) => c.name).join(',')}|capture:{String(p.captureFieldsEnabled)}|edit:{String(p.canEdit)}
    </div>
  ),
}));

import SettingsPage from './SettingsPage';

beforeEach(() => {
  flags.on = new Set();
  route.params = new URLSearchParams();
  route.setParams.mockReset();
});

describe('Inventory Settings › Options tab gating', () => {
  describe('Given submodule:dailystore:item_options is off', () => {
    it('When ?tab=options is opened Then no tab bar shows and the general settings render', async () => {
      route.params = new URLSearchParams('tab=options');
      render(<SettingsPage />);
      expect(await screen.findByText(/Units of Measure/)).toBeTruthy();
      expect(screen.queryByRole('tab', { name: 'Options & capture fields' })).toBeNull();
      expect(screen.queryByTestId('options-section')).toBeNull();
    });
  });

  describe('Given the flag is on', () => {
    beforeEach(() => { flags.on.add('submodule:dailystore:item_options'); });

    it('When ?tab=options is opened Then the options section replaces the general settings', async () => {
      route.params = new URLSearchParams('tab=options');
      render(<SettingsPage />);
      const section = await screen.findByTestId('options-section');
      expect(section.textContent).toBe('Fresh|capture:false|edit:true');
      expect(screen.queryByText(/Units of Measure/)).toBeNull();
      expect(screen.getByRole('tab', { name: 'Options & capture fields' }).getAttribute('aria-selected')).toBe('true');
    });

    it('When the capture flag is also on Then the section is told so', async () => {
      flags.on.add('action:dailystore:pos:captured_measurements');
      route.params = new URLSearchParams('tab=options');
      render(<SettingsPage />);
      expect((await screen.findByTestId('options-section')).textContent).toContain('capture:true');
    });

    it('When the Options tab is clicked Then ?tab=options is set (replace)', async () => {
      render(<SettingsPage />);
      fireEvent.click(await screen.findByRole('tab', { name: 'Options & capture fields' }));
      const [next, opts] = route.setParams.mock.calls[0];
      expect(next.get('tab')).toBe('options');
      expect(opts).toEqual({ replace: true });
    });
  });
});
