/**
 * BDD spec — StockCountSheetPage
 *
 * Invariants:
 *   - Each line shows expected, an actual input and live variance
 *   - A reason picker appears only for a non-zero variance; mortality reasons need the flag
 *   - Save PATCHes only changed lines; Post needs reasons + inline confirmation
 *   - Posted counts are read-only; scanning focuses or appends a line
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const h = vi.hoisted(() => ({
    count: null as any,
    getStockCount: null as any,
    getLocations: null as any,
    getLossReasons: null as any,
    updateStockCount: null as any,
    postStockCount: null as any,
    getItemByCode: null as any,
    flags: {} as Record<string, boolean>,
    navigate: null as any,
}));

vi.mock('../services/inventoryService', () => ({
    inventoryService: {
        getStockCount: (...a: any[]) => h.getStockCount(...a),
        getLocations: (...a: any[]) => h.getLocations(...a),
        getLossReasons: (...a: any[]) => h.getLossReasons(...a),
        updateStockCount: (...a: any[]) => h.updateStockCount(...a),
        postStockCount: (...a: any[]) => h.postStockCount(...a),
        getItemByCode: (...a: any[]) => h.getItemByCode(...a),
    },
}));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ hasPermission: () => true, isFeatureEnabled: (f: string) => h.flags[f] === true }),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => h.navigate,
    useParams: () => ({ id: 'c-1' }),
}));

import StockCountSheetPage from './StockCountSheetPage';

const draftCount = () => ({
    // Server shape: header has warehouse_id only; lines carry no unit.
    id: 'c-1', warehouse_id: 'w-1', count_date: '2026-10-03', status: 'draft', total_variance_value: 0,
    lines: [
        { id: 'l-1', count_id: 'c-1', item_id: 'i-1', variant_id: null, item_name: 'Widget A', sku: 'WA', expected_qty: 10, actual_qty: null, variance_qty: null, reason_code: null, unit_cost: 2, variance_value: null, movement_id: null },
        { id: 'l-2', count_id: 'c-1', item_id: 'i-2', variant_id: 'v-1', item_name: 'Widget B', sku: null, expected_qty: 4, actual_qty: null, variance_qty: null, reason_code: null, unit_cost: 1, variance_value: null, movement_id: null },
    ],
});

beforeEach(() => {
    h.flags = {};
    h.navigate = vi.fn();
    h.count = draftCount();
    h.getStockCount = vi.fn(() => Promise.resolve(h.count));
    h.getLocations = vi.fn(() => Promise.resolve([{ id: 'w-1', name: 'Main Store' }]));
    h.getLossReasons = vi.fn(() => Promise.resolve([
        { id: 'r1', code: 'SPOIL', label: 'Spoiled', category: 'spoilage' },
        { id: 'r2', code: 'DOA', label: 'Dead on arrival', category: 'mortality' },
    ]));
    h.updateStockCount = vi.fn((_id: string, body: any) => Promise.resolve({
        ...h.count,
        lines: h.count.lines.map((l: any) => {
            const u = body.lines.find((x: any) => x.item_id === l.item_id);
            return u ? { ...l, actual_qty: u.actual_qty, reason_code: u.reason_code } : l;
        }),
    }));
    h.postStockCount = vi.fn(() => Promise.resolve({ ...h.count, status: 'posted' }));
    h.getItemByCode = vi.fn(() => Promise.resolve(null));
});

const actual = (name: string) => screen.findByLabelText(`Actual for ${name}`);

describe('StockCountSheetPage', () => {
    describe('Given a count that carries only warehouse_id', () => {
        it('When locations load Then the header shows the warehouse name', async () => {
            render(<StockCountSheetPage />);
            expect(await screen.findByText(/Count — Main Store/)).toBeTruthy();
        });
        it('When locations fail Then a generic label is shown', async () => {
            h.getLocations = vi.fn(() => Promise.reject(new Error('x')));
            render(<StockCountSheetPage />);
            expect(await screen.findByText(/Count — Warehouse/)).toBeTruthy();
        });
    });

    describe('Given a draft count', () => {
        it('When an actual is typed Then the variance updates and a reason picker appears', async () => {
            render(<StockCountSheetPage />);
            fireEvent.change(await actual('Widget A'), { target: { value: '8' } });
            expect(screen.getByTestId('variance-i-1').textContent).toBe('-2');
            const reason = screen.getByLabelText('Reason for Widget A') as HTMLSelectElement;
            expect([...reason.options].map((o) => o.value)).toEqual(['', 'SPOIL']);
            expect(screen.getByText('1 variance need a reason')).toBeTruthy();
        });

        it('When the actual matches expected Then no reason picker shows', async () => {
            render(<StockCountSheetPage />);
            fireEvent.change(await actual('Widget B'), { target: { value: '4' } });
            expect(screen.getByTestId('variance-i-2:v-1').textContent).toBe('0');
            expect(screen.queryByLabelText('Reason for Widget B')).toBeNull();
        });

        it('When mortality tracking is enabled Then mortality reasons are offered', async () => {
            h.flags['action:inventory:loss:mortality_tracking'] = true;
            render(<StockCountSheetPage />);
            fireEvent.change(await actual('Widget A'), { target: { value: '9' } });
            const reason = screen.getByLabelText('Reason for Widget A') as HTMLSelectElement;
            expect([...reason.options].map((o) => o.value)).toContain('DOA');
        });

        it('When Save is tapped Then only changed lines are sent', async () => {
            render(<StockCountSheetPage />);
            fireEvent.change(await actual('Widget B'), { target: { value: '4' } });
            fireEvent.click(screen.getByText('Save (1)'));
            await waitFor(() => expect(h.updateStockCount).toHaveBeenCalledWith('c-1', {
                lines: [{ item_id: 'i-2', variant_id: 'v-1', actual_qty: 4, reason_code: null }],
            }));
            expect(await screen.findByText('Saved 1 line')).toBeTruthy();
        });

        it('When a variance lacks a reason Then Post is disabled', async () => {
            render(<StockCountSheetPage />);
            fireEvent.change(await actual('Widget A'), { target: { value: '8' } });
            expect((screen.getByText('Post').closest('button') as HTMLButtonElement).disabled).toBe(true);
        });

        it('When Post then Confirm post is tapped Then it saves and posts', async () => {
            render(<StockCountSheetPage />);
            fireEvent.change(await actual('Widget A'), { target: { value: '8' } });
            fireEvent.change(screen.getByLabelText('Reason for Widget A'), { target: { value: 'SPOIL' } });
            fireEvent.click(screen.getByText('Post'));
            expect(h.postStockCount).not.toHaveBeenCalled();
            fireEvent.click(screen.getByText('Confirm post'));
            await waitFor(() => expect(h.postStockCount).toHaveBeenCalledWith('c-1'));
            expect(h.updateStockCount).toHaveBeenCalledWith('c-1', {
                lines: [{ item_id: 'i-1', variant_id: null, actual_qty: 8, reason_code: 'SPOIL' }],
            });
            expect(await screen.findByText('Count posted — variances adjusted')).toBeTruthy();
        });

        it('When posting returns 409 Then the error shows and the count reloads', async () => {
            h.postStockCount = vi.fn(() => Promise.reject(Object.assign(new Error('Already posted'), { status: 409 })));
            render(<StockCountSheetPage />);
            fireEvent.change(await actual('Widget B'), { target: { value: '4' } });
            fireEvent.click(screen.getByText('Post'));
            fireEvent.click(screen.getByText('Confirm post'));
            expect((await screen.findByRole('alert')).textContent).toBe('Already posted');
            await waitFor(() => expect(h.getStockCount).toHaveBeenCalledTimes(2));
        });
    });

    describe('Given barcode scanning is enabled', () => {
        it('When an item not on the sheet is scanned Then a line with expected 0 is added', async () => {
            h.flags['submodule:inventory:barcode_scanning'] = true;
            h.getItemByCode = vi.fn(() => Promise.resolve({ id: 'i-3', name: 'Widget C' }));
            render(<StockCountSheetPage />);
            const scan = await screen.findByLabelText('Scan barcode');
            fireEvent.change(scan, { target: { value: '777' } });
            fireEvent.keyDown(scan, { key: 'Enter' });
            expect(await screen.findByTestId('count-line-i-3')).toBeTruthy();
        });

        it('When the flag is off Then no scan field shows', async () => {
            render(<StockCountSheetPage />);
            await actual('Widget A');
            expect(screen.queryByLabelText('Scan barcode')).toBeNull();
        });
    });

    describe('Given a posted count', () => {
        it('When opened Then inputs are read-only and there is no footer', async () => {
            h.count = { ...draftCount(), status: 'posted' };
            render(<StockCountSheetPage />);
            expect(((await actual('Widget A')) as HTMLInputElement).disabled).toBe(true);
            expect(screen.queryByText('Post')).toBeNull();
        });
    });

    describe('Given a filter', () => {
        it('When text is typed Then only matching lines show', async () => {
            render(<StockCountSheetPage />);
            await actual('Widget A');
            fireEvent.change(screen.getByLabelText('Filter lines'), { target: { value: 'wa' } });
            expect(screen.queryByTestId('count-line-i-2:v-1')).toBeNull();
            expect(screen.getByTestId('count-line-i-1')).toBeTruthy();
        });
    });
});

describe('StockCountSheetPage — inside Stock Overview Count mode', () => {
    describe('Given a count id passed by the host page', () => {
        it('When rendered Then that count is loaded instead of the route param', async () => {
            render(<StockCountSheetPage countId="c-7" embedded />);
            await screen.findByText(/Count — Main Store/);
            expect(h.getStockCount).toHaveBeenCalledWith('c-7');
        });
        it('When Back is tapped Then the host back action runs', async () => {
            const onBack = vi.fn();
            render(<StockCountSheetPage countId="c-7" onBack={onBack} embedded />);
            fireEvent.click(await screen.findByLabelText('Back to stock counts'));
            expect(onBack).toHaveBeenCalled();
            expect(h.navigate).not.toHaveBeenCalled();
        });
    });
    describe('Given no host back action', () => {
        it('When Back is tapped Then it returns to the Count mode list', async () => {
            render(<StockCountSheetPage />);
            fireEvent.click(await screen.findByLabelText('Back to stock counts'));
            expect(h.navigate).toHaveBeenCalledWith('/inventory/overview?mode=count');
        });
    });
    describe('Given scan mode (design §9a layout switch)', () => {
        it('When on Then the scan field is large, the filter is hidden and the last scanned line comes first', async () => {
            h.flags['submodule:inventory:barcode_scanning'] = true;
            h.getItemByCode = vi.fn(() => Promise.resolve({ id: 'i-2', variant_id: 'v-1', name: 'Widget B' }));
            const { container } = render(<StockCountSheetPage countId="c-1" embedded scanMode />);
            const scan = await screen.findByLabelText('Scan barcode');
            expect(scan.getAttribute('data-size')).toBe('large');
            expect(screen.queryByLabelText('Filter lines')).toBeNull();
            fireEvent.change(scan, { target: { value: '222' } });
            fireEvent.keyDown(scan, { key: 'Enter' });
            await waitFor(() => {
                const rows = [...container.querySelectorAll('[data-testid^="count-line-"]')].map((r) => r.getAttribute('data-testid'));
                expect(rows).toEqual(['count-line-i-2:v-1', 'count-line-i-1']);
            });
        });
        it('When off Then the normal scan field and the filter show', async () => {
            h.flags['submodule:inventory:barcode_scanning'] = true;
            render(<StockCountSheetPage countId="c-1" embedded />);
            expect((await screen.findByLabelText('Scan barcode')).getAttribute('data-size')).toBe('normal');
            expect(screen.getByLabelText('Filter lines')).toBeTruthy();
        });
    });
});
