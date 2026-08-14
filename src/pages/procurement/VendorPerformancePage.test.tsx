import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetVendorPerformance = vi.fn();

vi.mock('../../services/procurementInsightsService', () => ({
    procurementInsightsService: {
        getVendorPerformance: (...a: any[]) => mockGetVendorPerformance(...a),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({
        formatDate: (d: string) => d ?? '',
        formatDateTime: (d: string) => d ?? '',
        formatCurrency: (v: number) => `$${v}`,
        formatNumber: (n: number) => String(n),
        currency: 'USD', locale: 'en-US', timezone: 'UTC',
    }),
    useInventoryCurrencySymbol: () => '$',
}));

import VendorPerformancePage from './VendorPerformancePage';

const rows = [
    {
        vendor_id: 'v-1', vendor_name: 'Alpha Supplies', is_preferred: true,
        purchase_value: 1200, order_count: 4, open_orders: 1,
        delivery_performance_percent: 95, delay_percent: 5,
        average_lead_time_days: 12, average_response_days: 1,
        units_received: 100, units_rejected: 2, rejection_percent: 2,
        quality_score: 98, quotes_submitted: 4, quotes_won: 3,
        quote_win_rate_percent: 75, returns_raised: 0,
    },
    {
        vendor_id: 'v-2', vendor_name: 'Beta Trading', is_preferred: false,
        purchase_value: 2400, order_count: 2, open_orders: 2,
        delivery_performance_percent: 40, delay_percent: 60,
        average_lead_time_days: 30, average_response_days: 6,
        units_received: 50, units_rejected: 10, rejection_percent: 20,
        quality_score: 80, quotes_submitted: 2, quotes_won: 0,
        quote_win_rate_percent: 0, returns_raised: 2,
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    mockGetVendorPerformance.mockResolvedValue(rows);
});

describe('VendorPerformancePage', () => {
    describe('Given vendors have been scored', () => {
        it('When loaded / Then every performance axis is shown per vendor', async () => {
            render(<VendorPerformancePage />);
            await waitFor(() => expect(screen.getByText('Alpha Supplies')).toBeInTheDocument());

            expect(screen.getByText('95%')).toBeInTheDocument();
            expect(screen.getByText('98%')).toBeInTheDocument();
            expect(screen.getByText('12d')).toBeInTheDocument();
            expect(screen.getByText('75%')).toBeInTheDocument();
        });

        it('When a vendor is preferred / Then it is badged', async () => {
            render(<VendorPerformancePage />);
            await waitFor(() => expect(screen.getByText('Preferred')).toBeInTheDocument());
        });

        it('When ranked by spend / Then the biggest spend leads', async () => {
            render(<VendorPerformancePage />);
            await waitFor(() => screen.getByText('Beta Trading'));

            const names = screen.getAllByRole('row').slice(1).map(r => r.textContent || '');
            expect(names[0]).toContain('Beta Trading');
        });

        it('When ranked by rejection rate / Then the cleanest vendor leads', async () => {
            render(<VendorPerformancePage />);
            await waitFor(() => screen.getByLabelText('Rank by'));

            fireEvent.change(screen.getByLabelText('Rank by'), { target: { value: 'rejection_percent' } });

            const names = screen.getAllByRole('row').slice(1).map(r => r.textContent || '');
            expect(names[0]).toContain('Alpha Supplies');
        });
    });

    describe('Given no purchase history', () => {
        it('When loaded / Then an empty state explains there is nothing to score', async () => {
            mockGetVendorPerformance.mockResolvedValue([]);
            render(<VendorPerformancePage />);
            await waitFor(() => {
                expect(screen.getByText('No purchase history to score yet.')).toBeInTheDocument();
            });
        });
    });

    describe('Given the scorecard fails to load', () => {
        it('When the request errors / Then the reason is shown', async () => {
            mockGetVendorPerformance.mockRejectedValue(new Error('Permission denied'));
            render(<VendorPerformancePage />);
            await waitFor(() => expect(screen.getByText('Permission denied')).toBeInTheDocument());
        });
    });
});
