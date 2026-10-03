import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({ listOptionGroups: vi.fn(), updateOptionGroup: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ inventoryService: svc }));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
}));

import ItemOptionsTab from './ItemOptionsTab';

const g = (id: string, name: string, item_ids: string[], category_ids: string[] = []) => ({
  id, name, selection: 'single', is_required: false, min_select: 0, max_select: 1,
  applies_to: { item_ids, category_ids }, sort_order: 0, is_active: true,
  options: [{ name: 'A', price_delta: 0, price_mode: 'fixed', is_default: false, sort_order: 0, is_active: true }],
});

beforeEach(() => {
  svc.listOptionGroups.mockReset();
  svc.updateOptionGroup.mockReset();
  svc.listOptionGroups.mockResolvedValue([
    g('direct', 'Cut', ['i1', 'i2']),
    g('only', 'Glaze', ['i1']),
    g('viaCat', 'Pack', [], ['c1']),
    g('every', 'Gift wrap', []),
    g('other', 'Size', ['i9']),
  ]);
});

const renderTab = (canEdit = true) => render(<ItemOptionsTab itemId="i1" categoryId="c1" canEdit={canEdit} />);

describe('Item detail › Options tab', () => {
  describe('Given groups with different scopes', () => {
    it('When the tab loads Then applying groups are labelled by how they reach the item', async () => {
      renderTab();
      expect(within(await screen.findByTestId('applied-group-direct')).getByText('Attached to this item')).toBeTruthy();
      expect(within(screen.getByTestId('applied-group-viaCat')).getByText('Via category')).toBeTruthy();
      expect(within(screen.getByTestId('applied-group-every')).getByText('All items')).toBeTruthy();
      expect(screen.getByTestId('available-group-other')).toBeTruthy();
      expect(screen.getByText('Manage option groups').getAttribute('href')).toBe('/inventory/settings?tab=options');
    });

    it('When the item is the last one in a group Then Detach is disabled (it would widen to every item)', async () => {
      renderTab();
      expect((await screen.findByLabelText('Detach Glaze') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByLabelText('Detach Cut') as HTMLButtonElement).disabled).toBe(false);
      expect(screen.queryByLabelText('Detach Pack')).toBeNull();
    });
  });

  describe('Given a manager attaches a group', () => {
    it('When Attach is clicked Then only applies_to is PATCHed and the group moves to applied', async () => {
      svc.updateOptionGroup.mockResolvedValue({});
      renderTab();
      fireEvent.click(await screen.findByLabelText('Attach Size'));
      await waitFor(() => expect(svc.updateOptionGroup).toHaveBeenCalledWith('other', { applies_to: { item_ids: ['i9', 'i1'], category_ids: [] } }));
      expect(await screen.findByTestId('applied-group-other')).toBeTruthy();
    });
  });

  describe('Given a manager detaches a group', () => {
    it('When Detach is clicked Then the item is removed from applies_to and the group becomes available', async () => {
      svc.updateOptionGroup.mockResolvedValue({});
      renderTab();
      fireEvent.click(await screen.findByLabelText('Detach Cut'));
      await waitFor(() => expect(svc.updateOptionGroup).toHaveBeenCalledWith('direct', { applies_to: { item_ids: ['i2'], category_ids: [] } }));
      expect(await screen.findByTestId('available-group-direct')).toBeTruthy();
    });

    it('When the save fails Then the group stays attached', async () => {
      svc.updateOptionGroup.mockRejectedValue(new Error('nope'));
      renderTab();
      fireEvent.click(await screen.findByLabelText('Detach Cut'));
      await waitFor(() => expect(svc.updateOptionGroup).toHaveBeenCalled());
      expect(screen.getByTestId('applied-group-direct')).toBeTruthy();
    });
  });

  describe('Given a read-only user', () => {
    it('When the tab loads Then attach/detach controls are hidden', async () => {
      renderTab(false);
      await screen.findByTestId('applied-group-direct');
      expect(screen.queryByLabelText('Detach Cut')).toBeNull();
      expect(screen.queryByTestId('available-group-other')).toBeNull();
    });
  });
});
