/**
 * AssignedAgentsPanel — tower/unit agents/teams override with "Inherited from" hints.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/mediaService', () => ({ mediaService: {} }));
vi.mock('../../services/inventoryService', () => ({ inventoryService: {} }));

import { AssignedAgentsPanel } from './AssignedAgentsPanel';

const inherited = { users: { ids: ['u1', 'u2'], from: 'Marina Heights' }, teams: null };

describe('Given a tower with no own agents', () => {
  it('Then the hints name the parent it inherits from, or say not assigned', () => {
    render(<AssignedAgentsPanel value={{ assigned_user_ids: null, assigned_team_ids: null }} onChange={vi.fn()} inherited={inherited} scope="tower" />);
    expect(screen.getByRole('region', { name: 'Assigned agents' })).toBeTruthy();
    expect(screen.getByText('Assigned agents/teams')).toBeTruthy();
    expect(screen.getByText(/for this tower/)).toBeTruthy();
    expect(screen.getByTestId('inherited-users').textContent).toBe('Inherited from Marina Heights (2)');
    expect(screen.getByTestId('inherited-teams').textContent).toBe('Not assigned');
  });
});

describe('Given a unit with its own users', () => {
  it('Then the user hint is hidden and the list is shown', () => {
    render(<AssignedAgentsPanel value={{ assigned_user_ids: ['u7'], assigned_team_ids: [] }} onChange={vi.fn()} inherited={inherited} scope="unit" />);
    expect(screen.queryByTestId('inherited-users')).toBeNull();
    expect(screen.getByTestId('inherited-teams')).toBeTruthy();
    expect((screen.getByLabelText('Assigned user IDs') as HTMLInputElement).value).toBe('u7');
  });
});

describe('Given a manager edits the lists', () => {
  it('When they commit users and teams Then onChange gets parsed lists', () => {
    const onChange = vi.fn();
    const value = { assigned_user_ids: null, assigned_team_ids: null };
    render(<AssignedAgentsPanel value={value} onChange={onChange} inherited={inherited} scope="unit" />);
    const users = screen.getByLabelText('Assigned user IDs');
    fireEvent.change(users, { target: { value: 'u1, u3' } });
    fireEvent.blur(users);
    expect(onChange).toHaveBeenLastCalledWith({ assigned_user_ids: ['u1', 'u3'], assigned_team_ids: null });
    const teams = screen.getByLabelText('Assigned team IDs');
    fireEvent.change(teams, { target: { value: 't9' } });
    fireEvent.blur(teams);
    expect(onChange).toHaveBeenLastCalledWith({ assigned_user_ids: null, assigned_team_ids: ['t9'] });
  });

  it('When disabled Then the inputs are read-only', () => {
    render(<AssignedAgentsPanel value={{ assigned_user_ids: null, assigned_team_ids: null }} onChange={vi.fn()} inherited={inherited} disabled scope="unit" />);
    expect((screen.getByLabelText('Assigned user IDs') as HTMLInputElement).disabled).toBe(true);
  });
});
