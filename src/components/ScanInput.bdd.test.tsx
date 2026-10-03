/**
 * BDD spec — ScanInput
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const h = vi.hoisted(() => ({ getItemByCode: null as any }));

vi.mock('../services/inventoryService', () => ({
    inventoryService: { getItemByCode: (...a: any[]) => h.getItemByCode(...a) },
}));

import ScanInput from './ScanInput';

const scan = (code: string) => {
    const input = screen.getByLabelText('Scan barcode');
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: 'Enter' });
    return input as HTMLInputElement;
};

beforeEach(() => {
    h.getItemByCode = vi.fn((code: string) =>
        Promise.resolve(code === '123' ? { id: 'i-1', name: 'Widget A' } : null));
});

describe('ScanInput', () => {
    describe('Given a known barcode', () => {
        it('When scanned with Enter Then onScan receives the item and the field clears', async () => {
            const onScan = vi.fn();
            render(<ScanInput onScan={onScan} />);
            const input = scan('123');
            await waitFor(() => expect(onScan).toHaveBeenCalledWith({ id: 'i-1', name: 'Widget A' }));
            expect(h.getItemByCode).toHaveBeenCalledWith('123');
            expect(input.value).toBe('');
            expect(screen.getByRole('status').textContent).toBe('Widget A');
        });
    });

    describe('Given an unknown barcode', () => {
        it('When scanned Then onNotFound is called and a message shows', async () => {
            const onScan = vi.fn();
            const onNotFound = vi.fn();
            render(<ScanInput onScan={onScan} onNotFound={onNotFound} />);
            scan('999');
            await waitFor(() => expect(onNotFound).toHaveBeenCalledWith('999'));
            expect(onScan).not.toHaveBeenCalled();
            expect(screen.getByRole('status').textContent).toBe('No item for 999');
        });
    });

    describe('Given a failing lookup', () => {
        it('When scanned Then the error text is shown', async () => {
            h.getItemByCode = vi.fn(() => Promise.reject(new Error('Network down')));
            render(<ScanInput onScan={vi.fn()} />);
            scan('123');
            await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Network down'));
        });
    });

    describe('Given a blank field', () => {
        it('When Enter is pressed Then no lookup happens', () => {
            render(<ScanInput onScan={vi.fn()} />);
            scan('   ');
            expect(h.getItemByCode).not.toHaveBeenCalled();
        });
    });
});
