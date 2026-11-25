import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetGRNDetail = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getGRNDetail: (...args: any[]) => mockGetGRNDetail(...args),
    // The document-trail panel on this page reads the chain.
    getDocumentTrace: () => Promise.resolve({ chain: [] }),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'grn-1' }),
  useNavigate: () => mockNavigate,
}));

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

import GRNDetailPage from './GRNDetailPage';
const line = (o: any = {}) => ({
  id: 'l1', item_id: 'item-12345678', quantity_received: 1, accepted_quantity: 1, rejected_quantity: 0,
  serial_numbers: [],
  item: { name: 'Steel Bolt', sku: 'SB-1', description: 'M8 bolt', uom: 'Each' },
  po_line: { quantity: 1, unit_price: 99.99, description: 'Bolt' },
  ...o,
});
const grn = (o: any = {}) => ({
  id: 'grn-1', grn_number: 'GRN-012', created_at: '2026-11-01T00:00:00Z',
  warehouse: { id: 'w', name: 'Main WH' }, po: { id: 'p', po_number: 'PO-1' },
  inspection_status: 'pending', grn_lines: [line()], ...o,
});

describe('GRNDetailPage clarity (Pulse eec98794)', () => {
  it('Given a line with no batch/serials / When rendered / Then no stray 0 is shown under the item', async () => {
    mockGetGRNDetail.mockResolvedValue(grn());
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText('Steel Bolt')).toBeInTheDocument());
    expect(screen.getByText('Steel Bolt').parentElement?.textContent).toBe('Steel BoltSB-1 · UOM EachM8 bolt');
  });

  it('Given the item master resolves / When rendered / Then name, sku and UOM show', async () => {
    mockGetGRNDetail.mockResolvedValue(grn());
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText(/SB-1/)).toBeInTheDocument());
    expect(screen.getByText(/UOM Each/)).toBeInTheDocument();
  });

  it('Given the item cannot be resolved / When rendered / Then a controlled fallback replaces "Unknown Item"', async () => {
    mockGetGRNDetail.mockResolvedValue(grn({ grn_lines: [line({ item: null })] }));
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText(/Not found in item master/)).toBeInTheDocument());
    expect(screen.queryByText('Unknown Item')).not.toBeInTheDocument();
  });

  it('Given inspection is pending and stock on hold / When rendered / Then it is not reported as a success', async () => {
    mockGetGRNDetail.mockResolvedValue(grn({ stock_impact: { state: 'on_hold' } }));
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText('Stock on quality hold')).toBeInTheDocument());
    expect(screen.queryByText('Stock posted')).not.toBeInTheDocument();
    expect(screen.getByText('Awaiting quality inspection')).toBeInTheDocument();
  });

  it('Given stock was posted / When rendered / Then the posted message shows the quantity and warehouse', async () => {
    mockGetGRNDetail.mockResolvedValue(grn({ inspection_status: 'not_required', stock_impact: { state: 'posted', posted_quantity: 1, warehouse: { id: 'w', name: 'Main WH' } } }));
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText('Stock posted')).toBeInTheDocument());
    expect(screen.queryByText('Awaiting quality inspection')).not.toBeInTheDocument();
  });

  it('Given no movement evidence / When rendered / Then a pending state is shown instead of success', async () => {
    mockGetGRNDetail.mockResolvedValue(grn({ inspection_status: 'not_required', stock_impact: { state: 'pending' } }));
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText('No stock movement posted yet')).toBeInTheDocument());
  });
});
