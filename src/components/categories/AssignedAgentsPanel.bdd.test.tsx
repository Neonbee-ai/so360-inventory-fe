/**
 * AssignedAgentsPanel — tower/unit agents/teams override with "Inherited from" hints,
 * edited through the user and team pickers.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearchUsers = vi.fn();
const mockListTeams = vi.fn();
vi.mock('../../services/mediaService', () => ({ mediaService: {} }));
vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    searchOrgUsers: (...a: any[]) => mockSearchUsers(...a),
    listTeams: (...a: any[]) => mockListTeams(...a),
  },
}));

import { AssignedAgentsPanel } from './AssignedAgentsPanel';

const inherited = { users: { ids: ['u1', 'u2'], from: 'Marina Heights' }, teams: null };

beforeEach(() => {
  mockSearchUsers.mockReset();
  mockListTeams.mockReset();
  mockSearchUsers.mockResolvedValue([{ id: 'u1', name: 'Aisha Khan' }, { id: 'u7', name: 'Omar' }]);
  mockListTeams.mockResolvedValue([{ id: 't9', name: 'Leasing' }]);
});

describe('Given a tower with no own agents', () => {
  it('Then the hints name the parent it inherits from, or say not assigned', async () => {
    render(<AssignedAgentsPanel value={{ assigned_user_ids: null, assigned_team_ids: null }} onChange={vi.fn()} inherited={inherited} scope="tower" />);
    expect(screen.getByRole('region', { name: 'Assigned agents' })).toBeTruthy();
    expect(screen.getByText('Assigned agents/teams')).toBeTruthy();
    expect(screen.getByText(/for this tower/)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Assigned users' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Assigned teams' })).toBeTruthy();
    expect(screen.getByTestId('inherited-users').textContent).toBe('Inherited from Marina Heights (2)');
    expect(screen.getByTestId('inherited-teams').textContent).toBe('Not assigned');
    await waitFor(() => expect(mockListTeams).toHaveBeenCalled());
  });
});

describe('Given a unit with its own users', () => {
  it('Then the user hint is hidden and the chosen user is shown by name', async () => {
    render(<AssignedAgentsPanel value={{ assigned_user_ids: ['u7'], assigned_team_ids: [] }} onChange={vi.fn()} inherited={inherited} scope="unit" />);
    expect(screen.queryByTestId('inherited-users')).toBeNull();
    expect(screen.getByTestId('inherited-teams')).toBeTruthy();
    expect(await screen.findByText('Omar')).toBeTruthy();
  });
});

describe('Given a manager edits the lists', () => {
  it('When they pick a user and a team Then onChange gets the id lists', async () => {
    const onChange = vi.fn();
    const value = { assigned_user_ids: null, assigned_team_ids: null };
    render(<AssignedAgentsPanel value={value} onChange={onChange} inherited={inherited} scope="unit" />);
    fireEvent.focus(screen.getByLabelText('Search Assigned users'));
    fireEvent.click(await screen.findByRole('option', { name: /Aisha Khan/ }));
    expect(onChange).toHaveBeenLastCalledWith({ assigned_user_ids: ['u1'], assigned_team_ids: null });
    fireEvent.blur(screen.getByLabelText('Search Assigned users'));
    fireEvent.focus(screen.getByLabelText('Search Assigned teams'));
    fireEvent.click(await screen.findByRole('option', { name: /Leasing/ }));
    expect(onChange).toHaveBeenLastCalledWith({ assigned_user_ids: null, assigned_team_ids: ['t9'] });
  });

  it('When they remove the only user Then the override is cleared to null', async () => {
    const onChange = vi.fn();
    render(<AssignedAgentsPanel value={{ assigned_user_ids: ['u7'], assigned_team_ids: ['t9'] }} onChange={onChange} inherited={inherited} scope="unit" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Omar' }));
    expect(onChange).toHaveBeenLastCalledWith({ assigned_user_ids: null, assigned_team_ids: ['t9'] });
  });

  it('When disabled Then the pickers are read-only', async () => {
    render(<AssignedAgentsPanel value={{ assigned_user_ids: ['u7'], assigned_team_ids: null }} onChange={vi.fn()} inherited={inherited} disabled scope="unit" />);
    expect(await screen.findByText('Omar')).toBeTruthy();
    expect(screen.queryByLabelText('Search Assigned users')).toBeNull();
    expect(screen.queryByLabelText('Search Assigned teams')).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });
});

describe('Given teams cannot be listed', () => {
  it('Then the team field falls back to entering IDs and still reports changes', async () => {
    mockListTeams.mockRejectedValue(new Error('Request failed (403)'));
    const onChange = vi.fn();
    render(<AssignedAgentsPanel value={{ assigned_user_ids: null, assigned_team_ids: null }} onChange={onChange} inherited={inherited} scope="unit" />);
    const teams = await screen.findByLabelText('Assigned team IDs');
    fireEvent.change(teams, { target: { value: 't9' } });
    fireEvent.blur(teams);
    expect(onChange).toHaveBeenLastCalledWith({ assigned_user_ids: null, assigned_team_ids: ['t9'] });
    expect(screen.getByTestId('inherited-teams').textContent).toBe('Not assigned');
  });
});
