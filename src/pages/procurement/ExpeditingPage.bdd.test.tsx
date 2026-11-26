import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockExp = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/poScheduleService', () => ({ poScheduleService: { expediting: (...a: any[]) => mockExp(...a) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));

import ExpeditingPage from './ExpeditingPage';

beforeEach(() => {
    vi.clearAllMocks();
    mockExp.mockResolvedValue([{ schedule_id: 's1', po_id: 'po-1', po_number: 'PO-9', reasons: ['overdue_ack', 'at_risk'], ack_status: 'pending', forecast_date: '2027-03-01', ordered_qty: 100, delay_cause: null, next_follow_up_at: null }]);
});

describe('ExpeditingPage (Pulse a8c2a582)', () => {
    it('Given overdue schedules, When loaded, Then each row shows its reasons and links to the PO', async () => {
        render(<ExpeditingPage />);
        expect(await screen.findByText('Acknowledgement overdue')).toBeInTheDocument();
        // the same label is also a filter <option>; assert the badge, not the option
        expect(screen.getAllByText('At risk').some((el) => el.tagName !== 'OPTION')).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: '#PO-9' }));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/po/po-1');
    });

    it('Given nothing to chase, When loaded, Then the empty state shows', async () => {
        mockExp.mockResolvedValue([]);
        render(<ExpeditingPage />);
        expect(await screen.findByText('Nothing to chase right now.')).toBeInTheDocument();
    });

    it('Given a failure, When loaded, Then the error is shown', async () => {
        mockExp.mockRejectedValue(new Error('boom'));
        render(<ExpeditingPage />);
        await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    });
});
