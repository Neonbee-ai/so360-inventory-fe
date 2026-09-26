import { describe, it, expect } from 'vitest';
import { toBound } from './attributeBounds';

describe('toBound — parsing an item-attribute min/max field', () => {
    it.each([
        ['0', 0],
        ['120', 120],
        ['-5', -5],
        ['2.5', 2.5],
        ['  40  ', 40],
    ])('Given the input "%s" / When parsed / Then it becomes %s', (raw, expected) => {
        expect(toBound(raw)).toBe(expected);
    });

    it.each(['', '   '])('Given a blank input "%s" / When parsed / Then there is no bound (null)', (raw) => {
        expect(toBound(raw)).toBeNull();
    });

    it.each(['1e999', '-1e999', 'abc', '12kg'])(
        'Given "%s", which is not a finite number / When parsed / Then there is no bound (null) rather than Infinity or NaN',
        (raw) => {
            expect(toBound(raw)).toBeNull();
        },
    );
});
