import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockAck = vi.fn();
const mockResend = vi.fn();
const mockRemind = vi.fn();
vi.mock('../../services/rfqService', () => ({
    rfqService: {
        acknowledgeVendor: (...a: any[]) => mockAck(...a), resendToVendor: (...a: any[]) => mockResend(...a),
        sendReminders: (...a: any[]) => mockRemind(...a), requestVendorException: vi.fn(),
    },
}));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '' }) }));

import RFQInvitationsPanel from './RFQInvitationsPanel';

const rfq = {
    id: 'rfq-1', status: 'sent',
    rfq_vendors: [
        { id: 'r1', vendor_id: 'v1', vendor_name: 'Acme', status: 'invited', delivery_status: 'sent', sent_rfq_version: 1, reminder_count: 0, eligibility_decision: 'eligible' },
        { id: 'r2', vendor_id: 'v2', vendor_name: 'Beta', status: 'invited', delivery_status: 'failed', delivery_error: 'smtp down', sent_rfq_version: null, reminder_count: 2, eligibility_decision: 'ineligible', eligibility_reason_codes: ['DOCUMENT_EXPIRED'] },
    ],
};

beforeEach(() => { vi.clearAllMocks(); mockAck.mockResolvedValue({}); mockRemind.mockResolvedValue({}); });

describe('RFQInvitationsPanel', () => {
    it('Given per-vendor outcomes, When rendered, Then delivery, version, reminders and eligibility show per vendor', () => {
        render(<RFQInvitationsPanel rfq={rfq} canAct onChanged={vi.fn()} />);
        expect(screen.getByText('smtp down')).toBeInTheDocument();
        expect(screen.getByText('v1')).toBeInTheDocument();
        expect(screen.getByText('DOCUMENT_EXPIRED')).toBeInTheDocument();
    });

    it('Given a delivered invitation, When Mark acknowledged is clicked, Then the API is called and the RFQ refreshes', async () => {
        const onChanged = vi.fn();
        render(<RFQInvitationsPanel rfq={rfq} canAct onChanged={onChanged} />);
        fireEvent.click(screen.getByText('Mark acknowledged'));
        await waitFor(() => expect(mockAck).toHaveBeenCalledWith('rfq-1', 'v1'));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('Given an ineligible vendor, When listed, Then an exception can be requested', () => {
        render(<RFQInvitationsPanel rfq={rfq} canAct onChanged={vi.fn()} />);
        expect(screen.getByText('Request exception')).toBeInTheDocument();
    });

    it('Given a cancelled RFQ, When listed, Then no actions are offered', () => {
        render(<RFQInvitationsPanel rfq={{ ...rfq, status: 'cancelled' }} canAct={false} onChanged={vi.fn()} />);
        expect(screen.queryByText('Resend')).toBeNull();
        expect(screen.queryByText(/Send reminders/)).toBeNull();
    });
});
