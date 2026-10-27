import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGet = vi.fn();
vi.mock('../../services/procurementInsightsService', () => ({
    procurementInsightsService: { getVendorPerformance: (...a: any[]) => mockGet(...a) },
}));
vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({
        toBusinessDate: (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)),
        businessToday: () => '2026-09-15',
        startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`),
        endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
        formatDate: (d: string) => d ?? '',
        formatDateTime: (d: string) => d ?? '',
        formatCurrency: (v: number) => `$${v}`,
        formatNumber: (n: number) => String(n),
        currency: 'USD', locale: 'en-US', timezone: 'UTC',
    }),
    useInventoryCurrencySymbol: () => '$',
}));

import VendorPerformancePage from './VendorPerformancePage';

const row = (o: any = {}) => ({
    vendor_id: 'v-1', vendor_name: 'Alpha Supplies', is_preferred: true,
    purchase_value: 1200, order_count: 4, open_orders: 1,
    delivery_performance_percent: 95, delay_percent: 5,
    average_lead_time_days: 12, average_response_days: 1,
    units_received: 100, units_rejected: 2, rejection_percent: 2,
    quality_score: 98, quotes_submitted: 4, quotes_won: 3,
    quote_win_rate_percent: 75, returns_raised: 0, ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue([row()]);
});

describe('VendorPerformancePage (Comb)', () => {
    it('Given vendors are scored, When rendered, Then the list floorplan shows the title and rank control', async () => {
        const { container } = render(<VendorPerformancePage />);
        await waitFor(() => expect(screen.getByText('Alpha Supplies')).toBeInTheDocument());
        expect(container.querySelector('[data-template="list"]')).not.toBeNull();
        expect(screen.getByRole('heading', { name: 'Vendor Performance' })).toBeInTheDocument();
        expect(screen.getByLabelText('Rank by')).toBeInTheDocument();
    });

    it('Given the request is pending, When rendered, Then the loading skeleton is shown', () => {
        mockGet.mockReturnValue(new Promise(() => {}));
        const { container } = render(<VendorPerformancePage />);
        expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    });

    it('Given no purchase history, When loaded, Then the empty state explains it', async () => {
        mockGet.mockResolvedValue([]);
        render(<VendorPerformancePage />);
        await waitFor(() => expect(screen.getByText('No purchase history to score yet.')).toBeInTheDocument());
    });

    it('Given two vendors, When ranked by rejection rate, Then the cleanest vendor leads', async () => {
        mockGet.mockResolvedValue([row(), row({ vendor_id: 'v-2', vendor_name: 'Beta Trading', purchase_value: 2400, rejection_percent: 20, is_preferred: false })]);
        render(<VendorPerformancePage />);
        await waitFor(() => screen.getByText('Beta Trading'));
        fireEvent.change(screen.getByLabelText('Rank by'), { target: { value: 'rejection_percent' } });
        const rows = screen.getAllByRole('row').slice(1).map(r => r.textContent || '');
        expect(rows[0]).toContain('Alpha Supplies');
    });

    it('Given a preferred vendor, When loaded, Then it carries the Preferred badge', async () => {
        render(<VendorPerformancePage />);
        await waitFor(() => expect(screen.getByText('Preferred')).toBeInTheDocument());
    });
});
