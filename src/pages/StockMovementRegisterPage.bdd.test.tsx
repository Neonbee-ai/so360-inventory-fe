/**
 * BDD specs: Stock Movement Register page.
 *
 * Covers the register list (reference number, running balance, allocation
 * columns), the filter panel wiring to server-side query params, and the
 * entry form's client-side guards (insufficient stock, date rules,
 * production/project allocation requirements).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getMovements: vi.fn(),
    getLocations: vi.fn(),
    getOrgDefaultLogic: vi.fn(),
    searchProjects: vi.fn(),
    searchWorkOrders: vi.fn(),
    getItems: vi.fn(),
    getStockAvailability: vi.fn(),
    createAdjustment: vi.fn(),
    createTransfer: vi.fn(),
  },
}));

// The Stock adjustment form is now gated on the stock.adjust role permission
// (fail-closed). This suite exercises the form itself, so grant the permission
// and an enabled feature state — while preserving every other shell-context export.
vi.mock('@so360/shell-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@so360/shell-context')>();
  return {
    ...actual,
    useShellBridge: () => ({
      effectiveFlagsLoaded: true,
      permissionsLoaded: true,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      getFeatureState: () => 'enabled',
      currentOrg: { id: 'org-1' },
    }),
  };
});

import StockMovementRegisterPage from './StockMovementRegisterPage';
import { inventoryService } from '../services/inventoryService';

const inv = inventoryService as any;

const WH = 'wh-1';
const ITEM = { id: 'item-1', name: 'Teak Plank', sku: 'TW-001' };

const movement = (over: Record<string, any> = {}) => ({
    id: 'mv-1',
    item_id: ITEM.id,
    warehouse_id: WH,
    movement_type: 'adjustment',
    quantity: 10,
    created_at: '2026-08-10T09:00:00Z',
    transaction_date: '2026-08-10',
    reference_number: 'STK-202608-00001',
    balance_before: 100,
    balance_after: 110,
    items: { name: ITEM.name, sku: ITEM.sku },
    warehouses: { name: 'Main WH' },
    ...over,
});

const renderPage = () =>
    render(
        <MemoryRouter>
            <StockMovementRegisterPage />
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.resetAllMocks();
    inv.getMovements.mockResolvedValue([]);
    inv.getLocations.mockResolvedValue([{ id: WH, name: 'Main WH' }]);
    inv.getOrgDefaultLogic.mockResolvedValue({
        allow_negative_stock: false,
        auto_approve_transfers: false,
        allow_backdated_transactions: false,
        backdate_max_days: 0,
        allow_future_dated_transactions: false,
    });
    inv.searchProjects.mockResolvedValue([]);
    inv.searchWorkOrders.mockResolvedValue([]);
    inv.getItems.mockResolvedValue({ data: [ITEM] });
    inv.getStockAvailability.mockResolvedValue({ available: 50 });
    inv.createAdjustment.mockResolvedValue({ id: 'mv-new' });
});

describe('Stock Movement Register — list', () => {
    describe('Given movements exist', () => {
        it('When the page renders / Then the reference number is shown', async () => {
            inv.getMovements.mockResolvedValue([movement()]);
            renderPage();
            await waitFor(() =>
                expect(screen.getByText('STK-202608-00001')).toBeInTheDocument(),
            );
        });

        it('When the page renders / Then the running balance transition is shown', async () => {
            inv.getMovements.mockResolvedValue([movement()]);
            renderPage();
            await waitFor(() => expect(screen.getByText('110')).toBeInTheDocument());
        });

        it('When a movement predates the register / Then balance shows a placeholder instead of a number', async () => {
            inv.getMovements.mockResolvedValue([
                movement({ reference_number: null, balance_before: null, balance_after: null }),
            ]);
            renderPage();
            await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
        });

        it('When a movement is allocated to a project and work order / Then both are listed', async () => {
            inv.getMovements.mockResolvedValue([
                movement({
                    project_name_snapshot: 'Tower A',
                    work_order_number_snapshot: 'MO-0042',
                    source_type: 'production',
                }),
            ]);
            renderPage();
            await waitFor(() => {
                expect(screen.getByText(/Tower A/)).toBeInTheDocument();
                expect(screen.getByText(/MO-0042/)).toBeInTheDocument();
            });
        });
    });

    describe('Given no movements exist', () => {
        it('When the page renders / Then the empty state is shown', async () => {
            renderPage();
            await waitFor(() =>
                expect(screen.getByText(/No stock movements found/i)).toBeInTheDocument(),
            );
        });
    });
});

describe('Stock Movement Register — filters', () => {
    it('Given the filter panel is opened / When a reference number is typed / Then it is sent as a server-side filter', async () => {
        renderPage();
        await waitFor(() => expect(inv.getMovements).toHaveBeenCalled());

        fireEvent.click(screen.getByText('Filters'));
        fireEvent.change(screen.getByPlaceholderText('STK-…'), {
            target: { value: '00002' },
        });

        await waitFor(() =>
            expect(inv.getMovements).toHaveBeenLastCalledWith(
                expect.objectContaining({ reference_number: '00002' }),
            ),
        );
    });

    it('Given the filter panel is opened / When a movement type is chosen / Then it is sent as a server-side filter', async () => {
        renderPage();
        await waitFor(() => expect(inv.getMovements).toHaveBeenCalled());

        fireEvent.click(screen.getByText('Filters'));
        fireEvent.change(screen.getByLabelText('Filter movement type'), {
            target: { value: 'transfer' },
        });

        await waitFor(() =>
            expect(inv.getMovements).toHaveBeenLastCalledWith(
                expect.objectContaining({ movement_type: 'transfer' }),
            ),
        );
    });
});

describe('Stock Movement Register — entry form guards', () => {
    const openForm = async () => {
        renderPage();
        await waitFor(() => expect(inv.getLocations).toHaveBeenCalled());
        fireEvent.click(screen.getByText('New Transaction'));
        await screen.findByText('Transaction Information');
    };

    const selectItem = async () => {
        fireEvent.focus(screen.getByLabelText('Search items'));
        await waitFor(() => expect(inv.getItems).toHaveBeenCalled());
        fireEvent.click(await screen.findByText(ITEM.name));
    };

    it('Given a stock-out larger than the available balance / When negative stock is disabled / Then the insufficient-stock warning is shown', async () => {
        await openForm();
        await selectItem();

        fireEvent.click(screen.getByText('Stock Out'));
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        await waitFor(() => expect(inv.getStockAvailability).toHaveBeenCalled());
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '80' } });

        await waitFor(() =>
            expect(screen.getByText(/Insufficient stock/i)).toBeInTheDocument(),
        );
    });

    it('Given a backdated transaction / When the org disallows backdating / Then a warning is shown and submit is blocked', async () => {
        await openForm();

        fireEvent.change(screen.getByLabelText('Transaction date'), {
            target: { value: '2020-01-01' },
        });

        await waitFor(() =>
            expect(screen.getByText(/Backdated transactions are not enabled/i)).toBeInTheDocument(),
        );
        expect(screen.getByText('Record Transaction')).toBeDisabled();
    });

    it('Given the reference number field / When the form renders / Then it is read-only and auto-generated on save', async () => {
        await openForm();
        const refInput = screen.getByDisplayValue('Auto-generated on save') as HTMLInputElement;
        expect(refInput).toBeDisabled();
    });

    it('Given source is Production without a work order / When submitted / Then an allocation error is shown and no API call is made', async () => {
        await openForm();
        await selectItem();

        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Movement source'), {
            target: { value: 'production' },
        });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(screen.getByText(/Work Order is required/i)).toBeInTheDocument(),
        );
        expect(inv.createAdjustment).not.toHaveBeenCalled();
    });

    it('Given a valid stock-in / When submitted / Then the register fields are sent to the API', async () => {
        await openForm();
        await selectItem();

        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '25' } });
        fireEvent.change(screen.getByLabelText('Remarks'), {
            target: { value: 'Received in good condition' },
        });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(inv.createAdjustment).toHaveBeenCalledWith(
                expect.objectContaining({
                    item_id: ITEM.id,
                    warehouse_id: WH,
                    quantity: 25,
                    remarks: 'Received in good condition',
                }),
            ),
        );
    });
});
