import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import type { Deal, DealStage } from '../../types/crm';

/**
 * BDD: KanbanBoard renders deal values using the org's base currency
 * via useInventoryFormatters() — NOT a hardcoded `$`.
 *
 * We mock ../../utils/formatters so the active currency can be swapped per
 * scenario. The mock builds a real Intl.NumberFormat-backed formatter, so
 * INR genuinely renders ₹ and AED genuinely renders an AED symbol — proving
 * the component no longer hardcodes the dollar sign.
 */

let activeCurrency = 'USD';

const buildFormatCurrency = (currency: string) => (n: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(n);

vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({
        formatCurrency: buildFormatCurrency(activeCurrency),
        formatCompactCurrency: buildFormatCurrency(activeCurrency),
        formatDate: (d: string) => d,
        formatNumber: (n: number) => String(n),
        formatPercent: (n: number) => `${n}%`,
    }),
}));

import { KanbanBoard } from './KanbanBoard';

const owner = { id: 'u1', full_name: 'Jane Doe', email: 'jane@example.com' };

const makeDeal = (overrides: Partial<Deal> = {}): Deal => ({
    id: 'deal-1',
    name: 'Big Deal',
    company_name: 'Acme Corp',
    value: 50000,
    expected_close_date: '2026-06-01',
    stage: 'Lead',
    owner,
    notes: [],
    activities: [],
    ...overrides,
} as Deal);

const stages: { id: string; name: DealStage }[] = [
    { id: 's1', name: 'Lead' },
];

const renderBoard = (deals: Deal[]) =>
    render(
        <KanbanBoard
            deals={deals}
            stages={stages}
            onDealClick={() => {}}
            onStageChange={() => {}}
        />,
    );

beforeEach(() => {
    vi.clearAllMocks();
    activeCurrency = 'USD';
});

describe('KanbanBoard currency formatting', () => {
    describe('Given the org base_currency is INR', () => {
        beforeEach(() => {
            activeCurrency = 'INR';
        });

        it('When a deal renders / Then its value uses the INR symbol (₹), not a hardcoded $', () => {
            renderBoard([makeDeal({ value: 50000 })]);
            // ₹50,000 appears for the card value (and the column total).
            const matches = screen.getAllByText(/₹\s?50,000/);
            expect(matches.length).toBeGreaterThan(0);
            // No hardcoded dollar amount should be present.
            expect(screen.queryByText(/\$\s?50,000/)).not.toBeInTheDocument();
        });

        it('When a stage has deals / Then the column total is INR-formatted', () => {
            renderBoard([
                makeDeal({ id: 'd1', value: 30000 }),
                makeDeal({ id: 'd2', value: 20000 }),
            ]);
            // Column total = 50,000 in INR.
            expect(screen.getAllByText(/₹\s?50,000/).length).toBeGreaterThan(0);
            expect(screen.queryByText(/\$50,000/)).not.toBeInTheDocument();
        });
    });

    describe('Given the org base_currency is AED', () => {
        beforeEach(() => {
            activeCurrency = 'AED';
        });

        it('When a deal renders / Then its value shows AED, not a hardcoded $', () => {
            renderBoard([makeDeal({ value: 50000 })]);
            const matches = screen.getAllByText(/AED|د\.إ/);
            expect(matches.length).toBeGreaterThan(0);
            expect(screen.queryByText(/\$\s?50,000/)).not.toBeInTheDocument();
        });
    });

    describe('Given the org base_currency is USD', () => {
        it('When a deal renders / Then its value is USD-formatted (default)', () => {
            renderBoard([makeDeal({ value: 50000 })]);
            expect(screen.getAllByText(/\$50,000/).length).toBeGreaterThan(0);
        });
    });

    describe('Given an empty stage', () => {
        it('When no deals exist / Then the stage total renders zero in the active currency', () => {
            activeCurrency = 'INR';
            renderBoard([]);
            // Column total for an empty stage = ₹0.
            expect(screen.getByText(/₹\s?0/)).toBeInTheDocument();
        });
    });
});
