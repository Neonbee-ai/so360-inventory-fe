import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockVersions = vi.fn();
const mockAmend = vi.fn();
vi.mock('../../services/poApprovalService', () => ({ poApprovalService: { versions: (...a: any[]) => mockVersions(...a), amend: (...a: any[]) => mockAmend(...a) } }));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDateTime: (d: string) => d, formatDate: (d: string) => d, formatCurrency: (v: number) => `$${v}` }) }));

import POVersionsPanel, { diffVersions } from './POVersionsPanel';

const snap = (qty: number) => ({ header: { total_amount: qty * 10 }, lines: [{ id: 'l1abcdef', item_id: 'i', quantity: qty, unit_price: 10 }] });
const lines = [{ id: 'l1abcdef', description: 'Bolt', quantity: 10, unit_price: 10, received_quantity: 0 }];

beforeEach(() => {
    vi.clearAllMocks();
    mockVersions.mockResolvedValue([{ id: 'v1', version: 1, created_at: 'd1', change_reason: 'issued', snapshot: snap(10) }, { id: 'v2', version: 2, created_at: 'd2', change_reason: 'more', snapshot: snap(12) }]);
    mockAmend.mockResolvedValue({ version: 3, material: true });
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('POVersionsPanel (Pulse 5de6ad46)', () => {
    it('Given two versions, When loaded, Then v2 shows the quantity change against v1', async () => {
        render(<POVersionsPanel poId="po-1" lines={lines} canAmend={false} onChanged={vi.fn()} />);
        expect(await screen.findByText('v2')).toBeInTheDocument();
        expect(screen.getByText(/quantity \(l1abcd\): 10 -> 12/)).toBeInTheDocument();
        expect(screen.queryByText('Amend this PO')).not.toBeInTheDocument();
    });

    it('Given an amendable PO, When a quantity is changed and a reason given, Then the amendment is sent', async () => {
        const onChanged = vi.fn();
        render(<POVersionsPanel poId="po-1" lines={lines} canAmend onChanged={onChanged} />);
        fireEvent.change(await screen.findByLabelText('Quantity for Bolt'), { target: { value: '15' } });
        fireEvent.change(screen.getByLabelText('Reason for the amendment'), { target: { value: 'extra stock' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create new version' }));
        await waitFor(() => expect(mockAmend).toHaveBeenCalledWith('po-1', { reason: 'extra stock', lines: [{ id: 'l1abcdef', quantity: 15 }] }));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('Given no change, When Create new version is clicked, Then nothing is sent', async () => {
        render(<POVersionsPanel poId="po-1" lines={lines} canAmend onChanged={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Create new version' }));
        expect(mockAmend).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
    });

    it('Given the scenario, When it runs, Then diffVersions returns nothing for the first version and header changes otherwise', () => {
        expect(diffVersions(null, snap(10))).toEqual([]);
        const a = { ...snap(10), header: { payment_terms: 'Net 30' } };
        const b = { ...snap(10), header: { payment_terms: 'Net 45' } };
        expect(diffVersions(a, b)).toEqual([{ field: 'payment terms', from: 'Net 30', to: 'Net 45' }]);
    });
});
