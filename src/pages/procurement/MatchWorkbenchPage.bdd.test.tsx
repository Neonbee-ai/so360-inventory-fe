import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockCases = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/matchService', () => ({ matchService: { cases: (...a: any[]) => mockCases(...a) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));

import MatchWorkbenchPage from './MatchWorkbenchPage';

const row = (o: any = {}) => ({ id: 'c1', status: 'exception', invoice: { invoice_number: 'INV-1', total_amount: 1200 }, po: { po_number: 'PO-9' }, open_exceptions: 2, owners: ['procurement', 'finance'], next_due_at: '2027-03-01', finance_status: 'pending_approval', ...o });

beforeEach(() => {
    vi.clearAllMocks();
    mockCases.mockResolvedValue([row()]);
});

describe('MatchWorkbenchPage (Pulse 559f6d73)', () => {
    it('Given an invoice with issues, When loaded, Then it shows status, open issues and who is being waited on', async () => {
        render(<MatchWorkbenchPage />);
        expect(await screen.findByText('Exception')).toBeInTheDocument();
        expect(screen.getByText('Procurement, Finance')).toBeInTheDocument();
        expect(screen.getByText('pending approval')).toBeInTheDocument();
        expect(screen.getByText('$1200')).toBeInTheDocument();
    });
    it('Given an invoice, When opened, Then the case page opens', async () => {
        render(<MatchWorkbenchPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'INV-1' }));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/match-cases/c1');
    });
    it('Given a Finance hold, Then it is labelled as Finance owned', async () => {
        mockCases.mockResolvedValue([row({ status: 'on_hold' })]);
        render(<MatchWorkbenchPage />);
        expect(await screen.findByText('On hold (Finance)')).toBeInTheDocument();
    });
    it('Given no invoices, Then the empty state shows', async () => {
        mockCases.mockResolvedValue([]);
        render(<MatchWorkbenchPage />);
        expect(await screen.findByText('No invoices to match.')).toBeInTheDocument();
    });
    it('Given a failure, Then the error is shown', async () => {
        mockCases.mockRejectedValue(new Error('boom'));
        render(<MatchWorkbenchPage />);
        await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    });
    it('Given the default queue, Then every invoice is requested without filters', async () => {
        render(<MatchWorkbenchPage />);
        await screen.findByText('Exception');
        expect(mockCases).toHaveBeenCalledWith({});
    });
});
