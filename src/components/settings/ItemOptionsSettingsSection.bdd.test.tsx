import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({
  listOptionGroups: vi.fn(),
  createOptionGroup: vi.fn(),
  updateOptionGroup: vi.fn(),
  deleteOptionGroup: vi.fn(),
  listMeasurementDefs: vi.fn(),
  createMeasurementDef: vi.fn(),
  updateMeasurementDef: vi.fn(),
  deleteMeasurementDef: vi.fn(),
  getItems: vi.fn(),
}));
vi.mock('../../services/inventoryService', () => ({ inventoryService: svc }));

import ItemOptionsSettingsSection from './ItemOptionsSettingsSection';

const cats = [{ id: 'c1', name: 'Fresh' }];
const existing = {
  id: 'g1', name: 'Cut', selection: 'single', is_required: true, min_select: 1, max_select: 1,
  applies_to: { item_ids: [], category_ids: ['c1'] }, sort_order: 0, is_active: true,
  options: [{ id: 'o1', name: 'Whole', price_delta: 0, price_mode: 'fixed', is_default: true, sort_order: 0, is_active: true }],
};

const renderSection = (props: Partial<React.ComponentProps<typeof ItemOptionsSettingsSection>> = {}) =>
  render(<ItemOptionsSettingsSection categories={cats} captureFieldsEnabled={false} canEdit {...props} />);

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  svc.listOptionGroups.mockResolvedValue([existing]);
  svc.listMeasurementDefs.mockResolvedValue([{ id: 'm1', key: 'weight', label: 'Weight', unit: 'kg', applies_to: { item_ids: [], category_ids: [] }, is_billing_basis: true, sort_order: 0 }]);
  svc.getItems.mockResolvedValue([]);
});

