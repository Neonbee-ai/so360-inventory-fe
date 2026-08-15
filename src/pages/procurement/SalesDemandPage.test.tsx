import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
        formatDate: (d: string) => d ?? '',
        formatDateTime: (d: string) => d ?? '',
        formatCurrency: (v: number) => `$${v}`,
        formatNumber: (n: number) => String(n),
        currency: 'USD', locale: 'en-US', timezone: 'UTC',
    }),
    useInventoryCurrencySymbol: () => '$',
}));

import SalesDemandPage from './SalesDemandPage';

const makeDemand = (overrides: any = {}) => ({
    orders: [{
        sales_order_id: 'so-1',
        so_number: 'SO-1001',
        status: 'confirmed',
        customer_name: 'Acme Constructions',
        requested_delivery_date: '2026-09-15',
        short_line_count: 1,
        shortfall_value: 1050,
        fully_covered: false,
        lines: [{
            sales_order_line_id: 'sol-1',
            item_name: 'Cement 50kg',
            sku: 'CEM-50',
            ordered_quantity: 10,
            covered_by_stock: 3,
            covered_by_open_orders: 0,
            shortfall: 7,
            unit_price: 150,
        }],
    }],
    summary: { order_count: 1, orders_needing_purchase: 1, short_line_count: 1, shortfall_value: 1050 },
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetSalesDemand.mockResolvedValue(makeDemand());
    mockRaise.mockResolvedValue({ requisition: { id: 'pr-new', pr_number: 'PR-2026-0001' } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('SalesDemandPage', () => {
    describe('Given confirmed customer orders', () => {
        it('When loaded / Then each order shows what still needs buying', async () => {
            render(<SalesDemandPage />);
            await waitFor(() => expect(screen.getByText('SO-1001')).toBeInTheDocument());

            expect(screen.getByText('Acme Constructions')).toBeInTheDocument();
            expect(screen.getByText('1 short')).toBeInTheDocument();
            expect(screen.getAllByText('$1050').length).toBeGreaterThan(0);
        });

        it('When an order is expanded / Then the netting is shown line by line', async () => {
            render(<SalesDemandPage />);
            await waitFor(() => screen.getByText('SO-1001'));

            fireEvent.click(screen.getByText('SO-1001'));
            await waitFor(() => expect(screen.getByText('Cement 50kg')).toBeInTheDocument());

            expect(screen.getByText('From Stock')).toBeInTheDocument();
            expect(screen.getByText('On Order')).toBeInTheDocument();
            // 10 ordered, 3 from stock, 7 short.
            expect(screen.getByText('7')).toBeInTheDocument();
        });

        it('When an order is fully covered / Then no requisition is offered', async () => {
            mockGetSalesDemand.mockResolvedValue(makeDemand({
                orders: [{
                    sales_order_id: 'so-2', so_number: 'SO-1002', status: 'confirmed',
                    customer_name: 'Beta Builders', short_line_count: 0, shortfall_value: 0,
                    fully_covered: true, lines: [],
                }],
            }));
            render(<SalesDemandPage />);

            await waitFor(() => expect(screen.getByText('Covered')).toBeInTheDocument());
            expect(screen.queryByText('Raise Requisition')).not.toBeInTheDocument();
        });
    });

    describe('Given the buyer acts on a shortfall', () => {
        it('When Raise Requisition is clicked / Then the PR is raised and opened', async () => {
            render(<SalesDemandPage />);
            await waitFor(() => screen.getByText('Raise Requisition'));

            fireEvent.click(screen.getByText('Raise Requisition'));

            // The page raises for every short line, so it passes no line filter.
            await waitFor(() => expect(mockRaise).toHaveBeenCalledWith('so-1'));
            expect(mockNavigate).toHaveBeenCalledWith('/procurement/pr/pr-new');
        });

        it('When the confirm is dismissed / Then nothing is raised', async () => {
            (window.confirm as any).mockReturnValue(false);
            render(<SalesDemandPage />);
            await waitFor(() => screen.getByText('Raise Requisition'));

            fireEvent.click(screen.getByText('Raise Requisition'));
            expect(mockRaise).not.toHaveBeenCalled();
        });

        it('When the backend refuses / Then its reason is surfaced', async () => {
            mockRaise.mockRejectedValue(new Error('stock and open orders already cover it'));
            render(<SalesDemandPage />);
            await waitFor(() => screen.getByText('Raise Requisition'));

            fireEvent.click(screen.getByText('Raise Requisition'));
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('stock and open orders already cover it');
            });
        });
    });

    describe('Given the covered orders are hidden by default', () => {
        it('When the filter is cleared / Then every confirmed order is requested', async () => {
            render(<SalesDemandPage />);
            await waitFor(() => expect(mockGetSalesDemand).toHaveBeenCalledWith({ only_short: true }));

            fireEvent.click(screen.getByLabelText('Only orders needing purchase'));
            await waitFor(() => {
                expect(mockGetSalesDemand).toHaveBeenLastCalledWith({ only_short: false });
            });
        });

        it('When everything is covered / Then the empty state says so', async () => {
            mockGetSalesDemand.mockResolvedValue(makeDemand({ orders: [] }));
            render(<SalesDemandPage />);
            await waitFor(() => {
                expect(screen.getByText(/Every confirmed order is covered/)).toBeInTheDocument();
            });
        });
    });

    describe('Given the demand cannot be loaded', () => {
        it('When the request fails / Then the reason is shown', async () => {
            mockGetSalesDemand.mockRejectedValue(new Error('Permission denied'));
            render(<SalesDemandPage />);
            await waitFor(() => expect(screen.getByText('Permission denied')).toBeInTheDocument());
        });
    });
});
