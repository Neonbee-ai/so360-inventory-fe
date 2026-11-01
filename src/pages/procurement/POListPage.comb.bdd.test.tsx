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

describe('POListPage (Comb)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.flagState = 'enabled';
    h.can.mockReturnValue(true);
    h.getPOs.mockResolvedValue([po()]);
    h.getPRs.mockResolvedValue([]);
    h.getVendors.mockResolvedValue([{ id: 'v1', name: 'Acme' }]);
  });

  it('Given POs / When loaded / Then the title, row, and New PO primary action show', async () => {
    render(<POListPage />);
    expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
    expect(await screen.findByText('#PO-1')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('New PO')).toBeInTheDocument();
  });

  it('Given a pending request / When rendering / Then a skeleton shows', () => {
    h.getPOs.mockReturnValue(new Promise(() => {}));
    render(<POListPage />);
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('Given no POs / When loaded / Then the empty state shows', async () => {
    h.getPOs.mockResolvedValue([]);
    render(<POListPage />);
    expect(await screen.findByText('No purchase orders found.')).toBeInTheDocument();
  });

  it('Given a row / When clicked / Then it navigates to the PO detail', async () => {
    render(<POListPage />);
    fireEvent.click(await screen.findByText('#PO-1'));
    expect(h.navigate).toHaveBeenCalledWith('/procurement/po/po-1');
  });

  it('Given a transient failure / When Retry is clicked / Then POs are refetched', async () => {
    h.getPOs.mockRejectedValueOnce(new Error('boom'));
    render(<POListPage />);
    fireEvent.click(await screen.findByText('Retry'));
    await waitFor(() => expect(h.getPOs).toHaveBeenCalledTimes(2));
  });

  it('Given New PO clicked / When the modal opens / Then Vendor select and footer submit are present', async () => {
    render(<POListPage />);
    await screen.findByText('#PO-1');
    fireEvent.click(screen.getByText('New PO'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Vendor')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create Purchase Order' })).toHaveAttribute('form', 'po-form');
  });

  it('Given the feature is hidden / When rendered / Then New PO is not offered', async () => {
    h.flagState = 'hidden';
    render(<POListPage />);
    await screen.findByText('#PO-1');
    expect(screen.queryByText('New PO')).toBeNull();
  });
});
