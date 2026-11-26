import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockList = vi.fn();
const mockUpdate = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/matchService', () => ({ matchService: { reconciliationIssues: (...a: any[]) => mockList(...a), updateIssue: (...a: any[]) => mockUpdate(...a) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));

import ReconciliationPage from './ReconciliationPage';

const issue = (o: any = {}) => ({ id: 'i1', kind: 'po_status_stuck', severity: 'medium', status: 'open', detected_at: '2027-03-01', refs: { po_id: 'po1', po_number: 'PO-1' }, ...o });

beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([issue()]);
    mockUpdate.mockResolvedValue({});
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
    vi.spyOn(toast, 'warning').mockReturnValue('t');
});

describe('ReconciliationPage (Pulse 559f6d73)', () => {
    it('Given a recorded mismatch, Then it is described in plain words with a link to the PO', async () => {
        render(<ReconciliationPage />);
        expect(await screen.findByText('PO still waiting although fully received')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '#PO-1' }));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/po/po1');
    });
    it('Given the default view, Then open issues are requested', async () => {
        render(<ReconciliationPage />);
        await screen.findByText('PO still waiting although fully received');
        expect(mockList).toHaveBeenCalledWith({ status: 'open' });
    });
    it('Given resolving without a note, Then it is blocked before any request', async () => {
        render(<ReconciliationPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Look into it' }));
        fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'resolved' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(toast.warning).toHaveBeenCalled());
        expect(mockUpdate).not.toHaveBeenCalled();
    });
    it('Given a note, When resolved, Then the issue is updated and the list reloads', async () => {
        render(<ReconciliationPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Look into it' }));
        fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'resolved' } });
        fireEvent.change(screen.getByLabelText('What you found or did'), { target: { value: 'Status corrected by hand' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('i1', { status: 'resolved', note: 'Status corrected by hand' }));
        await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
    });
    it('Given nothing to reconcile, Then the empty state shows', async () => {
        mockList.mockResolvedValue([]);
        render(<ReconciliationPage />);
        expect(await screen.findByText('Nothing to reconcile.')).toBeInTheDocument();
    });
    it('Given a failure, Then the error is shown', async () => {
        mockList.mockRejectedValue(new Error('boom'));
        render(<ReconciliationPage />);
        await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    });
});
