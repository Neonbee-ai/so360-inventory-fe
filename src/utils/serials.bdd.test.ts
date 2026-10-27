import { describe, it, expect } from 'vitest';
import {
    isSerialTrackingEnabled, validateSerialSelection, toggleSerial, summariseSerials, serialStatusLabel,
} from './serials';

describe('serial helpers', () => {
    it('Given no bridge fn / When flag checked / Then off; explicit true turns on', () => {
        expect(isSerialTrackingEnabled(undefined)).toBe(false);
        expect(isSerialTrackingEnabled({})).toBe(false);
        expect(isSerialTrackingEnabled({ isFeatureEnabled: () => { throw new Error('x'); } })).toBe(false);
        expect(isSerialTrackingEnabled({ isFeatureEnabled: (k: string) => k === 'submodule:inventory:serial_tracking' })).toBe(true);
    });

    it('Given qty 2 / When 1 picked / Then message; when 2 picked Then null; qty 0 Then null', () => {
        expect(validateSerialSelection(['A'], 2)).toBe('Select exactly 2 serial numbers (1 selected).');
        expect(validateSerialSelection(['A'], 1)).toBeNull();
        expect(validateSerialSelection(['A', 'B'], -2)).toBeNull();
        expect(validateSerialSelection([], 0)).toBeNull();
        expect(validateSerialSelection(['A', 'B'], 1)).toContain('1 serial number ');
    });

    it('Given a selection / When toggled / Then added once and removed on second toggle', () => {
        expect(toggleSerial([], 'A')).toEqual(['A']);
        expect(toggleSerial(['A', 'B'], 'A')).toEqual(['B']);
    });

    it('Given rows / When summarised / Then counts sold and warranty buckets', () => {
        const s = summariseSerials([
            { id: '1', item_id: 'i', serial_number: 'a', status: 'issued', sold_at: 'd', warranty_status: 'in_warranty' },
            { id: '2', item_id: 'i', serial_number: 'b', status: 'issued', sold_at: 'd', warranty_status: 'out_of_warranty' },
            { id: '3', item_id: 'i', serial_number: 'c', status: 'in_stock', warranty_status: 'not_sold' },
        ]);
        expect(s).toEqual({ total: 3, sold: 2, inWarranty: 1, outOfWarranty: 1 });
    });

    it('Given statuses / When labelled / Then known, unknown and empty', () => {
        expect(serialStatusLabel('issued')).toBe('Sold / issued');
        expect(serialStatusLabel('on_hold')).toBe('on hold');
        expect(serialStatusLabel(null)).toBe('—');
    });
});
