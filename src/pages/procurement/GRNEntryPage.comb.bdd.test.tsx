import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetPOs = vi.fn();
const mockGetLocations = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: { getPOs: (...a: any[]) => mockGetPOs(...a), createGRN: vi.fn() },
}));
vi.mock('../../services/inventoryService', () => ({
  inventoryService: { getLocations: (...a: any[]) => mockGetLocations(...a) },
}));

import GRNEntryPage from './GRNEntryPage';

const po = {
  id: 'po-1', po_number: '2024-001', status: 'sent', vendor: { name: 'Acme Supplies' },
  po_lines: [{ id: 'l1', item_id: 'i1', quantity: 10, received_quantity: 0, description: 'Widget A' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPOs.mockResolvedValue([po]);
  mockGetLocations.mockResolvedValue([{ id: 'wh-1', name: 'Main Warehouse' }]);
});

describe('GRNEntryPage (Comb)', () => {
  it('Given the page / When rendered / Then it is a form template titled Goods Receipt Entry', async () => {
    const { container } = render(<GRNEntryPage />);
    expect(screen.getByRole('heading', { name: 'Goods Receipt Entry' })).toBeInTheDocument();
    expect(container.querySelector('[data-template="form"]')).toBeInTheDocument();
  });

  it('Given pending data / When loading / Then the PO table shows its loading state', () => {
    mockGetPOs.mockReturnValue(new Promise(() => {}));
    mockGetLocations.mockReturnValue(new Promise(() => {}));
    render(<GRNEntryPage />);
    expect(screen.getByTestId('datatable-loading')).toBeInTheDocument();
  });

  it('Given no open POs / When loaded / Then the empty state is shown', async () => {
    mockGetPOs.mockResolvedValue([{ ...po, status: 'received' }]);
    render(<GRNEntryPage />);
    await waitFor(() => expect(screen.getByText('No open purchase orders')).toBeInTheDocument());
  });

  it('Given an open PO / When it is clicked / Then the receipt form and Post action appear', async () => {
    render(<GRNEntryPage />);
    await waitFor(() => screen.getByText('#PO-2024-001'));
    fireEvent.click(screen.getByText('#PO-2024-001'));
    await waitFor(() => expect(screen.getByText('Post Goods Receipt')).toBeInTheDocument());
    expect(screen.getByLabelText('Receiving Warehouse')).toBeInTheDocument();
  });

  it('Given no PO selected / When rendered / Then the Post action is gated out', async () => {
    render(<GRNEntryPage />);
    await waitFor(() => screen.getByText('#PO-2024-001'));
    expect(screen.queryByText('Post Goods Receipt')).not.toBeInTheDocument();
  });

  it('Given a selected PO / When Cancel is clicked / Then the selection is cleared', async () => {
    render(<GRNEntryPage />);
    await waitFor(() => screen.getByText('#PO-2024-001'));
    fireEvent.click(screen.getByText('#PO-2024-001'));
    await waitFor(() => screen.getByText('Post Goods Receipt'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Post Goods Receipt')).not.toBeInTheDocument();
  });
});
