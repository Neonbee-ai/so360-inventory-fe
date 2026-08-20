import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetInspections = vi.fn();
const mockCompleteInspection = vi.fn();
const mockCreateInspection = vi.fn();
const mockGetGRNs = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/qualityService', () => ({
    qualityService: {
        getInspections: (...a: any[]) => mockGetInspections(...a),
        completeInspection: (...a: any[]) => mockCompleteInspection(...a),
        createInspection: (...a: any[]) => mockCreateInspection(...a),
    },
}));

vi.mock('../../services/procurementService', () => ({
    procurementService: { getGRNs: (...a: any[]) => mockGetGRNs(...a) },
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

import QualityInspectionPage from './QualityInspectionPage';

const makeInspection = (overrides: any = {}) => ({
    id: 'qc-1',
    inspection_number: 'QC-2026-0001',
    status: 'pending',
    result: null,
    grn_id: 'grn-1',
    grn: { grn_number: 'GRN-2026-001' },
    created_at: '2026-08-14T00:00:00Z',
    quality_inspection_lines: [
        { id: 'qcl-1', description: 'Cement 50kg', received_quantity: 10, accepted_quantity: 0, rejected_quantity: 0 },
    ],
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetInspections.mockResolvedValue([makeInspection()]);
    mockCompleteInspection.mockResolvedValue({
        summary: { result: 'partial', accepted: 7, rejected: 3, stock_released: true },
    });
    mockCreateInspection.mockResolvedValue({ id: 'qc-2' });
    mockGetGRNs.mockResolvedValue([{ id: 'grn-1', grn_number: 'GRN-2026-001', po: { po_number: 'PO-1' } }]);
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
    vi.spyOn(toast, 'warning').mockReturnValue('t');
});

describe('QualityInspectionPage', () => {
    describe('Given inspections are queued', () => {
        it('When loaded / Then pending inspections invite a result to be recorded', async () => {
            render(<QualityInspectionPage />);
            await waitFor(() => expect(screen.getByText('QC-2026-0001')).toBeInTheDocument());
            expect(screen.getByText('GRN-2026-001')).toBeInTheDocument();
            expect(screen.getByText('Record Result →')).toBeInTheDocument();
        });

        it('When an inspection is completed / Then its result is shown instead of an action', async () => {
            mockGetInspections.mockResolvedValue([makeInspection({ status: 'completed', result: 'passed' })]);
            render(<QualityInspectionPage />);
            await waitFor(() => expect(screen.getByText('passed')).toBeInTheDocument());
            expect(screen.queryByText('Record Result →')).not.toBeInTheDocument();
        });

        it('When nothing is queued / Then the empty state explains how receipts get here', async () => {
            mockGetInspections.mockResolvedValue([]);
            render(<QualityInspectionPage />);
            await waitFor(() => {
                expect(screen.getByText(/No inspections yet/)).toBeInTheDocument();
            });
        });
    });

    describe('Given an inspector records a result', () => {
        const openForm = async () => {
            render(<QualityInspectionPage />);
            await waitFor(() => screen.getByText('Record Result →'));
            fireEvent.click(screen.getByText('Record Result →'));
            await waitFor(() => screen.getByLabelText('Accepted quantity for Cement 50kg'));
        };

        it('When the form opens / Then accepted defaults to everything submitted', async () => {
            await openForm();
            expect(screen.getByLabelText('Accepted quantity for Cement 50kg')).toHaveValue(10);
            expect(screen.getByLabelText('Rejected quantity for Cement 50kg')).toHaveValue(0);
        });

        it('When units are rejected / Then defect fields appear and the result is submitted', async () => {
            await openForm();

            fireEvent.change(screen.getByLabelText('Accepted quantity for Cement 50kg'), { target: { value: '7' } });
            fireEvent.change(screen.getByLabelText('Rejected quantity for Cement 50kg'), { target: { value: '3' } });

            await waitFor(() => screen.getByLabelText('Defect code for Cement 50kg'));
            fireEvent.change(screen.getByLabelText('Defect code for Cement 50kg'), { target: { value: 'WET' } });
            fireEvent.change(screen.getByLabelText('Rejection reason for Cement 50kg'), { target: { value: 'Moisture damage' } });
            fireEvent.click(screen.getByText('Record & Release Stock'));

            await waitFor(() => {
                expect(mockCompleteInspection).toHaveBeenCalledWith('qc-1', expect.objectContaining({
                    lines: [expect.objectContaining({
                        line_id: 'qcl-1',
                        accepted_quantity: 7,
                        rejected_quantity: 3,
                        defect_code: 'WET',
                        rejection_reason: 'Moisture damage',
                    })],
                }));
            });
        });

        it('When accepted plus rejected exceeds what was submitted / Then submission is blocked', async () => {
            await openForm();

            fireEvent.change(screen.getByLabelText('Accepted quantity for Cement 50kg'), { target: { value: '8' } });
            fireEvent.change(screen.getByLabelText('Rejected quantity for Cement 50kg'), { target: { value: '5' } });
            fireEvent.click(screen.getByText('Record & Release Stock'));

            await waitFor(() => {
                expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('exceeds the 10 units submitted'));
            });
            expect(mockCompleteInspection).not.toHaveBeenCalled();
        });

        it('When the result is saved / Then the released quantity is reported back', async () => {
            await openForm();
            fireEvent.click(screen.getByText('Record & Release Stock'));

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Inspection partial — 7 units released to stock');
            });
        });

        it('When the backend rejects the result / Then its reason is surfaced', async () => {
            mockCompleteInspection.mockRejectedValue(new Error('This inspection is already completed'));
            await openForm();
            fireEvent.click(screen.getByText('Record & Release Stock'));

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('This inspection is already completed');
            });
        });
    });

    describe('Given an inspection is opened by hand', () => {
        it('When no receipt is chosen / Then it is blocked', async () => {
            render(<QualityInspectionPage />);
            await waitFor(() => screen.getByText('+ Open Inspection'));
            fireEvent.click(screen.getByText('+ Open Inspection'));

            await waitFor(() => screen.getByLabelText('Goods Receipt'));
            fireEvent.click(screen.getByRole('button', { name: 'Open Inspection' }));

            await waitFor(() => {
                expect(toast.warning).toHaveBeenCalledWith('Select the goods receipt to inspect.');
            });
            expect(mockCreateInspection).not.toHaveBeenCalled();
        });

        it('When a receipt is chosen / Then the inspection is opened against it', async () => {
            render(<QualityInspectionPage />);
            await waitFor(() => screen.getByText('+ Open Inspection'));
            fireEvent.click(screen.getByText('+ Open Inspection'));

            await waitFor(() => expect(mockGetGRNs).toHaveBeenCalled());
            // The fetch resolving is not the same as React having committed the
            // options: changing a <select> to a value with no matching <option>
            // leaves it '', the submit warns, and createInspection never fires.
            // Wait for the option list itself before selecting.
            await waitFor(() => {
                const select = screen.getByLabelText('Goods Receipt') as HTMLSelectElement;
                expect(select.options.length).toBeGreaterThan(1);
            });
            fireEvent.change(screen.getByLabelText('Goods Receipt'), { target: { value: 'grn-1' } });
            fireEvent.click(screen.getByRole('button', { name: 'Open Inspection' }));

            await waitFor(() => {
                expect(mockCreateInspection).toHaveBeenCalledWith({ grn_id: 'grn-1' });
            });
        });
    });
});
