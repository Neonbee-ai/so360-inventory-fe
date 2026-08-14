import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetComparison = vi.fn();
const mockAwardRFQ = vi.fn();
const mockGradeQuotation = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/rfqService', () => ({
    rfqService: {
        getComparison: (...args: any[]) => mockGetComparison(...args),
        awardRFQ: (...args: any[]) => mockAwardRFQ(...args),
        gradeQuotation: (...args: any[]) => mockGradeQuotation(...args),
    },
}));

vi.mock('react-router-dom', () => ({
    useParams: () => ({ id: 'rfq-1' }),
    useNavigate: () => mockNavigate,
}));

vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({
        formatDate: (d: string) => d ?? '',
        formatDateTime: (d: string) => d ?? '',
        formatCurrency: (v: number) => `$${v}`,
        formatNumber: (n: number) => String(n),
        currency: 'USD',
        locale: 'en-US',
        timezone: 'UTC',
    }),
    useInventoryCurrencySymbol: () => '$',
}));

import RFQComparisonPage from './RFQComparisonPage';

const makeQuotation = (overrides: any = {}) => ({
    quotation_id: 'q-1',
    vendor_id: 'v-1',
    vendor_name: 'Alpha Supplies',
    quotation_number: 'Q-1001',
    valid_until: '2026-12-31',
    is_expired: false,
    status: 'received',
    subtotal_amount: 1000,
    discount_amount: 0,
    tax_amount: 50,
    freight_amount: 25,
    total_amount: 1075,
    lead_time_days: 5,
    payment_terms: 'Net 30',
    delivery_terms: 'Door delivery',
    incoterms: 'DDP',
    warranty_terms: '12 months',
    moq_note: '10 bags',
    quality_rating: 4.2,
    is_lowest_total: true,
    is_fastest: true,
    is_best_rated: false,
    lines: { 'line-1': { unit_price: 100, line_total: 1000 } },
    ...overrides,
});

const makeComparison = (overrides: any = {}) => ({
    rfq: { id: 'rfq-1', rfq_number: 'RFQ-2026-0001', title: 'Cement supply', status: 'sent', currency: 'USD' },
    lines: [{ rfq_line_id: 'line-1', description: 'Cement 50kg', quantity: 10, uom: 'BAG', target_unit_price: 95, lowest_unit_price: 100 }],
    quotations: [makeQuotation()],
    summary: { quotation_count: 1, invited_count: 3, responded_count: 1, lowest_total: 1075, fastest_lead_time_days: 5, potential_saving: 0 },
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetComparison.mockResolvedValue(makeComparison());
    mockAwardRFQ.mockResolvedValue({ rfq: {}, po: { id: 'po-1', po_number: 'PO-1' } });
    mockGradeQuotation.mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(toast, 'success').mockReturnValue('toast-id');
    vi.spyOn(toast, 'error').mockReturnValue('toast-id');
    vi.spyOn(toast, 'warning').mockReturnValue('toast-id');
});

