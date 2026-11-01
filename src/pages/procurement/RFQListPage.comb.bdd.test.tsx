import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetRFQs = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/rfqService', () => ({
  rfqService: { getRFQs: (...a: any[]) => mockGetRFQs(...a), createRFQ: vi.fn().mockResolvedValue({ rfq_number: 'RFQ-1' }) },
}));
vi.mock('../../services/procurementService', () => ({ procurementService: { getPRs: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../services/vendorService', () => ({ vendorService: { getVendors: vi.fn().mockResolvedValue([{ id: 'v1', name: 'Acme' }]) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../components/ItemSearchSelector', () => ({ __esModule: true, default: () => <div data-testid="item-search" /> }));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    // Date-only primitives — this factory is a CLOSED LIST, so a component that
    // adopts formatters.businessToday()/toBusinessDate() throws here otherwise.
    toBusinessDate: (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)),
    businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`),
    endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
  useInventoryCurrencySymbol: () => '$',
}));

import RFQListPage, { RFQ_STATUS_STYLES } from './RFQListPage';

const makeRFQ = (o: any = {}) => ({
  id: 'rfq-1', rfq_number: 'RFQ-0001', title: 'Cement', status: 'sent', created_at: '2025-01-01',
  line_count: 2, vendor_count: 3, quotation_count: 2, response_due_date: '2025-02-01', ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRFQs.mockResolvedValue([]);
});

describe('RFQListPage on Comb ListPageTemplate', () => {
  it('Given the page loads / When rendered / Then the title and New RFQ primary action are shown', async () => {
    render(<RFQListPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Requests for Quotation' })).toBeInTheDocument());
    expect(document.querySelector('[data-slot="primary"]')?.textContent).toContain('New RFQ');
  });

  it('Given the request is pending / When rendered / Then the skeleton is shown', () => {
    mockGetRFQs.mockReturnValue(new Promise(() => {}));
    render(<RFQListPage />);
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('Given no RFQs / When loaded / Then the empty state is shown', async () => {
    render(<RFQListPage />);
    await waitFor(() => expect(screen.getByText('No RFQs yet. Create one to start sourcing quotes.')).toBeInTheDocument());
  });

  it('Given RFQs with several quotes / When Compare is clicked / Then it navigates to the comparison', async () => {
    mockGetRFQs.mockResolvedValue([makeRFQ()]);
    render(<RFQListPage />);
    await waitFor(() => screen.getByText('RFQ-0001'));
    fireEvent.click(screen.getByText('Compare'));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/rfq/rfq-1/compare');
  });

  it('Given the filter drawer / When a status is chosen / Then RFQs are re-fetched with that status', async () => {
    render(<RFQListPage />);
    await waitFor(() => screen.getByRole('heading', { name: 'Requests for Quotation' }));
    fireEvent.click(screen.getByTestId('filters-button'));
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'awarded' } });
    await waitFor(() => expect(mockGetRFQs).toHaveBeenLastCalledWith({ status: 'awarded' }));
  });

  it('Given the page loaded / When New RFQ is clicked / Then the Comb modal opens and Cancel closes it', async () => {
    render(<RFQListPage />);
    await waitFor(() => screen.getByText('New RFQ'));
    fireEvent.click(screen.getByText('New RFQ'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Given the RFQ module, When RFQ_STATUS_STYLES is imported, Then it maps every status to its class string', () => {
    expect(Object.keys(RFQ_STATUS_STYLES).sort()).toEqual(['awarded', 'cancelled', 'closed', 'draft', 'sent']);
    expect(RFQ_STATUS_STYLES.draft).toBe('bg-surface-high text-fg-muted border-line-strong/20');
    expect(RFQ_STATUS_STYLES.awarded).toContain('text-success');
  });
});
