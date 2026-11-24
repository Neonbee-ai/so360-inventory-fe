import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockCheck = vi.fn();
const mockClose = vi.fn();
const mockResidual = vi.fn();
let mockCanApprove = true;
vi.mock('../../services/matchService', () => ({ matchService: { closeoutCheck: (...a: any[]) => mockCheck(...a), closePo: (...a: any[]) => mockClose(...a), cancelResidual: (...a: any[]) => mockResidual(...a) } }));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ hasPermission: () => mockCanApprove }) }));

import POCloseoutPanel from './POCloseoutPanel';

const totals = (o: any = {}) => ({ ordered: 100, received: 80, accepted: 80, rejected: 0, returned: 0, invoiced: 80, open_qty: 20, open_value: 200, uninvoiced_qty: 0, ordered_value: 1000, invoiced_value: 800, ...o });
const check = (o: any = {}) => ({
    po_id: 'po1', status: 'partially_received', can_close: false, totals: totals(), open_claims: [], open_match_cases: [], residual_cancel: null,
    blockers: [{ code: 'RESIDUAL_QUANTITY', message: '20 unit(s) are still open. Receive them or cancel the residual with an approved reason.' }],
    lines: [{ po_line_id: 'abcdef123', ordered: 100, acked: 100, received: 80, accepted: 80, rejected: 0, returned: 0, invoiced: 80, open_qty: 20 }], ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockCanApprove = true;
    mockCheck.mockResolvedValue(check());
    mockClose.mockResolvedValue({});
    mockResidual.mockResolvedValue({});
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
    vi.spyOn(toast, 'warning').mockReturnValue('t');
});

describe('POCloseoutPanel (Pulse 559f6d73)', () => {
    it('Given open quantity, Then the reasons it cannot close are listed and Close PO is disabled', async () => {
        render(<POCloseoutPanel poId="po1" status="partially_received" onChanged={vi.fn()} />);
        expect(await screen.findByText(/20 unit\(s\) are still open/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close PO' })).toBeDisabled();
        expect(screen.getByTestId('closeout-lines')).toBeInTheDocument();
    });
    it('Given a clean PO, When Close PO is clicked, Then it is closed with the note and the page refreshes', async () => {
        mockCheck.mockResolvedValue(check({ can_close: true, blockers: [], totals: totals({ open_qty: 0, open_value: 0 }) }));
        const onChanged = vi.fn();
        render(<POCloseoutPanel poId="po1" status="received" onChanged={onChanged} />);
        fireEvent.change(await screen.findByLabelText('Closing note'), { target: { value: 'All done' } });
        fireEvent.click(screen.getByRole('button', { name: 'Close PO' }));
        await waitFor(() => expect(mockClose).toHaveBeenCalledWith('po1', { reason: 'All done' }));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });
    it('Given residual quantity and the approve right, Then cancel residual needs a reason and a supplier reference', async () => {
        render(<POCloseoutPanel poId="po1" status="partially_received" onChanged={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel residual quantity' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel residual' }));
        await waitFor(() => expect(toast.warning).toHaveBeenCalled());
        expect(mockResidual).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Scope reduced' } });
        fireEvent.change(screen.getByLabelText('How the supplier was told'), { target: { value: 'MAIL-14' } });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel residual' }));
        await waitFor(() => expect(mockResidual).toHaveBeenCalledWith('po1', { reason: 'Scope reduced', supplier_communication_ref: 'MAIL-14' }));
    });
    it('Given no approve right, Then the residual cancellation is not offered', async () => {
        mockCanApprove = false;
        render(<POCloseoutPanel poId="po1" status="partially_received" onChanged={vi.fn()} />);
        await screen.findByText(/still open/);
        expect(screen.queryByRole('button', { name: 'Cancel residual quantity' })).not.toBeInTheDocument();
    });
    it('Given the only blocker is uninvoiced receipts, Then a reason enables closing and is sent', async () => {
        mockCheck.mockResolvedValue(check({ totals: totals({ open_qty: 0, open_value: 0, uninvoiced_qty: 10 }), blockers: [{ code: 'UNINVOICED_RECEIPTS', message: '10 accepted unit(s) have no invoice.' }] }));
        render(<POCloseoutPanel poId="po1" status="received" onChanged={vi.fn()} />);
        const btn = await screen.findByRole('button', { name: 'Close PO' });
        expect(btn).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Why will the remaining accepted units/), { target: { value: 'Free replacement' } });
        expect(screen.getByRole('button', { name: 'Close PO' })).not.toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Close PO' }));
        await waitFor(() => expect(mockClose).toHaveBeenCalledWith('po1', { accept_uninvoiced_reason: 'Free replacement' }));
    });
    it('Given a closed PO, Then it shows what was checked and offers no close action', async () => {
        mockCheck.mockResolvedValue(check({ status: 'closed', can_close: true, blockers: [] }));
        render(<POCloseoutPanel poId="po1" status="closed" onChanged={vi.fn()} />);
        expect(await screen.findByText(/This PO is closed/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Close PO' })).not.toBeInTheDocument();
    });
    it('Given the check is unavailable, Then a warning is shown', async () => {
        mockCheck.mockRejectedValue(new Error('flag off'));
        render(<POCloseoutPanel poId="po1" status="received" onChanged={vi.fn()} />);
        expect(await screen.findByText('flag off')).toBeInTheDocument();
    });
});
