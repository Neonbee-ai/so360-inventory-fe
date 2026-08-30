/**
 * BDD specs: Stock Transaction business controls.
 *
 * Covers the defects reported against the Record Stock Transaction screen and
 * the register beneath it:
 *   - a balance of 5 with a quantity of -8 previewing as 13
 *   - `((^*&%` accepted as a Party / Reference
 *   - Project and Work Order offering only "Not linked" with no explanation
 *   - no reason required on a stock change
 *   - Transfers and Adjustments indistinguishable in the register
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ can: () => true }),
}));

import StockMovementRegisterPage from './StockMovementRegisterPage';
import { inventoryService } from '../services/inventoryService';

const inv = inventoryService as any;

const WH = 'wh-1';
const WH2 = 'wh-2';
const ITEM = { id: 'item-1', name: 'Teak Plank', sku: 'TW-001' };

const movement = (over: Record<string, any> = {}) => ({
    id: `mv-${Math.random()}`,
    item_id: ITEM.id,
    warehouse_id: WH,
    movement_type: 'adjustment',
    quantity: -5,
    created_at: '2026-08-10T09:00:00Z',
    transaction_date: '2026-08-10',
    reference_number: 'ADJ-00012',
    balance_before: 100,
    balance_after: 95,
    items: { name: ITEM.name, sku: ITEM.sku },
    warehouses: { name: 'Dubai South Hub' },
    ...over,
});

const renderPage = () =>
    render(
        <MemoryRouter>
            <StockMovementRegisterPage />
        </MemoryRouter>,
    );

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

beforeEach(() => {
    vi.resetAllMocks();
    inv.getMovements.mockResolvedValue([]);
    inv.getLocations.mockResolvedValue([
        { id: WH, name: 'Dubai South Hub' },
        { id: WH2, name: 'City Distribution Centre' },
    ]);
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
    inv.getStockAvailability.mockResolvedValue({ available: 5 });
    inv.createAdjustment.mockResolvedValue({ id: 'mv-new' });
    inv.createTransfer.mockResolvedValue({ id: 'mv-new' });
});

describe('Given the Record Stock Transaction quantity rules', () => {
    it('Given a Stock In with a balance of 5 / When -8 is entered / Then the projection refuses to render instead of showing 13', async () => {
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        await waitFor(() => expect(inv.getStockAvailability).toHaveBeenCalled());

        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '-8' } });

        await waitFor(() =>
            expect(screen.getByTestId('error-quantity')).toHaveTextContent(
                'Quantity must be greater than zero.',
            ),
        );
        expect(screen.queryByText('13')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Record Transaction'));
        expect(inv.createAdjustment).not.toHaveBeenCalled();
    });

    it('Given an Adjustment with a balance of 5 / When -8 is entered / Then the updated balance reads -3', async () => {
        await openForm();
        await selectItem();
        fireEvent.click(screen.getByText('Adjustment'));
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        await waitFor(() => expect(inv.getStockAvailability).toHaveBeenCalled());

        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '-8' } });

        await waitFor(() => expect(screen.getByText('-3')).toBeInTheDocument());
    });

    it('Given a decrease below zero / When negative stock is disabled / Then submission is blocked with the current balance stated', async () => {
        await openForm();
        await selectItem();
        fireEvent.click(screen.getByText('Adjustment'));
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        await waitFor(() => expect(inv.getStockAvailability).toHaveBeenCalled());
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'SHRINKAGE' } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '-8' } });

        await waitFor(() =>
            expect(screen.getByTestId('error-stock')).toHaveTextContent(
                'Insufficient stock available. Current balance is 5.',
            ),
        );
        expect(screen.getByText('Record Transaction')).toBeDisabled();
        fireEvent.click(screen.getByText('Record Transaction'));
        expect(inv.createAdjustment).not.toHaveBeenCalled();
    });

    it('Given negative stock is permitted by the org / When the balance would go below zero / Then the transaction is allowed', async () => {
        inv.getOrgDefaultLogic.mockResolvedValue({
            allow_negative_stock: true,
            auto_approve_transfers: false,
            allow_backdated_transactions: false,
            backdate_max_days: 0,
            allow_future_dated_transactions: false,
        });
        await openForm();
        await selectItem();
        fireEvent.click(screen.getByText('Stock Out'));
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        await waitFor(() => expect(inv.getStockAvailability).toHaveBeenCalled());
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'DAMAGE' } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '8' } });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(inv.createAdjustment).toHaveBeenCalledWith(
                expect.objectContaining({ quantity: -8 }),
            ),
        );
    });

    it('Given a blank quantity / When the form is submitted / Then the quantity is reported as required', async () => {
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'PURCHASE_RECEIPT' } });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(screen.getByTestId('error-quantity')).toHaveTextContent('Quantity is required.'),
        );
        expect(inv.createAdjustment).not.toHaveBeenCalled();
    });
});

describe('Given the transaction reason requirement', () => {
    it('Given a stock movement with no reason / When submitted / Then a reason is demanded and nothing is sent', async () => {
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(screen.getByTestId('error-reason')).toHaveTextContent(
                'Please select a transaction reason.',
            ),
        );
        expect(inv.createAdjustment).not.toHaveBeenCalled();
    });

    it('Given a Transfer / When the form renders / Then no reason is asked for', async () => {
        await openForm();
        fireEvent.click(screen.getByText('Transfer'));
        expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument();
    });
});

describe('Given the Party / Reference field', () => {
    it('Given a supplier receipt referenced as ((^*&% / When submitted / Then the reference is rejected', async () => {
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'PURCHASE_RECEIPT' } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Movement source'), { target: { value: 'supplier' } });
        fireEvent.change(screen.getByLabelText('Source party label'), {
            target: { value: '((^*&%' },
        });

        await waitFor(() =>
            expect(screen.getByTestId('error-source_label')).toHaveTextContent(
                'Party / Reference contains invalid characters.',
            ),
        );
        fireEvent.click(screen.getByText('Record Transaction'));
        expect(inv.createAdjustment).not.toHaveBeenCalled();
    });

    it('Given a supplier receipt with no reference at all / When submitted / Then the reference is demanded', async () => {
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'PURCHASE_RECEIPT' } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Movement source'), { target: { value: 'supplier' } });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(screen.getByTestId('error-source_label')).toHaveTextContent(
                'Party / Reference is required.',
            ),
        );
    });

    it('Given a valid document reference / When submitted / Then it reaches the API', async () => {
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'PURCHASE_RECEIPT' } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Movement source'), { target: { value: 'supplier' } });
        fireEvent.change(screen.getByLabelText('Source party label'), {
            target: { value: 'PO-1001' },
        });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(inv.createAdjustment).toHaveBeenCalledWith(
                expect.objectContaining({ source_label: 'PO-1001', source_type: 'supplier' }),
            ),
        );
    });

    it('Given an employee issue with a blank reference / When submitted / Then it is allowed because only outside-party movements demand one', async () => {
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'PURCHASE_RECEIPT' } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Movement source'), { target: { value: 'employee' } });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() => expect(inv.createAdjustment).toHaveBeenCalled());
    });
});

describe('Given the Project and Work Order allocation dropdowns', () => {
    it('Given no projects are available / When the form renders / Then it says so rather than only "Not linked"', async () => {
        await openForm();
        expect(
            within(screen.getByLabelText('Project')).getByText('No active projects available.'),
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Project')).toBeDisabled();
    });

    it('Given no work orders are available / When the form renders / Then it says so rather than only "Not linked"', async () => {
        await openForm();
        expect(
            within(screen.getByLabelText('Work order')).getByText(
                'No active work orders available.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Work order')).toBeDisabled();
    });

    it('Given active projects exist / When the form renders / Then they are selectable', async () => {
        inv.searchProjects.mockResolvedValue([
            { id: 'p-1', name: 'Marina Tower Fit-out' },
            { id: 'p-2', name: 'Warehouse Retrofit' },
        ]);
        await openForm();
        const select = screen.getByLabelText('Project');
        expect(within(select).getByText('Marina Tower Fit-out')).toBeInTheDocument();
        expect(select).not.toBeDisabled();
    });

    it('Given work orders exist / When rendered / Then each shows its number, description and status', async () => {
        inv.searchWorkOrders.mockResolvedValue([
            { id: 'wo-1', code: 'WO-0007', description: 'Frame assembly', status: 'in_progress' },
        ]);
        await openForm();
        expect(
            within(screen.getByLabelText('Work order')).getByText(
                'WO-0007 · Frame assembly · in_progress',
            ),
        ).toBeInTheDocument();
    });

    it('Given a project is selected / When work orders belong to other projects / Then only that project\'s orders remain', async () => {
        inv.searchProjects.mockResolvedValue([{ id: 'p-1', name: 'Marina Tower Fit-out' }]);
        inv.searchWorkOrders.mockResolvedValue([
            { id: 'wo-1', code: 'WO-0007', project_id: 'p-1', status: 'in_progress' },
            { id: 'wo-2', code: 'WO-0008', project_id: 'p-9', status: 'in_progress' },
        ]);
        await openForm();
        fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p-1' } });

        const woSelect = screen.getByLabelText('Work order');
        expect(within(woSelect).getByText(/WO-0007/)).toBeInTheDocument();
        expect(within(woSelect).queryByText(/WO-0008/)).not.toBeInTheDocument();
    });

    it('Given a production movement without a work order / When submitted / Then the work order is demanded beside its field', async () => {
        inv.searchWorkOrders.mockResolvedValue([
            { id: 'wo-1', code: 'WO-0007', status: 'in_progress' },
        ]);
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'PURCHASE_RECEIPT' } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Movement source'), {
            target: { value: 'production' },
        });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(screen.getByTestId('error-work_order')).toHaveTextContent(
                'Please select a work order.',
            ),
        );
    });

    it('Given a project-site movement without a project / When submitted / Then the project is demanded beside its field', async () => {
        inv.searchProjects.mockResolvedValue([{ id: 'p-1', name: 'Marina Tower Fit-out' }]);
        await openForm();
        await selectItem();
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'PURCHASE_RECEIPT' } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Movement source'), {
            target: { value: 'project_site' },
        });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(screen.getByTestId('error-project')).toHaveTextContent(
                'Please select a project.',
            ),
        );
    });
});

describe('Given a warehouse transfer', () => {
    it('Given no destination is chosen / When submitted / Then the destination is demanded', async () => {
        await openForm();
        await selectItem();
        fireEvent.click(screen.getByText('Transfer'));
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(screen.getByTestId('error-to_warehouse')).toHaveTextContent(
                'Please select a destination warehouse.',
            ),
        );
        expect(inv.createTransfer).not.toHaveBeenCalled();
    });

    it('Given source and destination are the same / When submitted / Then the clash is reported', async () => {
        await openForm();
        await selectItem();
        fireEvent.click(screen.getByText('Transfer'));
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Destination warehouse'), { target: { value: WH } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(screen.getByTestId('error-to_warehouse')).toHaveTextContent(
                'Source and destination warehouses must be different.',
            ),
        );
    });

    it('Given a transfer exceeding the source balance / When negative stock is disabled / Then it is blocked', async () => {
        await openForm();
        await selectItem();
        fireEvent.click(screen.getByText('Transfer'));
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        await waitFor(() => expect(inv.getStockAvailability).toHaveBeenCalled());
        fireEvent.change(screen.getByLabelText('Destination warehouse'), { target: { value: WH2 } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '50' } });

        await waitFor(() =>
            expect(screen.getByTestId('error-stock')).toHaveTextContent(
                'Insufficient stock available. Current balance is 5.',
            ),
        );
        fireEvent.click(screen.getByText('Record Transaction'));
        expect(inv.createTransfer).not.toHaveBeenCalled();
    });

    it('Given a valid transfer / When submitted / Then both warehouses and a positive quantity are sent', async () => {
        await openForm();
        await selectItem();
        fireEvent.click(screen.getByText('Transfer'));
        fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: WH } });
        await waitFor(() => expect(inv.getStockAvailability).toHaveBeenCalled());
        fireEvent.change(screen.getByLabelText('Destination warehouse'), { target: { value: WH2 } });
        fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });

        fireEvent.click(screen.getByText('Record Transaction'));

        await waitFor(() =>
            expect(inv.createTransfer).toHaveBeenCalledWith(
                expect.objectContaining({
                    from_warehouse_id: WH,
                    to_warehouse_id: WH2,
                    quantity: 5,
                }),
            ),
        );
    });
});

describe('Given the movement register list', () => {
    it('Given an adjustment row / When rendered / Then it carries an ADJUSTMENT badge', async () => {
        inv.getMovements.mockResolvedValue([movement()]);
        renderPage();
        await waitFor(() =>
            expect(screen.getByTestId('movement-type-badge')).toHaveTextContent('ADJUSTMENT'),
        );
    });

    it('Given transfer and adjustment rows / When rendered / Then their badges differ', async () => {
        inv.getMovements.mockResolvedValue([
            movement({ movement_type: 'adjustment', reference_number: 'ADJ-00012' }),
            movement({ movement_type: 'transfer', reference_number: 'TRF-00023', quantity: -50 }),
        ]);
        renderPage();
        await waitFor(() => expect(screen.getAllByTestId('movement-type-badge')).toHaveLength(2));
        const labels = screen
            .getAllByTestId('movement-type-badge')
            .map((el) => el.textContent);
        expect(labels).toEqual(['ADJUSTMENT', 'TRANSFER']);
    });

    it('Given an unrecognised movement type / When rendered / Then it degrades to a readable label', async () => {
        inv.getMovements.mockResolvedValue([movement({ movement_type: 'stock_take' })]);
        renderPage();
        await waitFor(() =>
            expect(screen.getByTestId('movement-type-badge')).toHaveTextContent('STOCK TAKE'),
        );
    });

    it('Given both legs of a transfer / When rendered / Then the route from source to destination is shown', async () => {
        inv.getMovements.mockResolvedValue([
            movement({
                movement_type: 'transfer',
                reference_number: 'TRF-00023',
                quantity: -50,
                warehouses: { name: 'City Distribution Centre' },
            }),
            movement({
                movement_type: 'transfer',
                reference_number: 'TRF-00023',
                quantity: 50,
                warehouses: { name: 'Dubai South Hub' },
            }),
        ]);
        renderPage();
        await waitFor(() =>
            expect(
                screen.getAllByText('City Distribution Centre → Dubai South Hub'),
            ).toHaveLength(2),
        );
    });

    it('Given only one leg of a transfer is loaded / When rendered / Then it falls back to that leg\'s warehouse', async () => {
        inv.getMovements.mockResolvedValue([
            movement({ movement_type: 'transfer', reference_number: 'TRF-00099', quantity: -50 }),
        ]);
        renderPage();
        await waitFor(() =>
            expect(screen.getByText('Dubai South Hub')).toBeInTheDocument(),
        );
    });

    it('Given an adjustment with a reason code / When rendered / Then the reason is spelled out', async () => {
        inv.getMovements.mockResolvedValue([movement({ reason_code: 'CYCLE_COUNT' })]);
        renderPage();
        await waitFor(() =>
            expect(screen.getByTestId('movement-reason')).toHaveTextContent('Cycle Count'),
        );
    });

    it('Given an unmapped reason code / When rendered / Then the raw code is humanised rather than blank', async () => {
        inv.getMovements.mockResolvedValue([movement({ reason_code: 'LEGACY_REASON' })]);
        renderPage();
        await waitFor(() =>
            expect(screen.getByTestId('movement-reason')).toHaveTextContent('LEGACY REASON'),
        );
    });

    it('Given an adjustment / When rendered / Then the balance reads before, delta and after', async () => {
        inv.getMovements.mockResolvedValue([movement()]);
        renderPage();
        await waitFor(() =>
            expect(screen.getByTestId('movement-balance')).toHaveTextContent('100 → -5 → 95'),
        );
    });

    it('Given the filter panel / When a transaction type is chosen / Then it is passed to the API', async () => {
        renderPage();
        await waitFor(() => expect(inv.getMovements).toHaveBeenCalled());
        fireEvent.click(screen.getByText('Filters'));
        fireEvent.change(screen.getByLabelText('Filter movement type'), {
            target: { value: 'transfer' },
        });

        await waitFor(() =>
            expect(inv.getMovements).toHaveBeenCalledWith(
                expect.objectContaining({ movement_type: 'transfer' }),
            ),
        );
    });
});
