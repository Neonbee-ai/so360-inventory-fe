import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetVendors = vi.fn();
const mockGetLocations = vi.fn();
const mockGetUnlinked = vi.fn();
const mockCreate = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/vendorService', () => ({ vendorService: { getVendors: (...a: any[]) => mockGetVendors(...a) } }));
vi.mock('../../services/inventoryService', () => ({ inventoryService: { getLocations: (...a: any[]) => mockGetLocations(...a) } }));
vi.mock('../../services/procurementService', () => ({
  procurementService: {
    createOpeningBalance: (...a: any[]) => mockCreate(...a),
    getUnlinkedMovements: (...a: any[]) => mockGetUnlinked(...a),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../components/ItemSearchSelector', () => ({ default: () => <span data-testid="item-selector" /> }));

import OpeningBalancePage from './OpeningBalancePage';

const unlinked = [{ item_id: 'i1', item_name: 'Widget A', item_sku: 'W-1', warehouse_id: 'wh-1', warehouse_name: 'Main', total_qty: 5, avg_cost: 2 }];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetVendors.mockResolvedValue([{ id: 'v1', name: 'Acme Supplies' }]);
  mockGetLocations.mockResolvedValue([{ id: 'wh-1', name: 'Main' }]);
  mockGetUnlinked.mockResolvedValue(unlinked);
  mockCreate.mockResolvedValue({ po: { id: 'po-1', po_number: 'OB-1', status: 'received' }, grn: { id: 'g1', grn_number: 'G-1' }, movements_linked: 1 });
});

describe('OpeningBalancePage (Comb)', () => {
  it('Given loaded data / When rendered / Then title and primary action show in a form template', async () => {
    const { container } = render(<OpeningBalancePage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Opening Balance' })).toBeInTheDocument());
    expect(screen.getByText('Create Opening Balance')).toBeInTheDocument();
    expect(container.querySelector('[data-template="form"]')).toBeInTheDocument();
  });

  it('Given pending vendor data / When loading / Then a status spinner shows', () => {
    mockGetVendors.mockReturnValue(new Promise(() => {}));
    render(<OpeningBalancePage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('Given no lines / When rendered / Then the empty state invites loading unlinked stock', async () => {
    render(<OpeningBalancePage />);
    await waitFor(() => expect(screen.getByText('No item lines yet')).toBeInTheDocument());
  });

  it('Given unlinked stock / When Load Unlinked Stock is clicked / Then lines are filled', async () => {
    render(<OpeningBalancePage />);
    await waitFor(() => screen.getByText('No item lines yet'));
    fireEvent.click(screen.getByRole('button', { name: /Load Unlinked Stock/ }));
    await waitFor(() => expect(screen.getByText('Widget A (W-1)')).toBeInTheDocument());
  });

  it('Given no complete lines / When rendered / Then submit is gated off, and on after loading stock', async () => {
    render(<OpeningBalancePage />);
    await waitFor(() => screen.getByText('No item lines yet'));
    expect(screen.getByText('Create Opening Balance').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Load Unlinked Stock/ }));
    await waitFor(() => screen.getByText('Widget A (W-1)'));
    expect(screen.getByText('Create Opening Balance').closest('button')).not.toBeDisabled();
  });
});
