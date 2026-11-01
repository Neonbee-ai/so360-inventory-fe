import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetGRNDetail = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getGRNDetail: (...a: any[]) => mockGetGRNDetail(...a),
    getDocumentTrace: () => Promise.resolve({ chain: [] }),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'grn-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    toBusinessDate: (d: any) => String(d).slice(0, 10),
    businessToday: () => '2026-09-15',
    startOfBusinessDayUtc: (d: string) => new Date(`${d}T00:00:00Z`),
    endOfBusinessDayUtcExclusive: (d: string) => new Date(`${d}T00:00:00Z`),
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD', locale: 'en-US', timezone: 'UTC',
  }),
  useInventoryCurrencySymbol: () => '$',
}));

import GRNDetailPage from './GRNDetailPage';

const makeGRN = (overrides: any = {}) => ({
  id: 'grn-1',
  grn_number: 'GRN-2024-001',
  created_at: '2024-01-15T00:00:00Z',
  warehouse: { id: 'wh-1', name: 'Main Warehouse' },
  po: { id: 'po-1', po_number: 'PO-2024-001', vendor: { id: 'v1', name: 'Acme Supplies' } },
  grn_lines: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetGRNDetail.mockResolvedValue(makeGRN());
});

describe('GRNDetailPage (Comb)', () => {
  it('Given a GRN / When loaded / Then the GRN number is the page title in a detail template', async () => {
    const { container } = render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'GRN-2024-001' })).toBeInTheDocument());
    expect(container.querySelector('[data-template="detail"]')).toBeInTheDocument();
  });

  it('Given a slow API / When loading / Then the template shows its skeleton', () => {
    mockGetGRNDetail.mockReturnValue(new Promise(() => {}));
    const { container } = render(<GRNDetailPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('Given a GRN with no lines / When loaded / Then the line table renders no rows', async () => {
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText('Received Items')).toBeInTheDocument());
    expect(screen.queryByText('Widget A')).not.toBeInTheDocument();
  });

  it('Given the fetch fails / When shown / Then Back to GRNs navigates to the list', async () => {
    mockGetGRNDetail.mockRejectedValue(new Error('Boom'));
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByText('Boom')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Back to GRNs'));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/grn');
  });

  it('Given inspection is not required / When loaded / Then no inspection-pending badge is gated in', async () => {
    mockGetGRNDetail.mockResolvedValue(makeGRN({ inspection_status: 'not_required' }));
    render(<GRNDetailPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'GRN-2024-001' })).toBeInTheDocument());
    expect(screen.queryByText('Inspection pending')).not.toBeInTheDocument();
  });
});
