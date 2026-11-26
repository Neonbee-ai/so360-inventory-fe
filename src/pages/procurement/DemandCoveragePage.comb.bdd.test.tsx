import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetCoverage = vi.fn();
const mockDecide = vi.fn();
const mockRecalc = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/procurementService', () => ({
    procurementService: {
        getCoverage: (...a: any[]) => mockGetCoverage(...a),
        decideCoverage: (...a: any[]) => mockDecide(...a),
        recalculateCoverage: (...a: any[]) => mockRecalc(...a),
    },
}));
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

import DemandCoveragePage from './DemandCoveragePage';

const row = (o: any = {}) => ({
    pr_line_id: 'l1', status: 'partially_covered', gross_qty: 100, available_qty: 40, inbound_confirmed_qty: 0,
    inbound_unconfirmed_qty: 25, net_purchase_qty: 60, earliest_eta: '2026-12-10', latest_order_date: '2026-12-01',
    stale: false, decision: null,
    line: { pr_id: 'pr-1', description: 'Rebar 12mm', purchase_requisitions: { pr_number: 'PR-0001' } },
    ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockGetCoverage.mockResolvedValue({ rows: [row()], summary: { partially_covered: 1, fully_covered: 0, net_purchase_required: 0 } });
    mockDecide.mockResolvedValue({});
    mockRecalc.mockResolvedValue([]);
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('DemandCoveragePage (Comb)', () => {
    it('Given a partially covered line, When rendered, Then the list floorplan shows gross, stock, unconfirmed inbound and what is left to buy', async () => {
        const { container } = render(<DemandCoveragePage />);
        await waitFor(() => expect(screen.getByText('PR-0001')).toBeInTheDocument());
        expect(container.querySelector('[data-template="list"]')).not.toBeNull();
        expect(screen.getByRole('heading', { name: 'Demand Coverage' })).toBeInTheDocument();
        expect(screen.getByText('+25 unconfirmed')).toBeInTheDocument();
        // the same label is also a filter <option>; assert the badge, not the option
        expect(screen.getAllByText('Partially covered').some((el) => el.tagName !== 'OPTION')).toBe(true);
    });

    it('Given a stale line, When rendered, Then a stale chip and a recalculate warning are shown', async () => {
        mockGetCoverage.mockResolvedValue({ rows: [row({ stale: true })], summary: {} });
        render(<DemandCoveragePage />);
        await waitFor(() => screen.getByText('Stale'));
        expect(screen.getByText(/calculated before stock, reservations or purchase orders changed/)).toBeInTheDocument();
    });

    it('Given no approved lines, When loaded, Then the empty state is shown', async () => {
        mockGetCoverage.mockResolvedValue({ rows: [], summary: {} });
        render(<DemandCoveragePage />);
        await waitFor(() => expect(screen.getByText('No approved requisition lines need coverage.')).toBeInTheDocument());
    });

    it('Given a line, When Decide is chosen and saved, Then the purchase decision is posted for that line', async () => {
        render(<DemandCoveragePage />);
        await waitFor(() => screen.getByText('Decide'));
        fireEvent.click(screen.getByText('Decide'));
        fireEvent.click(await screen.findByTestId('coverage-save'));
        await waitFor(() => expect(mockDecide).toHaveBeenCalledWith('l1', expect.objectContaining({ decision: 'purchase' })));
    });

    it('Given the server refuses the decision, When saved, Then the message shows in the drawer and it stays open', async () => {
        mockDecide.mockRejectedValue(new Error('Split must add up'));
        render(<DemandCoveragePage />);
        await waitFor(() => screen.getByText('Decide'));
        fireEvent.click(screen.getByText('Decide'));
        fireEvent.click(await screen.findByTestId('coverage-save'));
        await waitFor(() => expect(screen.getByText('Split must add up')).toBeInTheDocument());
    });

    it('Given lines, When Recalculate is clicked, Then all line ids are recalculated', async () => {
        render(<DemandCoveragePage />);
        await waitFor(() => screen.getByText('PR-0001'));
        fireEvent.click(screen.getByText('Recalculate'));
        await waitFor(() => expect(mockRecalc).toHaveBeenCalledWith(['l1']));
    });
});
