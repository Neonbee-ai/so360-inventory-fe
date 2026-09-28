import { describe, it, expect } from 'vitest';
import {
  previewUnitCount,
  defaultStackLabels,
  formatUnitNumber,
  summarizeCounts,
  buildAvailabilityGrid,
  cellKey,
  DEFAULT_NUMBERING_PATTERN,
} from './unitGrid';
import type { AvailabilityUnit } from '../types/inventory';

const unit = (over: Partial<AvailabilityUnit>): AvailabilityUnit => ({
  item_id: 'i', unit_number: 'u', floor: 1, stack: '01', status: 'available', ...over,
});

describe('previewUnitCount', () => {
  describe('Given floors 1–10 and 4 units per floor', () => {
    it('Then it previews 40 units', () => {
      expect(previewUnitCount(1, 10, 4)).toBe(40);
    });
  });
  describe('Given string inputs from form fields', () => {
    it('Then it parses them', () => {
      expect(previewUnitCount('3', '3', '6')).toBe(6);
    });
  });
  describe('Given floor_to below floor_from', () => {
    it('Then it previews 0', () => {
      expect(previewUnitCount(10, 1, 4)).toBe(0);
    });
  });
  describe('Given blank, fractional or non-positive inputs', () => {
    it('Then it previews 0', () => {
      expect(previewUnitCount('', 5, 2)).toBe(0);
      expect(previewUnitCount(1, 5, 0)).toBe(0);
      expect(previewUnitCount(1, 5.5, 2)).toBe(0);
      expect(previewUnitCount(1, 5, 'x')).toBe(0);
    });
  });
  describe('Given a whitespace-only, null or undefined input', () => {
    it('Then it previews 0 instead of reading the blank as floor 0', () => {
      expect(previewUnitCount('  ', 5, 2)).toBe(0);
      expect(previewUnitCount(null, 5, 2)).toBe(0);
      expect(previewUnitCount(1, undefined, 2)).toBe(0);
    });
  });
  describe('Given a fractional numeric string or an infinite number', () => {
    it('Then it previews 0', () => {
      expect(previewUnitCount('1.5', 5, 2)).toBe(0);
      expect(previewUnitCount(1, Infinity, 2)).toBe(0);
    });
  });
  describe('Given floor 0 (ground) entered as a string', () => {
    it('Then it is accepted as a real floor', () => {
      expect(previewUnitCount('0', '1', 3)).toBe(6);
    });
  });
  describe('Given a negative units-per-floor', () => {
    it('Then it previews 0', () => {
      expect(previewUnitCount(1, 2, -3)).toBe(0);
    });
  });
});

describe('defaultStackLabels', () => {
  describe('Given 3 units per floor', () => {
    it('Then it returns 01..03', () => {
      expect(defaultStackLabels(3)).toEqual(['01', '02', '03']);
    });
  });
  describe('Given 0 or a negative count', () => {
    it('Then it returns no labels', () => {
      expect(defaultStackLabels(0)).toEqual([]);
      expect(defaultStackLabels(-2)).toEqual([]);
    });
  });
  describe('Given more than 99', () => {
    it('Then it caps at 99', () => {
      expect(defaultStackLabels(150)).toHaveLength(99);
    });
  });
});

describe('formatUnitNumber', () => {
  describe('Given the default pattern', () => {
    it('Then floor 12 stack 3 renders 1203', () => {
      expect(formatUnitNumber(DEFAULT_NUMBERING_PATTERN, 12, '3')).toBe('1203');
    });
    it('Then a pre-padded stack stays two digits', () => {
      expect(formatUnitNumber(DEFAULT_NUMBERING_PATTERN, 2, '04')).toBe('204');
    });
  });
  describe('Given a custom pattern with separators', () => {
    it('Then it substitutes each token', () => {
      expect(formatUnitNumber('T1-{floor:03}-{stack}', 7, 'B')).toBe('T1-007-B');
    });
  });
  describe('Given an empty pattern', () => {
    it('Then it falls back to the default', () => {
      expect(formatUnitNumber('', 5, 1)).toBe('501');
    });
  });
  describe('Given a non-numeric stack with padding', () => {
    it('Then it pads the text as-is', () => {
      expect(formatUnitNumber('{stack:02}', 1, 'A')).toBe('0A');
    });
  });
});

describe('summarizeCounts', () => {
  describe('Given a mix of statuses', () => {
    it('Then it counts each bucket and the total', () => {
      const counts = summarizeCounts([
        unit({ status: 'available' }),
        unit({ status: 'available' }),
        unit({ status: 'on_hold' }),
        unit({ status: 'sold' }),
      ]);
      expect(counts).toEqual({ total: 4, available: 2, on_hold: 1, sold: 1 });
    });
  });
  describe('Given no units', () => {
    it('Then every count is 0', () => {
      expect(summarizeCounts([])).toEqual({ total: 0, available: 0, on_hold: 0, sold: 0 });
      expect(summarizeCounts(undefined as any)).toEqual({ total: 0, available: 0, on_hold: 0, sold: 0 });
    });
  });
});

