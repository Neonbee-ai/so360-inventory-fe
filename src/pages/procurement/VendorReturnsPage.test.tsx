import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetReturns = vi.fn();
const mockCreateReturn = vi.fn();
const mockUpdateReturnStatus = vi.fn();
const mockGetGRNs = vi.fn();

vi.mock('../../services/qualityService', () => ({
    qualityService: {
        getReturns: (...a: any[]) => mockGetReturns(...a),
        createReturn: (...a: any[]) => mockCreateReturn(...a),
        updateReturnStatus: (...a: any[]) => mockUpdateReturnStatus(...a),
    },
}));

vi.mock('../../services/procurementService', () => ({
    procurementService: { getGRNs: (...a: any[]) => mockGetGRNs(...a) },
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

import VendorReturnsPage from './VendorReturnsPage';

const makeReturn = (overrides: any = {}) => ({
    id: 'ret-1',
    return_number: 'VRN-2026-0001',
    vendor_name: 'Alpha Supplies',
    reason: 'quality_failure',
    resolution: 'credit_note',
    total_amount: 300,
    status: 'draft',
    grn: { grn_number: 'GRN-2026-001' },
    vendor_return_lines: [],
    ...overrides,
});

const makeGRN = (overrides: any = {}) => ({
    id: 'grn-1',
    grn_number: 'GRN-2026-001',
    po_id: 'po-1',
    vendor_id: 'v-1',
    warehouse_id: 'wh-1',
    goods_receipt_lines: [
        {
            id: 'grl-1',
            item_id: 'item-1',
            description: 'Cement 50kg',
            quantity_received: 10,
            rejected_quantity: 2,
            damaged_quantity: 1,
            unit_cost: 100,
        },
    ],
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetReturns.mockResolvedValue([makeReturn()]);
    mockCreateReturn.mockResolvedValue({ id: 'ret-2' });
    mockUpdateReturnStatus.mockResolvedValue({});
    mockGetGRNs.mockResolvedValue([makeGRN()]);
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
    vi.spyOn(toast, 'warning').mockReturnValue('t');
});

describe('VendorReturnsPage', () => {
    describe('Given returns exist', () => {
        it('When loaded / Then each return shows its vendor, reason, value and next step', async () => {
            render(<VendorReturnsPage />);
            await waitFor(() => expect(screen.getByText('VRN-2026-0001')).toBeInTheDocument());
            expect(screen.getByText('Alpha Supplies')).toBeInTheDocument();
            expect(screen.getByText('quality failure')).toBeInTheDocument();
            // The value appears both on the row and in the 'Value Returned' tile.
            expect(screen.getAllByText('$300').length).toBeGreaterThan(0);
            expect(screen.getByText('Approve →')).toBeInTheDocument();
        });

        it('When a return is settled / Then no further step is offered and the credit note is shown', async () => {
            mockGetReturns.mockResolvedValue([makeReturn({ status: 'settled', credit_note_number: 'CN-8891' })]);
            render(<VendorReturnsPage />);
            await waitFor(() => expect(screen.getByText('CN-8891')).toBeInTheDocument());
            expect(screen.queryByText(/→$/)).not.toBeInTheDocument();
        });
    });

    describe('Given a return is moved along', () => {
        it('When Approve is clicked / Then the status advances', async () => {
            render(<VendorReturnsPage />);
            await waitFor(() => screen.getByText('Approve →'));
            fireEvent.click(screen.getByText('Approve →'));

            await waitFor(() => {
                expect(mockUpdateReturnStatus).toHaveBeenCalledWith('ret-1', { status: 'approved' });
            });
        });

        it('When a dispatched credit-note return is settled / Then the credit note is collected first', async () => {
            mockGetReturns.mockResolvedValue([makeReturn({ status: 'dispatched' })]);
            render(<VendorReturnsPage />);
            await waitFor(() => screen.getByText('Settle →'));

            fireEvent.click(screen.getByText('Settle →'));
            // The API would reject a settle without the credit note, so the UI asks.
            await waitFor(() => expect(screen.getByLabelText('Credit Note Number')).toBeInTheDocument());
            expect(mockUpdateReturnStatus).not.toHaveBeenCalled();

            fireEvent.change(screen.getByLabelText('Credit Note Number'), { target: { value: 'CN-8891' } });
            fireEvent.click(screen.getByRole('button', { name: 'Settle' }));

            await waitFor(() => {
                expect(mockUpdateReturnStatus).toHaveBeenCalledWith('ret-1', expect.objectContaining({
                    status: 'settled',
                    credit_note_number: 'CN-8891',
                }));
            });
        });

        it('When a replacement return is dispatched / Then no credit note is demanded', async () => {
            mockGetReturns.mockResolvedValue([makeReturn({ status: 'approved', resolution: 'replacement' })]);
            render(<VendorReturnsPage />);
            await waitFor(() => screen.getByText('Mark Dispatched →'));

            fireEvent.click(screen.getByText('Mark Dispatched →'));
            await waitFor(() => {
                expect(mockUpdateReturnStatus).toHaveBeenCalledWith('ret-1', { status: 'dispatched' });
            });
        });
    });

    describe('Given a new return is raised from a receipt', () => {
        const openForm = async () => {
            render(<VendorReturnsPage />);
            await waitFor(() => screen.getByText('+ New Return'));
            fireEvent.click(screen.getByText('+ New Return'));
            await waitFor(() => expect(mockGetGRNs).toHaveBeenCalled());
            fireEvent.change(screen.getByLabelText('Goods Receipt'), { target: { value: 'grn-1' } });
            await waitFor(() => screen.getByLabelText('Return quantity for Cement 50kg'));
        };

        it('When the receipt is chosen / Then lines default to what was rejected on arrival', async () => {
            await openForm();
            // 2 rejected + 1 damaged.
            expect(screen.getByLabelText('Return quantity for Cement 50kg')).toHaveValue(3);
            expect(screen.getByLabelText('Already excluded from stock for Cement 50kg')).toBeChecked();
        });

        it('When submitted / Then the return carries the receipt, reason and never-stocked flag', async () => {
            await openForm();
            fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'expired' } });
            fireEvent.click(screen.getByText('Raise Return'));

            await waitFor(() => {
                expect(mockCreateReturn).toHaveBeenCalledWith(expect.objectContaining({
                    grn_id: 'grn-1',
                    vendor_id: 'v-1',
                    warehouse_id: 'wh-1',
                    reason: 'expired',
                    resolution: 'credit_note',
                    items: [expect.objectContaining({
                        grn_line_id: 'grl-1',
                        quantity: 3,
                        unit_cost: 100,
                        already_excluded_from_stock: true,
                    })],
                }));
            });
        });

        it('When more is returned than was received / Then submission is blocked', async () => {
            await openForm();
            fireEvent.change(screen.getByLabelText('Return quantity for Cement 50kg'), { target: { value: '25' } });
            fireEvent.click(screen.getByText('Raise Return'));

            await waitFor(() => {
                expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('more than the 10 units received'));
            });
            expect(mockCreateReturn).not.toHaveBeenCalled();
        });

        it('When stock WAS taken in / Then the never-stocked flag can be cleared so dispatch decrements inventory', async () => {
            mockGetGRNs.mockResolvedValue([makeGRN({
                goods_receipt_lines: [{
                    id: 'grl-1', item_id: 'item-1', description: 'Cement 50kg',
                    quantity_received: 10, rejected_quantity: 0, damaged_quantity: 0, unit_cost: 100,
                }],
            })]);
            await openForm();

            // Nothing was rejected on arrival, so the line starts un-flagged.
            expect(screen.getByLabelText('Already excluded from stock for Cement 50kg')).not.toBeChecked();

            fireEvent.change(screen.getByLabelText('Return quantity for Cement 50kg'), { target: { value: '4' } });
            fireEvent.click(screen.getByText('Raise Return'));

            await waitFor(() => {
                expect(mockCreateReturn).toHaveBeenCalledWith(expect.objectContaining({
                    items: [expect.objectContaining({ quantity: 4, already_excluded_from_stock: false })],
                }));
            });
        });
    });
});
