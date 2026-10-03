/**
 * BDD spec — LossReportPage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const h = vi.hoisted(() => ({
    getLossSummary: null as any,
    getLossReasons: null as any,
    flags: {} as Record<string, boolean>,
}));

vi.mock('../services/inventoryService', () => ({
    inventoryService: {
        getLossSummary: (...a: any[]) => h.getLossSummary(...a),
        getLossReasons: (...a: any[]) => h.getLossReasons(...a),
    },
}));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ isFeatureEnabled: (f: string) => h.flags[f] === true }),
}));

import LossReportPage from './LossReportPage';

beforeEach(() => {
    h.flags = {};
    h.getLossReasons = vi.fn(() => Promise.resolve([
        { id: 'r0', code: 'DOA', label: 'Dead on arrival', category: 'mortality' },
        { id: 'r1', code: 'SPOIL', label: 'Spoiled', category: 'spoilage' },
        { id: 'r2', code: 'TRIM', label: 'Trim loss', category: 'process' },
    ]));
    h.getLossSummary = vi.fn(() => Promise.resolve({
        total_value: 1234.5,
        total_qty: 42,
        rows: [
            { key: 'TRIM', label: 'Trim loss', qty: 30, value: 300 },
            { key: 'SPOIL', label: 'Spoiled', qty: 12, value: 934.5 },
        ],
        trend: [{ date: '2026-10-01', value: 100 }, { date: '2026-10-02', value: 250 }],
    }));
});

describe('LossReportPage', () => {
    describe('Given the page opens', () => {
        it('When loaded Then it requests the last 30 days grouped by reason', async () => {
            render(<LossReportPage />);
            await waitFor(() => expect(h.getLossSummary).toHaveBeenCalled());
            const arg = h.getLossSummary.mock.calls[0][0];
            expect(arg.group_by).toBe('reason');
            const days = (Date.parse(arg.to) - Date.parse(arg.from)) / 86400000;
            expect(Math.round(days)).toBe(29);
        });

        it('When data arrives Then totals, the biggest row and the trend render', async () => {
            render(<LossReportPage />);
            expect(await screen.findByText('Spoiled', { selector: '[data-testid="top-row"]' })).toBeTruthy();
            expect(screen.getByTestId('total-value').textContent).toBe((1234.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            expect(screen.getByTestId('total-qty').textContent).toBe('42');
            expect(screen.getAllByTestId('trend-point')).toHaveLength(2);
            const rows = screen.getAllByTestId(/^loss-row-/).map((el) => el.getAttribute('data-testid'));
            expect(rows).toEqual(['loss-row-SPOIL', 'loss-row-TRIM']);
        });
    });

    describe('Given the group-by toggle', () => {
        it('When Item is tapped Then the summary reloads grouped by item', async () => {
            render(<LossReportPage />);
            await screen.findByTestId('loss-row-TRIM');
            fireEvent.click(screen.getByRole('button', { name: 'Item' }));
            await waitFor(() => expect(h.getLossSummary).toHaveBeenLastCalledWith(expect.objectContaining({ group_by: 'item' })));
            expect(screen.getByRole('button', { name: 'Item' }).getAttribute('aria-pressed')).toBe('true');
        });
    });

    describe('Given a date change', () => {
        it('When From is changed Then the summary reloads for the new range', async () => {
            render(<LossReportPage />);
            await screen.findByTestId('loss-row-TRIM');
            fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
            await waitFor(() => expect(h.getLossSummary).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01' })));
        });
    });

    describe('Given mortality losses in the summary', () => {
        const withMortality = (rows: any[]) => () => Promise.resolve({
            total_value: 1300, total_qty: 50, rows, trend: [],
        });

        it('When mortality tracking is off and grouped by reason Then mortality rows are hidden and totals exclude them', async () => {
            h.getLossSummary = vi.fn(withMortality([
                { key: 'DOA', label: 'Dead on arrival', qty: 8, value: 900 },
                { key: 'SPOIL', label: 'Spoiled', qty: 42, value: 400 },
            ]));
            render(<LossReportPage />);
            await screen.findByTestId('loss-row-SPOIL');
            await waitFor(() => expect(screen.queryByTestId('loss-row-DOA')).toBeNull());
            expect(screen.getByTestId('top-row').textContent).toBe('Spoiled');
            expect(screen.getByTestId('total-qty').textContent).toBe('42');
            expect(screen.getByTestId('total-value').textContent).toBe((400).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        });

        it('When mortality tracking is off and grouped by category Then the mortality category is hidden', async () => {
            h.getLossSummary = vi.fn((q: any) => q.group_by === 'category'
                ? withMortality([
                    { key: 'mortality', label: 'Mortality', qty: 8, value: 900 },
                    { key: 'spoilage', label: 'Spoilage', qty: 42, value: 400 },
                ])()
                : withMortality([])());
            render(<LossReportPage />);
            fireEvent.click(await screen.findByRole('button', { name: 'Category' }));
            await screen.findByTestId('loss-row-spoilage');
            expect(screen.queryByTestId('loss-row-mortality')).toBeNull();
        });

        it('When mortality tracking is on Then mortality rows show and reasons are not fetched', async () => {
            h.flags['action:inventory:loss:mortality_tracking'] = true;
            h.getLossSummary = vi.fn(withMortality([
                { key: 'DOA', label: 'Dead on arrival', qty: 8, value: 900 },
                { key: 'SPOIL', label: 'Spoiled', qty: 42, value: 400 },
            ]));
            render(<LossReportPage />);
            expect(await screen.findByTestId('loss-row-DOA')).toBeTruthy();
            expect(screen.getByTestId('total-qty').textContent).toBe('50');
            expect(h.getLossReasons).not.toHaveBeenCalled();
        });
    });

    describe('Given no losses', () => {
        it('When loaded Then empty states show', async () => {
            h.getLossSummary = vi.fn(() => Promise.resolve({ total_value: 0, total_qty: 0, rows: [], trend: [] }));
            render(<LossReportPage />);
            expect(await screen.findByText('No losses in this period')).toBeTruthy();
            expect(screen.getByText('No trend data')).toBeTruthy();
        });
    });

    describe('Given the request fails', () => {
        it('When loaded Then the error is shown', async () => {
            h.getLossSummary = vi.fn(() => Promise.reject(new Error('Forbidden')));
            render(<LossReportPage />);
            expect((await screen.findByRole('alert')).textContent).toBe('Forbidden');
        });
    });
});
