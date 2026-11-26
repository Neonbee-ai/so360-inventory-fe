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

describe('GRNDetailPage vendor attribution exceptions (Pulse 91b5ff86)', () => {
  it('Given an open missing-vendor exception / When rendered / Then the chip and the reason show', async () => {
    mockGetGRNDetail.mockResolvedValue(grn({ inspection_status: 'not_required', integration_exceptions: [{ id: 'e1', exception_code: 'missing_vendor' }] }));
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getAllByText('Vendor attribution needs review').length).toBeGreaterThan(0));
    expect(screen.getByText(/Receipt has no vendor/)).toBeInTheDocument();
  });

  it('Given no exceptions / When rendered / Then no chip shows', async () => {
    mockGetGRNDetail.mockResolvedValue(grn({ inspection_status: 'not_required', integration_exceptions: [] }));
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText('Steel Bolt')).toBeInTheDocument());
    expect(screen.queryByText('Vendor attribution needs review')).not.toBeInTheDocument();
  });
});
