/**
 * BDD spec — StockCountsPage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const h = vi.hoisted(() => ({
    getStockCounts: null as any,
    getLocations: null as any,
    createStockCount: null as any,
    navigate: null as any,
    canAdjust: true,
}));

vi.mock('../services/inventoryService', () => ({
    inventoryService: {
        getStockCounts: (...a: any[]) => h.getStockCounts(...a),
        getLocations: (...a: any[]) => h.getLocations(...a),
        createStockCount: (...a: any[]) => h.createStockCount(...a),
    },
}));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ hasPermission: () => h.canAdjust, isFeatureEnabled: () => true }),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));

import StockCountsPage from './StockCountsPage';

beforeEach(() => {
    h.canAdjust = true;
    h.navigate = vi.fn();
    h.getStockCounts = vi.fn(() => Promise.resolve([
        { id: 'c-1', warehouse_id: 'w-1', count_date: '2026-10-02', status: 'posted' },
        { id: 'c-2', warehouse_id: 'w-1', warehouse_name: 'Back Room', count_date: '2026-10-03', status: 'draft' },
    ]));
    h.getLocations = vi.fn(() => Promise.resolve([{ id: 'w-1', name: 'Main Store' }]));
    h.createStockCount = vi.fn(() => Promise.resolve({ id: 'c-9', warehouse_id: 'w-1', count_date: '2026-10-03', status: 'draft' }));
});

describe('StockCountsPage', () => {
    describe('Given existing counts', () => {
        it('When the page loads Then each count shows its warehouse and status', async () => {
            render(<StockCountsPage />);
            expect(await screen.findByText('Main Store')).toBeTruthy();
            expect(screen.getByText('Back Room')).toBeTruthy();
            expect(screen.getByText('Posted')).toBeTruthy();
            expect(screen.getByText('Draft')).toBeTruthy();
        });
        it('When a count is tapped Then it opens the count sheet', async () => {
            render(<StockCountsPage />);
            fireEvent.click(await screen.findByText('Back Room'));
            expect(h.navigate).toHaveBeenCalledWith('/inventory/overview?mode=count&count=c-2');
        });
    });

    describe('Given a single warehouse', () => {
        it('When New count then Start count is tapped Then a draft is created and opened', async () => {
            render(<StockCountsPage />);
            fireEvent.click(await screen.findByText('New count'));
            expect((screen.getByLabelText('Warehouse') as HTMLSelectElement).value).toBe('w-1');
            fireEvent.click(screen.getByText('Start count'));
            await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/inventory/overview?mode=count&count=c-9'));
            expect(h.createStockCount).toHaveBeenCalledWith({ warehouse_id: 'w-1', count_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
        });
    });

    describe('Given creation fails', () => {
        it('When Start count is tapped Then the error is shown and no navigation happens', async () => {
            h.createStockCount = vi.fn(() => Promise.reject(new Error('Draft already open')));
            render(<StockCountsPage />);
            fireEvent.click(await screen.findByText('New count'));
            fireEvent.click(screen.getByText('Start count'));
            expect((await screen.findByRole('alert')).textContent).toBe('Draft already open');
            expect(h.navigate).not.toHaveBeenCalled();
        });
    });

    describe('Given the user lacks stock.adjust', () => {
        it('When the page loads Then New count is hidden', async () => {
            h.canAdjust = false;
            render(<StockCountsPage />);
            await screen.findByText('Back Room');
            expect(screen.queryByText('New count')).toBeNull();
        });
    });

    describe('Given no counts', () => {
        it('When the page loads Then an empty state shows', async () => {
            h.getStockCounts = vi.fn(() => Promise.resolve([]));
            render(<StockCountsPage />);
            expect(await screen.findByText('No stock counts yet')).toBeTruthy();
        });
    });
});

describe('StockCountsPage — inside Stock Overview Count mode', () => {
    describe('Given the host page handles opening a count', () => {
        it('When a count is tapped Then the host opens it in place and the title is a section heading', async () => {
            const onOpen = vi.fn();
            render(<StockCountsPage embedded onOpen={onOpen} />);
            fireEvent.click(await screen.findByText('Back Room'));
            expect(onOpen).toHaveBeenCalledWith('c-2');
            expect(h.navigate).not.toHaveBeenCalled();
            expect(screen.getByRole('heading', { level: 2, name: 'Stock counts' })).toBeTruthy();
            expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
        });
    });
});
