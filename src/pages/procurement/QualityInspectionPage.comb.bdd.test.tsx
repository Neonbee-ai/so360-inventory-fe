import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetInspections = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/qualityService', () => ({
  qualityService: { getInspections: (...a: any[]) => mockGetInspections(...a), completeInspection: vi.fn(), createInspection: vi.fn() },
}));
vi.mock('../../services/procurementService', () => ({ procurementService: { getGRNs: () => Promise.resolve([]) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '', businessToday: () => '2026-09-15' }),
  useInventoryCurrencySymbol: () => '$',
}));

import QualityInspectionPage from './QualityInspectionPage';

const insp = (o: any = {}) => ({
  id: 'qc-1', inspection_number: 'QC-1', status: 'pending', result: null, grn_id: 'grn-1',
  grn: { grn_number: 'GRN-1' }, created_at: '2026-08-14',
  quality_inspection_lines: [{ id: 'l1', description: 'Cement', received_quantity: 10 }], ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInspections.mockResolvedValue([insp()]);
});

describe('QualityInspectionPage (Comb)', () => {
  it('Given inspections / When loaded / Then the list template shows its title and Open Inspection action', async () => {
    const { container } = render(<QualityInspectionPage />);
    await waitFor(() => screen.getByText('QC-1'));
    expect(screen.getByRole('heading', { name: 'Quality Inspection' })).toBeInTheDocument();
    expect(screen.getByText('+ Open Inspection')).toBeInTheDocument();
    expect(container.querySelector('[data-template="list"]')).toBeInTheDocument();
  });

  it('Given a slow API / When loading / Then the list skeleton shows', () => {
    mockGetInspections.mockReturnValue(new Promise(() => {}));
    const { container } = render(<QualityInspectionPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('Given no inspections / When loaded / Then the empty state shows', async () => {
    mockGetInspections.mockResolvedValue([]);
    render(<QualityInspectionPage />);
    await waitFor(() => expect(screen.getByText('No inspections yet')).toBeInTheDocument());
  });

  it('Given a pending inspection / When Record Result is clicked / Then the record dialog opens', async () => {
    render(<QualityInspectionPage />);
    await waitFor(() => screen.getByText('Record Result →'));
    fireEvent.click(screen.getByText('Record Result →'));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Record Inspection' })).toBeInTheDocument());
    expect(screen.getByText('Record & Release Stock')).toBeInTheDocument();
  });

  it('Given a completed inspection / When listed / Then Record Result is gated out and View Receipt navigates', async () => {
    mockGetInspections.mockResolvedValue([insp({ status: 'completed', result: 'passed' })]);
    render(<QualityInspectionPage />);
    await waitFor(() => screen.getByText('View Receipt'));
    expect(screen.queryByText('Record Result →')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('View Receipt'));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/grn/grn-1');
  });
});
