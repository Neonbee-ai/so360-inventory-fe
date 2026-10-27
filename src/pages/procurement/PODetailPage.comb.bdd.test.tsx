import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetPODetail = vi.fn();
const mockUpdatePOStatus = vi.fn();
const mockAcknowledgePO = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPODetail: (...a: any[]) => mockGetPODetail(...a),
    updatePOStatus: (...a: any[]) => mockUpdatePOStatus(...a),
    acknowledgePO: (...a: any[]) => mockAcknowledgePO(...a),
    getDocumentTrace: () => Promise.resolve({ chain: [] }),
  },
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'po-1' }), useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}`,
  }),
}));

import PODetailPage from './PODetailPage';

const makePO = (o: any = {}) => ({
  id: 'po-1', po_number: 'PO-7', status: 'draft', total_amount: 100, created_at: '2025-01-01',
  vendor: { id: 'v1', name: 'Acme' },
  po_lines: [{ id: 'l1', item_id: 'i1', description: 'Bolt', quantity: 10, unit_price: 10, received_quantity: 0 }],
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPODetail.mockResolvedValue(makePO());
  mockUpdatePOStatus.mockResolvedValue({});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('PODetailPage (Comb)', () => {
  it('Given a draft PO / When loaded / Then title and the Send PO primary action show', async () => {
    render(<PODetailPage />);
    expect(await screen.findByRole('heading', { name: '#PO-7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send PO' })).toBeInTheDocument();
  });

  it('Given a slow fetch / When loading / Then a skeleton is shown', () => {
    mockGetPODetail.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PODetailPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('Given a failed fetch / When Back is clicked / Then it navigates to the PO list', async () => {
    mockGetPODetail.mockRejectedValue(new Error('boom'));
    render(<PODetailPage />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Purchase Orders' }));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/po');
  });

  it('Given the API answers 404 / When loaded / Then it settles on "PO not found" inside the page shell', async () => {
    mockGetPODetail.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    const { container } = render(<PODetailPage />);
    expect(await screen.findByText('PO not found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Purchase Order' })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument();
  });

  it('Given the API answers 400 for a malformed id / When loaded / Then it shows "PO not found"', async () => {
    mockGetPODetail.mockRejectedValue(Object.assign(new Error('Validation failed'), { status: 400 }));
    render(<PODetailPage />);
    expect(await screen.findByText('PO not found')).toBeInTheDocument();
  });

  it('Given a PO without lines / When loaded / Then the lines table has no rows', async () => {
    mockGetPODetail.mockResolvedValue(makePO({ po_lines: [] }));
    render(<PODetailPage />);
    await screen.findByRole('heading', { name: '#PO-7' });
    expect(screen.queryByText('Bolt')).not.toBeInTheDocument();
  });

  it('Given a draft PO / When Send PO is clicked / Then status is updated to sent', async () => {
    render(<PODetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send PO' }));
    await waitFor(() => expect(mockUpdatePOStatus).toHaveBeenCalledWith('po-1', { status: 'sent' }));
  });

  it('Given a sent PO with goods received / When loaded / Then Cancel PO is disabled and Record GRN navigates', async () => {
    mockGetPODetail.mockResolvedValue(makePO({
      status: 'sent',
      po_lines: [{ id: 'l1', item_id: 'i1', description: 'Bolt', quantity: 10, unit_price: 10, received_quantity: 4 }],
    }));
    render(<PODetailPage />);
    expect(await screen.findByRole('button', { name: 'Cancel PO' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Record GRN' }));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/grn');
  });

  it('Given a closed PO / When loaded / Then no status-change actions are offered', async () => {
    mockGetPODetail.mockResolvedValue(makePO({ status: 'closed' }));
    render(<PODetailPage />);
    await screen.findByRole('heading', { name: '#PO-7' });
    expect(screen.queryByRole('button', { name: 'Send PO' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel PO' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print PO' })).toBeInTheDocument();
  });
});
