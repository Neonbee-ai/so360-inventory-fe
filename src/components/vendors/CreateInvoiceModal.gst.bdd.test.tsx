/** Pulse c55520ce: taxable amount + separate CGST/SGST/IGST on the vendor invoice form. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockCreateVendorInvoice = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: { createVendorInvoice: (...a: any[]) => mockCreateVendorInvoice(...a) },
}));
vi.mock('../../services/mediaService', () => ({ mediaService: { uploadDocument: vi.fn() } }));
vi.mock('../../services/inventoryService', () => ({ inventoryService: { getOrgId: () => 'org-1' } }));

import { CreateInvoiceModal } from './CreateInvoiceModal';

const props = () => ({ isOpen: true, onClose: vi.fn(), vendorId: 'vendor-1', vendorPOs: [], onSuccess: vi.fn() });
const field = (container: HTMLElement, name: string) => container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
const pickGst = (container: HTMLElement, value: string) =>
  fireEvent.change(container.querySelector('select[name="gst_type"]')!, { target: { value } });
const submit = (container: HTMLElement) => fireEvent.submit(container.querySelector('#create-vendor-invoice-form')!);

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateVendorInvoice.mockResolvedValue({ id: 'inv-1' });
});

describe('Vendor invoice GST breakdown', () => {
  it('Given intra-state GST / When taxable 1000 and rate 9 are entered / Then CGST and SGST amounts are 90 each and the total is 1180', () => {
    const { container } = render(<CreateInvoiceModal {...props()} />);
    fireEvent.change(field(container, 'taxable_amount'), { target: { value: '1000' } });
    pickGst(container, 'intra');
    fireEvent.change(field(container, 'cgst_rate'), { target: { value: '9' } });

    expect(field(container, 'cgst_amount').value).toBe('90');
    expect(field(container, 'sgst_rate').value).toBe('9');
    expect(field(container, 'sgst_amount').value).toBe('90');
    expect(field(container, 'total_amount').value).toBe('1180');
    expect(container.querySelector('input[name="igst_amount"]')).toBeNull();
  });

  it('Given inter-state GST / When submitted / Then only IGST and the taxable amount are sent with the derived total', async () => {
    const p = props();
    const { container } = render(<CreateInvoiceModal {...p} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. INV-2026-001'), { target: { value: 'INV-5' } });
    fireEvent.change(field(container, 'taxable_amount'), { target: { value: '1000' } });
    pickGst(container, 'inter');
    fireEvent.change(field(container, 'igst_rate'), { target: { value: '18' } });
    submit(container);

    await waitFor(() => expect(mockCreateVendorInvoice).toHaveBeenCalled());
    const sent = mockCreateVendorInvoice.mock.calls[0][0];
    expect(sent).toMatchObject({ taxable_amount: 1000, igst_amount: 180, igst_rate: 18, total_amount: 1180 });
    expect(sent).not.toHaveProperty('cgst_amount');
    expect(sent).not.toHaveProperty('sgst_amount');
  });

  it('Given No GST / When submitted / Then the total equals the taxable amount and no component is sent', async () => {
    const { container } = render(<CreateInvoiceModal {...props()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. INV-2026-001'), { target: { value: 'INV-6' } });
    fireEvent.change(field(container, 'taxable_amount'), { target: { value: '500' } });
    submit(container);

    await waitFor(() => expect(mockCreateVendorInvoice).toHaveBeenCalled());
    const sent = mockCreateVendorInvoice.mock.calls[0][0];
    expect(sent).toMatchObject({ taxable_amount: 500, total_amount: 500 });
    expect(sent).not.toHaveProperty('igst_amount');
  });

  it('Given CGST and SGST amounts that differ / When submitted / Then an error is shown and nothing is sent', async () => {
    const { container } = render(<CreateInvoiceModal {...props()} />);
    fireEvent.change(field(container, 'taxable_amount'), { target: { value: '1000' } });
    pickGst(container, 'intra');
    fireEvent.change(field(container, 'cgst_amount'), { target: { value: '90' } });
    fireEvent.change(field(container, 'sgst_amount'), { target: { value: '80' } });
    submit(container);

    expect(await screen.findByText('CGST and SGST amounts must be equal')).toBeInTheDocument();
    expect(mockCreateVendorInvoice).not.toHaveBeenCalled();
  });

  it('Given a GST type with no tax amount / When submitted / Then the user is told to enter the GST or choose No GST', async () => {
    const { container } = render(<CreateInvoiceModal {...props()} />);
    fireEvent.change(field(container, 'taxable_amount'), { target: { value: '1000' } });
    pickGst(container, 'inter');
    submit(container);

    expect(await screen.findByText(/choose No GST/)).toBeInTheDocument();
    expect(mockCreateVendorInvoice).not.toHaveBeenCalled();
  });

  it('Given a rate was entered / When the taxable amount changes / Then the component amounts follow it', () => {
    const { container } = render(<CreateInvoiceModal {...props()} />);
    pickGst(container, 'inter');
    fireEvent.change(field(container, 'taxable_amount'), { target: { value: '200' } });
    fireEvent.change(field(container, 'igst_rate'), { target: { value: '18' } });
    fireEvent.change(field(container, 'taxable_amount'), { target: { value: '300' } });

    expect(field(container, 'igst_amount').value).toBe('54');
    expect(field(container, 'total_amount').value).toBe('354');
  });
});
