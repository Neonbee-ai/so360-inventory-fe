/**
 * BDD spec — loss & yield helpers
 */
import { describe, it, expect } from 'vitest';
import {
    changedCountLines,
    conversionYield,
    effectiveLine,
    hideMortality,
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

    describe('Given a loss summary with mortality rows', () => {
        const reasons: any[] = [
            { id: 'r0', code: 'DOA', label: 'Dead on arrival', category: 'mortality' },
            { id: 'r1', code: 'SPOIL', label: 'Spoiled', category: 'spoilage' },
        ];
        const summary = (rows: any[]) => ({ total_value: 130, total_qty: 13, rows, trend: [{ date: '2026-10-01', value: 130 }] });

        it('When grouped by reason Then mortality reason rows and their totals are removed', () => {
            const out = hideMortality(summary([
                { key: 'DOA', label: 'Dead on arrival', qty: 3, value: 30.1 },
                { key: 'SPOIL', label: 'Spoiled', qty: 10, value: 99.9 },
            ]), 'reason', reasons);
            expect(out.rows.map((r) => r.key)).toEqual(['SPOIL']);
            expect(out.total_qty).toBe(10);
            expect(out.total_value).toBe(99.9);
            expect(out.trend).toHaveLength(1);
        });
        it('When grouped by category Then the mortality key is removed', () => {
            const out = hideMortality(summary([
                { key: 'mortality', label: 'Mortality', qty: 3, value: 30 },
                { key: 'spoilage', label: 'Spoilage', qty: 10, value: 100 },
            ]), 'category', []);
            expect(out.rows.map((r) => r.key)).toEqual(['spoilage']);
            expect(out.total_value).toBe(100);
        });
        it('When grouped by item Then the summary is unchanged', () => {
            const s = summary([{ key: 'i-1', label: 'A', qty: 13, value: 130 }]);
            expect(hideMortality(s, 'item', reasons)).toBe(s);
        });
    });
});