describe('RFQComparisonPage', () => {
    describe('Given quotations are being compared', () => {
        it('When loaded / Then every commercial axis a buyer decides on is shown', async () => {
            render(<RFQComparisonPage />);
            await waitFor(() => expect(screen.getByText('Landed Total')).toBeInTheDocument());

            for (const axis of ['Lead Time', 'Payment Terms', 'Delivery Terms', 'Incoterms', 'Warranty', 'MOQ', 'Quality Rating']) {
                expect(screen.getByText(axis)).toBeInTheDocument();
            }
        });

        it('When a quotation is cheapest and fastest / Then it carries both badges', async () => {
            render(<RFQComparisonPage />);
            await waitFor(() => expect(screen.getByText('Lowest')).toBeInTheDocument());
            expect(screen.getByText('Fastest')).toBeInTheDocument();
        });

        it('When a vendor has a rating / Then it is rendered out of 5', async () => {
            render(<RFQComparisonPage />);
            await waitFor(() => expect(screen.getByText('4.2 / 5')).toBeInTheDocument());
        });

        it('When a vendor did not quote a line / Then the cell says so rather than showing a price', async () => {
            mockGetComparison.mockResolvedValue(makeComparison({
                quotations: [makeQuotation({ lines: {} })],
            }));
            render(<RFQComparisonPage />);
            await waitFor(() => expect(screen.getByText('Not quoted')).toBeInTheDocument());
        });

        it('When the sourcing saved money / Then the potential saving is summarised', async () => {
            mockGetComparison.mockResolvedValue(makeComparison({
                summary: { quotation_count: 2, invited_count: 3, responded_count: 2, lowest_total: 1000, fastest_lead_time_days: 5, potential_saving: 200 },
            }));
            render(<RFQComparisonPage />);
            await waitFor(() => expect(screen.getByText('Potential Saving')).toBeInTheDocument());
            expect(screen.getByText('$200')).toBeInTheDocument();
        });
    });

    describe('Given an expired quotation', () => {
        it('When loaded / Then it is badged expired and its Award button is disabled', async () => {
            mockGetComparison.mockResolvedValue(makeComparison({
                quotations: [makeQuotation({ is_expired: true, is_lowest_total: false, is_fastest: false })],
            }));
            render(<RFQComparisonPage />);

            await waitFor(() => expect(screen.getByText('Expired')).toBeInTheDocument());
            expect(screen.getByRole('button', { name: /Award/i })).toBeDisabled();
        });
    });

    describe('Given the buyer awards a quotation', () => {
        it('When Award is clicked / Then the quotation and justification are submitted and the PO is opened', async () => {
            render(<RFQComparisonPage />);
            await waitFor(() => screen.getByRole('button', { name: /Award/i }));

            fireEvent.change(screen.getByLabelText('Award Justification'), {
                target: { value: 'Best overall value' },
            });
            fireEvent.click(screen.getByRole('button', { name: /Award/i }));

            await waitFor(() => {
                expect(mockAwardRFQ).toHaveBeenCalledWith('rfq-1', {
                    quotation_id: 'q-1',
                    justification: 'Best overall value',
                });
            });
            expect(mockNavigate).toHaveBeenCalledWith('/procurement/po/po-1');
        });

        it('When the award is cancelled at the confirm / Then nothing is submitted', async () => {
            (window.confirm as any).mockReturnValue(false);
            render(<RFQComparisonPage />);
            await waitFor(() => screen.getByRole('button', { name: /Award/i }));

            fireEvent.click(screen.getByRole('button', { name: /Award/i }));
            expect(mockAwardRFQ).not.toHaveBeenCalled();
        });

        it('When the award fails / Then the backend reason is surfaced', async () => {
            mockAwardRFQ.mockRejectedValue(new Error('Quotation expired on 2026-01-01'));
            render(<RFQComparisonPage />);
            await waitFor(() => screen.getByRole('button', { name: /Award/i }));

            fireEvent.click(screen.getByRole('button', { name: /Award/i }));
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Quotation expired on 2026-01-01');
            });
        });
    });

    describe('Given the RFQ has already been awarded', () => {
        it('When loaded / Then the decision controls are gone', async () => {
            mockGetComparison.mockResolvedValue(makeComparison({
                rfq: { id: 'rfq-1', rfq_number: 'RFQ-2026-0001', status: 'awarded' },
                quotations: [makeQuotation({ status: 'awarded' })],
            }));
            render(<RFQComparisonPage />);

            await waitFor(() => expect(screen.getByText('Landed Total')).toBeInTheDocument());
            expect(screen.queryByRole('button', { name: /Award/i })).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Award Justification')).not.toBeInTheDocument();
        });
    });

    describe('Given quotations are being graded', () => {
        it('When Shortlist is clicked / Then the quotation is shortlisted and the view refreshes', async () => {
            render(<RFQComparisonPage />);
            await waitFor(() => screen.getByText('Shortlist'));

            fireEvent.click(screen.getByText('Shortlist'));
            await waitFor(() => {
                expect(mockGradeQuotation).toHaveBeenCalledWith('q-1', { status: 'shortlisted' });
            });
            expect(mockGetComparison).toHaveBeenCalledTimes(2);
        });
    });

    describe('Given nobody has quoted yet', () => {
        it('When loaded / Then an empty state replaces the matrix', async () => {
            mockGetComparison.mockResolvedValue(makeComparison({ quotations: [] }));
            render(<RFQComparisonPage />);
            await waitFor(() => {
                expect(screen.getByText('No quotations to compare yet.')).toBeInTheDocument();
            });
        });
    });

    describe('Given the comparison cannot be loaded', () => {
        it('When the request fails / Then the error is shown with a way back', async () => {
            mockGetComparison.mockRejectedValue(new Error('RFQ not found'));
            render(<RFQComparisonPage />);
            await waitFor(() => expect(screen.getByText('RFQ not found')).toBeInTheDocument());
            expect(screen.getByText('Back to RFQs')).toBeInTheDocument();
        });
    });
});
