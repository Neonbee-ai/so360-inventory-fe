import { describe, it, expect } from 'vitest';
import { embeddedPan, gstinCheckChar, gstinIssue, normalizeTaxId, panIssue, taxIdIssues } from './taxIdentifiers';

/** BDD: GSTIN/PAN rules — must agree with so360-inventory-be tax-identifiers (Pulse 086d33b1). Synthetic fixtures. */
const GSTIN = '27AAPFU0939F1ZV';
const PAN = 'AAPFU0939F';

describe('Given GSTIN/PAN input', () => {
    it('When pasted with spaces, NBSP, zero-width chars and lower case / Then normalised to the bare upper-case value', () => {
        expect(normalizeTaxId(' 27 aapfu 0939f​1zv ')).toBe(GSTIN);
    });
    it('When blank, null or not text / Then null', () => {
        expect(normalizeTaxId('  ')).toBeNull();
        expect(normalizeTaxId(undefined)).toBeNull();
        expect(normalizeTaxId(7)).toBeNull();
    });
    it('When the check character is computed / Then it matches a valid GSTIN and rejects junk', () => {
        expect(gstinCheckChar(GSTIN.slice(0, 14))).toBe('V');
        expect(gstinCheckChar('27AAP')).toBeNull();
        expect(gstinCheckChar('27AAPFU0939F1-')).toBeNull();
    });
    it('When the embedded PAN is read / Then characters 3-12 return, or null if too short', () => {
        expect(embeddedPan(GSTIN)).toBe(PAN);
        expect(embeddedPan('27A')).toBeNull();
    });
    it('When a valid GSTIN and its own PAN are checked / Then there is no issue', () => {
        expect(taxIdIssues(GSTIN, PAN)).toEqual([]);
    });
    it('When the PAN differs from the embedded one / Then a pan_mismatch naming the embedded PAN', () => {
        const [i] = taxIdIssues(GSTIN, 'ABCDE1234F');
        expect(i).toMatchObject({ field: 'pan_number', code: 'pan_mismatch' });
        expect(i.message).toContain(`(${PAN})`);
    });
    it('When the check character is wrong / Then gstin_checksum, unless checksum is off', () => {
        expect(gstinIssue('27AAPFU0939F1ZA')?.code).toBe('gstin_checksum');
        expect(gstinIssue('27AAPFU0939F1ZA', { checksum: false })).toBeNull();
    });
    it('When both values are malformed / Then two format issues and no mismatch', () => {
        expect(taxIdIssues('27AAP', 'AAP').map((i) => i.code)).toEqual(['gstin_format', 'pan_format']);
        expect(panIssue(null)).toBeNull();
        expect(gstinIssue(null)).toBeNull();
    });
});
