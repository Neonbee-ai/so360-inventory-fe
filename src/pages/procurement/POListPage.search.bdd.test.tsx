import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  getPOs: vi.fn(),
  getPRs: vi.fn(),
  getVendors: vi.fn(),
  can: vi.fn(() => true),
  flagState: 'enabled' as string,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
  useLocation: () => ({ state: null }),
}));
vi.mock('../../services/procurementService', () => ({
  procurementService: { getPOs: h.getPOs, getPRs: h.getPRs, getConversionPayload: vi.fn(), createPO: vi.fn() },
}));
vi.mock('../../services/vendorService', () => ({ vendorService: { getVendors: h.getVendors } }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ can: h.can, isLoading: false }) }));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({ formatCurrency: (n: number) => `$${n}`, formatDate: (d: string) => d }),
}));
vi.mock('../../components/ItemSearchSelector', () => ({ default: () => <div data-testid="item-search" /> }));
vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD' } }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({
    currentOrg: { id: 'org-1' },
    effectiveFlagsLoaded: true,
    getFeatureState: () => h.flagState,
  }),
  useQuota: () => ({ getQuota: () => null }),
}));

import POListPage from './POListPage';

const po = (o: any = {}) => ({
  id: 'po-1', po_number: 'PO-1', status: 'sent', total_amount: '120', created_at: '2026-01-01',
  vendor: { name: 'Acme' }, po_lines: [{ quantity: 1, received_quantity: 1 }, { quantity: 2, received_quantity: 0 }],
  ...o,
});

describe('POListPage search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.flagState = 'enabled';
    h.can.mockReturnValue(true);
    h.getPOs.mockResolvedValue([
      po(),
      po({ id: 'po-2', po_number: 'PO-2', vendor: { name: 'Globex' }, terms: 'Net 30 e2e-abc123' }),
    ]);
    h.getPRs.mockResolvedValue([]);
    h.getVendors.mockResolvedValue([{ id: 'v1', name: 'Acme' }]);
  });

  it('Given two POs / When searching by PO number / Then only the matching row shows', async () => {
    render(<POListPage />);
    await screen.findByText('#PO-2');
    fireEvent.change(screen.getByTestId('po-search'), { target: { value: 'po-2' } });
    expect(screen.getByText('#PO-2')).toBeInTheDocument();
    expect(screen.queryByText('#PO-1')).not.toBeInTheDocument();
  });

  it('Given two POs / When searching by vendor name / Then the vendor PO shows', async () => {
    render(<POListPage />);
    await screen.findByText('#PO-1');
    fireEvent.change(screen.getByTestId('po-search'), { target: { value: 'acme' } });
    expect(screen.getByText('#PO-1')).toBeInTheDocument();
    expect(screen.queryByText('#PO-2')).not.toBeInTheDocument();
  });

  it('Given a PO with terms text / When searching a word from its terms / Then that PO shows', async () => {
    render(<POListPage />);
    await screen.findByText('#PO-1');
    fireEvent.change(screen.getByTestId('po-search'), { target: { value: 'abc123' } });
    expect(screen.getByText('#PO-2')).toBeInTheDocument();
    expect(screen.queryByText('#PO-1')).not.toBeInTheDocument();
  });

  it('Given POs / When the search matches nothing / Then the no-match empty state shows', async () => {
    render(<POListPage />);
    await screen.findByText('#PO-1');
    fireEvent.change(screen.getByTestId('po-search'), { target: { value: 'zzz-none' } });
    expect(await screen.findByText('No purchase orders match your search.')).toBeInTheDocument();
  });

  it('Given a search / When it is cleared / Then all POs show again', async () => {
    render(<POListPage />);
    await screen.findByText('#PO-1');
    fireEvent.change(screen.getByTestId('po-search'), { target: { value: 'po-2' } });
    fireEvent.change(screen.getByTestId('po-search'), { target: { value: '' } });
    expect(screen.getByText('#PO-1')).toBeInTheDocument();
    expect(screen.getByText('#PO-2')).toBeInTheDocument();
  });
});
