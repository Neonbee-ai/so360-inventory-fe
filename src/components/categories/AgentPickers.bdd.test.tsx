/**
 * AgentPickers — multi-select pickers for assigned users (Core directory) and
 * teams (People Connect departments), replacing raw UUID lists.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSearchUsers = vi.fn();
const mockListTeams = vi.fn();
vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    searchOrgUsers: (...a: any[]) => mockSearchUsers(...a),
    listTeams: (...a: any[]) => mockListTeams(...a),
  },
}));

import { AgentMultiSelect, TeamAgentPicker, UserAgentPicker, USER_SEARCH_DEBOUNCE_MS, shortId } from './AgentPickers';
import type { AgentOption } from '../../types/inventory';

const UUID = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';
const users: AgentOption[] = [
  { id: 'u1', name: 'Aisha Khan', detail: 'aisha@x.com' },
  { id: 'u2', name: 'Bilal Rao', detail: 'bilal@x.com' },
  { id: 'u3', name: 'Chen', detail: 'Chen' },
];

beforeEach(() => {
  mockSearchUsers.mockReset();
  mockListTeams.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const Harness: React.FC<{
  initial?: string[] | null;
  onChangeSpy?: (v: string[] | null) => void;
  options?: AgentOption[];
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  names?: Record<string, string>;
}> = ({ initial = null, onChangeSpy, options = users, ...rest }) => {
  const [value, setValue] = useState<string[] | null>(initial);
  return (
    <AgentMultiSelect label="Assigned users" value={value} options={options} {...rest}
      onChange={(v) => { onChangeSpy?.(v); setValue(v); }} />
  );
};

const search = (label = 'Assigned users') => screen.getByLabelText(`Search ${label}`) as HTMLInputElement;
const optionNames = () => screen.getAllByRole('option').map((o) => o.firstChild?.textContent);

describe('Given the id shortener', () => {
  it('Then long ids are truncated and short ids kept', () => {
    expect(shortId(UUID)).toBe('0f1e2d3c…');
    expect(shortId('abc')).toBe('abc');
  });
});

describe('Given an AgentMultiSelect', () => {
  describe('When it renders with selected ids', () => {
    it('Then known ids show names and unknown ids show a truncated chip with the full id as title', () => {
      render(<Harness initial={['u1', UUID, 'u9']} names={{ u9: 'Old Name' }} />);
      expect(screen.getByRole('group', { name: 'Assigned users' })).toBeTruthy();
      expect(screen.getByText('Aisha Khan')).toBeTruthy();
      expect(screen.getByText('Old Name')).toBeTruthy();
      const unknown = screen.getByText('0f1e2d3c…');
      expect(unknown.getAttribute('title')).toBe(UUID);
      expect(unknown.getAttribute('data-unknown')).toBe('true');
      expect(screen.getByText('Aisha Khan').getAttribute('title')).toBeNull();
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('When the search box is focused', () => {
    it('Then unselected options are listed with their detail unless it repeats the name', () => {
      render(<Harness initial={['u1']} />);
      fireEvent.focus(search());
      expect(search().getAttribute('aria-expanded')).toBe('true');
      expect(optionNames()).toEqual(['Bilal Rao', 'Chen']);
      expect(screen.getByText('bilal@x.com')).toBeTruthy();
      expect(screen.getAllByText('Chen')).toHaveLength(1);
    });
  });

  describe('When text is typed', () => {
    it('Then options filter by name or detail and the query is reported', () => {
      const onQuery = vi.fn();
      render(<AgentMultiSelect label="Assigned users" value={null} onChange={vi.fn()} options={users} onQueryChange={onQuery} />);
      fireEvent.change(search(), { target: { value: 'BILAL@' } });
      expect(onQuery).toHaveBeenLastCalledWith('BILAL@');
      expect(optionNames()).toEqual(['Bilal Rao']);
      fireEvent.change(search(), { target: { value: 'khan' } });
      expect(optionNames()).toEqual(['Aisha Khan']);
      fireEvent.change(search(), { target: { value: 'zzz' } });
      expect(screen.queryAllByRole('option')).toHaveLength(0);
      expect(screen.getByText('No matches')).toBeTruthy();
    });
  });

  describe('When an option is clicked', () => {
    it('Then its id is appended, the chip shows its name and the query clears', () => {
      const spy = vi.fn();
      const onQuery = vi.fn();
      render(<AgentMultiSelect label="Assigned users" value={['u2']} onChange={spy} options={users} onQueryChange={onQuery} />);
      fireEvent.change(search(), { target: { value: 'ai' } });
      const opt = screen.getByRole('option', { name: /Aisha Khan/ });
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      opt.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      fireEvent.click(opt);
      expect(spy).toHaveBeenCalledWith(['u2', 'u1']);
      expect(onQuery).toHaveBeenLastCalledWith('');
      expect(search().value).toBe('');
    });

    it('Then with no prior value the list starts from empty', () => {
      const spy = vi.fn();
      render(<Harness onChangeSpy={spy} />);
      fireEvent.focus(search());
      fireEvent.click(screen.getByRole('option', { name: /Chen/ }));
      expect(spy).toHaveBeenCalledWith(['u3']);
      expect(screen.getByRole('button', { name: 'Remove Chen' })).toBeTruthy();
    });
  });

  describe('When Enter is pressed', () => {
    it('Then the first visible option is added; with no match nothing changes', () => {
      const spy = vi.fn();
      render(<Harness onChangeSpy={spy} />);
      fireEvent.change(search(), { target: { value: 'bil' } });
      fireEvent.keyDown(search(), { key: 'Enter' });
      expect(spy).toHaveBeenLastCalledWith(['u2']);
      fireEvent.change(search(), { target: { value: 'zzz' } });
      fireEvent.keyDown(search(), { key: 'Enter' });
      expect(spy).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(search(), { key: 'a' });
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('When Escape is pressed or focus leaves', () => {
    it('Then the option list closes', () => {
      render(<Harness />);
      fireEvent.focus(search());
      expect(screen.getByRole('listbox', { name: 'Assigned users options' })).toBeTruthy();
      fireEvent.keyDown(search(), { key: 'Escape' });
      expect(screen.queryByRole('listbox')).toBeNull();
      fireEvent.focus(search());
      expect(screen.getByRole('listbox')).toBeTruthy();
      fireEvent.blur(search());
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('When a chip is removed', () => {
    it('Then the rest remain, and removing the last emits null', () => {
      const spy = vi.fn();
      render(<Harness initial={['u1', UUID]} onChangeSpy={spy} />);
      fireEvent.click(screen.getByRole('button', { name: 'Remove 0f1e2d3c…' }));
      expect(spy).toHaveBeenLastCalledWith(['u1']);
      fireEvent.click(screen.getByRole('button', { name: 'Remove Aisha Khan' }));
      expect(spy).toHaveBeenLastCalledWith(null);
      expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    });
  });

  describe('When loading or failed', () => {
    it('Then the list shows Loading… instead of options, and the error is announced', () => {
      render(<Harness loading error="Could not load users: down" />);
      fireEvent.focus(search());
      expect(screen.getByText('Loading…')).toBeTruthy();
      expect(screen.queryAllByRole('option')).toHaveLength(0);
      expect(screen.queryByText('No matches')).toBeNull();
      expect(screen.getByRole('alert').textContent).toBe('Could not load users: down');
    });
  });

  describe('When disabled (no items.update)', () => {
    it('Then chips stay visible without remove buttons or a search box', () => {
      render(<Harness initial={['u1']} disabled />);
      expect(screen.getByText('Aisha Khan')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
      expect(screen.queryByLabelText('Search Assigned users')).toBeNull();
      expect(screen.queryByText('None')).toBeNull();
    });

    it('Then an empty selection reads None', () => {
      render(<Harness disabled />);
      expect(screen.getByText('None')).toBeTruthy();
    });
  });
});

describe('Given a UserAgentPicker', () => {
  describe('When it mounts', () => {
    it('Then it loads org users once with no text and lists them', async () => {
      mockSearchUsers.mockResolvedValue(users);
      render(<UserAgentPicker value={['u1']} onChange={vi.fn()} />);
      fireEvent.focus(search());
      expect(screen.getByText('Loading…')).toBeTruthy();
      await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
      expect(mockSearchUsers).toHaveBeenCalledTimes(1);
      expect(mockSearchUsers).toHaveBeenCalledWith('');
      expect(screen.getByText('Aisha Khan')).toBeTruthy();
      expect(optionNames()).toEqual(['Bilal Rao', 'Chen']);
    });
  });

  describe('When the user types', () => {
    it('Then the server search is debounced, and chip names from earlier results are kept', async () => {
      mockSearchUsers.mockResolvedValueOnce(users).mockResolvedValueOnce([{ id: 'u4', name: 'Dana' }]);
      render(<UserAgentPicker value={['u1']} onChange={vi.fn()} label="Agents" />);
      await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledTimes(1));
      await screen.findByText('Aisha Khan');
      vi.useFakeTimers();
      fireEvent.change(search('Agents'), { target: { value: 'd' } });
      fireEvent.change(search('Agents'), { target: { value: 'da' } });
      act(() => { vi.advanceTimersByTime(USER_SEARCH_DEBOUNCE_MS - 1); });
      expect(mockSearchUsers).toHaveBeenCalledTimes(1);
      act(() => { vi.advanceTimersByTime(1); });
      vi.useRealTimers();
      await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledTimes(2));
      expect(mockSearchUsers).toHaveBeenLastCalledWith('da');
      await screen.findByRole('option', { name: /Dana/ });
      expect(screen.getByText('Aisha Khan')).toBeTruthy();
    });
  });

  describe('When the lookup fails', () => {
    it('Then the chips remain and the reason is shown', async () => {
      mockSearchUsers.mockRejectedValue(new Error('Request failed (403)'));
      render(<UserAgentPicker value={[UUID]} onChange={vi.fn()} />);
      expect((await screen.findByRole('alert')).textContent).toBe('Could not load users: Request failed (403)');
      expect(screen.getByText('0f1e2d3c…')).toBeTruthy();
    });

    it('Then a rejection without a message shows a generic reason', async () => {
      mockSearchUsers.mockRejectedValue('boom');
      render(<UserAgentPicker value={null} onChange={vi.fn()} />);
      expect((await screen.findByRole('alert')).textContent).toBe('Could not load users: request failed');
    });

    it('Then a later successful search clears the error', async () => {
      mockSearchUsers.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(users);
      render(<UserAgentPicker value={null} onChange={vi.fn()} />);
      await screen.findByRole('alert');
      fireEvent.change(search(), { target: { value: 'a' } });
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
      expect(screen.getByRole('option', { name: /Aisha Khan/ })).toBeTruthy();
    });
  });

  describe('When an older response arrives after a newer search', () => {
    it('Then the stale result or error is ignored', async () => {
      let resolveFirst!: (v: AgentOption[]) => void;
      let rejectSecond!: (e: unknown) => void;
      mockSearchUsers
        .mockReturnValueOnce(new Promise((res) => { resolveFirst = res; }))
        .mockReturnValueOnce(new Promise((_, rej) => { rejectSecond = rej; }))
        .mockResolvedValueOnce([{ id: 'u4', name: 'Dana' }]);
      render(<UserAgentPicker value={null} onChange={vi.fn()} />);
      await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledTimes(1));
      fireEvent.change(search(), { target: { value: 'x' } });
      await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledTimes(2));
      fireEvent.change(search(), { target: { value: 'da' } });
      await waitFor(() => expect(mockSearchUsers).toHaveBeenCalledTimes(3));
      await screen.findByRole('option', { name: /Dana/ });
      await act(async () => {
        resolveFirst(users);
        rejectSecond(new Error('late'));
      });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('option', { name: /Aisha/ })).toBeNull();
      expect(screen.getByRole('option', { name: /Dana/ })).toBeTruthy();
    });
  });

  describe('When the service method is missing (older mocks/builds)', () => {
    it('Then the picker shows an error instead of crashing', async () => {
      mockSearchUsers.mockImplementation(() => { throw new TypeError('not a function'); });
      render(<UserAgentPicker value={null} onChange={vi.fn()} />);
      expect((await screen.findByRole('alert')).textContent).toBe('Could not load users: not a function');
    });
  });
});

describe('Given a TeamAgentPicker', () => {
  describe('When departments load', () => {
    it('Then teams are listed and selected ids show team names', async () => {
      mockListTeams.mockResolvedValue([{ id: 't1', name: 'Sales', detail: 'SAL' }, { id: 't2', name: 'Leasing' }]);
      const spy = vi.fn();
      render(<TeamAgentPicker value={['t1']} onChange={spy} />);
      fireEvent.focus(search('Assigned teams'));
      expect(screen.getByText('Loading…')).toBeTruthy();
      await screen.findByText('Sales');
      expect(mockListTeams).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('option', { name: /Leasing/ }));
      expect(spy).toHaveBeenCalledWith(['t1', 't2']);
    });
  });

  describe('When departments cannot be listed', () => {
    it('Then it falls back to a team ID input that commits the parsed list on blur', async () => {
      mockListTeams.mockRejectedValue(new Error('Request failed (403)'));
      const spy = vi.fn();
      render(<TeamAgentPicker value={['t1']} onChange={spy} />);
      const input = (await screen.findByLabelText('Assigned team IDs')) as HTMLInputElement;
      expect(input.value).toBe('t1');
      expect(screen.getByText('Assigned teams')).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toBe('Could not load teams (Request failed (403)). Enter team IDs separated by commas.');
      fireEvent.change(input, { target: { value: 't1, t9, ' } });
      expect(spy).not.toHaveBeenCalled();
      fireEvent.blur(input);
      expect(spy).toHaveBeenLastCalledWith(['t1', 't9']);
      fireEvent.change(input, { target: { value: ' , ' } });
      fireEvent.blur(input);
      expect(spy).toHaveBeenLastCalledWith(null);
    });

    it('Then the fallback respects disabled and a message-less error', async () => {
      mockListTeams.mockRejectedValue(undefined);
      render(<TeamAgentPicker value={null} onChange={vi.fn()} disabled />);
      const input = (await screen.findByLabelText('Assigned team IDs')) as HTMLInputElement;
      expect(input.disabled).toBe(true);
      expect(input.value).toBe('');
      expect(screen.getByRole('alert').textContent).toMatch(/Could not load teams \(request failed\)/);
    });
  });

  describe('When it unmounts before departments return', () => {
    it('Then the late result is dropped without errors', async () => {
      let resolve!: (v: AgentOption[]) => void;
      let reject!: (e: unknown) => void;
      mockListTeams
        .mockReturnValueOnce(new Promise((res) => { resolve = res; }))
        .mockReturnValueOnce(new Promise((_, rej) => { reject = rej; }));
      const a = render(<TeamAgentPicker value={null} onChange={vi.fn()} />);
      a.unmount();
      const b = render(<TeamAgentPicker value={null} onChange={vi.fn()} />);
      b.unmount();
      await act(async () => {
        resolve([{ id: 't1', name: 'Sales' }]);
        reject(new Error('late'));
      });
      expect(screen.queryByText('Sales')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
