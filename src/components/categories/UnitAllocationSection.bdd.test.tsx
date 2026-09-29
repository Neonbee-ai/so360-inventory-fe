/**
 * UnitAllocationSection — a unit's own agents/teams (item custom_attributes) with tower/project inheritance.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('../../services/mediaService', () => ({ mediaService: {} }));
vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getUnitAllocation: (...a: any[]) => mockGet(...a),
    setUnitAllocation: (...a: any[]) => mockSet(...a),
  },
}));

import { UnitAllocationSection } from './UnitAllocationSection';
import type { ItemCategory } from '../../types/inventory';

const categories: ItemCategory[] = [
  { id: 'p', name: 'Marina Heights', metadata: { assigned_team_ids: ['t1'] } },
  { id: 'tw', name: 'Tower A', parent_id: 'p', metadata: { assigned_user_ids: ['u1'] } },
];

beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
});

const typeUsers = (v: string) => {
  const input = screen.getByLabelText('Assigned user IDs');
  fireEvent.change(input, { target: { value: v } });
  fireEvent.blur(input);
};

describe('Given a unit with no own agents', () => {
  describe('When the section loads', () => {
    it('Then it shows loading, then the inherited tower and project lists', async () => {
      mockGet.mockResolvedValue({ assigned_user_ids: null, assigned_team_ids: null });
      render(<UnitAllocationSection itemId="i1" towerId="tw" categories={categories} canManage />);
      expect(screen.getByTestId('unit-allocation-loading')).toBeTruthy();
      await screen.findByTestId('unit-allocation');
      expect(mockGet).toHaveBeenCalledWith('i1');
      expect(screen.getByTestId('inherited-users').textContent).toBe('Inherited from Tower A (1)');
      expect(screen.getByTestId('inherited-teams').textContent).toBe('Inherited from Marina Heights (1)');
      expect((screen.getByRole('button', { name: 'Save agents' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('When a manager sets users and saves', () => {
    it('Then the override is saved and Save disables again', async () => {
      mockGet.mockResolvedValue({ assigned_user_ids: null, assigned_team_ids: null });
      mockSet.mockResolvedValue(undefined);
      render(<UnitAllocationSection itemId="i1" towerId="tw" categories={categories} canManage />);
      await screen.findByTestId('unit-allocation');
      typeUsers('u5');
      const save = screen.getByRole('button', { name: 'Save agents' }) as HTMLButtonElement;
      expect(save.disabled).toBe(false);
      fireEvent.click(save);
      await waitFor(() => expect(mockSet).toHaveBeenCalledWith('i1', { assigned_user_ids: ['u5'], assigned_team_ids: null }));
      await waitFor(() => expect((screen.getByRole('button', { name: 'Save agents' }) as HTMLButtonElement).disabled).toBe(true));
    });
  });

  describe('When the save is in flight and then fails', () => {
    it('Then Saving… shows, then the error', async () => {
      mockGet.mockResolvedValue({ assigned_user_ids: null, assigned_team_ids: null });
      let fail!: (e: unknown) => void;
      mockSet.mockReturnValueOnce(new Promise((_, rej) => { fail = rej; }));
      render(<UnitAllocationSection itemId="i1" towerId="tw" categories={categories} canManage />);
      await screen.findByTestId('unit-allocation');
      typeUsers('u5');
      fireEvent.click(screen.getByRole('button', { name: 'Save agents' }));
      expect(await screen.findByText('Saving…')).toBeTruthy();
      fail(new Error('Request failed (500)'));
      expect(await screen.findByText('Request failed (500)')).toBeTruthy();
    });

    it('Then a failure without a message shows a generic error', async () => {
      mockGet.mockResolvedValue({ assigned_user_ids: null, assigned_team_ids: null });
      mockSet.mockRejectedValueOnce({});
      render(<UnitAllocationSection itemId="i1" towerId="tw" categories={categories} canManage />);
      await screen.findByTestId('unit-allocation');
      typeUsers('u5');
      fireEvent.click(screen.getByRole('button', { name: 'Save agents' }));
      expect(await screen.findByText('Failed to save agents')).toBeTruthy();
    });
  });
});

describe('Given a unit with its own teams', () => {
  it('Then editing teams back to the saved value is not dirty', async () => {
    mockGet.mockResolvedValue({ assigned_user_ids: null, assigned_team_ids: ['t7'] });
    render(<UnitAllocationSection itemId="i1" towerId="tw" categories={categories} canManage />);
    await screen.findByTestId('unit-allocation');
    expect(screen.queryByTestId('inherited-teams')).toBeNull();
    const teams = screen.getByLabelText('Assigned team IDs');
    fireEvent.change(teams, { target: { value: 't8' } });
    fireEvent.blur(teams);
    expect((screen.getByRole('button', { name: 'Save agents' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(teams, { target: { value: 't7' } });
    fireEvent.blur(teams);
    expect((screen.getByRole('button', { name: 'Save agents' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Given a viewer without manage rights', () => {
  it('Then the lists are read-only and there is no Save', async () => {
    mockGet.mockResolvedValue({ assigned_user_ids: ['u1'], assigned_team_ids: null });
    render(<UnitAllocationSection itemId="i1" towerId={null} categories={categories} canManage={false} />);
    await screen.findByTestId('unit-allocation');
    expect((screen.getByLabelText('Assigned user IDs') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save agents' })).toBeNull();
    expect(screen.getByTestId('inherited-teams').textContent).toBe('Not assigned');
  });
});

describe('Given loading fails', () => {
  it('When it rejects with a message Then that message shows', async () => {
    mockGet.mockRejectedValue(new Error('Request failed (404)'));
    render(<UnitAllocationSection itemId="i1" towerId="tw" categories={categories} canManage />);
    expect(await screen.findByText('Request failed (404)')).toBeTruthy();
  });
  it('When it rejects without a message Then a generic error shows', async () => {
    mockGet.mockRejectedValue({});
    render(<UnitAllocationSection itemId="i1" towerId="tw" categories={categories} canManage />);
    expect(await screen.findByText('Could not load agents')).toBeTruthy();
  });
});

describe('Given the unit changes or unmounts mid-load', () => {
  it('Then a late result or failure is ignored', async () => {
    let resolveFirst!: (v: unknown) => void;
    let rejectSecond!: (e: unknown) => void;
    mockGet
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
      .mockReturnValueOnce(new Promise((_, rej) => { rejectSecond = rej; }))
      .mockResolvedValueOnce({ assigned_user_ids: ['u3'], assigned_team_ids: null });
    const { rerender, unmount } = render(<UnitAllocationSection itemId="i1" towerId="tw" categories={categories} canManage />);
    rerender(<UnitAllocationSection itemId="i2" towerId="tw" categories={categories} canManage />);
    resolveFirst({ assigned_user_ids: ['u-late'], assigned_team_ids: null });
    rerender(<UnitAllocationSection itemId="i3" towerId="tw" categories={categories} canManage />);
    rejectSecond(new Error('late'));
    await screen.findByTestId('unit-allocation');
    expect((screen.getByLabelText('Assigned user IDs') as HTMLInputElement).value).toBe('u3');
    expect(screen.queryByText('late')).toBeNull();
    unmount();
  });
});
