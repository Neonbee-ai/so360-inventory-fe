import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetRFQ = vi.fn();
const mockRecord = vi.fn();
vi.mock('../../services/rfqService', () => ({
  rfqService: {
    getRFQ: (...a: any[]) => mockGetRFQ(...a),
    sendRFQ: vi.fn(),
    cancelRFQ: vi.fn(),
    recordQuotation: (...a: any[]) => mockRecord(...a),
  },
}));
vi.mock('../../services/vendorService', () => ({ vendorService: { getVendors: vi.fn().mockResolvedValue([]) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ id: 'rfq-1' }) }));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}` }),
}));

import RFQDetailPage, { mapServerErrors } from './RFQDetailPage';

const rfq = (o: any = {}) => ({
  id: 'rfq-1', rfq_number: 'RFQ-2026-0002', title: 'Cement', status: 'sent', currency: 'INR',
  response_due_date: '2026-12-01', delivery_terms: 'DAP site', incoterms: 'DAP',
  rfq_lines: [
    { id: 'l1', item_id: 'i1', item: { name: 'Portland Cement', sku: 'CEM-1' }, description: 'Grade 53', quantity: 10, uom: 'bag', target_unit_price: 400 },
    { id: 'l2', item_id: 'i2', item: { name: 'Sand', sku: 'SND-1' }, quantity: 5, uom: 'ton' },
  ],
  rfq_vendors: [{ id: 'rv1', vendor_id: 'v1', vendor_name: 'Acme', status: 'invited' }],
  vendor_quotations: [],
  ...o,
});

const open = async () => {
  render(<RFQDetailPage />);
  fireEvent.click(await screen.findByText('Record quotation'));
  await screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRFQ.mockResolvedValue(rfq());
});

describe('Record Quotation modal (Pulse 749a4e7a)', () => {
  it('Given an RFQ with lines / When the modal opens / Then each line shows item identity, qty, UOM and target price', async () => {
    await open();
    expect(screen.getByText(/Portland Cement · CEM-1/)).toBeTruthy();
    expect(screen.getByText(/Requested 10 bag · Target \$400/)).toBeTruthy();
    expect(screen.getByText(/Sand · SND-1/)).toBeTruthy();
  });

  it('Given the RFQ carries delivery terms and incoterms / When the modal opens / Then they are pre-filled', async () => {
    await open();
    expect((screen.getByLabelText(/Delivery Terms/) as HTMLInputElement).value).toBe('DAP site');
    expect((screen.getByLabelText(/Incoterms/) as HTMLSelectElement).value).toBe('DAP');
  });

  it('Given payment terms are blank / When saving / Then an inline error shows and nothing is sent', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Vendor \(invited\)/), { target: { value: 'v1' } });
    fireEvent.change(screen.getByLabelText('Unit price for Portland Cement'), { target: { value: '5' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    expect(await screen.findByText(/Payment terms are required/)).toBeTruthy();
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('Given a complete form / When saved / Then delivery_terms and incoterms are sent as strings', async () => {
    mockRecord.mockResolvedValue({});
    await open();
    fireEvent.change(screen.getByLabelText(/Vendor \(invited\)/), { target: { value: 'v1' } });
    fireEvent.change(screen.getByLabelText(/Payment Terms/), { target: { value: 'Net 30 days' } });
    fireEvent.change(screen.getByLabelText('Unit price for Portland Cement'), { target: { value: '5' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(mockRecord).toHaveBeenCalledTimes(1));
    const body = mockRecord.mock.calls[0][1];
    expect(body.delivery_terms).toBe('DAP site');
    expect(body.incoterms).toBe('DAP');
    expect(body.currency).toBe('INR');
    expect(body.items[0].rfq_line_id).toBe('l1');
  });

  it('Given the server rejects a field / When saving fails / Then the modal stays open with the value kept and the error inline', async () => {
    mockRecord.mockRejectedValue(new Error('lead_time_days cannot exceed 365 days'));
    await open();
    fireEvent.change(screen.getByLabelText(/Vendor \(invited\)/), { target: { value: 'v1' } });
    fireEvent.change(screen.getByLabelText(/Payment Terms/), { target: { value: 'Net 30 days' } });
    fireEvent.change(screen.getByLabelText('Unit price for Portland Cement'), { target: { value: '5' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    expect(await screen.findByText(/lead_time_days cannot exceed 365 days/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText(/Payment Terms/) as HTMLInputElement).value).toBe('Net 30 days');
  });
});

describe('mapServerErrors', () => {
  it('Given the joined server message / When mapped / Then each message lands on its field', () => {
    const m = mapServerErrors('delivery_terms must be a string, delivery_terms is required to record a quotation, incoterms must be a string');
    expect(m.delivery_terms).toContain('required');
    expect(m.incoterms).toContain('string');
  });
});
