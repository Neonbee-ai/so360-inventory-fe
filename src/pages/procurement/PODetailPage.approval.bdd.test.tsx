import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetPODetail = vi.fn();
const mockSubmit = vi.fn();
const mockIssue = vi.fn();
const flags: Record<string, boolean> = {};
vi.mock('../../services/procurementService', () => ({ procurementService: { getPODetail: (...a: any[]) => mockGetPODetail(...a), getDocumentTrace: () => Promise.resolve({ chain: [] }) } }));
vi.mock('../../services/poApprovalService', () => ({
    PO_APPROVAL_FLAG: 'action:inventory:procurement:po_approval',
    PO_AMEND_FLAG: 'action:inventory:procurement:po_amend',
    poApprovalService: { submit: (...a: any[]) => mockSubmit(...a), issue: (...a: any[]) => mockIssue(...a), getApproval: () => Promise.resolve({ evidence: [], allocations: [], schedules: [], route: null }), versions: () => Promise.resolve([]) },
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'po-1' }), useNavigate: () => vi.fn() }));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d, formatDateTime: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));
vi.mock('@so360/shell-context', async (orig) => ({
    ...(await orig<any>()),
    useShell: () => ({ isFeatureEnabled: (f: string) => !!flags[f] }),
}));

import PODetailPage from './PODetailPage';

const po = (status: string) => ({ id: 'po-1', po_number: 'PO-7', status, total_amount: 100, created_at: '2025-01-01', vendor: { id: 'v1', name: 'Acme' }, po_lines: [{ id: 'l1', item_id: 'i1', description: 'Bolt', quantity: 10, unit_price: 10, received_quantity: 0 }] });

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(flags)) delete flags[k];
    mockGetPODetail.mockResolvedValue(po('draft'));
    mockSubmit.mockResolvedValue({ status: 'pending_approval' });
    mockIssue.mockResolvedValue({});
});

describe('PODetailPage approval flow (Pulse 5de6ad46)', () => {
    it('Given the approval flag is off, When a draft loads, Then the legacy Send PO action shows and there are no tabs', async () => {
        render(<PODetailPage />);
        expect(await screen.findByRole('button', { name: 'Send PO' })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'Approvals' })).not.toBeInTheDocument();
    });

    it('Given the flag is on, When a draft loads, Then Submit for approval replaces Send PO and the tabs show', async () => {
        flags['action:inventory:procurement:po_approval'] = true;
        render(<PODetailPage />);
        expect(await screen.findByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Send PO' })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Approvals' })).toBeInTheDocument();
    });

    it('Given the flag is on, When Submit for approval is clicked, Then the PO is submitted and reloaded', async () => {
        flags['action:inventory:procurement:po_approval'] = true;
        render(<PODetailPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }));
        await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('po-1'));
        await waitFor(() => expect(mockGetPODetail).toHaveBeenCalledTimes(2));
    });

    it('Given an approved PO, When loaded, Then Issue PO is the primary action and issues it', async () => {
        flags['action:inventory:procurement:po_approval'] = true;
        mockGetPODetail.mockResolvedValue(po('approved'));
        render(<PODetailPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Issue PO' }));
        await waitFor(() => expect(mockIssue).toHaveBeenCalledWith('po-1'));
    });
});
