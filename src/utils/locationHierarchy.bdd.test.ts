import { describe, it, expect } from 'vitest';
import { locationPath, parentError, parentOptions, sortByHierarchy, typeOf, locationTypeLabel } from './locationHierarchy';

const locs = [
    { id: 'zA', name: 'Zone A', location_type: 'zone', is_active: true },
    { id: 'zOff', name: 'Old zone', location_type: 'zone', is_active: false },
    { id: 'a1', name: 'Aisle 1', location_type: 'aisle', parent_location_id: 'zA' },
    { id: 'r1', name: 'Rack 1', location_type: 'rack', parent_location_id: 'a1' },
    { id: 'g', name: 'Dock', location_type: null },
];

describe('Given the warehouse location hierarchy helpers (bd9e7544)', () => {
    it('When a rack picks a parent / Then only active zones and aisles are offered, with their path', () => {
        expect(parentOptions('rack', locs)).toEqual([
            { value: 'zA', label: 'Zone A' },
            { value: 'a1', label: 'Zone A / Aisle 1' },
        ]);
    });

    it('When an aisle picks a parent / Then only zones are offered', () => {
        expect(parentOptions('aisle', locs).map((o) => o.value)).toEqual(['zA']);
    });

    it('When a zone or general location is edited / Then no parent can be picked', () => {
        expect(parentOptions('zone', locs)).toEqual([]);
        expect(parentOptions('general', locs)).toEqual([]);
    });

    it('When an aisle is edited / Then it cannot pick itself or its descendants', () => {
        const withNested = [...locs, { id: 'z2', name: 'Zone 2', location_type: 'zone', parent_location_id: 'a1' }];
        expect(parentOptions('aisle', withNested, 'a1').map((o) => o.value)).toEqual(['zA']);
    });

    it('When a rack has no parent / Then it is flagged; other types are not', () => {
        expect(parentError('rack', null)).toMatch(/zone or aisle/);
        expect(parentError('rack', 'zA')).toBeNull();
        expect(parentError('zone', null)).toBeNull();
    });

    it('When a path loops / Then it stops instead of hanging', () => {
        const byId = new Map([
            ['c1', { id: 'c1', name: 'C1', parent_location_id: 'c2' }],
            ['c2', { id: 'c2', name: 'C2', parent_location_id: 'c1' }],
        ]);
        expect(locationPath('c1', byId)).toBe('C2 / C1');
    });

    it('When locations are listed / Then children follow their parent with increasing depth', () => {
        const rows = sortByHierarchy(locs).map((r) => `${r.loc.id}:${r.depth}`);
        expect(rows).toEqual(['zA:0', 'a1:1', 'r1:2', 'zOff:0', 'g:0']);
    });

    it('When a location has no type (pre-migration) / Then it is a general location', () => {
        expect(typeOf({ location_type: null })).toBe('general');
        expect(locationTypeLabel('rack')).toBe('Rack');
    });
});
