import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetGRNs = vi.fn();
const mockNavigate = vi.fn();
const mockUseShellBridge = vi.fn();

vi.mock('@so360/shell-context', () => ({
  useShellBridge: (...args: any[]) => mockUseShellBridge(...args),
}));

vi.mock('../../services/procurementService', () => ({
  procurementService: { getGRNs: (...args: any[]) => mockGetGRNs(...args) },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

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

import GRNListPage from './GRNListPage';

const makeGRN = (o: any = {}) => ({
  id: 'grn-1', grn_number: 'GRN-2025-0001', created_at: new Date().toISOString(),
  warehouse: { name: 'Main WH' }, po: { po_number: 'PO-1', vendor: { name: 'Acme Corp' } },
  grn_lines: [{ quantity_received: 10 }], ...o,
});

const shell = (state = 'enabled') => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, getFeatureState: () => state });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetGRNs.mockResolvedValue([]);
  mockUseShellBridge.mockReturnValue(shell());
});

describe('GRNListPage on Comb ListPageTemplate', () => {
  it('Given the page loads / When rendered / Then the list template shows the title and New GRN primary action', async () => {
    render(<GRNListPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Goods Receipt Notes' })).toBeInTheDocument());
    expect(document.querySelector('[data-template="list"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="primary"]')?.textContent).toContain('New GRN');
  });

  it('Given the request is pending / When rendered / Then the skeleton shows and no table', () => {
    mockGetGRNs.mockReturnValue(new Promise(() => {}));
    render(<GRNListPage />);
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.queryByTestId('grn-table')).toBeNull();
  });

  it('Given no GRNs exist / When loaded / Then the empty state is shown', async () => {
    render(<GRNListPage />);
    await waitFor(() => expect(screen.getByText('No goods receipt notes found.')).toBeInTheDocument());
  });

  it('Given GRNs exist / When a row is clicked / Then it navigates to the GRN detail', async () => {
    mockGetGRNs.mockResolvedValue([makeGRN()]);
    render(<GRNListPage />);
    await waitFor(() => screen.getByText('GRN-2025-0001'));
    fireEvent.click(screen.getByText('GRN-2025-0001'));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/grn/grn-1');
  });

  it('Given GRNs exist / When searching for an unknown value / Then the no-match empty state is shown', async () => {
    mockGetGRNs.mockResolvedValue([makeGRN()]);
    render(<GRNListPage />);
    await waitFor(() => screen.getByText('GRN-2025-0001'));
    fireEvent.change(screen.getByTestId('grn-search'), { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.getByText('No GRNs match your search.')).toBeInTheDocument());
  });

  it('Given the create flag is hidden / When rendered / Then New GRN is not shown', async () => {
    mockUseShellBridge.mockReturnValue(shell('hidden'));
    render(<GRNListPage />);
    await waitFor(() => screen.getByText('Goods Receipt Notes'));
    expect(screen.queryByText('New GRN')).toBeNull();
  });
});
