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
      expect(summary.textContent).toContain('Reserved 1');
      expect(summary.textContent).toContain('Sold 1');
      expect(screen.getByTestId('percent-sold').textContent).toBe('25% Sold');
      expect(summary.textContent).not.toContain('Blocked');
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
    it('Then the unit panel opens and Open unit navigates to the item detail page', async () => {
      render(<AvailabilityMatrix categoryId="p1" />);
      fireEvent.click(await screen.findByRole('button', { name: 'Unit 102 On hold' }));
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByTestId('unit-panel').textContent).toContain('Unit 102');
      fireEvent.click(screen.getByRole('button', { name: /Open unit/ }));
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

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const untaggedUnit = (id: string, unitNumber: string) => ({
  item_id: id, unit_number: unitNumber, floor: 1, stack: '01', status: 'available',
});

describe('Given the availability request fails without a message', () => {
  describe('When it loads', () => {
    it('Then the generic load error shows', async () => {
      mockGetAvailability.mockRejectedValue({});
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(await screen.findByText(/Failed to load availability/)).toBeTruthy();
    });
  });
});

describe('Given untagged units and a tower fetch that fails', () => {
  describe('When the tower request rejects with a message', () => {
    it('Then that message shows', async () => {
      mockGetAvailability.mockImplementation(async (id: string) => {
        if (id === 'p1') return { towers, units: [] };
        throw new Error('Tower down');
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(await screen.findByText(/Tower down/)).toBeTruthy();
    });
  });

  describe('When the tower request rejects without a message', () => {
    it('Then the generic tower error shows', async () => {
      mockGetAvailability.mockImplementation(async (id: string) => {
        if (id === 'p1') return { towers, units: [] };
        throw {};
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(await screen.findByText(/Failed to load tower/)).toBeTruthy();
    });
  });
});

describe('Given untagged units and a slow tower request', () => {
  describe('When the tower is still loading', () => {
    it('Then the tower loading indicator shows', async () => {
      mockGetAvailability.mockImplementation((id: string) =>
        id === 'p1' ? Promise.resolve({ towers, units: [] }) : new Promise(() => {}));
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(await screen.findByText(/Loading tower/)).toBeTruthy();
    });
  });

  describe('When the user switches tower before the first tower resolves', () => {
    it('Then the late result is ignored and the first tower is fetched again on return', async () => {
      const slowT1 = deferred<{ towers: []; units: ReturnType<typeof untaggedUnit>[] }>();
      let t1Calls = 0;
      mockGetAvailability.mockImplementation((id: string) => {
        if (id === 'p1') return Promise.resolve({ towers, units: [] });
        if (id === 't2') return Promise.resolve({ towers: [], units: [untaggedUnit('b', '401')] });
        t1Calls += 1;
        return t1Calls === 1 ? slowT1.promise : Promise.resolve({ towers: [], units: [untaggedUnit('a2', '302')] });
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      await screen.findByText(/Loading tower/);
      fireEvent.click(screen.getAllByRole('tab')[1]);
      expect(await screen.findByRole('button', { name: 'Unit 401 Available' })).toBeTruthy();

      slowT1.resolve({ towers: [], units: [untaggedUnit('a1', '301')] });
      await slowT1.promise;

      fireEvent.click(screen.getAllByRole('tab')[0]);
      expect(await screen.findByRole('button', { name: 'Unit 302 Available' })).toBeTruthy();
      expect(t1Calls).toBe(2);
    });

    it('Then a late rejection does not surface an error', async () => {
      const slowT1 = deferred<never>();
      mockGetAvailability.mockImplementation((id: string) => {
        if (id === 'p1') return Promise.resolve({ towers, units: [] });
        if (id === 't2') return Promise.resolve({ towers: [], units: [untaggedUnit('b', '401')] });
        return slowT1.promise;
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      await screen.findByText(/Loading tower/);
      fireEvent.click(screen.getAllByRole('tab')[1]);
      expect(await screen.findByRole('button', { name: 'Unit 401 Available' })).toBeTruthy();

      slowT1.reject(new Error('late fail'));
      await slowT1.promise.catch(() => undefined);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Unit 401 Available' })).toBeTruthy());
      expect(screen.queryByText(/late fail/)).toBeNull();
    });
  });
});

describe('Given untagged units and a tower that was already fetched', () => {
  describe('When the user returns to that tower', () => {
    it('Then the cached units show without another request', async () => {
      mockGetAvailability.mockImplementation(async (id: string) => {
        if (id === 'p1') return { towers, units: [] };
        return { towers: [], units: [untaggedUnit(`u-${id}`, id === 't1' ? '301' : '401')] };
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      await screen.findByRole('button', { name: 'Unit 301 Available' });
      fireEvent.click(screen.getAllByRole('tab')[1]);
      await screen.findByRole('button', { name: 'Unit 401 Available' });
      fireEvent.click(screen.getAllByRole('tab')[0]);
      expect(await screen.findByRole('button', { name: 'Unit 301 Available' })).toBeTruthy();
      expect(mockGetAvailability.mock.calls.filter(([id]) => id === 't1')).toHaveLength(1);
    });
  });
});

describe('Given the only tower is the category itself', () => {
  describe('When it loads', () => {
    it('Then the project units show and no tower request is made', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [{ category_id: 'p1', name: 'Self', total: 1, available: 1, on_hold: 0, sold: 0 }],
        units: [untaggedUnit('s', '111')],
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      expect(await screen.findByRole('button', { name: 'Unit 111 Available' })).toBeTruthy();
      expect(mockGetAvailability).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Given towers with missing counts', () => {
  describe('When it loads', () => {
    it('Then missing counts read as 0', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [{ category_id: 't1', name: 'Bare', total: null, available: undefined, on_hold: 'x', sold: null }],
        units: [{ ...untaggedUnit('a', '101'), category_id: 't1' }],
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      const tab = await screen.findByRole('tab');
      expect(tab.textContent).toContain('(0/0)');
      expect(screen.getByTestId('availability-summary').textContent).toContain('Total 0');
    });
  });
});

describe('Given a unit with an unknown status and one with bedrooms', () => {
  describe('When it renders', () => {
    it('Then the unknown status falls back to Available and bedrooms appear in the title', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [],
        units: [
          { item_id: 'a', unit_number: '101', floor: 1, stack: '01', status: 'reserved', bedrooms: 2 },
          { item_id: 'b', unit_number: '102', floor: 1, stack: '02', status: 'sold', bedrooms: null },
        ],
      });
      render(<AvailabilityMatrix categoryId="t9" />);
      const odd = await screen.findByRole('button', { name: 'Unit 101 Available' });
      expect(odd.className).toContain('emerald');
      expect(odd.getAttribute('title')).toBe('101 · Available · 2 BR');
      expect(screen.getByRole('button', { name: 'Unit 102 Sold' }).getAttribute('title')).toBe('102 · Sold');
    });
  });
});

describe('Given a rendered matrix', () => {
  describe('When refreshKey changes', () => {
    it('Then availability is reloaded', async () => {
      mockGetAvailability.mockResolvedValue({ towers: [], units: [] });
      const { rerender } = render(<AvailabilityMatrix categoryId="p1" refreshKey={0} />);
      await screen.findByTestId('availability-empty');
      rerender(<AvailabilityMatrix categoryId="p1" refreshKey={1} />);
      await waitFor(() => expect(mockGetAvailability).toHaveBeenCalledTimes(2));
      expect(await screen.findByTestId('availability-empty')).toBeTruthy();
    });
  });
});
