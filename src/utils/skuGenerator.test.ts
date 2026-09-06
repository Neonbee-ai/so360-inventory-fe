import { describe, it, expect } from 'vitest';
import { generateSkuFromName } from './skuGenerator';

describe('generateSkuFromName', () => {
    it('returns empty string for empty or whitespace-only name', () => {
        expect(generateSkuFromName('')).toBe('');
        expect(generateSkuFromName('   ')).toBe('');
    });

    it('converts standard product names to uppercase hyphenated format', () => {
        expect(generateSkuFromName('ABC Office Chair')).toBe('ABC-OFFICE-CHAIR');
        expect(generateSkuFromName('macbook pro 14')).toBe('MACBOOK-PRO-14');
    });

    it('handles special characters and punctuation cleanly', () => {
        expect(generateSkuFromName('Office Chair (Black)')).toBe('OFFICE-CHAIR-BLACK');
        expect(generateSkuFromName('LED Light 24W / Cool White')).toBe('LED-LIGHT-24W-COOL-WHITE');
        expect(generateSkuFromName('Product & Co. @ 2026!')).toBe('PRODUCT-CO-2026');
    });

    it('replaces slashes and underscores with hyphens and collapses duplicates', () => {
        expect(generateSkuFromName('ITEM_NAME//SUB_TYPE')).toBe('ITEM-NAME-SUB-TYPE');
        expect(generateSkuFromName('  --Desk __ Pro--  ')).toBe('DESK-PRO');
    });
});
