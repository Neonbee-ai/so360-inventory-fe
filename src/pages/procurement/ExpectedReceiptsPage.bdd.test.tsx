import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockList = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/receivingService', () => ({ receivingService: { expectedReceipts: (...a: any[]) => mockList(...a) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));

import ExpectedReceiptsPage from './ExpectedReceiptsPage';

const row = (o: any = {}) => ({ id: 'er1', po_id: 'po-1', po: { po_number: 'PO-9' }, due_date: '2027-03-01', quantity: 100, accepted_qty: 40, pending_inspection_qty: 0, quarantined_qty: 0, open_qty: 60, status: 'partially_received', direct_to_site: false, inspection_required: true, ...o });

beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([row()]);
});

describe('ExpectedReceiptsPage (Pulse 4fe6cf16)', () => {
    it('Given a confirmed delivery, When loaded, Then it shows the quantities, destination and inspection hint', async () => {
        render(<ExpectedReceiptsPage />);
        expect(await screen.findByText('Partially received')).toBeInTheDocument();
        expect(screen.getByText('Warehouse')).toBeInTheDocument();
        expect(screen.getByText('Inspection')).toBeInTheDocument();
        expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('Given an open notice, When Receive is clicked, Then the goods receipt form opens prefilled from the notice', async () => {
        render(<ExpectedReceiptsPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Receive' }));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/grn/new?expected_receipt_id=er1');
    });

    it('Given a fully received notice, Then there is no Receive action', async () => {
        mockList.mockResolvedValue([row({ status: 'received', open_qty: 0 })]);
        render(<ExpectedReceiptsPage />);
        await screen.findByText('Received');
        expect(screen.queryByRole('button', { name: 'Receive' })).not.toBeInTheDocument();
    });

    it('Given a direct-to-site notice, Then the destination says so', async () => {
        mockList.mockResolvedValue([row({ direct_to_site: true })]);
        render(<ExpectedReceiptsPage />);
        expect(await screen.findByText('Direct to site')).toBeInTheDocument();
    });

    it('Given the PO link, When clicked, Then it opens the PO', async () => {
        render(<ExpectedReceiptsPage />);
        fireEvent.click(await screen.findByRole('button', { name: '#PO-9' }));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/po/po-1');
    });

    it('Given nothing is expected, Then the empty state shows', async () => {
        mockList.mockResolvedValue([]);
        render(<ExpectedReceiptsPage />);
        expect(await screen.findByText('No expected receipts.')).toBeInTheDocument();
    });

    it('Given a failure, Then the error is shown', async () => {
        mockList.mockRejectedValue(new Error('boom'));
        render(<ExpectedReceiptsPage />);
        await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    });

    it('Given the default view, Then the list is requested without a status filter', async () => {
        render(<ExpectedReceiptsPage />);
        await screen.findByText('Partially received');
        expect(mockList).toHaveBeenCalledWith({});
    });
});
