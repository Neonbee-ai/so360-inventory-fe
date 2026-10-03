/**
 * BDD spec — Stock Movement Register helpers (conversion type, loss filter)
 */
import { describe, it, expect } from 'vitest';
import {
    CLIENT_FILTER_LIMIT, applyClientFilters, isConversion, lossFilterParams, matchesLossFilter,
    movementTypeOf, parseLossFilter, serverFilters, type LossFilter,
} from './movementRegister';

const reasons: any[] = [
    { id: 'r1', code: 'SPOIL', label: 'Spoiled', category: 'spoilage' },
    { id: 'r2', code: 'TRIM', label: 'Trim loss', category: 'process' },
];
const rows = (): any[] => [
    { id: 'm1', item_id: 'i-1', quantity: -5, reason_code: 'CONVERSION', source_label: 'stock_conversion:c1', movement_type: 'outbound' },
    { id: 'm2', item_id: 'i-2', quantity: 4, reason_code: null, source_label: 'stock_conversion:c1', movement_type: 'inbound' },
    { id: 'm3', item_id: 'i-1', quantity: -2, reason_code: 'SPOIL', source_label: 'stock_count:k1', movement_type: 'adjustment' },
    { id: 'm4', item_id: 'i-1', quantity: -1, reason_code: 'ODD', source_label: 'stock_count:k1', movement_type: 'adjustment' },
    { id: 'm5', item_id: 'i-3', quantity: -3, reason_code: 'SALES_DISPATCH', source_label: null, movement_type: 'outbound' },
    { id: 'm6', item_id: 'i-1', quantity: 2, reason_code: 'SPOIL', source_label: null, movement_type: 'adjustment' },
];
const lf = (p: Partial<LossFilter>): LossFilter => ({ groupBy: 'reason', key: 'SPOIL', label: 'Spoiled', from: '2026-09-01', to: '2026-09-30', ...p });
const ids = (r: any[]) => r.map((m) => m.id);

describe('Given movements written by a conversion', () => {
    it('When classified Then both legs are conversions by reason or source label', () => {
        expect(isConversion(rows()[0])).toBe(true);
        expect(isConversion(rows()[1])).toBe(true);
        expect(isConversion(rows()[2])).toBe(false);
        expect(movementTypeOf(rows()[1])).toBe('conversion');
        expect(movementTypeOf(rows()[2])).toBe('adjustment');
    });
    it('When the conversion type is chosen Then only conversion rows remain', () => {
        expect(ids(applyClientFilters(rows(), 'conversion', null, reasons))).toEqual(['m1', 'm2']);
        expect(applyClientFilters(rows(), '', null, reasons)).toHaveLength(6);
    });
});

describe('Given server filters', () => {
    it('When the conversion type is chosen Then it is not sent and the page is widened', () => {
        expect(serverFilters({ movement_type: 'conversion', warehouse_id: 'w-1', reference_number: '' }, null))
            .toEqual({ warehouse_id: 'w-1', limit: CLIENT_FILTER_LIMIT });
    });
    it('When a loss row is set Then the report range replaces the dates and the page is widened', () => {
        expect(serverFilters({ movement_type: '', date_from: '2026-01-01' }, lf({ groupBy: 'item', key: 'i-1' })))
            .toEqual({ date_from: '2026-09-01', date_to: '2026-09-30', limit: CLIENT_FILTER_LIMIT });
    });
    it('When nothing client-side is active Then filters pass through unchanged', () => {
        expect(serverFilters({ movement_type: 'inbound', project_id: '' }, null)).toEqual({ movement_type: 'inbound' });
    });
});

describe('Given a tapped loss row', () => {
    it('When grouped by reason Then only outgoing movements with that reason match', () => {
        expect(ids(rows().filter((m) => matchesLossFilter(m, lf({}), reasons)))).toEqual(['m3']);
    });
    it('When grouped by item Then outgoing movements of that item match', () => {
        expect(ids(rows().filter((m) => matchesLossFilter(m, lf({ groupBy: 'item', key: 'i-1' }), reasons)))).toEqual(['m1', 'm3', 'm4']);
    });
    it('When the item row is a variant Then movements of that variant match', () => {
        const m = { item_id: 'i-9', variant_id: 'v-9', quantity: -1 };
        expect(matchesLossFilter(m, lf({ groupBy: 'item', key: 'v-9' }), reasons)).toBe(true);
        expect(matchesLossFilter(m, lf({ groupBy: 'item', key: 'v-8' }), reasons)).toBe(false);
    });
    it('When grouped by category Then the catalog category decides, and uncatalogued count reasons are "other"', () => {
        expect(ids(rows().filter((m) => matchesLossFilter(m, lf({ groupBy: 'category', key: 'spoilage' }), reasons)))).toEqual(['m3']);
        expect(ids(rows().filter((m) => matchesLossFilter(m, lf({ groupBy: 'category', key: 'other' }), reasons)))).toEqual(['m4']);
    });
    it('When the reason is UNSPECIFIED Then outgoing rows without a reason match', () => {
        const r = [{ id: 'x', item_id: 'i', quantity: -1, reason_code: null }];
        expect(matchesLossFilter(r[0], lf({ key: 'UNSPECIFIED' }), reasons)).toBe(true);
    });
});

describe('Given the loss filter in the URL', () => {
    it('When written and read back Then it round-trips', () => {
        const f = lf({ groupBy: 'category', key: 'spoilage', label: 'Spoilage' });
        expect(parseLossFilter(new URLSearchParams(lossFilterParams(f)))).toEqual(f);
    });
    it('When the grouping is missing or unknown Then there is no filter', () => {
        expect(parseLossFilter(new URLSearchParams('loss_key=SPOIL'))).toBeNull();
        expect(parseLossFilter(new URLSearchParams('loss_by=x&loss_key=SPOIL'))).toBeNull();
        expect(lossFilterParams(null)).toEqual({ loss_by: '', loss_key: '', loss_label: '', from: '', to: '' });
    });
});
