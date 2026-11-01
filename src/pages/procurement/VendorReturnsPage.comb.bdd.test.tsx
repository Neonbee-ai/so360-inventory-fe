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

describe('VendorReturnsPage (Comb)', () => {
    it('Given returns exist, When rendered, Then the list floorplan shows the title and New Return action', async () => {
        const { container } = render(<VendorReturnsPage />);
        await waitFor(() => expect(screen.getByText('VRN-1')).toBeInTheDocument());
        expect(container.querySelector('[data-template="list"]')).not.toBeNull();
        expect(screen.getByRole('heading', { name: 'Vendor Returns' })).toBeInTheDocument();
        expect(screen.getByText('+ New Return')).toBeInTheDocument();
    });

    it('Given the request is pending, When rendered, Then the loading skeleton is shown', () => {
        mockGetReturns.mockReturnValue(new Promise(() => {}));
        const { container } = render(<VendorReturnsPage />);
        expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    });

    it('Given no returns, When loaded, Then the empty state is shown', async () => {
        mockGetReturns.mockResolvedValue([]);
        render(<VendorReturnsPage />);
        await waitFor(() => expect(screen.getByText('No vendor returns raised.')).toBeInTheDocument());
    });

    it('Given a draft return, When Approve is clicked, Then the status advances', async () => {
        render(<VendorReturnsPage />);
        await waitFor(() => screen.getByText('Approve →'));
        fireEvent.click(screen.getByText('Approve →'));
        await waitFor(() => expect(mockUpdateReturnStatus).toHaveBeenCalledWith('ret-1', { status: 'approved' }));
    });

    it('Given the form is open, When rendered, Then the footer carries Cancel then Raise Return', async () => {
        render(<VendorReturnsPage />);
        await waitFor(() => screen.getByText('+ New Return'));
        fireEvent.click(screen.getByText('+ New Return'));
        const dialog = await screen.findByRole('dialog', { name: 'New Vendor Return' });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Raise Return')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Raise Return'));
        expect(toast.warning).toHaveBeenCalledWith('Select the receipt the goods came in on.');
        expect(mockCreateReturn).not.toHaveBeenCalled();
    });

    it('Given the load fails, When the request errors, Then the reason is shown', async () => {
        mockGetReturns.mockRejectedValue(new Error('Permission denied'));
        render(<VendorReturnsPage />);
        await waitFor(() => expect(screen.getByText('Permission denied')).toBeInTheDocument());
    });

    it('Given returns of mixed state, When rendered, Then the KPI row shows open, awaiting credit, settled and value', async () => {
        mockGetReturns.mockResolvedValue([
            ret(),
            ret({ id: 'ret-2', return_number: 'VRN-2', status: 'dispatched', resolution: 'credit_note', total_amount: 200 }),
            ret({ id: 'ret-3', return_number: 'VRN-3', status: 'settled', total_amount: 100 }),
        ]);
        render(<VendorReturnsPage />);
        await waitFor(() => expect(screen.getByText('VRN-1')).toBeInTheDocument());
        const kpis = within(screen.getByTestId('vendor-returns-kpis'));
        for (const label of ['Open Returns', 'Awaiting Credit', 'Settled', 'Value Returned']) {
            expect(kpis.getByText(label)).toBeInTheDocument();
        }
        expect(kpis.getByText('2')).toBeInTheDocument();
        expect(kpis.getAllByText('1')).toHaveLength(2);
        expect(kpis.getByText('$600')).toBeInTheDocument();
    });
});
