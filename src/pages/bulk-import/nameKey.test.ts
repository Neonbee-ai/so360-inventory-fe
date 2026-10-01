import { describe, it, expect } from 'vitest';
import { classifyImage, countKeys, importableRowKeyCounts, nameKey, nameKeyFromFilename, rowNameKey } from './nameKey';

describe('nameKey', () => {
    it('GIVEN mixed case and spacing WHEN normalized THEN trimmed, lower-cased and whitespace-collapsed', () => {
        expect(nameKey('  Namur   SOFA ')).toBe('namur sofa');
        expect(nameKey(undefined)).toBe('');
    });

    it('GIVEN near-identical names WHEN normalized THEN punctuation keeps them distinct', () => {
        expect(nameKey('Sofa-2')).not.toBe(nameKey('Sofa 2'));
        expect(nameKey('Sofa')).not.toBe(nameKey('Sofa Cushion'));
    });
});

describe('nameKeyFromFilename', () => {
    it('GIVEN a filename WHEN keyed THEN only the last extension is removed', () => {
        expect(nameKeyFromFilename('Namur Sofa.jpg')).toBe('namur sofa');
        expect(nameKeyFromFilename('Table 2.5m.JPG')).toBe('table 2.5m');
        expect(nameKeyFromFilename('Sofa')).toBe('sofa');
    });
});

describe('rowNameKey', () => {
    it('GIVEN a backend name_key WHEN read THEN it wins over the name', () => {
        expect(rowNameKey({ data: { name: 'Other', name_key: 'sofa' } })).toBe('sofa');
    });
    it('GIVEN no name_key WHEN read THEN it is derived from the name', () => {
        expect(rowNameKey({ data: { name: ' Sofa  Bed' } })).toBe('sofa bed');
    });
});

describe('classifyImage', () => {
    const rows = importableRowKeyCounts([
        { status: 'valid', data: { name: 'Sofa' } },
        { status: 'warning', data: { name: 'Chair' } },
        { status: 'warning', data: { name: 'chair' } },
        { status: 'error', data: { name: 'Lamp' } },
    ]);

    it('GIVEN one importable row WHEN one image has its name THEN matched', () => {
        expect(classifyImage('sofa', rows, countKeys(['sofa']))).toBe('matched');
    });
    it('GIVEN no row with that name WHEN classified THEN no_match', () => {
        expect(classifyImage('table', rows, countKeys(['table']))).toBe('no_match');
        expect(classifyImage('', rows, countKeys(['']))).toBe('no_match');
    });
    it('GIVEN an error row WHEN an image has its name THEN no_match', () => {
        expect(classifyImage('lamp', rows, countKeys(['lamp']))).toBe('no_match');
    });
    it('GIVEN two rows share the name WHEN classified THEN ambiguous', () => {
        expect(classifyImage('chair', rows, countKeys(['chair']))).toBe('ambiguous');
    });
    it('GIVEN two images share the name WHEN classified THEN duplicate_image', () => {
        expect(classifyImage('sofa', rows, countKeys(['sofa', 'sofa']))).toBe('duplicate_image');
    });
});