describe('buildAvailabilityGrid', () => {
  describe('Given units across floors and stacks', () => {
    const units = [
      unit({ item_id: 'a', floor: 1, stack: '10' }),
      unit({ item_id: 'b', floor: 3, stack: '2' }),
      unit({ item_id: 'c', floor: 2, stack: '1' }),
      unit({ item_id: 'dup', floor: 2, stack: '1' }),
    ];
    const grid = buildAvailabilityGrid(units);

    it('Then floors are listed highest first', () => {
      expect(grid.floors).toEqual([3, 2, 1]);
    });
    it('Then stacks are in natural order', () => {
      expect(grid.stacks).toEqual(['1', '2', '10']);
    });
    it('Then each cell maps to its unit and the first duplicate wins', () => {
      expect(grid.cells.get(cellKey(3, '2'))?.item_id).toBe('b');
      expect(grid.cells.get(cellKey(2, '1'))?.item_id).toBe('c');
      expect(grid.cells.get(cellKey(3, '1'))).toBeUndefined();
    });
  });
  describe('Given a unit with an unusable floor', () => {
    it('Then it is skipped', () => {
      const grid = buildAvailabilityGrid([unit({ floor: NaN as any }), unit({ floor: 4 })]);
      expect(grid.floors).toEqual([4]);
    });
  });
  describe('Given no units', () => {
    it('Then the grid is empty', () => {
      const grid = buildAvailabilityGrid([]);
      expect(grid.floors).toEqual([]);
      expect(grid.stacks).toEqual([]);
      expect(grid.cells.size).toBe(0);
    });
  });
});

describe('unitGrid edge branches', () => {
  describe('defaultStackLabels', () => {
    describe('Given NaN or a fractional count', () => {
      it('Then NaN yields no labels and a fraction is floored', () => {
        expect(defaultStackLabels(NaN)).toEqual([]);
        expect(defaultStackLabels(2.7)).toEqual(['01', '02']);
      });
    });
  });

  describe('formatUnitNumber', () => {
    describe('Given a whitespace-only pattern', () => {
      it('Then it falls back to the default pattern', () => {
        expect(formatUnitNumber('   ', 3, '2')).toBe('302');
      });
    });
    describe('Given a zero-padded numeric stack and no width', () => {
      it('Then the stack text is kept verbatim', () => {
        expect(formatUnitNumber('{floor}-{stack}', 4, '03')).toBe('4-03');
      });
    });
    describe('Given a numeric stack with a width', () => {
      it('Then leading zeros collapse before padding', () => {
        expect(formatUnitNumber('{stack:03}', 1, '007')).toBe('007');
        expect(formatUnitNumber('{stack:01}', 1, '05')).toBe('5');
      });
    });
    describe('Given a floor token with a width', () => {
      it('Then the floor is padded but never collapsed', () => {
        expect(formatUnitNumber('{floor:02}', 3, 'A')).toBe('03');
      });
    });
    describe('Given a pattern with no tokens', () => {
      it('Then it is returned unchanged', () => {
        expect(formatUnitNumber('PH', 30, '1')).toBe('PH');
      });
    });
  });

  describe('summarizeCounts', () => {
    describe('Given a unit with an unknown status', () => {
      it('Then it counts toward the total only', () => {
        const odd = { status: 'reserved' } as unknown as Pick<AvailabilityUnit, 'status'>;
        expect(summarizeCounts([odd, unit({ status: 'sold' })])).toEqual({ total: 2, available: 0, on_hold: 0, sold: 1 });
      });
    });
  });

  describe('buildAvailabilityGrid', () => {
    describe('Given null entries and units with no stack', () => {
      it('Then nulls are skipped and a missing stack becomes an empty column', () => {
        const noStack = { ...unit({ item_id: 'ns', floor: 2 }), stack: undefined } as unknown as AvailabilityUnit;
        const nullStack = { ...unit({ item_id: 'nl', floor: 3 }), stack: null } as unknown as AvailabilityUnit;
        const grid = buildAvailabilityGrid([null as unknown as AvailabilityUnit, noStack, nullStack]);
        expect(grid.floors).toEqual([3, 2]);
        expect(grid.stacks).toEqual(['']);
        expect(grid.cells.get(cellKey(2, ''))?.item_id).toBe('ns');
        expect(grid.cells.get(cellKey(3, ''))?.item_id).toBe('nl');
      });
    });
    describe('Given a numeric-string floor', () => {
      it('Then it is coerced to a number', () => {
        const grid = buildAvailabilityGrid([unit({ floor: '7' as unknown as number, stack: 'B' })]);
        expect(grid.floors).toEqual([7]);
        expect(grid.cells.get(cellKey(7, 'B'))).toBeDefined();
      });
    });
    describe('Given undefined instead of a list', () => {
      it('Then the grid is empty', () => {
        const grid = buildAvailabilityGrid(undefined as unknown as AvailabilityUnit[]);
        expect(grid.floors).toEqual([]);
        expect(grid.cells.size).toBe(0);
      });
    });
  });

  describe('cellKey', () => {
    it('Then it joins floor and stack with a pipe', () => {
      expect(cellKey(12, '03')).toBe('12|03');
    });
  });
});
