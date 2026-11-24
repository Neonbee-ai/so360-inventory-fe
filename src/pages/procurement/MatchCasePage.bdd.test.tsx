import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockDetail = vi.fn();
const mockUpdate = vi.fn();
const mockReeval = vi.fn();
let mockCanFinance = false;
vi.mock('../../services/matchService', () => ({ matchService: { caseDetail: (...a: any[]) => mockDetail(...a), updateException: (...a: any[]) => mockUpdate(...a), reevaluate: (...a: any[]) => mockReeval(...a) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ id: 'c1' }) }));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ hasPermission: (p: string) => (p === 'match_exceptions.resolve_finance' ? mockCanFinance : true) }) }));

import MatchCasePage from './MatchCasePage';

const detail = () => ({
    id: 'c1', status: 'exception', finance_status: 'pending_approval', finance_hold: false, po_version: 2, tolerance_version: 0, last_sent_to_finance_at: '2027-01-01T00:00:00Z',
    invoice: { invoice_number: 'INV-1', total_amount: 1200 }, po: { id: 'po-1', po_number: 'PO-9' },
    result: { invoice_total: 1200, expected_total: 1000, lines: [{ po_line_id: 'abcdef123456', ordered: 100, accepted: 90, invoiced: 100, po_unit_price: 10, invoice_unit_price: 12, ok: false }] },
    exceptions: [
        { id: 'e1', type: 'price', owner_module: 'procurement', status: 'open', due_at: '2027-03-01', expected: { unit_price: 10 }, actual: { unit_price: 12 }, history: [{ id: 'h1', action: 'opened', created_at: '2027-01-01', note: null }] },
        { id: 'e2', type: 'duplicate', owner_module: 'finance', status: 'open', due_at: '2027-03-01', expected: {}, actual: { duplicate: true }, history: [] },
    ],
});

beforeEach(() => {
    vi.clearAllMocks();
    mockCanFinance = false;
    mockDetail.mockResolvedValue(detail());
    mockUpdate.mockResolvedValue({});
    mockReeval.mockResolvedValue({});
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
    vi.spyOn(toast, 'warning').mockReturnValue('t');
});

describe('MatchCasePage (Pulse 559f6d73)', () => {
    it('Given a case, Then the line grid shows PO, accepted and invoiced and Finance status is read-only', async () => {
        render(<MatchCasePage />);
        expect(await screen.findByText('Differs')).toBeInTheDocument();
        expect(screen.getByText('pending approval')).toBeInTheDocument();
        expect(screen.getByText(/A match is not a payment/)).toBeInTheDocument();
    });
    it('Given a Finance-owned exception and no Finance right, Then Procurement sees "Finance decides" and no action', async () => {
        render(<MatchCasePage />);
        expect(await screen.findByText('Finance decides')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Work on' })).toHaveLength(1);
    });
    it('Given the Finance right, Then the Finance exception can be worked on', async () => {
        mockCanFinance = true;
        render(<MatchCasePage />);
        await screen.findByText('Differs');
        expect(screen.getAllByRole('button', { name: 'Work on' })).toHaveLength(2);
    });
    it('Given resolving without a note, Then it is blocked before any request', async () => {
        render(<MatchCasePage />);
        fireEvent.click((await screen.findAllByRole('button', { name: 'Work on' }))[0]);
        fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'resolved' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('resolution note')));
        expect(mockUpdate).not.toHaveBeenCalled();
    });
    it('Given a note and evidence, When saved, Then the exception is updated on the standard route and the case reloads', async () => {
        render(<MatchCasePage />);
        fireEvent.click((await screen.findAllByRole('button', { name: 'Work on' }))[0]);
        fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'resolved' } });
        fireEvent.change(screen.getByLabelText('Resolution note'), { target: { value: 'Supplier agreed to PO price' } });
        fireEvent.change(screen.getByLabelText('Evidence name'), { target: { value: 'agreement.eml' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        expect(mockUpdate.mock.calls[0][0]).toBe('e1');
        expect(mockUpdate.mock.calls[0][1]).toMatchObject({ status: 'resolved', resolution_note: 'Supplier agreed to PO price', evidence: [{ name: 'agreement.eml' }] });
        expect(mockUpdate.mock.calls[0][2]).toBe(false);
        await waitFor(() => expect(mockDetail).toHaveBeenCalledTimes(2));
    });
    it('Given Re-evaluate, Then the match is re-run and reloaded', async () => {
        render(<MatchCasePage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Re-evaluate' }));
        await waitFor(() => expect(mockReeval).toHaveBeenCalledWith('c1'));
    });
    it('Given a load failure, Then the error is shown with a way back', async () => {
        mockDetail.mockRejectedValue(new Error('nope'));
        render(<MatchCasePage />);
        expect(await screen.findByText('nope')).toBeInTheDocument();
    });
});
