import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

import VendorReturnsPage from './VendorReturnsPage';

const ret = (o: any = {}) => ({
    id: 'ret-1', return_number: 'VRN-1', vendor_name: 'Alpha Supplies', reason: 'quality_failure',
    resolution: 'credit_note', total_amount: 300, status: 'draft', grn: { grn_number: 'GRN-1' }, ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetReturns.mockResolvedValue([ret()]);
    mockGetGRNs.mockResolvedValue([]);
    mockUpdateReturnStatus.mockResolvedValue({});
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
    vi.spyOn(toast, 'warning').mockReturnValue('t');
});

const openForm = async () => {
    render(<VendorReturnsPage />);
    await waitFor(() => screen.getByText('+ New Return'));
    fireEvent.click(screen.getByText('+ New Return'));
    await screen.findByRole('dialog', { name: 'New Vendor Return' });
};

describe('VendorReturnsPage inline validation (AQA L10)', () => {
    it('Given the form is empty, When Raise Return is clicked, Then the receipt field shows a required error', async () => {
        await openForm();
        fireEvent.click(screen.getByText('Raise Return'));
        expect(await screen.findByText('Goods receipt is required.')).toBeInTheDocument();
        expect(screen.getByLabelText('Goods Receipt')).toHaveAttribute('aria-invalid', 'true');
        expect(mockCreateReturn).not.toHaveBeenCalled();
    });

    it('Given remarks over 500 characters, When submitted, Then a max-length error shows and nothing is written', async () => {
        await openForm();
        fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: 'a'.repeat(501) } });
        fireEvent.click(screen.getByText('Raise Return'));
        expect(await screen.findByText('Remarks must be at most 500 characters.')).toBeInTheDocument();
        expect(screen.getByLabelText('Remarks')).toHaveAttribute('aria-invalid', 'true');
        expect(mockCreateReturn).not.toHaveBeenCalled();
    });

    it('Given remarks with markup, When submitted, Then an invalid-format error shows', async () => {
        await openForm();
        fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: '<script>alert(1)</script>' } });
        fireEvent.click(screen.getByText('Raise Return'));
        expect(await screen.findByText(/Remarks is invalid/)).toBeInTheDocument();
        expect(mockCreateReturn).not.toHaveBeenCalled();
    });

    it('Given a receipt error is showing, When the user edits remarks, Then the remarks error clears', async () => {
        await openForm();
        fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: 'x'.repeat(501) } });
        fireEvent.click(screen.getByText('Raise Return'));
        await screen.findByText('Remarks must be at most 500 characters.');
        fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: 'ok' } });
        expect(screen.queryByText('Remarks must be at most 500 characters.')).not.toBeInTheDocument();
    });
});
