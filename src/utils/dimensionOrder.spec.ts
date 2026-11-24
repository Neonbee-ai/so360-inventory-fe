import { describe, it, expect } from 'vitest';
import { dimensionRole, orderAttributesForDisplay, orderWithDimensions } from './dimensionOrder';

describe('Given dimensionRole (Pulse f2493088)', () => {
    it('When a name is Length / Breadth / Width or L / B / W / Then it maps to that role', () => {
        expect(dimensionRole('Length')).toBe('length');
        expect(dimensionRole('b')).toBe('breadth');
        expect(dimensionRole('W')).toBe('width');
    });
    it('When a name carries a unit or qualifier / Then the role is still found', () => {
        expect(dimensionRole('length_mm')).toBe('length');
        expect(dimensionRole('Overall Width (cm)')).toBe('width');
        expect(dimensionRole('itemHeight')).toBe('height');
        expect(dimensionRole('depth')).toBe('depth');
    });
    it('When a name is not a plain dimension / Then null', () => {
        expect(dimensionRole('Seat Height')).toBeNull();
        expect(dimensionRole('Rack Number')).toBeNull();
        expect(dimensionRole(undefined, null, '')).toBeNull();
    });
    it('When the first name says nothing / Then the next one is used', () => {
        expect(dimensionRole('attr_1', 'Breadth')).toBe('breadth');
    });
});

describe('Given orderWithDimensions', () => {
    it('When nothing is a dimension / Then the same array comes back', () => {
        const items = ['a', 'b'];
        expect(orderWithDimensions(items, () => null)).toBe(items);
    });
    it('When dimensions are scattered / Then they gather at the first one in L, B, W, H order', () => {
        expect(orderWithDimensions(['Colour', 'Height', 'Width', 'Material', 'Length', 'Breadth'], (n) => dimensionRole(n)))
            .toEqual(['Colour', 'Length', 'Breadth', 'Width', 'Height', 'Material']);
    });
});

describe('Given orderAttributesForDisplay', () => {
    it('When attributes are missing / Then an empty list', () => {
        expect(orderAttributesForDisplay(null)).toEqual([]);
        expect(orderAttributesForDisplay(undefined)).toEqual([]);
    });
    it('When sort_order differs / Then it is respected for non-dimension fields', () => {
        const out = orderAttributesForDisplay([
            { field_name: 'material', label: 'Material', sort_order: 2 },
            { field_name: 'colour', label: 'Colour', sort_order: 1 },
            { field_name: 'rack', label: 'Rack', sort_order: null },
        ]);
        expect(out.map((a) => a.field_name)).toEqual(['rack', 'colour', 'material']);
    });
    it('When the key is generic but the label is a dimension / Then the label decides', () => {
        const out = orderAttributesForDisplay([
            { field_name: 'attr_w', label: 'Width', sort_order: 1 },
            { field_name: 'attr_l', label: 'Length', sort_order: 2 },
        ]);
        expect(out.map((a) => a.label)).toEqual(['Length', 'Width']);
    });
    it('When the furniture fields tie / Then Length, Breadth, Height precede Colour / Finish and the input is untouched', () => {
        const input = [
            { field_name: 'breadth', label: 'Breadth', sort_order: 0 },
            { field_name: 'height', label: 'Height', sort_order: 0 },
            { field_name: 'length', label: 'Length', sort_order: 0 },
            { field_name: 'colour_finish', label: 'Colour / Finish', sort_order: 0 },
        ];
        const out = orderAttributesForDisplay(input);
        expect(out.map((a) => a.label)).toEqual(['Length', 'Breadth', 'Height', 'Colour / Finish']);
        expect(input[0].label).toBe('Breadth');
    });
});
