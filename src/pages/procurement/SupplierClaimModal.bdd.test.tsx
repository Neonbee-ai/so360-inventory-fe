import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockUpdate = vi.fn();
vi.mock('../../services/receivingService', () => ({ receivingService: { updateClaim: (...a: any[]) => mockUpdate(...a) } }));

import SupplierClaimModal, { claimGaps, claimNeedsPhysical } from './SupplierClaimModal';

const claim = (o: any = {}) => ({ id: 'c1', return_number: 'CLM-1', claim_type: 'return', inspection_id: 'q1', physical_done: false, quality_done: false, commercial_done: false, evidence: [{ name: 'dent.jpg' }], ...o });

beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
});

describe('claim gaps', () => {
    it('Given a return claim with an inspection and nothing done, Then physical, quality and commercial are open', () => {
        expect(claimGaps(claim())).toEqual(['Physical', 'Quality', 'Commercial']);
    });
    it('Given a price concession, Then no physical return is expected', () => {
        expect(claimNeedsPhysical('price_concession')).toBe(false);
        expect(claimGaps(claim({ claim_type: 'price_concession', inspection_id: null }))).toEqual(['Commercial']);
    });
    it('Given everything done, Then there are no gaps', () => {
        expect(claimGaps(claim({ physical_done: true, quality_done: true, commercial_done: true }))).toEqual([]);
    });
});

describe('SupplierClaimModal (Pulse 4fe6cf16)', () => {
    it('Given an open claim, Then the missing resolution parts are named and existing evidence is listed', () => {
        render(<SupplierClaimModal claim={claim()} onClose={vi.fn()} onSaved={vi.fn()} />);
        expect(screen.getByText(/Cannot settle yet. Still open: Physical, Quality, Commercial/)).toBeInTheDocument();
        expect(screen.getByText('dent.jpg')).toBeInTheDocument();
    });
    it('Given the checklist is completed, When saved, Then the flags, RMA and new evidence are sent', async () => {
        const onSaved = vi.fn();
        render(<SupplierClaimModal claim={claim()} onClose={vi.fn()} onSaved={onSaved} />);
        fireEvent.click(screen.getByLabelText(/Physical: goods returned/i));
        fireEvent.click(screen.getByLabelText(/Commercial: credit/i));
        fireEvent.change(screen.getByLabelText('RMA number'), { target: { value: 'RMA-9' } });
        fireEvent.change(screen.getByLabelText('Evidence name'), { target: { value: 'credit-note.pdf' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save claim' }));
        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        expect(mockUpdate.mock.calls[0][0]).toBe('c1');
        expect(mockUpdate.mock.calls[0][1]).toMatchObject({ physical_done: true, commercial_done: true, rma_number: 'RMA-9', evidence: [{ name: 'credit-note.pdf' }] });
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
    });
    it('Given the API refuses, Then the modal stays open and does not report success', async () => {
        mockUpdate.mockRejectedValue(new Error('The linked inspection is not completed'));
        const onSaved = vi.fn();
        render(<SupplierClaimModal claim={claim()} onClose={vi.fn()} onSaved={onSaved} />);
        fireEvent.click(screen.getByLabelText(/Quality: inspection outcome/i));
        fireEvent.click(screen.getByRole('button', { name: 'Save claim' }));
        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        expect(onSaved).not.toHaveBeenCalled();
    });
    it('Given a claim without an inspection, Then there is no quality checkbox', () => {
        render(<SupplierClaimModal claim={claim({ inspection_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);
        expect(screen.queryByLabelText(/Quality: inspection outcome/i)).not.toBeInTheDocument();
    });
});
