import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockUseShellBridge = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: (...args: any[]) => mockUseShellBridge(...args),
}));

const mockGetPRs = vi.fn();
const mockDeletePR = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPRs: (...a: any[]) => mockGetPRs(...a),
    createPR: vi.fn().mockResolvedValue({ id: 'pr-new' }),
    deletePR: (...a: any[]) => mockDeletePR(...a),
  },
}));
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

import PRListPage from './PRListPage';

const makePR = (o: any = {}) => ({
  id: 'pr-1', pr_number: 'PR-0001', status: 'draft', description: 'Office supplies', required_date: '2025-06-01',
  created_at: '2025-01-10T00:00:00Z', requester: { full_name: 'John Doe' }, pr_lines: [{ id: 'l1', description: 'Paper', quantity: 5, estimated_unit_price: 20 }], ...o,
});

const shell = (state = 'enabled') => ({ effectiveFlagsLoaded: true, getFeatureState: () => state });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPRs.mockResolvedValue([]);
  mockDeletePR.mockResolvedValue({});
  mockUseShellBridge.mockReturnValue(shell());
});

describe('PRListPage on Comb ListPageTemplate', () => {
  it('Given the page loads / When rendered / Then the list template shows the title and New Requisition primary action', async () => {
    render(<PRListPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Purchase Requisitions' })).toBeInTheDocument());
    expect(document.querySelector('[data-template="list"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="primary"]')?.textContent).toContain('New Requisition');
  });

  it('Given the request is pending / When rendered / Then the skeleton shows', () => {
    mockGetPRs.mockReturnValue(new Promise(() => {}));
    render(<PRListPage />);
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('Given no requisitions exist / When loaded / Then the empty state is shown', async () => {
    render(<PRListPage />);
    await waitFor(() => expect(screen.getByText('No purchase requisitions found.')).toBeInTheDocument());
  });

  it('Given a requisition exists / When View Details is clicked / Then it navigates to the PR detail', async () => {
    mockGetPRs.mockResolvedValue([makePR()]);
    render(<PRListPage />);
    await waitFor(() => screen.getByText('PR-0001'));
    fireEvent.click(screen.getByText('View Details →'));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/pr/pr-1');
  });

  it('Given the page loaded / When New Requisition is clicked / Then the Comb modal form opens and Cancel closes it', async () => {
    render(<PRListPage />);
    await waitFor(() => screen.getByText('New Requisition'));
    fireEvent.click(screen.getByText('New Requisition'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Given the create_pr flag is hidden / When rendered / Then New Requisition is not shown', async () => {
    mockUseShellBridge.mockReturnValue(shell('hidden'));
    render(<PRListPage />);
    await waitFor(() => screen.getByText('Purchase Requisitions'));
    expect(screen.queryByText('New Requisition')).toBeNull();
  });
});
