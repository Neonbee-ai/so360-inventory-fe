import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGet = vi.fn();
const mockDecide = vi.fn();
vi.mock('../../services/poApprovalService', () => ({
    PO_APPROVAL_FLAG: 'action:inventory:procurement:po_approval',
    PO_AMEND_FLAG: 'action:inventory:procurement:po_amend',
    poApprovalService: { getApproval: (...a: any[]) => mockGet(...a), decide: (...a: any[]) => mockDecide(...a) },
}));
vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }),
}));

import POApprovalPanel, { stepState } from './POApprovalPanel';

const view = (o: any = {}) => ({
    po_id: 'po-1', status: 'pending_approval', version: 1,
    route: { policy_version: 'p1@v1', steps: [{ id: 'rule:r1', name: 'Above 10k', mode: 'sequential', approvers: [], role: 'finance_manager', required: 1, reason: 'policy_rule' }] },
    progress: { state: 'pending', active_step_ids: ['rule:r1'] },
    evidence: [], eligibility_snapshot: { decision: 'eligible' }, budget_check: { status: 'insufficient', available: 5000 },
    allocations: [], schedules: [], ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(view());
    mockDecide.mockResolvedValue({});
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('POApprovalPanel (Pulse 5de6ad46)', () => {
    it('Given a submitted PO, When loaded, Then the route step, its waiting state and the budget check show', async () => {
        render(<POApprovalPanel poId="po-1" status="pending_approval" onChanged={vi.fn()} />);
        expect(await screen.findByText('Above 10k')).toBeInTheDocument();
        expect(screen.getByText('Waiting')).toBeInTheDocument();
        expect(screen.getByText('insufficient')).toBeInTheDocument();
    });

    it('Given a pending PO, When Approve is clicked, Then the decision is sent and the page is told to reload', async () => {
        const onChanged = vi.fn();
        render(<POApprovalPanel poId="po-1" status="pending_approval" onChanged={onChanged} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
        await waitFor(() => expect(mockDecide).toHaveBeenCalledWith('po-1', { decision: 'approve', reason: undefined }));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('Given no reason, When Reject is clicked, Then nothing is sent and the user is asked for a reason', async () => {
        render(<POApprovalPanel poId="po-1" status="pending_approval" onChanged={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
        expect(mockDecide).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('Enter a reason first');
    });

    it('Given the server rejects a self-approval, When Approve is clicked, Then the SoD message is shown', async () => {
        mockDecide.mockRejectedValue(new Error('The requester or buyer cannot approve this purchase order.'));
        render(<POApprovalPanel poId="po-1" status="pending_approval" onChanged={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The requester or buyer cannot approve this purchase order.'));
    });

    it('Given an approved PO with evidence, When loaded, Then no decision form and the evidence row shows', async () => {
        mockGet.mockResolvedValue(view({ status: 'approved', evidence: [{ id: 'e1', created_at: '2026-12-01', decision: 'approve', approver_id: 'aaaaaaaa-1', source: 'procurement', step_id: 'rule:r1' }] }));
        render(<POApprovalPanel poId="po-1" status="approved" onChanged={vi.fn()} />);
        expect(await screen.findByText('approve')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    });

    it('Given a policy auto-approval with no steps, When loaded, Then the empty-route note shows', async () => {
        mockGet.mockResolvedValue(view({ status: 'approved', route: { policy_version: 'default', steps: [] }, evidence: [{ id: 'e1', created_at: 'x', decision: 'auto_approved', source: 'procurement' }] }));
        render(<POApprovalPanel poId="po-1" status="approved" onChanged={vi.fn()} />);
        expect(await screen.findByText(/approved by policy/)).toBeInTheDocument();
    });

    it('stepState counts distinct approvals against the required number', () => {
        const step = { id: 's', required: 'all', approvers: ['a', 'b'] };
        expect(stepState(step, [{ step_id: 's', decision: 'approve', approver_id: 'a' }])).toBe('pending');
        expect(stepState(step, [{ step_id: 's', decision: 'approve', approver_id: 'a' }, { step_id: 's', decision: 'approve', approver_id: 'b' }])).toBe('approved');
    });
});
