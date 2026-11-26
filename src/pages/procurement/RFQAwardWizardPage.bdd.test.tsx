import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockList = vi.fn();
const mockCmp = vi.fn();
const mockEv = vi.fn();
const mockAward = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/rfqService', () => ({
    rfqService: {
        listEvaluations: (...a: any[]) => mockList(...a), getComparison: (...a: any[]) => mockCmp(...a),
        getEvaluation: (...a: any[]) => mockEv(...a), createAward: (...a: any[]) => mockAward(...a),
    },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => ({ id: 'rfq-1' }) }));

import RFQAwardWizardPage from './RFQAwardWizardPage';

beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([{ id: 'e1', status: 'locked' }]);
    mockCmp.mockResolvedValue({
        lines: [{ rfq_line_id: 'l1', description: 'Cement', quantity: 100 }],
        quotations: [{ quotation_id: 'q1', vendor_id: 'v1', vendor_name: 'Alpha' }, { quotation_id: 'q2', vendor_id: 'v2', vendor_name: 'Beta' }],
    });
    mockEv.mockResolvedValue({
        id: 'e1', recommendation: { recommended_quotation_id: 'q1' }, scores: [{ quotation_id: 'q1', total: 90 }],
        normalized: [{ quotation_id: 'q1', version: 1, base_currency: 'INR', flags: [], lines: [{ rfq_line_id: 'l1', normalized_unit_price: 10 }] }],
    });
    mockAward.mockResolvedValue({ status: 'approved' });
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('RFQAwardWizardPage (Pulse 84845b42)', () => {
    it('Given a locked evaluation, When loaded, Then the recommended vendor is pre-filled with the full quantity', async () => {
        render(<RFQAwardWizardPage />);
        const input = await screen.findByLabelText('Quantity for Alpha');
        expect((input as HTMLInputElement).value).toBe('100');
        expect((screen.getByLabelText('Quantity for Beta') as HTMLInputElement).value).toBe('0');
    });

    it('Given no locked evaluation, When loaded, Then the wizard explains an evaluation must be locked first', async () => {
        mockList.mockResolvedValue([{ id: 'e0', status: 'draft' }]);
        render(<RFQAwardWizardPage />);
        await waitFor(() => expect(screen.getByText('Lock an evaluation before awarding.')).toBeInTheDocument());
    });

    it('Given a line over-allocated, When Next is clicked, Then the step blocks', async () => {
        render(<RFQAwardWizardPage />);
        const beta = await screen.findByLabelText('Quantity for Beta');
        fireEvent.change(beta, { target: { value: '10' } });
        fireEvent.click(screen.getByText('Next'));
        await waitFor(() => expect(screen.getByText('A line is awarded for more than the requested quantity')).toBeInTheDocument());
    });
});
