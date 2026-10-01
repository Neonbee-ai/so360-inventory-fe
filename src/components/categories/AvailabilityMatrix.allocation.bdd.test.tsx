/**
 * AvailabilityMatrix — unit agents/teams override (action:crm:unit_allocation) BDD specs.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const mockGetAvailability = vi.fn();
vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getCategoryAvailability: (...a: any[]) => mockGetAvailability(...a),
    setUnitStatusOverride: vi.fn(),
  },
}));

const mockSection = vi.fn();
vi.mock('./UnitAllocationSection', () => ({
  UnitAllocationSection: (props: any) => {
    mockSection(props);
    return <div data-testid="alloc-section">{`${props.itemId}|${props.towerId}|${props.categories.length}|${String(props.canManage)}`}</div>;
  },
}));

import { AvailabilityMatrix } from './AvailabilityMatrix';

const unit = (over: Record<string, unknown> = {}) => ({ item_id: 'u1', unit_number: '101', floor: 1, stack: '01', status: 'available', ...over });
const cats = [{ id: 'p1', name: 'Project', parent_id: null }, { id: 't1', name: 'Tower A', parent_id: 'p1' }] as any[];

beforeEach(() => {
  mockGetAvailability.mockReset();
  mockSection.mockReset();
});

const openUnit = async () => fireEvent.click(await screen.findByRole('button', { name: 'Unit 101 Available' }));

describe('Given the unit allocation flag is off', () => {
  it('When a unit is opened Then no agents section shows', async () => {
    mockGetAvailability.mockResolvedValue({ towers: [], units: [unit({ category_id: 't1' })] });
    render(<AvailabilityMatrix categoryId="p1" canManage categories={cats} />);
    await openUnit();
    expect(screen.getByTestId('unit-panel')).toBeTruthy();
    expect(screen.queryByTestId('alloc-section')).toBeNull();
  });
});

describe('Given the unit allocation flag is on', () => {
  it('When a tower-tagged unit is opened Then its tower starts the inheritance walk', async () => {
    mockGetAvailability.mockResolvedValue({ towers: [], units: [unit({ category_id: 't1' })] });
    render(<AvailabilityMatrix categoryId="p1" canManage allocationEnabled categories={cats} />);
    await openUnit();
    expect(screen.getByTestId('alloc-section').textContent).toBe('u1|t1|2|true');
  });

  it('When an untagged unit is opened with no tower picked Then the shown category is used', async () => {
    mockGetAvailability.mockResolvedValue({ towers: [], units: [unit()] });
    render(<AvailabilityMatrix categoryId="t9" allocationEnabled />);
    await openUnit();
    expect(screen.getByTestId('alloc-section').textContent).toBe('u1|t9|0|false');
  });

  it('When an untagged unit is opened under a picked tower Then that tower is used', async () => {
    mockGetAvailability
      .mockResolvedValueOnce({ towers: [{ category_id: 't1', name: 'A', total: 1, available: 1, on_hold: 0, sold: 0 }], units: [] })
      .mockResolvedValueOnce({ towers: [], units: [unit()] });
    render(<AvailabilityMatrix categoryId="p1" allocationEnabled categories={cats} />);
    fireEvent.click(await screen.findByRole('tab', { name: /A/ }));
    await openUnit();
    expect(mockGetAvailability).toHaveBeenLastCalledWith('t1');
    expect(screen.getByTestId('alloc-section').textContent).toBe('u1|t1|2|false');
  });
});
