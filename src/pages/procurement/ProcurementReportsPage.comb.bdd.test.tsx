import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetReport = vi.fn();
vi.mock('../../services/procurementInsightsService', () => ({
    procurementInsightsService: { getReport: (...a: any[]) => mockGetReport(...a) },
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

import ProcurementReportsPage from './ProcurementReportsPage';

beforeEach(() => {
    vi.clearAllMocks();
    mockGetReport.mockResolvedValue({ report: 'purchase_register', rows: [{ po_number: 'PO-001', vendor_name: 'Alpha', total_amount: 1200 }] });
});

describe('ProcurementReportsPage (Comb)', () => {
    it('Given the page opens, When rendered, Then title, Run and Export CSV are in the header', async () => {
        const { container } = render(<ProcurementReportsPage />);
        await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument());
        expect(container.querySelector('[data-template="list"]')).not.toBeNull();
        expect(screen.getByRole('heading', { name: 'Procurement Reports' })).toBeInTheDocument();
        expect(screen.getByText('Run')).toBeInTheDocument();
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    it('Given the report is running, When rendered, Then the loading skeleton is shown', () => {
        mockGetReport.mockReturnValue(new Promise(() => {}));
        const { container } = render(<ProcurementReportsPage />);
        expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    });

    it('Given a report with no rows, When loaded, Then the empty state is shown', async () => {
        mockGetReport.mockResolvedValue({ report: 'purchase_register', rows: [] });
        render(<ProcurementReportsPage />);
        await waitFor(() => expect(screen.getByText('No rows for this report.')).toBeInTheDocument());
    });

    it('Given the report chooser, When another report is picked, Then that report is requested', async () => {
        render(<ProcurementReportsPage />);
        await waitFor(() => screen.getByText('Delayed Deliveries'));
        mockGetReport.mockResolvedValue({ report: 'delayed_deliveries', rows: [] });
        fireEvent.click(screen.getByText('Delayed Deliveries'));
        await waitFor(() => expect(mockGetReport).toHaveBeenCalledWith('delayed_deliveries', expect.any(Object)));
    });

    it('Given the backend rejects the report, When loaded, Then the reason is shown', async () => {
        mockGetReport.mockRejectedValue(new Error('Feature not enabled'));
        render(<ProcurementReportsPage />);
        await waitFor(() => expect(screen.getByText('Feature not enabled')).toBeInTheDocument());
    });
});
