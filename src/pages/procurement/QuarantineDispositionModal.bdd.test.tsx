import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockDispose = vi.fn();
vi.mock('../../services/receivingService', () => ({ receivingService: { dispositionInspection: (...a: any[]) => mockDispose(...a) } }));

import QuarantineDispositionModal, { openQuarantine } from './QuarantineDispositionModal';

const insp = {
    id: 'q1', inspection_number: 'QC-1', grn: { grn_number: 'GRN-1' },
    quality_inspection_lines: [
        { id: 'l1', description: 'Widget A', quarantined_quantity: 5, quarantine_released_quantity: 1, quarantine_rejected_quantity: 0 },
        { id: 'l2', description: 'Widget B', quarantined_quantity: 2, quarantine_released_quantity: 2, quarantine_rejected_quantity: 0 },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
    mockDispose.mockResolvedValue({ dispositioned: [] });
    vi.spyOn(toast, 'warning').mockReturnValue('t');
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('QuarantineDispositionModal (Pulse 4fe6cf16)', () => {
    it('Given released units, Then the open quarantine excludes them', () => {
        expect(openQuarantine(insp.quality_inspection_lines[0])).toBe(4);
        expect(openQuarantine(insp.quality_inspection_lines[1])).toBe(0);
    });
    it('Given two lines of which one is fully dispositioned, Then only the open one is listed', () => {
        render(<QuarantineDispositionModal inspection={insp} onClose={vi.fn()} onSaved={vi.fn()} />);
        expect(screen.getByText('4 in quarantine')).toBeInTheDocument();
        expect(screen.queryByText('Widget B')).not.toBeInTheDocument();
    });
    it('Given a release of 3, When applied, Then the decision is sent for that line', async () => {
        const onSaved = vi.fn();
        render(<QuarantineDispositionModal inspection={insp} onClose={vi.fn()} onSaved={onSaved} />);
        fireEvent.change(screen.getByLabelText(/Disposition quantity for Widget A/i), { target: { value: '3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }));
        await waitFor(() => expect(mockDispose).toHaveBeenCalledWith('q1', { lines: [{ line_id: 'l1', decision: 'release', quantity: 3 }] }));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
    });
    it('Given more than is quarantined, Then the decision is blocked before any request', async () => {
        render(<QuarantineDispositionModal inspection={insp} onClose={vi.fn()} onSaved={vi.fn()} />);
        fireEvent.change(screen.getByLabelText(/Disposition quantity for Widget A/i), { target: { value: '9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }));
        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Only 4 units remain')));
        expect(mockDispose).not.toHaveBeenCalled();
    });
    it('Given nothing is quarantined, Then it says so', () => {
        render(<QuarantineDispositionModal inspection={{ ...insp, quality_inspection_lines: [] }} onClose={vi.fn()} onSaved={vi.fn()} />);
        expect(screen.getByText('Nothing is held in quarantine.')).toBeInTheDocument();
    });
});
