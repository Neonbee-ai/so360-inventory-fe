import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetDashboard = vi.fn();
const mockGetTrends = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/procurementInsightsService', () => ({
    procurementInsightsService: {
        getDashboard: (...a: any[]) => mockGetDashboard(...a),
        getTrends: (...a: any[]) => mockGetTrends(...a),
    },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

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

import ProcurementDashboardPage from './ProcurementDashboardPage';

const makeDashboard = (overrides: any = {}) => ({
    generated_at: '2026-08-14T00:00:00Z',
    kpis: {
        total_procurement_value: 2000,
        pending_requisitions: 3,
        pending_approval: 2,
        rfqs_awaiting_response: 1,
        po_issued: 5,
        po_pending_delivery: 2,
        grns_pending_inspection: 1,
        quality_inspection_pending: 1,
        purchase_invoices_pending: 4,
        vendor_payments_pending: 3,
        delayed_deliveries: 2,
        rejected_deliveries: 1,
        open_returns: 1,
        procurement_lead_time_days: 15,
        average_approval_days: 2,
        cost_savings: 200,
        budget_allocated: 1500,
        budget_utilisation_percent: 67,
        completed_orders: 3,
    },
    spend_by_vendor: [
        { vendor_id: 'v-1', vendor_name: 'Alpha Supplies', amount: 1200 },
        { vendor_id: 'v-2', vendor_name: 'Beta Trading', amount: 800 },
    ],
    spend_by_category: [{ category_id: 'cat-1', amount: 1800 }],
    alerts: [
        { severity: 'critical', type: 'delivery_overdue', message: '2 purchase order(s) past their delivery date', count: 2 },
        { severity: 'warning', type: 'qc_pending', message: '1 receipt(s) holding stock pending inspection', count: 1 },
    ],
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetDashboard.mockResolvedValue(makeDashboard());
    mockGetTrends.mockResolvedValue({
        monthly_spend: [{ month: '2026-07', value: 800, orders: 2 }, { month: '2026-08', value: 1200, orders: 3 }],
        top_vendors: [{ vendor_id: 'v-1', vendor_name: 'Alpha Supplies', value: 1200 }],
        top_items: [{ item_id: 'i-1', item_name: 'Cement 50kg', sku: 'CEM-50', quantity: 18, value: 1800 }],
    });
});

describe('ProcurementDashboardPage', () => {
    describe('Given the dashboard loads', () => {
        it('When rendered / Then the committed value and savings lead the page', async () => {
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Total Procurement Value')).toBeInTheDocument());
            expect(screen.getByText('$2000')).toBeInTheDocument();
            expect(screen.getByText('$200')).toBeInTheDocument();
            expect(screen.getByText('67%')).toBeInTheDocument();
        });

        it('When rendered / Then every pipeline stage is counted', async () => {
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Pipeline')).toBeInTheDocument());

            for (const label of ['Pending PR', 'Awaiting Approval', 'RFQs Waiting', 'PO Issued', 'GRNs Pending', 'Inspection Pending', 'Payments Pending', 'Open Returns']) {
                expect(screen.getByText(label)).toBeInTheDocument();
            }
        });

        it('When rendered / Then process health surfaces lead time and delays', async () => {
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Procurement Lead Time')).toBeInTheDocument());
            expect(screen.getByText('15 days')).toBeInTheDocument();
            expect(screen.getByText('Delayed Deliveries')).toBeInTheDocument();
        });

        it('When spend exists / Then it is broken down by vendor', async () => {
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Spend by Vendor')).toBeInTheDocument());
            expect(screen.getByText('Alpha Supplies')).toBeInTheDocument();
            expect(screen.getByText('$1200')).toBeInTheDocument();
        });

        it('When trends are available / Then top purchased items are listed', async () => {
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Top Purchased Items')).toBeInTheDocument());
            expect(screen.getByText('Cement 50kg')).toBeInTheDocument();
            expect(screen.getByText('CEM-50')).toBeInTheDocument();
        });
    });

    describe('Given alerts need attention', () => {
        it('When rendered / Then each alert is shown with its count', async () => {
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Needs Attention')).toBeInTheDocument());
            expect(screen.getByText('2 purchase order(s) past their delivery date')).toBeInTheDocument();
            expect(screen.getByText('1 receipt(s) holding stock pending inspection')).toBeInTheDocument();
        });

        it('When an alert is clicked / Then it navigates to the queue that resolves it', async () => {
            render(<ProcurementDashboardPage />);
            await waitFor(() => screen.getByText('1 receipt(s) holding stock pending inspection'));

            fireEvent.click(screen.getByText('1 receipt(s) holding stock pending inspection'));
            expect(mockNavigate).toHaveBeenCalledWith('/procurement/quality');
        });

        it('When there is nothing to act on / Then the attention block is hidden', async () => {
            mockGetDashboard.mockResolvedValue(makeDashboard({ alerts: [] }));
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Pipeline')).toBeInTheDocument());
            expect(screen.queryByText('Needs Attention')).not.toBeInTheDocument();
        });
    });

    describe('Given a pipeline tile is clicked', () => {
        it('When PO Issued is clicked / Then the purchase order list opens', async () => {
            render(<ProcurementDashboardPage />);
            await waitFor(() => screen.getByText('PO Issued'));
            fireEvent.click(screen.getByText('PO Issued'));
            expect(mockNavigate).toHaveBeenCalledWith('/procurement/po');
        });
    });

    describe('Given trends are unavailable', () => {
        it('When the trends call fails / Then the dashboard still renders', async () => {
            mockGetTrends.mockRejectedValue(new Error('nope'));
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Total Procurement Value')).toBeInTheDocument());
            expect(screen.getByText('Not enough history yet.')).toBeInTheDocument();
        });
    });

    describe('Given the dashboard cannot load', () => {
        it('When the request fails / Then the reason is shown', async () => {
            mockGetDashboard.mockRejectedValue(new Error('Feature not enabled'));
            render(<ProcurementDashboardPage />);
            await waitFor(() => expect(screen.getByText('Feature not enabled')).toBeInTheDocument());
        });
    });
});
