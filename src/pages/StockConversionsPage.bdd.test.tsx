/**
 * BDD spec — StockConversionsPage
 *
 * Invariants:
 *   - Yield % and loss update live from input and output quantities
 *   - Reason defaults to the first 'process' reason; mortality hidden without the flag
 *   - Record is blocked when outputs exceed input; payload sends loss_qty, not yield_pct
 *   - Each form carries a client_ref UUID: reused on retry, renewed after success
 *   - input_item_id is the stock row (variant id for a variant); outputs carry variant_id
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
        { id: 'x-1', warehouse_id: 'w-1', conversion_date: '2026-10-02', input_item_id: 'in-1', input_qty: 10, outputs: [], loss_qty: 2, yield_pct: 80, loss_value: 4 },
    ]));
    h.createStockConversion = vi.fn(() => Promise.resolve({ id: 'x-2' }));
    h.getItemByCode = vi.fn(() => Promise.resolve({ id: 'in-1', name: 'Whole unit', variant_id: null, matched_on: 'barcode' }));
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const scan = async (code: string) => {
    const box = await screen.findByLabelText('Scan barcode');
    fireEvent.change(box, { target: { value: code } });
    fireEvent.keyDown(box, { key: 'Enter' });
};

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
            expect(screen.getByText('in-1')).toBeTruthy(); // server sends no input name
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
                outputs: [{ item_id: 'out-1', variant_id: null, qty: 7.5 }], loss_qty: 2.5, reason_code: 'TRIM',
            });
            expect(body.client_ref).toMatch(UUID);
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

        it('When a failed save is retried Then the same client_ref is resent', async () => {
            h.createStockConversion = vi.fn()
                .mockImplementationOnce(() => Promise.reject(new Error('Network down')))
                .mockImplementation(() => Promise.resolve({ id: 'x-2' }));
            render(<StockConversionsPage />);
            await fillBasic();
            fireEvent.click(screen.getByText('Record conversion'));
            await screen.findByRole('alert');
            fireEvent.click(screen.getByText('Record conversion'));
            await waitFor(() => expect(h.createStockConversion).toHaveBeenCalledTimes(2));
            const [first, second] = h.createStockConversion.mock.calls.map((c: any[]) => c[0].client_ref);
            expect(first).toMatch(UUID);
            expect(second).toBe(first);
        });

        it('When a save succeeds Then the next conversion gets a fresh client_ref', async () => {
            h.pick.push({ id: 'in-1', name: 'Whole unit' }, { id: 'out-1', name: 'Part A' });
            render(<StockConversionsPage />);
            await fillBasic();
            fireEvent.click(screen.getByText('Record conversion'));
            await screen.findByText('Recorded — yield 75.00%');
            await fillBasic();
            fireEvent.click(screen.getByText('Record conversion'));
            await waitFor(() => expect(h.createStockConversion).toHaveBeenCalledTimes(2));
            const [first, second] = h.createStockConversion.mock.calls.map((c: any[]) => c[0].client_ref);
            expect(second).toMatch(UUID);
            expect(second).not.toBe(first);
        });
    });

    describe('Given barcode scanning is enabled', () => {
        it('When the input item is scanned Then it becomes the input', async () => {
            h.flags['submodule:inventory:barcode_scanning'] = true;
            render(<StockConversionsPage />);
            await scan('555');
            await waitFor(() => expect(screen.getAllByTestId('item-picker')[0].textContent).toBe('Whole unit'));
        });

        it('When variants are scanned Then input uses the variant stock row and outputs carry parent + variant', async () => {
            h.flags['submodule:inventory:barcode_scanning'] = true;
            h.getItemByCode = vi.fn()
                .mockResolvedValueOnce({ id: 'p-in', name: 'Whole unit', variant_id: 'v-in', matched_on: 'barcode' })
                .mockResolvedValueOnce({ id: 'p-out', name: 'Part A', variant_id: 'v-out', matched_on: 'sku' });
            render(<StockConversionsPage />);
            await scan('111');
            await waitFor(() => expect(screen.getAllByTestId('item-picker')[0].textContent).toBe('Whole unit'));
            await scan('222');
            await waitFor(() => expect(screen.getAllByTestId('item-picker')[1].textContent).toBe('Part A'));
            fireEvent.change(screen.getByLabelText('Input quantity'), { target: { value: '4' } });
            fireEvent.change(screen.getByLabelText('Output 1 quantity'), { target: { value: '3' } });
            fireEvent.click(screen.getByText('Record conversion'));
            await waitFor(() => expect(h.createStockConversion).toHaveBeenCalledTimes(1));
            expect(h.createStockConversion.mock.calls[0][0]).toMatchObject({
                input_item_id: 'v-in',
                outputs: [{ item_id: 'p-out', variant_id: 'v-out', qty: 3 }],
                loss_qty: 1,
            });
        });
    });
});
