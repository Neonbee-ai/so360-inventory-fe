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

const props = (o: any = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  vendorId: 'vendor-1',
  vendorPOs: [{ id: 'po-1', po_number: 'PO-1', status: 'sent', total_amount: 100 }],
  onSuccess: vi.fn(),
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateVendorInvoice.mockResolvedValue({ id: 'inv-1' });
});

describe('CreateInvoiceModal (Comb)', () => {
  it('Given the modal is open / When rendered / Then it is a titled dialog with Cancel and primary footer actions', () => {
    render(<CreateInvoiceModal {...props()} />);
    const dialog = screen.getByRole('dialog', { name: 'Create Vendor Invoice' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Invoice' })).toHaveAttribute('form', 'create-vendor-invoice-form');
  });

  it('Given the modal is closed / When rendered / Then no dialog is present', () => {
    render(<CreateInvoiceModal {...props({ isOpen: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Given Cancel / When clicked / Then onClose fires', () => {
    const p = props();
    render(<CreateInvoiceModal {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it('Given valid fields / When the form is submitted / Then the invoice is created and onSuccess fires', async () => {
    const p = props();
    const { container } = render(<CreateInvoiceModal {...p} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. INV-2026-001'), { target: { value: 'INV-9' } });
    fireEvent.change(container.querySelector('input[name="invoice_date"]')!, { target: { value: '2026-01-05' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250' } });
    fireEvent.submit(container.querySelector('#create-vendor-invoice-form')!);
    await waitFor(() => expect(mockCreateVendorInvoice).toHaveBeenCalled());
    expect(mockCreateVendorInvoice.mock.calls[0][0]).toMatchObject({ vendor_id: 'vendor-1', invoice_number: 'INV-9', total_amount: 250 });
    await waitFor(() => expect(p.onSuccess).toHaveBeenCalled());
  });

  it('Given the API rejects / When submitted / Then an error alert is shown', async () => {
    mockCreateVendorInvoice.mockRejectedValue(new Error('nope'));
    const { container } = render(<CreateInvoiceModal {...props()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. INV-2026-001'), { target: { value: 'INV-9' } });
    fireEvent.change(container.querySelector('input[name="invoice_date"]')!, { target: { value: '2026-01-05' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250' } });
    fireEvent.submit(container.querySelector('#create-vendor-invoice-form')!);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
