import { describe, it, expect } from 'vitest';
import { parseImageName, planImages, classifyImage, countKeys, importableRowKeyCounts, nameKey, nameKeyFromFilename, rowNameKey } from './nameKey';

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

describe('parseImageName', () => {
    const rows = (...names: string[]) => countKeys(names);
    it('GIVEN Chair_2.jpg WHEN parsed THEN base is chair and position 2', () => {
        expect(parseImageName('Chair_2.jpg', rows('chair'))).toEqual({ key: 'chair', seq: 2 });
        expect(parseImageName('Chair-3.PNG', rows('chair'))).toEqual({ key: 'chair', seq: 3 });
        expect(parseImageName('Chair _ 10.jpg', rows('chair'))).toEqual({ key: 'chair', seq: 10 });
    });
    it('GIVEN a plain name WHEN parsed THEN it is the primary (position 1)', () => {
        expect(parseImageName('Chair.jpg', rows('chair'))).toEqual({ key: 'chair', seq: 1 });
    });
    it('GIVEN a filename that is exactly a product name WHEN parsed THEN the full name wins over the suffix', () => {
        expect(parseImageName('Model-3.jpg', rows('model-3', 'model'))).toEqual({ key: 'model-3', seq: 1 });
    });
    it('GIVEN _0 or a space-separated number WHEN parsed THEN no suffix is read', () => {
        expect(parseImageName('Chair_0.jpg', rows('chair')).key).toBe('chair_0');
        expect(parseImageName('Chair 2.jpg', rows('chair')).key).toBe('chair 2');
    });
});

describe('planImages', () => {
    const rows = (...names: string[]) => countKeys(names);
    const statusOf = (names: string[], rowNames: string[], key = 'chair') => planImages(names, rows(...rowNames)).groups.get(key)!;

    it('GIVEN primary + numbered images WHEN planned THEN matched and ordered by number', () => {
        const g = statusOf(['Chair_3.jpg', 'Chair.jpg', 'Chair_2.jpg'], ['chair']);
        expect(g.status).toBe('matched');
        expect(g.ordered).toEqual(['Chair.jpg', 'Chair_2.jpg', 'Chair_3.jpg']);
        expect(g.gaps).toEqual([]);
    });
    it('GIVEN a skipped number WHEN planned THEN the gap is reported', () => {
        expect(statusOf(['Chair.jpg', 'Chair_4.jpg'], ['chair']).gaps).toEqual([2, 3]);
    });
    it('GIVEN only numbered images WHEN planned THEN missing_primary', () => {
        expect(statusOf(['Chair_2.jpg'], ['chair']).status).toBe('missing_primary');
    });
    it('GIVEN two files at one position WHEN planned THEN duplicate_image for the product', () => {
        const plan = planImages(['Chair.jpg', 'Chair_1.png'], rows('chair'));
        expect(plan.groups.get('chair')!.status).toBe('duplicate_image');
        expect(plan.entries.every(e => e.match === 'duplicate_image')).toBe(true);
    });
    it('GIVEN a product name shared by two rows WHEN planned THEN ambiguous', () => {
        expect(statusOf(['Chair.jpg'], ['chair', 'chair']).status).toBe('ambiguous');
    });
    it('GIVEN no product with that name WHEN planned THEN no_match', () => {
        expect(statusOf(['Stool_2.jpg'], ['chair'], 'stool').status).toBe('no_match');
    });
});
