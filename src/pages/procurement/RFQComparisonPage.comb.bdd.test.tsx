import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetComparison = vi.fn();
const mockAward = vi.fn();
const mockGrade = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/rfqService', () => ({
  rfqService: {
    getComparison: (...a: any[]) => mockGetComparison(...a),
    awardRFQ: (...a: any[]) => mockAward(...a),
    gradeQuotation: (...a: any[]) => mockGrade(...a),
  },
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'rfq-1' }), useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}` }),
}));

import RFQComparisonPage from './RFQComparisonPage';

const quote = (o: any = {}) => ({
  quotation_id: 'q-1', vendor_id: 'v-1', vendor_name: 'Alpha', quotation_number: 'Q1', status: 'received', is_expired: false,
  subtotal_amount: 100, tax_amount: 5, freight_amount: 1, discount_amount: 0, total_amount: 106, lead_time_days: 5,
  is_lowest_total: true, lines: {}, ...o,
});
const data = (o: any = {}) => ({
  rfq: { id: 'rfq-1', rfq_number: 'RFQ-1', title: 'Cement', status: 'sent' }, lines: [], quotations: [quote()],
  summary: { quotation_count: 1, invited_count: 2, lowest_total: 106, potential_saving: 0 }, ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetComparison.mockResolvedValue(data());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('RFQComparisonPage (Comb)', () => {
  it('Given quotations, When it loads, Then the title and criteria rows show', async () => {
    render(<RFQComparisonPage />);
    expect(await screen.findByRole('heading', { name: 'Quotation Comparison' })).toBeTruthy();
    expect(screen.getByText('Landed Total')).toBeTruthy();
  });

  it('Given the comparison is loading, When rendered, Then the skeleton slot shows', () => {
    mockGetComparison.mockReturnValue(new Promise(() => {}));
    const { container } = render(<RFQComparisonPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it('Given no quotations, When it loads, Then the empty state shows', async () => {
    mockGetComparison.mockResolvedValue(data({ quotations: [] }));
    render(<RFQComparisonPage />);
    expect(await screen.findByText('No quotations to compare yet.')).toBeTruthy();
  });

  it('Given a quotation, When Award is clicked, Then awardRFQ is called and the PO opens', async () => {
    mockAward.mockResolvedValue({ po: { id: 'po-1', po_number: 'PO-1' } });
    render(<RFQComparisonPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Award/ }));
    await waitFor(() => expect(mockAward).toHaveBeenCalledWith('rfq-1', { quotation_id: 'q-1', justification: undefined }));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/po/po-1');
  });

  it('Given an awarded RFQ, When it loads, Then decision controls are hidden', async () => {
    mockGetComparison.mockResolvedValue(data({ rfq: { id: 'rfq-1', rfq_number: 'RFQ-1', status: 'awarded' } }));
    render(<RFQComparisonPage />);
    await screen.findByText('Landed Total');
    expect(screen.queryByRole('button', { name: /Award/ })).toBeNull();
    expect(screen.queryByLabelText('Award Justification')).toBeNull();
  });

  it('Given an expired quotation, When it loads, Then Award is disabled', async () => {
    mockGetComparison.mockResolvedValue(data({ quotations: [quote({ is_expired: true })] }));
    render(<RFQComparisonPage />);
    expect((await screen.findByRole('button', { name: /Award/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
