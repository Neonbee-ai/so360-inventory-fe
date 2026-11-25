import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockLock = vi.fn();
vi.mock('../../services/rfqService', () => ({
    rfqService: {
        listEvaluations: (...a: any[]) => mockList(...a), getEvaluation: (...a: any[]) => mockGet(...a),
        createEvaluation: (...a: any[]) => mockCreate(...a), lockEvaluation: (...a: any[]) => mockLock(...a), addEvaluationEntry: vi.fn(),
    },
}));
vi.mock('../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatCurrency: (v: number) => `$${v}`, formatDate: (d: string) => d }) }));

import RFQEvaluationPanel from './RFQEvaluationPanel';

const evaluation = (o: any = {}) => ({
    id: 'e1', version: 2, status: 'draft', base_currency: 'INR', stale_quotes: false,
    criteria: { rule_version: 1, weights: { price: 40, lead_time: 20 } },
    recommendation: { recommended_quotation_id: 'q1', lowest_cost_fails_mandatory: true },
    normalized: [
        { quotation_id: 'q1', version: 1, currency: 'USD', base_currency: 'INR', fx: { rate: 83, source: 'direct', effective_date: '2026-11-01' }, flags: ['DELIVERY_RISK'], totals: { evaluated_cost: 83000, tax: 0 }, lines: [{ rfq_line_id: 'l1', original: { quantity: 100, uom: 'EA', unit_price: 10 } }] },
        { quotation_id: 'q2', version: 2, currency: 'INR', base_currency: 'INR', fx: null, flags: ['FX_RATE_MISSING'], totals: { evaluated_cost: null, tax: null }, lines: [] },
    ],
    scores: [{ quotation_id: 'q1', total: 91.5, rank: 1 }, { quotation_id: 'q2', total: null, rank: null, disqualified: true }],
    entries: [], ...o,
});
const labels = { q1: 'Alpha', q2: 'Beta' };

beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([{ id: 'e1', status: 'draft' }]);
    mockGet.mockResolvedValue(evaluation());
});

describe('RFQEvaluationPanel (Pulse 84845b42)', () => {
    it('Given an evaluation, When rendered, Then original, normalised value, FX rate/date and flags are shown side by side', async () => {
        render(<RFQEvaluationPanel rfqId="rfq-1" quoteLabels={labels} canAct />);
        await waitFor(() => expect(screen.getByText('$83000')).toBeInTheDocument());
        expect(screen.getByText(/100 EA × 10 USD/)).toBeInTheDocument();
        expect(screen.getByText('direct · 2026-11-01')).toBeInTheDocument();
        expect(screen.getByText('delivery risk')).toBeInTheDocument();
        expect(screen.getByText('Not comparable')).toBeInTheDocument();
        expect(screen.getByText(/scoring rule v1/)).toBeInTheDocument();
    });

    it('Given the lowest quote fails a mandatory criterion, When rendered, Then a warning says it cannot be recommended', async () => {
        render(<RFQEvaluationPanel rfqId="rfq-1" quoteLabels={labels} canAct />);
        await waitFor(() => screen.getByText(/fails a mandatory technical criterion/));
    });

    it('Given a draft evaluation, When Lock snapshot is clicked, Then the API locks it', async () => {
        mockLock.mockResolvedValue({});
        render(<RFQEvaluationPanel rfqId="rfq-1" quoteLabels={labels} canAct />);
        fireEvent.click(await screen.findByText('Lock snapshot'));
        await waitFor(() => expect(mockLock).toHaveBeenCalledWith('rfq-1', 'e1'));
    });

    it('Given quotes changed after the snapshot, When rendered, Then a stale warning offers a new version', async () => {
        mockGet.mockResolvedValue(evaluation({ stale_quotes: true, status: 'locked' }));
        render(<RFQEvaluationPanel rfqId="rfq-1" quoteLabels={labels} canAct />);
        await waitFor(() => screen.getByText(/Quotations changed after this evaluation/));
        expect(screen.getByText('New version')).toBeInTheDocument();
    });

    it('Given no evaluation exists, When rendered, Then Create evaluation is offered', async () => {
        mockList.mockResolvedValue([]);
        render(<RFQEvaluationPanel rfqId="rfq-1" quoteLabels={labels} canAct />);
        fireEvent.click(await screen.findByText('Create evaluation'));
        await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('rfq-1'));
    });
});