describe('Settings › Options & capture fields', () => {
  describe('Given existing option groups', () => {
    it('When the tab loads Then each group shows picks, scope and values', async () => {
      renderSection();
      const row = await screen.findByTestId('option-group-g1');
      expect(within(row).getByText('Cut')).toBeTruthy();
      expect(within(row).getByText('pick 1 · required')).toBeTruthy();
      expect(within(row).getByText('Fresh')).toBeTruthy();
      expect(within(row).getByText('Whole')).toBeTruthy();
    });

    it('When capture fields are off Then neither the sub-tabs nor the measurement list are requested', async () => {
      renderSection();
      await screen.findByTestId('option-group-g1');
      expect(screen.queryByRole('tab', { name: 'Capture fields' })).toBeNull();
      expect(svc.listMeasurementDefs).not.toHaveBeenCalled();
    });

    it('When the user cannot edit Then no create/edit/delete controls are offered', async () => {
      renderSection({ canEdit: false });
      await screen.findByTestId('option-group-g1');
      expect(screen.queryByText('+ New group')).toBeNull();
      expect(screen.queryByLabelText('Delete Cut')).toBeNull();
    });
  });

  describe('Given a new single-pick group', () => {
    it('When saved Then the normalised body is POSTed and the row appears', async () => {
      svc.createOptionGroup.mockResolvedValue({ id: 'g2' });
      renderSection();
      await screen.findByTestId('option-group-g1');
      fireEvent.click(screen.getByText('+ New group'));
      fireEvent.change(screen.getByLabelText('Group name'), { target: { value: ' Size ' } });
      fireEvent.click(screen.getByLabelText('Required'));
      fireEvent.change(screen.getByLabelText('Value 1 name'), { target: { value: 'Small' } });
      fireEvent.click(screen.getByText('+ value'));
      fireEvent.change(screen.getByLabelText('Value 2 name'), { target: { value: 'Large' } });
      fireEvent.change(screen.getByLabelText('Value 2 price add'), { target: { value: '1.5' } });
      fireEvent.click(screen.getByLabelText('Value 2 per unit'));
      fireEvent.click(screen.getByLabelText('Value 1 default'));
      fireEvent.click(screen.getByLabelText('Value 2 default'));
      fireEvent.click(screen.getByRole('button', { name: 'Fresh' }));
      fireEvent.click(screen.getByText('Save group'));

      await waitFor(() => expect(svc.createOptionGroup).toHaveBeenCalledTimes(1));
      const body = svc.createOptionGroup.mock.calls[0][0];
      expect(body).toMatchObject({ name: 'Size', selection: 'single', is_required: true, min_select: 1, max_select: 1, applies_to: { item_ids: [], category_ids: ['c1'] } });
      expect(body.options).toEqual([
        { name: 'Small', price_delta: 0, price_mode: 'fixed', is_default: false, sort_order: 0, is_active: true },
        { name: 'Large', price_delta: 1.5, price_mode: 'per_unit', is_default: true, sort_order: 1, is_active: true },
      ]);
      expect(await screen.findByTestId('option-group-g2')).toBeTruthy();
    });

    it('When the name is missing Then an alert is shown and nothing is sent', async () => {
      renderSection();
      await screen.findByTestId('option-group-g1');
      fireEvent.click(screen.getByText('+ New group'));
      fireEvent.click(screen.getByText('Save group'));
      expect((await screen.findByRole('alert')).textContent).toBe('Group name is required.');
      expect(svc.createOptionGroup).not.toHaveBeenCalled();
    });
  });

  describe('Given an existing group', () => {
    it('When edited and saved Then it PATCHes by id without sending the id in the body', async () => {
      svc.updateOptionGroup.mockResolvedValue({});
      renderSection();
      fireEvent.click(await screen.findByLabelText('Edit Cut'));
      fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Cut style' } });
      fireEvent.click(screen.getByText('Save group'));
      await waitFor(() => expect(svc.updateOptionGroup).toHaveBeenCalledTimes(1));
      const [id, patch] = svc.updateOptionGroup.mock.calls[0];
      expect(id).toBe('g1');
      expect(patch.id).toBeUndefined();
      expect(patch.name).toBe('Cut style');
    });

    it('When deleted Then the row is removed', async () => {
      svc.deleteOptionGroup.mockResolvedValue(undefined);
      renderSection();
      fireEvent.click(await screen.findByLabelText('Delete Cut'));
      await waitFor(() => expect(screen.queryByTestId('option-group-g1')).toBeNull());
      expect(svc.deleteOptionGroup).toHaveBeenCalledWith('g1');
    });
  });

  describe('Given capture fields are enabled', () => {
    it('When the Capture fields tab is opened Then fields list with their billing basis', async () => {
      renderSection({ captureFieldsEnabled: true });
      fireEvent.click(await screen.findByRole('tab', { name: 'Capture fields' }));
      const row = await screen.findByTestId('capture-field-m1');
      expect(within(row).getByText('Weight')).toBeTruthy();
      expect(within(row).getByText('Yes')).toBeTruthy();
    });

    it('When a new field is saved Then the key is derived from the label', async () => {
      svc.createMeasurementDef.mockResolvedValue({ id: 'm2' });
      renderSection({ captureFieldsEnabled: true });
      fireEvent.click(await screen.findByRole('tab', { name: 'Capture fields' }));
      fireEvent.click(screen.getByText('+ New field'));
      fireEvent.change(screen.getByLabelText('Field label'), { target: { value: 'Gross length' } });
      fireEvent.change(screen.getByLabelText('Field unit'), { target: { value: 'm' } });
      fireEvent.click(screen.getByLabelText('Drives price'));
      fireEvent.click(screen.getByText('Save field'));
      await waitFor(() => expect(svc.createMeasurementDef).toHaveBeenCalledTimes(1));
      expect(svc.createMeasurementDef.mock.calls[0][0]).toMatchObject({ key: 'gross_length', label: 'Gross length', unit: 'm', is_billing_basis: true });
    });
  });

  describe('Given the service is unreachable', () => {
    it('When loading fails Then the error is shown', async () => {
      svc.listOptionGroups.mockRejectedValue(new Error('Request failed (403)'));
      renderSection();
      expect((await screen.findByRole('alert')).textContent).toBe('Request failed (403)');
    });
  });
});
