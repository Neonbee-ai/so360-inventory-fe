import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockSchedules = vi.fn();
const mockShipments = vi.fn();
const mockRecord = vi.fn();
const mockDecide = vi.fn();
const mockShip = vi.fn();
vi.mock('../../services/poScheduleService', () => ({
    LINE_ACK_FLAG: 'action:inventory:procurement:line_acknowledgement',
    poScheduleService: {
        schedules: (...a: any[]) => mockSchedules(...a), shipments: (...a: any[]) => mockShipments(...a), recordAck: (...a: any[]) => mockRecord(...a),
        decideProposal: (...a: any[]) => mockDecide(...a), recordShipment: (...a: any[]) => mockShip(...a),
    },
}));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));

import POAcknowledgementPanel from './POAcknowledgementPanel';

const lines = [{ id: 'l1', description: 'Cement' }];
const sched = (o: any = {}) => ({ id: 's1', po_line_id: 'l1', quantity: 100, need_by_date: '2027-03-01', po_promised_date: '2027-03-01', ack_status: 'pending', forecast_confidence: 'requested', ...o });

beforeEach(() => {
    vi.clearAllMocks();
    mockSchedules.mockResolvedValue([sched()]);
    mockShipments.mockResolvedValue([]);
    mockRecord.mockResolvedValue({ id: 'a1' });
    mockDecide.mockResolvedValue({ decision: 'accepted' });
    mockShip.mockResolvedValue({});
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('POAcknowledgementPanel (Pulse a8c2a582)', () => {
    it('Given a schedule, When loaded, Then requested, PO-promised, confirmed and forecast are separate columns', async () => {
        render(<POAcknowledgementPanel poId="po-1" poVersion={2} status="sent" lines={lines} onChanged={vi.fn()} />);
        expect(await screen.findByText('Supplier confirmed')).toBeInTheDocument();
        expect(screen.getByText('Requested')).toBeInTheDocument();
        expect(screen.getByText('PO promised')).toBeInTheDocument();
        expect(screen.getByText('Forecast')).toBeInTheDocument();
    });

    it('Given nothing chosen, When Record acknowledgement is clicked, Then nothing is sent', async () => {
        render(<POAcknowledgementPanel poId="po-1" poVersion={2} status="sent" lines={lines} onChanged={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Record acknowledgement' }));
        expect(mockRecord).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
    });

    it('Given a response is chosen, When saved, Then it is sent for the current PO version', async () => {
        const onChanged = vi.fn();
        render(<POAcknowledgementPanel poId="po-1" poVersion={2} status="sent" lines={lines} onChanged={onChanged} />);
        fireEvent.change(await screen.findByLabelText('Response for Cement'), { target: { value: 'accepted' } });
        fireEvent.click(screen.getByRole('button', { name: 'Record acknowledgement' }));
        await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('po-1', expect.objectContaining({ po_version: 2, lines: [{ schedule_id: 's1', response: 'accepted' }] })));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('Given the server reports a stale version, When saved, Then the message is shown', async () => {
        mockRecord.mockRejectedValue(new Error('This acknowledgement is for version 1; the PO is at version 2.'));
        render(<POAcknowledgementPanel poId="po-1" poVersion={1} status="sent" lines={lines} onChanged={vi.fn()} />);
        fireEvent.change(await screen.findByLabelText('Response for Cement'), { target: { value: 'rejected' } });
        fireEvent.click(screen.getByRole('button', { name: 'Record acknowledgement' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This acknowledgement is for version 1; the PO is at version 2.'));
    });

    it('Given a supplier proposal, When Accept proposal is clicked, Then it is decided; reject needs a reason', async () => {
        mockSchedules.mockResolvedValue([sched({ ack_status: 'proposed_change', forecast_date: '2027-03-20', forecast_confidence: 'proposed' })]);
        render(<POAcknowledgementPanel poId="po-1" poVersion={2} status="sent" lines={lines} onChanged={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Reject proposal' }));
        expect(mockDecide).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Accept proposal' }));
        await waitFor(() => expect(mockDecide).toHaveBeenCalledWith('s1', { decision: 'accept', reason: undefined }));
    });

    it('Given a draft PO, When loaded, Then the acknowledgement form is not offered', async () => {
        render(<POAcknowledgementPanel poId="po-1" poVersion={1} status="approved" lines={lines} onChanged={vi.fn()} />);
        await screen.findByText('Supplier confirmed');
        expect(screen.queryByRole('button', { name: 'Record acknowledgement' })).not.toBeInTheDocument();
    });

    it('Given an ASN without a number, When Record shipment is clicked, Then nothing is sent', async () => {
        render(<POAcknowledgementPanel poId="po-1" poVersion={2} status="sent" lines={lines} onChanged={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Record shipment' }));
        expect(mockShip).not.toHaveBeenCalled();
    });
});
