import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetExceptions = vi.fn();
const mockRetry = vi.fn();
const mockResolve = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/procurementService', () => ({
    procurementService: {
        getExceptions: (...a: any[]) => mockGetExceptions(...a),
        retryException: (...a: any[]) => mockRetry(...a),
        resolveException: (...a: any[]) => mockResolve(...a),
        assignException: vi.fn(),
    },
}));
vi.mock('../../services/inventoryService', () => ({ inventoryService: { getOrgId: () => 'org-1' } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({
        formatDate: (d: string) => d ?? '',
        formatDateTime: (d: string) => d ?? '',
        formatCurrency: (v: number) => `$${v}`,
        formatNumber: (n: number) => String(n),
        currency: 'USD', locale: 'en-US', timezone: 'UTC',
    }),
}));

import ProcurementExceptionsPage from './ProcurementExceptionsPage';

const rejected = {
    id: 'e1', kind: 'intake_rejected', status: 'open', severity: 'medium', created_at: '2026-11-24T10:00:00Z',
    ref_type: 'demand_intake', ref_id: 'in-1',
    payload: { reason_code: 'SOURCE_STATE_UNSUPPORTED', source: { module: 'manufacturing', id: 'MO-1' } },
};
const changed = {
    id: 'e2', kind: 'source_changed', status: 'open', severity: 'high', created_at: '2026-11-24T11:00:00Z',
    ref_type: 'purchase_requisition', ref_id: 'pr-1',
    payload: { old_version: 3, new_version: 4, source: { module: 'projects', id: 'P-9' } },
};

beforeEach(() => {
    vi.clearAllMocks();
    mockGetExceptions.mockResolvedValue([rejected, changed]);
    mockRetry.mockResolvedValue({ status: 'applied', pr_number: 'PR-2026-0007' });
    mockResolve.mockResolvedValue({});
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('ProcurementExceptionsPage (Comb)', () => {
    it('Given open exceptions, When rendered, Then the list floorplan shows both with their reasons', async () => {
        const { container } = render(<ProcurementExceptionsPage />);
        await waitFor(() => expect(screen.getByText('SOURCE_STATE_UNSUPPORTED')).toBeInTheDocument());
        expect(container.querySelector('[data-template="list"]')).not.toBeNull();
        expect(screen.getByRole('heading', { name: 'Procurement Exceptions' })).toBeInTheDocument();
        expect(screen.getByText('Source v3 -> v4')).toBeInTheDocument();
        expect(mockGetExceptions).toHaveBeenCalledWith({ status: 'open', kind: undefined });
    });

    it('Given no exceptions, When loaded, Then the empty state is shown', async () => {
        mockGetExceptions.mockResolvedValue([]);
        render(<ProcurementExceptionsPage />);
        await waitFor(() => expect(screen.getByText('No open exceptions.')).toBeInTheDocument());
    });

    it('Given a rejected demand, When Retry is clicked, Then the stored payload is re-run and the new PR number is announced', async () => {
        render(<ProcurementExceptionsPage />);
        await waitFor(() => screen.getByText('SOURCE_STATE_UNSUPPORTED'));
        fireEvent.click(screen.getAllByText('Retry')[0]);
        await waitFor(() => expect(mockRetry).toHaveBeenCalledWith('e1'));
        expect(toast.success).toHaveBeenCalledWith('Accepted as PR-2026-0007');
    });

    it('Given a source_changed exception, When rendered, Then it offers Open PR but no Retry', async () => {
        render(<ProcurementExceptionsPage />);
        await waitFor(() => screen.getByText('Source v3 -> v4'));
        expect(screen.getAllByText('Retry')).toHaveLength(1);
        fireEvent.click(screen.getByText('Open PR'));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/pr/pr-1');
    });

    it('Given an exception, When Resolve is confirmed with a note, Then it is resolved', async () => {
        render(<ProcurementExceptionsPage />);
        await waitFor(() => screen.getByText('SOURCE_STATE_UNSUPPORTED'));
        fireEvent.click(screen.getAllByText('Resolve')[0]);
        const input = await screen.findByLabelText('Resolution');
        fireEvent.change(input, { target: { value: 'Fixed at source' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Resolve' }).pop()!);
        await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('e1', 'Fixed at source'));
    });
});
