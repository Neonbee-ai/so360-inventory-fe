import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetSalesDemand = vi.fn();
const mockRaise = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/procurementService', () => ({
    procurementService: {
        getSalesDemand: (...a: any[]) => mockGetSalesDemand(...a),
        raiseRequisitionForSalesOrder: (...a: any[]) => mockRaise(...a),
    },
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

import SalesDemandPage from './SalesDemandPage';

const demand = (o: any = {}) => ({
    orders: [{
        sales_order_id: 'so-1', so_number: 'SO-1001', status: 'confirmed', customer_name: 'Acme',
        requested_delivery_date: '2026-09-15', short_line_count: 1, shortfall_value: 1050,
        lines: [{ sales_order_line_id: 'sol-1', item_name: 'Cement 50kg', sku: 'CEM-50', ordered_quantity: 10, covered_by_stock: 3, covered_by_open_orders: 0, shortfall: 7 }],
    }],
    summary: { order_count: 1, orders_needing_purchase: 1, short_line_count: 1, shortfall_value: 1050 },
    ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetSalesDemand.mockResolvedValue(demand());
    mockRaise.mockResolvedValue({ requisition: { id: 'pr-new', pr_number: 'PR-1' } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('SalesDemandPage (Comb)', () => {
    it('Given confirmed orders, When rendered, Then the list floorplan shows the title and the toggle', async () => {
        const { container } = render(<SalesDemandPage />);
        await waitFor(() => expect(screen.getByText('SO-1001')).toBeInTheDocument());
        expect(container.querySelector('[data-template="list"]')).not.toBeNull();
        expect(screen.getByRole('heading', { name: 'Sales Demand' })).toBeInTheDocument();
        expect(screen.getByLabelText('Only orders needing purchase')).toBeChecked();
    });

    it('Given the request is pending, When rendered, Then the loading skeleton is shown', () => {
        mockGetSalesDemand.mockReturnValue(new Promise(() => {}));
        const { container } = render(<SalesDemandPage />);
        expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    });

    it('Given every order is covered, When loaded, Then the empty state says so', async () => {
        mockGetSalesDemand.mockResolvedValue(demand({ orders: [] }));
        render(<SalesDemandPage />);
        await waitFor(() => expect(screen.getByText(/Every confirmed order is covered/)).toBeInTheDocument());
    });

    it('Given an order, When its number is clicked, Then the line netting is shown', async () => {
        render(<SalesDemandPage />);
        await waitFor(() => screen.getByText('SO-1001'));
        fireEvent.click(screen.getByText('SO-1001'));
        await waitFor(() => expect(screen.getByText('Cement 50kg')).toBeInTheDocument());
        expect(screen.getByText('From Stock')).toBeInTheDocument();
    });

    it('Given a shortfall, When Raise Requisition is clicked, Then the PR is raised and opened', async () => {
        render(<SalesDemandPage />);
        await waitFor(() => screen.getByText('Raise Requisition'));
        fireEvent.click(screen.getByText('Raise Requisition'));
        await waitFor(() => expect(mockRaise).toHaveBeenCalledWith('so-1'));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/pr/pr-new');
    });

    it('Given a fully covered order, When listed, Then no requisition action is offered', async () => {
        mockGetSalesDemand.mockResolvedValue(demand({ orders: [{ sales_order_id: 'so-2', so_number: 'SO-1002', status: 'confirmed', short_line_count: 0, shortfall_value: 0, lines: [] }] }));
        render(<SalesDemandPage />);
        await waitFor(() => expect(screen.getByText('Covered')).toBeInTheDocument());
        expect(screen.queryByText('Raise Requisition')).not.toBeInTheDocument();
    });

    it('Given a demand summary, When rendered, Then the KPI row shows orders, purchasing need, short lines and shortfall value', async () => {
        render(<SalesDemandPage />);
        await waitFor(() => expect(screen.getByText('SO-1001')).toBeInTheDocument());
        const kpis = within(screen.getByTestId('sales-demand-kpis'));
        for (const label of ['Orders Shown', 'Need Purchasing', 'Short Lines', 'Shortfall Value']) {
            expect(kpis.getByText(label)).toBeInTheDocument();
        }
        expect(kpis.getByText('$1050')).toBeInTheDocument();
        expect(kpis.getAllByText('1')).toHaveLength(3);
    });
});
