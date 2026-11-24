import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockCandidates = vi.fn();
const mockCreate = vi.fn();
const mockNavigate = vi.fn();
const mockShell = vi.fn();
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => mockShell() }));
vi.mock('../../services/procurementService', () => ({
    procurementService: { getConsolidationCandidates: (...a: any[]) => mockCandidates(...a), createConsolidationGroup: (...a: any[]) => mockCreate(...a) },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatNumber: (n: number) => String(n), formatCurrency: (v: number) => `$${v}` }),
}));

import ConsolidationWizardPage from './ConsolidationWizardPage';

const line = (id: string, over: any = {}) => ({ pr_line_id: id, pr_number: `PR-${id}`, description: 'Rebar', free_qty: 10, required_date: '2026-12-10', source_module: 'projects', source_id: `P-${id}`, ...over });
const groups = [
    { group_key: 'k1', consolidatable: true, total_qty: 20, rationale: '2 lines match', lines: [line('a'), line('b')] },
    { group_key: 'k2', consolidatable: false, total_qty: 5, rationale: 'No other compatible line', lines: [line('c', { free_qty: 5 })] },
];

beforeEach(() => {
    vi.clearAllMocks();
    mockShell.mockReturnValue({ isFeatureEnabled: () => false });
    mockCandidates.mockResolvedValue(groups);
    mockCreate.mockResolvedValue({ id: 'g1' });
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('ConsolidationWizardPage', () => {
    it('Given candidates, When rendered, Then compatible lines are grouped with the rationale', async () => {
        render(<ConsolidationWizardPage />);
        await waitFor(() => expect(screen.getByText('2 lines match')).toBeInTheDocument());
        expect(screen.getByText('2 compatible lines - 20 to buy')).toBeInTheDocument();
    });

    it('Given nothing selected, When Next is clicked, Then the step blocks with a message', async () => {
        render(<ConsolidationWizardPage />);
        await waitFor(() => screen.getByText('2 lines match'));
        fireEvent.click(screen.getByText('Next'));
        await waitFor(() => expect(screen.getByText('Select at least one requisition line')).toBeInTheDocument());
    });

    it('Given two compatible lines selected, When the wizard is finished, Then one group is created for both lines', async () => {
        render(<ConsolidationWizardPage />);
        await waitFor(() => screen.getByText('2 lines match'));
        fireEvent.click(screen.getByLabelText('Select PR-a'));
        fireEvent.click(screen.getByLabelText('Select PR-b'));
        fireEvent.click(screen.getByText('Next'));
        await waitFor(() => screen.getByText('All 2 selected line(s) are compatible.'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(await screen.findByText('Consolidate'));
        await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ pr_line_ids: ['a', 'b'] }));
        expect(mockNavigate).toHaveBeenCalledWith('/procurement/coverage');
    });

    it('Given incompatible lines and no override permission, When reviewing, Then it is blocked', async () => {
        render(<ConsolidationWizardPage />);
        await waitFor(() => screen.getByText('2 lines match'));
        fireEvent.click(screen.getByLabelText('Select PR-a'));
        fireEvent.click(screen.getByLabelText('Select PR-c'));
        fireEvent.click(screen.getByText('Next'));
        await waitFor(() => screen.getByText('Incompatible lines'));
        fireEvent.click(screen.getByText('Next'));
        await waitFor(() => expect(screen.getByText(/cannot be combined/)).toBeInTheDocument());
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('Given incompatible lines and override permission, When a reason is given, Then the group is created with it', async () => {
        mockShell.mockReturnValue({ isFeatureEnabled: () => true });
        render(<ConsolidationWizardPage />);
        await waitFor(() => screen.getByText('2 lines match'));
        fireEvent.click(screen.getByLabelText('Select PR-a'));
        fireEvent.click(screen.getByLabelText('Select PR-c'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.change(await screen.findByLabelText(/Reason for the override/), { target: { value: 'Same supplier lorry' } });
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(await screen.findByText('Consolidate'));
        await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ pr_line_ids: ['a', 'c'], override_reason: 'Same supplier lorry' }));
    });
});
