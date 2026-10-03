/**
 * BDD spec — loss & yield helpers
 */
import { describe, it, expect } from 'vitest';
import {
    changedCountLines,
    conversionYield,
    effectiveLine,
    isFlagOn,
    lineKey,
    linesMissingReason,
    parseQty,
    shiftDays,
    varianceOf,
    visibleReasons,
} from './lossYield';

const reasons = [
    { id: '1', code: 'TRIM', label: 'Trim', category: 'process' as const },
    { id: '2', code: 'DOA', label: 'Dead on arrival', category: 'mortality' as const },
    { id: '3', code: 'OLD', label: 'Retired', category: 'other' as const, is_active: false },
];

describe('lossYield helpers', () => {
    describe('Given a list of loss reasons', () => {
        it('When mortality tracking is off Then mortality and inactive reasons are hidden', () => {
            expect(visibleReasons(reasons, false).map((r) => r.code)).toEqual(['TRIM']);
        });
        it('When mortality tracking is on Then mortality reasons are shown', () => {
            expect(visibleReasons(reasons, true).map((r) => r.code)).toEqual(['TRIM', 'DOA']);
        });
    });

    describe('Given a shell bridge', () => {
        it('When the flag is enabled Then isFlagOn is true, otherwise false', () => {
            expect(isFlagOn({ isFeatureEnabled: () => true }, 'x')).toBe(true);
            expect(isFlagOn({ isFeatureEnabled: () => undefined }, 'x')).toBe(false);
            expect(isFlagOn(null, 'x')).toBe(false);
        });
    });

    describe('Given typed quantities', () => {
        it('When blank, invalid or negative Then parseQty returns null', () => {
            expect(parseQty('')).toBeNull();
            expect(parseQty('abc')).toBeNull();
            expect(parseQty('-1')).toBeNull();
            expect(parseQty('2.5')).toBe(2.5);
            expect(parseQty('0')).toBe(0);
        });
        it('When an actual is entered Then variance is actual minus expected', () => {
            expect(varianceOf(10, 8.5)).toBe(-1.5);
            expect(varianceOf(10, null)).toBeNull();
        });
    });

    describe('Given count lines with local drafts', () => {
        const lines = [
            { item_id: 'a', expected_qty: 10, actual_qty: null },
            { item_id: 'b', variant_id: 'v', expected_qty: 5, actual_qty: 5, reason_code: null },
            { item_id: 'c', expected_qty: 3, actual_qty: 2, reason_code: 'TRIM' },
        ];
        it('When keyed Then variant lines use item:variant', () => {
            expect(lineKey(lines[1])).toBe('b:v');
            expect(lineKey(lines[0])).toBe('a');
        });
        it('When a draft overrides actual Then the effective line uses it', () => {
            expect(effectiveLine(lines[0], { actual: '7' })).toEqual({ actual: 7, reason: null, variance: -3 });
        });
        it('When only changed lines are collected Then unchanged drafts are skipped', () => {
            const out = changedCountLines(lines, { a: { actual: '9', reason: 'TRIM' }, 'b:v': { actual: '5' }, c: { reason: 'TRIM' } });
            expect(out).toEqual([{ item_id: 'a', variant_id: null, actual_qty: 9, reason_code: 'TRIM' }]);
        });
        it('When a variance has no reason Then the line is reported missing', () => {
            const missing = linesMissingReason(lines, { a: { actual: '9' } });
            expect(missing.map((l) => l.item_id)).toEqual(['a']);
        });
    });

    describe('Given a conversion', () => {
        it('When outputs are less than input Then loss and yield are computed', () => {
            expect(conversionYield(10, [6, 2.5, null])).toEqual({ output: 8.5, loss: 1.5, yieldPct: 85 });
        });
        it('When there is no input Then loss and yield are null', () => {
            expect(conversionYield(null, [1])).toEqual({ output: 1, loss: null, yieldPct: null });
        });
        it('When outputs exceed input Then loss is negative', () => {
            expect(conversionYield(4, [5]).loss).toBe(-1);
        });
    });

    describe('Given an ISO date', () => {
        it('When shifted Then it crosses month boundaries', () => {
            expect(shiftDays('2026-10-01', -1)).toBe('2026-09-30');
        });
    });
});
