import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetReport = vi.fn();

vi.mock('../../services/procurementInsightsService', () => ({
    procurementInsightsService: {
        getReport: (...a: any[]) => mockGetReport(...a),
    },
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

import ProcurementReportsPage from './ProcurementReportsPage';

beforeEach(() => {
    vi.clearAllMocks();
    mockGetReport.mockResolvedValue({
        report: 'purchase_register',
        rows: [
            { po_number: 'PO-001', vendor_name: 'Alpha Supplies', status: 'received', total: 1200 },
        ],
    });
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'warning').mockReturnValue('t');
});

describe('ProcurementReportsPage', () => {
    describe('Given the report pack opens', () => {
        it('When it loads / Then the purchase register runs by default', async () => {
            render(<ProcurementReportsPage />);
            await waitFor(() => {
                expect(mockGetReport).toHaveBeenCalledWith('purchase_register', expect.any(Object));
            });
            expect(screen.getByText('PO-001')).toBeInTheDocument();
        });

        it('When it loads / Then columns are derived from the rows and made readable', async () => {
            render(<ProcurementReportsPage />);
            await waitFor(() => expect(screen.getByText('Po Number')).toBeInTheDocument());
            expect(screen.getByText('Vendor Name')).toBeInTheDocument();
            // Money columns are formatted, not printed raw.
            expect(screen.getByText('$1200')).toBeInTheDocument();
        });

        it('When another report is chosen / Then it is run', async () => {
            render(<ProcurementReportsPage />);
            await waitFor(() => screen.getByText('Delayed Deliveries'));

            mockGetReport.mockResolvedValue({ report: 'delayed_deliveries', rows: [] });
            fireEvent.click(screen.getByText('Delayed Deliveries'));

            await waitFor(() => {
                expect(mockGetReport).toHaveBeenCalledWith('delayed_deliveries', expect.any(Object));
            });
        });

        it('When a date range is applied / Then it is passed to the report', async () => {
            render(<ProcurementReportsPage />);
            await waitFor(() => screen.getByLabelText('From'));

            fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
            fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-14' } });
            fireEvent.click(screen.getByText('Run'));

            await waitFor(() => {
                expect(mockGetReport).toHaveBeenLastCalledWith('purchase_register', {
                    from: '2026-01-01',
                    to: '2026-08-14',
                    vendor_id: undefined,
                    project_id: undefined,
                });
            });
        });

        it('When a report returns nothing / Then an empty state is shown', async () => {
            mockGetReport.mockResolvedValue({ report: 'savings', rows: [] });
            render(<ProcurementReportsPage />);
            await waitFor(() => expect(screen.getByText('No rows for this report.')).toBeInTheDocument());
        });

        it('When the report fails / Then the reason is surfaced', async () => {
            mockGetReport.mockRejectedValue(new Error('Unknown report "x"'));
            render(<ProcurementReportsPage />);
            await waitFor(() => expect(screen.getByText('Unknown report "x"')).toBeInTheDocument());
        });
    });

    describe('Given the buyer exports', () => {
        it('When there are no rows / Then the export is refused rather than writing an empty file', async () => {
            mockGetReport.mockResolvedValue({ report: 'savings', rows: [] });
            render(<ProcurementReportsPage />);
            await waitFor(() => screen.getByText('Export CSV'));

            fireEvent.click(screen.getByText('Export CSV'));
            expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Nothing to export'));
        });

        it('When rows exist / Then a CSV of exactly those rows is produced', async () => {
            const createObjectURL = vi.fn(() => 'blob:mock');
            const revokeObjectURL = vi.fn();
            vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
            const clickSpy = vi
                .spyOn(HTMLAnchorElement.prototype, 'click')
                .mockImplementation(() => undefined);

            render(<ProcurementReportsPage />);
            await waitFor(() => screen.getByText('PO-001'));
            fireEvent.click(screen.getByText('Export CSV'));

            expect(createObjectURL).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalledWith('Exported 1 row(s)');

            vi.unstubAllGlobals();
        });
    });
});
