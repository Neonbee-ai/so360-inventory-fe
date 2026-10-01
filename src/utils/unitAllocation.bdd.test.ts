/**
 * Unit/tower agent allocation inheritance: nearest non-empty list wins, users and teams independently.
 */
import { describe, it, expect } from 'vitest';
import { categoryChain, inheritedAllocation } from './unitAllocation';
import type { ItemCategory } from '../types/inventory';

const cats: ItemCategory[] = [
  { id: 'p', name: 'Marina Heights', metadata: { assigned_user_ids: ['u1', 'u2'], assigned_team_ids: ['t1'] } },
  { id: 't', name: 'Tower A', parent_id: 'p', metadata: { assigned_user_ids: ['u9'], assigned_team_ids: [] } },
  { id: 't2', name: 'Tower B', parent_id: 'p', metadata: null },
  { id: 'orphan', name: 'Orphan', parent_id: 'missing' },
];

describe('Given a category tree', () => {
  it('When walking from a tower Then the chain is nearest first', () => {
    expect(categoryChain(cats, 't').map((c) => c.id)).toEqual(['t', 'p']);
  });
  it('When the start is blank or unknown Then the chain is empty', () => {
    expect(categoryChain(cats, null)).toEqual([]);
    expect(categoryChain(cats, 'nope')).toEqual([]);
  });
  it('When a parent is missing Then the walk stops', () => {
    expect(categoryChain(cats, 'orphan').map((c) => c.id)).toEqual(['orphan']);
  });
  it('When the tree has a cycle Then each category appears once', () => {
    const loop: ItemCategory[] = [{ id: 'a', name: 'A', parent_id: 'b' }, { id: 'b', name: 'B', parent_id: 'a' }];
    expect(categoryChain(loop, 'a').map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('Given a unit in Tower A', () => {
  it('Then users come from the tower and teams from the project', () => {
    expect(inheritedAllocation(cats, 't')).toEqual({
      users: { ids: ['u9'], from: 'Tower A' },
      teams: { ids: ['t1'], from: 'Marina Heights' },
    });
  });
});

describe('Given a unit in Tower B with no metadata', () => {
  it('Then both lists come from the project', () => {
    const r = inheritedAllocation(cats, 't2');
    expect(r.users?.from).toBe('Marina Heights');
    expect(r.teams?.ids).toEqual(['t1']);
  });
});

describe('Given nothing up the chain has a list', () => {
  it('Then both are null, and junk entries are ignored', () => {
    const junk: ItemCategory[] = [{ id: 'x', name: 'X', metadata: { assigned_user_ids: ['', 5 as unknown as string] } }];
    expect(inheritedAllocation(junk, 'x')).toEqual({ users: null, teams: null });
    expect(inheritedAllocation(cats, undefined)).toEqual({ users: null, teams: null });
  });
});
