/**
 * BDD spec — StockConversionsPage
 *
 * Invariants:
 *   - Yield % and loss update live from input and output quantities
 *   - Reason defaults to the first 'process' reason; mortality hidden without the flag
 *   - Record is blocked when outputs exceed input; payload sends loss_qty, not yield_pct
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const h = vi.hoisted(() => ({
    getLocations: null as any,
    getLossReasons: null as any,
    getStockConversions: null as any,
    createStockConversion: null as any,
    getItemByCode: null as any,
    flags: {} as Record<string, boolean>,
    pick: [] as { id: string; name: string }[],
}));

vi.mock('../services/inventoryService', () => ({
    inventoryService: {
        getLocations: (...a: any[]) => h.getLocations(...a),
        getLossReasons: (...a: any[]) => h.getLossReasons(...a),
        getStockConversions: (...a: any[]) => h.getStockConversions(...a),
        createStockConversion: (...a: any[]) => h.createStockConversion(...a),
        getItemByCode: (...a: any[]) => h.getItemByCode(...a),
    },
}));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ hasPermission: () => true, isFeatureEnabled: (f: string) => h.flags[f] === true }),
}));

// Lightweight picker: a button per instance that selects the next queued item.
vi.mock('../components/ItemSearchSelector', () => ({
    default: ({ onSelect, selectedName }: any) => (
        <button data-testid="item-picker" onClick={() => onSelect(h.pick.shift())}>{selectedName || 'Pick item'}</button>
    ),
}));

import StockConversionsPage from './StockConversionsPage';

beforeEach(() => {
    h.flags = {};
    h.pick = [{ id: 'in-1', name: 'Whole unit' }, { id: 'out-1', name: 'Part A' }, { id: 'out-2', name: 'Part B' }];
    h.getLocations = vi.fn(() => Promise.resolve([{ id: 'w-1', name: 'Main Store' }]));
    h.getLossReasons = vi.fn(() => Promise.resolve([
        { id: 'r0', code: 'DOA', label: 'Dead on arrival', category: 'mortality' },
        { id: 'r1', code: 'SPOIL', label: 'Spoiled', category: 'spoilage' },
        { id: 'r2', code: 'TRIM', label: 'Trim loss', category: 'process' },
    ]));
    h.getStockConversions = vi.fn(() => Promise.resolve([
        { id: 'x-1', warehouse_id: 'w-1', conversion_date: '2026-10-02', input_item_id: 'in-1', input_item_name: 'Whole unit', input_qty: 10, outputs: [], loss_qty: 2, yield_pct: 80 },
    ]));
    h.createStockConversion = vi.fn(() => Promise.resolve({ id: 'x-2' }));
    h.getItemByCode = vi.fn(() => Promise.resolve({ id: 'in-1', name: 'Whole unit' }));
});

const fillBasic = async () => {
    const pickers = await screen.findAllByTestId('item-picker');
    fireEvent.click(pickers[0]);
    fireEvent.change(screen.getByLabelText('Input quantity'), { target: { value: '10' } });
    fireEvent.click(screen.getAllByTestId('item-picker')[1]);
    fireEvent.change(screen.getByLabelText('Output 1 quantity'), { target: { value: '7.5' } });
};

describe('StockConversionsPage', () => {
    describe('Given the page opens', () => {
        it('When reasons load Then the process reason is preselected and mortality is hidden', async () => {
            render(<StockConversionsPage />);
            await waitFor(() => expect((screen.getByLabelText('Loss reason') as HTMLSelectElement).value).toBe('TRIM'));
            const opts = [...(screen.getByLabelText('Loss reason') as HTMLSelectElement).options].map((o) => o.value);
            expect(opts).not.toContain('DOA');
            expect((screen.getByLabelText('Warehouse') as HTMLSelectElement).value).toBe('w-1');
        });
        it('When recent conversions exist Then they are listed with yield', async () => {
            render(<StockConversionsPage />);
            expect(await screen.findByText('80.00%')).toBeTruthy();
        });
    });

    describe('Given input and output quantities', () => {
        it('When typed Then yield and loss update live', async () => {
            render(<StockConversionsPage />);
            await fillBasic();
            expect(screen.getByTestId('yield-pct').textContent).toBe('75.00%');
            expect(screen.getByTestId('loss-qty').textContent).toBe('2.5');
        });

        it('When a second output is added Then it counts towards the yield', async () => {
            render(<StockConversionsPage />);
            await fillBasic();
            fireEvent.click(screen.getByText('Add output'));
            fireEvent.click(screen.getAllByTestId('item-picker')[2]);
            fireEvent.change(screen.getByLabelText('Output 2 quantity'), { target: { value: '2' } });
            expect(screen.getByTestId('yield-pct').textContent).toBe('95.00%');
            fireEvent.click(screen.getByLabelText('Remove output 2'));
            expect(screen.getByTestId('yield-pct').textContent).toBe('75.00%');
        });

        it('When outputs exceed input Then Record is disabled', async () => {
            render(<StockConversionsPage />);
            await fillBasic();
            fireEvent.change(screen.getByLabelText('Output 1 quantity'), { target: { value: '12' } });
            expect(screen.getByText('Outputs exceed the input quantity')).toBeTruthy();
            expect((screen.getByText('Record conversion') as HTMLButtonElement).disabled).toBe(true);
        });

        it('When Record is tapped Then the conversion is sent with loss_qty and the form resets', async () => {
            render(<StockConversionsPage />);
            await waitFor(() => expect((screen.getByLabelText('Loss reason') as HTMLSelectElement).value).toBe('TRIM'));
            await fillBasic();
            fireEvent.click(screen.getByText('Record conversion'));
            await waitFor(() => expect(h.createStockConversion).toHaveBeenCalledTimes(1));
            const body = h.createStockConversion.mock.calls[0][0];
            expect(body).toMatchObject({
                warehouse_id: 'w-1', input_item_id: 'in-1', input_qty: 10,
                outputs: [{ item_id: 'out-1', qty: 7.5 }], loss_qty: 2.5, reason_code: 'TRIM',
            });
            expect(body).not.toHaveProperty('yield_pct');
            expect(await screen.findByText('Recorded — yield 75.00%')).toBeTruthy();
            expect((screen.getByLabelText('Input quantity') as HTMLInputElement).value).toBe('');
        });

        it('When saving fails Then the error is shown', async () => {
            h.createStockConversion = vi.fn(() => Promise.reject(new Error('Insufficient stock')));
            render(<StockConversionsPage />);
            await fillBasic();
            fireEvent.click(screen.getByText('Record conversion'));
            expect((await screen.findByRole('alert')).textContent).toBe('Insufficient stock');
        });
    });

    describe('Given barcode scanning is enabled', () => {
        it('When the input item is scanned Then it becomes the input', async () => {
            h.flags['submodule:inventory:barcode_scanning'] = true;
            render(<StockConversionsPage />);
            const scan = await screen.findByLabelText('Scan barcode');
            fireEvent.change(scan, { target: { value: '555' } });
            fireEvent.keyDown(scan, { key: 'Enter' });
            await waitFor(() => expect(screen.getAllByTestId('item-picker')[0].textContent).toBe('Whole unit'));
        });
    });
});
