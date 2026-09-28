import { describe, it, expect } from 'vitest';
import { addCounts, emptyCounts, formatUnitMoney, percentSold, summarizeCounts, toCounts } from './unitGrid';

const zero = { total: 0, available: 0, on_hold: 0, sold: 0, blocked: 0, cancelled: 0, unavailable: 0 };

describe('Given unit status counts (RE plan G2/G3)', () => {
  describe('When emptyCounts is called', () => {
    it('Then every bucket is 0 and each call is a fresh object', () => {
      expect(emptyCounts()).toEqual(zero);
      expect(emptyCounts()).not.toBe(emptyCounts());
    });
  });

  describe('When toCounts reads a raw counts object', () => {
    it('Then numeric strings are parsed and missing or junk buckets read as 0', () => {
      expect(toCounts({ total: '5', available: 1, on_hold: null, sold: 'x', blocked: 2, cancelled: '1' })).toEqual({
        ...zero, total: 5, available: 1, blocked: 2, cancelled: 1,
      });
    });

    it('Then a null, primitive or missing value reads as all zeros', () => {
      expect(toCounts(null)).toEqual(zero);
      expect(toCounts(7)).toEqual(zero);
      expect(toCounts(undefined)).toEqual(zero);
    });
  });

  describe('When addCounts sums two towers', () => {
    it('Then every bucket and the total are added', () => {
      const a = { total: 3, available: 1, on_hold: 1, sold: 1, blocked: 0, cancelled: 0, unavailable: 0 };
      const b = { total: 3, available: 0, on_hold: 0, sold: 0, blocked: 1, cancelled: 1, unavailable: 1 };
      expect(addCounts(a, b)).toEqual({ total: 6, available: 1, on_hold: 1, sold: 1, blocked: 1, cancelled: 1, unavailable: 1 });
    });
  });

  describe('When summarizeCounts sees manual statuses and an unknown one', () => {
    it('Then each manual status has its bucket and the unknown one only adds to the total', () => {
      const units = ['blocked', 'cancelled', 'unavailable', 'sold', 'reserved'].map((status) => ({ status })) as any;
      expect(summarizeCounts(units)).toEqual({ ...zero, total: 5, blocked: 1, cancelled: 1, unavailable: 1, sold: 1 });
    });

    it('Then a null list is all zeros', () => {
      expect(summarizeCounts(null as any)).toEqual(zero);
    });
  });

  describe('When percentSold is computed', () => {
    it('Then it is sold over total to one decimal place', () => {
      expect(percentSold({ total: 3, sold: 1 })).toBe(33.3);
      expect(percentSold({ total: 8, sold: 8 })).toBe(100);
      expect(percentSold({ total: 200, sold: 1 })).toBe(0.5);
    });

    it('Then an empty or negative total is 0', () => {
      expect(percentSold({ total: 0, sold: 0 })).toBe(0);
      expect(percentSold({ total: -1, sold: 1 })).toBe(0);
    });
  });
});

describe('Given a unit price to show', () => {
  describe('When the unit has its own currency', () => {
    it('Then that currency wins over the org currency', () => {
      expect(formatUnitMoney(1500000, 'AED', 'USD')).toBe(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(1500000));
    });
  });

  describe('When the unit currency is blank', () => {
    it('Then the org currency is used', () => {
      expect(formatUnitMoney(10, '  ', 'USD')).toBe('$10.00');
      expect(formatUnitMoney(10, null, 'USD')).toBe('$10.00');
    });
  });

  describe('When neither currency is known', () => {
    it('Then a plain number is shown', () => {
      expect(formatUnitMoney(1234, null, null)).toBe('1,234');
      expect(formatUnitMoney(1234, undefined, ' ')).toBe('1,234');
    });
  });

  describe('When the currency code is invalid', () => {
    it('Then the code is prefixed to the number instead of throwing', () => {
      expect(formatUnitMoney(99, 'NOT-A-CODE', 'USD')).toBe('NOT-A-CODE 99');
    });
  });

  describe('When the amount is missing or not finite', () => {
    it('Then nothing is shown', () => {
      expect(formatUnitMoney(null, 'USD', 'USD')).toBeNull();
      expect(formatUnitMoney(undefined, 'USD', 'USD')).toBeNull();
      expect(formatUnitMoney(Infinity, 'USD', 'USD')).toBeNull();
    });
  });
});
