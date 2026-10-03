/**
 * BDD spec — daily rates helpers (shift, CSV round-trip, review summary, chunking)
 */
import { describe, it, expect } from 'vitest';
import {
  applyShift, chunk, currentPrice, parseCsv, parseRatesCsv, reviewSummary, shiftPrice, toRatesCsv,
} from './rateBoard';

const rows = (): any[] => [
  { item_id: 'i-1', variant_id: null, item_name: 'Widget A', sku: 'WA', unit: 'kg', price: 100, previous_price: 90, effective_from: null, change_pct: null },
  { item_id: 'i-2', variant_id: 'v-1', item_name: 'Widget, "B"', sku: 'WB-L', unit: 'pc', price: 50, previous_price: 50, effective_from: null, change_pct: 0 },
  { item_id: 'i-3', variant_id: null, item_name: 'Unpriced', sku: null, unit: null, price: null, previous_price: null, effective_from: null, change_pct: null },
];

describe('Given a price shift', () => {
  it('When shifting by % or Rs Then the result is rounded and never below zero', () => {
    expect(shiftPrice(100, 'pct', 12.5)).toBe(112.5);
    expect(shiftPrice(33.33, 'pct', 10)).toBe(36.66);
    expect(shiftPrice(10, 'amount', -15)).toBe(0);
  });

  it('When applied to a set of items Then only those rows with a price change', () => {
    const d = applyShift(rows(), {}, new Set(['i-2', 'i-3']), 'amount', 5);
    expect(d).toEqual({ 'i-2:v-1': '55' });
  });

  it('When applied on top of an edit Then the edit is the base', () => {
    expect(applyShift(rows(), { 'i-1': '200' }, null, 'pct', -50)).toMatchObject({ 'i-1': '100', 'i-2:v-1': '25' });
  });

  it('When the amount is zero or not a number Then drafts are unchanged', () => {
    const d = { 'i-1': '7' };
    expect(applyShift(rows(), d, null, 'pct', 0)).toEqual(d);
    expect(applyShift(rows(), d, null, 'pct', NaN)).toEqual(d);
  });

  it('When a draft is invalid Then currentPrice falls back to the loaded price', () => {
    expect(currentPrice(rows()[0], { 'i-1': 'x' })).toBe(100);
    expect(currentPrice(rows()[0], { 'i-1': '-3' })).toBe(100);
    expect(currentPrice(rows()[2], {})).toBeNull();
  });
});

describe('Given the board is exported to CSV', () => {
  it('When exported Then cells are escaped, variants use item:variant and drafts are applied', () => {
    const csv = toRatesCsv(rows(), { 'i-1': '101' });
    expect(csv.split('\n')).toEqual([
      'item_id,sku,name,unit,price',
      'i-1,WA,Widget A,kg,101',
      'i-2:v-1,WB-L,"Widget, ""B""",pc,50',
      'i-3,,Unpriced,,',
      '',
    ]);
  });

  it('When the export is parsed back Then every priced row round-trips with no errors', () => {
    const res = parseRatesCsv(toRatesCsv(rows(), {}), rows());
    expect(res.drafts).toEqual({ 'i-1': '100', 'i-2:v-1': '50' });
    expect(res.errors).toEqual([{ line: 4, message: 'Blank price for Unpriced' }]);
    expect(res.rows).toBe(3);
  });
});

describe('Given a CSV text', () => {
  it('When it has a BOM, CRLF, quoted newlines and blank lines Then parseCsv handles them', () => {
    expect(parseCsv('﻿a,b\r\n"x\ny",2\r\n\r\n')).toEqual([['a', 'b'], ['x\ny', '2']]);
  });

  it('When rows match by SKU in any case Then they become drafts', () => {
    expect(parseRatesCsv('SKU,Price\nwb-l,51\n', rows()).drafts).toEqual({ 'i-2:v-1': '51' });
  });

  it('When rows are bad Then each is reported with its line number', () => {
    const res = parseRatesCsv('sku,price\nZZ,1\nWA,\nWA,-1\nWA,abc\n', rows());
    expect(res.errors.map((e) => `${e.line}:${e.message}`)).toEqual([
      '2:Unknown item ZZ', '3:Blank price for WA', '4:Negative price for WA', '5:Invalid price "abc" for WA',
    ]);
    expect(res.drafts).toEqual({});
  });

  it('When the file is empty or the header is wrong Then one file-level error is returned', () => {
    expect(parseRatesCsv('', rows()).errors).toEqual([{ line: 1, message: 'File is empty' }]);
    expect(parseRatesCsv('name,cost\nA,1', rows()).errors[0].message).toBe('Header must include price and item_id or sku');
  });
});

describe('Given drafts to review', () => {
  it('When summarised Then up/down/unchanged and the largest jump are reported', () => {
    const s = reviewSummary(rows(), { 'i-1': '80', 'i-2:v-1': '50', 'i-3': '10' });
    expect(s).toEqual({ change: 2, up: 1, down: 1, unchanged: 1, largest: { name: 'Widget A', pct: -20 } });
  });

  it('When there are no drafts Then nothing changes', () => {
    expect(reviewSummary(rows(), {})).toEqual({ change: 0, up: 0, down: 0, unchanged: 0, largest: null });
  });
});

describe('Given a long list to save', () => {
  it('When chunked Then pieces keep order and size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
