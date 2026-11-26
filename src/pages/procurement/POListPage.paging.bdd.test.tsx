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

const po = (i: number) => ({
  id: `po-${i}`, po_number: `PO-${i}`, status: 'sent', total_amount: '10', created_at: '2026-01-01',
  vendor: { name: 'Acme' }, po_lines: [],
});

describe('POListPage paging (Pulse 2662a34a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.flagState = 'enabled';
    h.can.mockReturnValue(true);
    h.getPRs.mockResolvedValue([]);
    h.getVendors.mockResolvedValue([]);
  });

  it('Given a paging BE / When the page loads / Then it requests page 1 of 50 and shows the BE rows', async () => {
    h.getPOs.mockResolvedValue({ data: [po(1), po(2)], total: 120 });
    render(<POListPage />);
    await screen.findByText('#PO-2');
    expect(h.getPOs).toHaveBeenCalledWith({ limit: 50, offset: 0, search: '' });
  });

  it('Given an old BE returning a bare array of 60 POs / When the page loads / Then only the first 50 rows render', async () => {
    h.getPOs.mockResolvedValue(Array.from({ length: 60 }, (_, i) => po(i + 1)));
    render(<POListPage />);
    await screen.findByText('#PO-1');
    expect(screen.getByText('#PO-50')).toBeInTheDocument();
    expect(screen.queryByText('#PO-51')).not.toBeInTheDocument();
  });
});
