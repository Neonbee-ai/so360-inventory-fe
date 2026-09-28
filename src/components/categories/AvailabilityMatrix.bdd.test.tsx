import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const mockGetAvailability = vi.fn();
vi.mock('../../services/inventoryService', () => ({
  inventoryService: { getCategoryAvailability: (...a: any[]) => mockGetAvailability(...a) },
}));

import { AvailabilityMatrix } from './AvailabilityMatrix';

const towers = [
  { category_id: 't1', name: 'Tower A', total: 3, available: 1, on_hold: 1, sold: 1 },
  { category_id: 't2', name: 'Tower B', total: 1, available: 1, on_hold: 0, sold: 0 },
];

const taggedUnits = [
  { item_id: 'i1', category_id: 't1', unit_number: '101', floor: 1, stack: '01', status: 'available' },
  { item_id: 'i2', category_id: 't1', unit_number: '102', floor: 1, stack: '02', status: 'on_hold' },
  { item_id: 'i3', category_id: 't1', unit_number: '201', floor: 2, stack: '01', status: 'sold' },
  { item_id: 'i4', category_id: 't2', unit_number: '101', floor: 1, stack: '01', status: 'available' },
];

beforeEach(() => {
  mockNavigate.mockReset();
  mockGetAvailability.mockReset();
});

describe('Given a project with two towers and tower-tagged units', () => {
  beforeEach(() => {
    mockGetAvailability.mockResolvedValue({ towers, units: taggedUnits });
  });

  describe('When the matrix loads', () => {
    it('Then it requests availability for the project', async () => {
      render(<AvailabilityMatrix categoryId="p1" />);
      await screen.findByTestId('availability-grid');
      expect(mockGetAvailability).toHaveBeenCalledWith('p1');
      expect(mockGetAvailability).toHaveBeenCalledTimes(1);
    });

    it('Then the summary sums the tower counts', async () => {
      render(<AvailabilityMatrix categoryId="p1" />);
      const summary = await screen.findByTestId('availability-summary');
      expect(summary.textContent).toContain('Total 4');
      expect(summary.textContent).toContain('Available 2');
      expect(summary.textContent).toContain('On hold 1');
      expect(summary.textContent).toContain('Sold 1');
    });

    it('Then one tab per tower is shown and the first is selected', async () => {
      render(<AvailabilityMatrix categoryId="p1" />);
      const tabs = await screen.findAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(tabs[0].textContent).toContain('Tower A');
      expect(tabs[0].textContent).toContain('(1/3)');
    });

    it('Then only the first tower units render, floors descending', async () => {
      render(<AvailabilityMatrix categoryId="p1" />);
      await screen.findByTestId('availability-grid');
      expect(screen.getByRole('button', { name: 'Unit 101 Available' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Unit 102 On hold' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Unit 201 Sold' })).toBeTruthy();
      const rows = screen.getByTestId('availability-grid').querySelectorAll('tbody tr');
      expect(rows[0].textContent).toContain('201');
      expect(rows[1].textContent).toContain('102');
    });

    it('Then chips carry status colours', async () => {
      render(<AvailabilityMatrix categoryId="p1" />);
      await screen.findByTestId('availability-grid');
      expect(screen.getByRole('button', { name: 'Unit 101 Available' }).className).toContain('emerald');
      expect(screen.getByRole('button', { name: 'Unit 102 On hold' }).className).toContain('amber');
      expect(screen.getByRole('button', { name: 'Unit 201 Sold' }).className).toContain('rose');
    });
  });

  describe('When the user clicks a unit chip', () => {
    it('Then it navigates to the item detail page', async () => {
      render(<AvailabilityMatrix categoryId="p1" />);
      fireEvent.click(await screen.findByRole('button', { name: 'Unit 102 On hold' }));
      expect(mockNavigate).toHaveBeenCalledWith('/inventory/items/i2');
    });
  });

  describe('When the user switches to the second tower', () => {
    it('Then it filters locally without another request', async () => {
      render(<AvailabilityMatrix categoryId="p1" />);
      const tabs = await screen.findAllByRole('tab');
      fireEvent.click(tabs[1]);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Unit 201 Sold' })).toBeNull());
      expect(screen.getByRole('button', { name: 'Unit 101 Available' })).toBeTruthy();
      expect(mockGetAvailability).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Given a project whose units do not carry a tower id', () => {
  describe('When a tower tab is active', () => {
    it('Then the tower availability is fetched on demand', async () => {
      mockGetAvailability.mockImplementation(async (id: string) => {
        if (id === 'p1') return { towers, units: [] };
        return {
          towers: [],
          units: [{ item_id: `u-${id}`, unit_number: id === 't1' ? '301' : '401', floor: 3, stack: '01', status: 'available' }],
        };
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(await screen.findByRole('button', { name: 'Unit 301 Available' })).toBeTruthy();
      expect(mockGetAvailability).toHaveBeenCalledWith('t1');

      fireEvent.click(screen.getAllByRole('tab')[1]);
      expect(await screen.findByRole('button', { name: 'Unit 401 Available' })).toBeTruthy();
      expect(mockGetAvailability).toHaveBeenCalledWith('t2');
    });
  });
});

describe('Given a single tower (no child towers)', () => {
  describe('When it loads', () => {
    it('Then it renders the returned units and summarises them without tabs', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [],
        units: [
          { item_id: 'a', unit_number: '101', floor: 1, stack: '01', status: 'available' },
          { item_id: 'b', unit_number: '102', floor: 1, stack: '02', status: 'sold' },
        ],
      });
      render(<AvailabilityMatrix categoryId="t9" />);
      const summary = await screen.findByTestId('availability-summary');
      expect(summary.textContent).toContain('Total 2');
      expect(summary.textContent).toContain('Sold 1');
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Unit 102 Sold' })).toBeTruthy();
    });
  });
});

describe('Given a project with no units', () => {
  describe('When it loads', () => {
    it('Then it shows the empty state', async () => {
      mockGetAvailability.mockResolvedValue({ towers: [], units: [] });
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(await screen.findByTestId('availability-empty')).toBeTruthy();
    });
  });
});

describe('Given the availability request fails', () => {
  describe('When it loads', () => {
    it('Then the error shows and Retry reloads', async () => {
      mockGetAvailability.mockRejectedValueOnce(new Error('Boom'));
      mockGetAvailability.mockResolvedValueOnce({ towers: [], units: [] });
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(await screen.findByText(/Boom/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
      expect(await screen.findByTestId('availability-empty')).toBeTruthy();
      expect(mockGetAvailability).toHaveBeenCalledTimes(2);
    });
  });

  describe('When it is still loading', () => {
    it('Then a loading indicator shows', () => {
      mockGetAvailability.mockReturnValue(new Promise(() => {}));
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(screen.getByTestId('availability-loading')).toBeTruthy();
    });
  });
});
