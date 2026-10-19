import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetRFQ = vi.fn();
const mockSend = vi.fn();
const mockCancel = vi.fn();
const mockRecord = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/rfqService', () => ({
  rfqService: {
    getRFQ: (...a: any[]) => mockGetRFQ(...a),
    sendRFQ: (...a: any[]) => mockSend(...a),
    cancelRFQ: (...a: any[]) => mockCancel(...a),
    recordQuotation: (...a: any[]) => mockRecord(...a),
  },
}));
vi.mock('../../services/vendorService', () => ({ vendorService: { getVendors: vi.fn().mockResolvedValue([]) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => ({ id: 'rfq-1' }) }));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
  }),
}));

import RFQDetailPage from './RFQDetailPage';

const makeRFQ = (o: any = {}) => ({
  id: 'rfq-1', rfq_number: 'RFQ-0001', title: 'Cement', status: 'draft', response_due_date: '2025-02-01',
  rfq_lines: [{ id: 'l1', description: 'Cement bag', quantity: 10, uom: 'bag' }],
  rfq_vendors: [{ id: 'rv1', vendor_id: 'v1', vendor_name: 'Acme', status: 'invited' }],
  vendor_quotations: [],
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRFQ.mockResolvedValue(makeRFQ());
});

describe('RFQDetailPage (Comb)', () => {
  it('Given a draft RFQ, When it loads, Then the title and Send to Vendors primary action show', async () => {
    render(<RFQDetailPage />);
    expect(await screen.findByRole('heading', { name: 'RFQ-0001' })).toBeTruthy();
    expect(screen.getByText('Send to Vendors')).toBeTruthy();
    expect(screen.getByText('Cement bag')).toBeTruthy();
  });

  it('Given the RFQ is still loading, When rendered, Then the skeleton slot is shown', () => {
    mockGetRFQ.mockReturnValue(new Promise(() => {}));
    const { container } = render(<RFQDetailPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it('Given the RFQ fails to load, When rendered, Then an empty state with a back action shows', async () => {
    mockGetRFQ.mockRejectedValue(new Error('boom'));
    render(<RFQDetailPage />);
    expect(await screen.findByText('boom')).toBeTruthy();
    fireEvent.click(screen.getByText('Back to RFQs'));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/rfq');
  });

  it('Given a draft RFQ, When Send to Vendors is clicked, Then sendRFQ is called', async () => {
    mockSend.mockResolvedValue({});
    render(<RFQDetailPage />);
    fireEvent.click(await screen.findByText('Send to Vendors'));
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('rfq-1'));
  });

  it('Given an awarded RFQ, When it loads, Then send, record and cancel actions are hidden', async () => {
    mockGetRFQ.mockResolvedValue(makeRFQ({ status: 'awarded' }));
    render(<RFQDetailPage />);
    await screen.findByRole('heading', { name: 'RFQ-0001' });
    expect(screen.queryByText('Send to Vendors')).toBeNull();
    expect(screen.queryByText('Record Quotation')).toBeNull();
    expect(screen.queryByText('Cancel RFQ')).toBeNull();
  });

  it('Given an RFQ with quotations, When Compare & Award is clicked, Then it navigates to the comparison', async () => {
    mockGetRFQ.mockResolvedValue(makeRFQ({ status: 'sent', vendor_quotations: [{ id: 'q1', vendor_id: 'v1', vendor_name: 'Acme', total_amount: 100, status: 'submitted' }] }));
    render(<RFQDetailPage />);
    fireEvent.click(await screen.findByText(/Compare/));
    expect(mockNavigate).toHaveBeenCalledWith('/procurement/rfq/rfq-1/compare');
  });

  it('Given the quote form, When a price is entered and saved, Then recordQuotation is called', async () => {
    mockRecord.mockResolvedValue({});
    render(<RFQDetailPage />);
    fireEvent.click(await screen.findByText('Record Quotation'));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
    fireEvent.change(screen.getByLabelText('Unit price for Cement bag'), { target: { value: '5' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(mockRecord).toHaveBeenCalled());
    expect(mockRecord.mock.calls[0][1].vendor_id).toBe('v1');
  });
});
