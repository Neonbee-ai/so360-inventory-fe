import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetDashboard = vi.fn();
const mockGetTrends = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/procurementInsightsService', () => ({
    procurementInsightsService: { getDashboard: (...a: any[]) => mockGetDashboard(...a), getTrends: (...a: any[]) => mockGetTrends(...a) },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
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

import ProcurementDashboardPage from './ProcurementDashboardPage';

const dashboard = (o: any = {}) => ({
    kpis: { total_procurement_value: 2000, cost_savings: 200, po_issued: 5, completed_orders: 3, pending_requisitions: 3, open_returns: 1 },
    spend_by_vendor: [{ vendor_id: 'v-1', vendor_name: 'Alpha Supplies', amount: 1200 }],
    alerts: [{ severity: 'warning', type: 'qc_pending', message: '1 receipt(s) pending inspection', count: 1 }],
    ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetDashboard.mockResolvedValue(dashboard());
    mockGetTrends.mockResolvedValue({ monthly_spend: [], top_items: [] });
});

describe('ProcurementDashboardPage (Comb)', () => {
    it('Given the dashboard loads, When rendered, Then the dashboard floorplan shows title, Refresh and KPIs', async () => {
        const { container } = render(<ProcurementDashboardPage />);
        await waitFor(() => expect(screen.getByText('Total Procurement Value')).toBeInTheDocument());
        expect(container.querySelector('[data-template="dashboard"]')).not.toBeNull();
        expect(screen.getByRole('heading', { name: 'Procurement Dashboard' })).toBeInTheDocument();
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('$2000')).toBeInTheDocument();
    });

    it('Given the request is pending, When rendered, Then a loading spinner is shown', () => {
        mockGetDashboard.mockReturnValue(new Promise(() => {}));
        render(<ProcurementDashboardPage />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('Given no purchase orders and no history, When loaded, Then both empty states show', async () => {
        mockGetDashboard.mockResolvedValue(dashboard({ spend_by_vendor: [], alerts: [] }));
        render(<ProcurementDashboardPage />);
        await waitFor(() => expect(screen.getByText('No purchase orders yet.')).toBeInTheDocument());
        expect(screen.getByText('Not enough history yet.')).toBeInTheDocument();
        expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
    });

    it('Given a pipeline tile, When clicked, Then the matching queue opens', async () => {
        render(<ProcurementDashboardPage />);
        await waitFor(() => screen.getByText('PO Issued'));
        fireEvent.click(screen.getByText('PO Issued'));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/po');
    });

    it('Given the dashboard cannot load, When the request fails, Then the reason is shown and Refresh stays available', async () => {
        mockGetDashboard.mockRejectedValue(new Error('Feature not enabled'));
        render(<ProcurementDashboardPage />);
        await waitFor(() => expect(screen.getByText('Feature not enabled')).toBeInTheDocument());
        expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('Given monthly spend history, When loaded, Then each month shows its amount as visible text', async () => {
        mockGetTrends.mockResolvedValue({ monthly_spend: [{ month: '2026-08', value: 500 }, { month: '2026-09', value: 750 }], top_items: [] });
        render(<ProcurementDashboardPage />);
        await waitFor(() => expect(screen.getByText('2026-08')).toBeInTheDocument());
        const values = screen.getAllByTestId('monthly-spend-value').map(n => n.textContent);
        expect(values).toEqual(['$500', '$750']);
    });
});
