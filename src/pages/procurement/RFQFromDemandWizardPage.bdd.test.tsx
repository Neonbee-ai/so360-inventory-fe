import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGroups = vi.fn();
const mockCreate = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/rfqService', () => ({
    rfqService: { getDemandGroups: (...a: any[]) => mockGroups(...a), createFromDemand: (...a: any[]) => mockCreate(...a) },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatNumber: (n: number) => String(n) }),
}));

import RFQFromDemandWizardPage from './RFQFromDemandWizardPage';

const group = { id: 'g1', specification: 'Rebar 12mm', uom: 'KG', rationale: '2 lines match', need_by_from: '2026-12-10', procurement_demand_allocations: [
    { status: 'active', fulfilment: 'purchase', allocated_qty: 6, rfq_line_id: null },
    { status: 'active', fulfilment: 'purchase', allocated_qty: 4, rfq_line_id: null },
    { status: 'active', fulfilment: 'stock', allocated_qty: 9, rfq_line_id: null },
] };

beforeEach(() => {
    vi.clearAllMocks();
    mockGroups.mockResolvedValue([group, { id: 'g2', specification: 'done', procurement_demand_allocations: [{ status: 'active', fulfilment: 'purchase', allocated_qty: 3, rfq_line_id: 'x' }] }]);
    mockCreate.mockResolvedValue({ id: 'rfq-9', status: 'draft' });
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('RFQFromDemandWizardPage (Pulse 028b8302)', () => {
    it('Given groups, When rendered, Then only groups with unsourced purchase quantity are offered', async () => {
        render(<RFQFromDemandWizardPage />);
        await waitFor(() => expect(screen.getByText('Rebar 12mm')).toBeInTheDocument());
        expect(screen.queryByText('done')).toBeNull();
        expect(screen.getByText('10 KG')).toBeInTheDocument();
    });

    it('Given nothing selected, When Next is clicked, Then the step blocks', async () => {
        render(<RFQFromDemandWizardPage />);
        await waitFor(() => screen.getByText('Rebar 12mm'));
        fireEvent.click(screen.getByText('Next'));
        await waitFor(() => expect(screen.getByText('Select at least one demand group')).toBeInTheDocument());
    });

    it('Given a group is selected and no due date, When Next is clicked, Then the route step asks for the due date', async () => {
        render(<RFQFromDemandWizardPage />);
        await waitFor(() => screen.getByText('Rebar 12mm'));
        fireEvent.click(screen.getByLabelText('Select Rebar 12mm'));
        fireEvent.click(screen.getByText('Next'));
        await waitFor(() => screen.getByLabelText('Response due date'));
        fireEvent.click(screen.getByText('Next'));
        await waitFor(() => expect(screen.getByText('Set the response due date')).toBeInTheDocument());
    });
});
