import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/** BDD: the vendor-profile invoice carries its GST choice to the Accounting bill (Pulse a4e95994). */
const mockCreate = vi.fn();
const mockGetTaxCodes = vi.fn();

vi.mock('../../services/procurementService', () => ({
    procurementService: { createVendorInvoice: (...a: any[]) => mockCreate(...a) },
}));
vi.mock('../../services/mediaService', () => ({ mediaService: { uploadDocument: vi.fn() } }));
vi.mock('../../services/inventoryService', () => ({
    inventoryService: { getOrgId: () => 'org-1', getTaxCodes: () => mockGetTaxCodes() },
}));

import { CreateInvoiceModal } from './CreateInvoiceModal';

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;
const fill = () => {
    fireEvent.change(field('invoice_number'), { target: { value: 'INV-9' } });
    fireEvent.change(field('total_amount'), { target: { value: '1180' } });
};

beforeEach(() => {
    vi.clearAllMocks();
    mockGetTaxCodes.mockResolvedValue([{ id: 'gst18', name: 'GST 18', rate: 18 }]);
    mockCreate.mockResolvedValue({ invoice: { id: 'vi1' }, accounting: { sync_status: 'synced', bill_id: 'b1' } });
});

describe('Given the Create Vendor Invoice modal', () => {
    it('When a GST code is chosen / Then its id and rate are sent and onSuccess gets the response', async () => {
        const onSuccess = vi.fn();
        render(<CreateInvoiceModal isOpen onClose={vi.fn()} vendorId="v1" vendorPOs={[]} onSuccess={onSuccess} />);
        await screen.findByRole('option', { name: 'GST 18 (18%)' });
        fill();
        fireEvent.change(field('tax_code_id'), { target: { value: 'gst18' } });
        fireEvent.click(screen.getByText('Create Invoice'));
        await waitFor(() => expect(mockCreate).toHaveBeenCalled());
        expect(mockCreate.mock.calls[0][0]).toMatchObject({ vendor_id: 'v1', total_amount: 1180, tax_code_id: 'gst18', tax_rate: 18 });
        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ accounting: expect.objectContaining({ bill_id: 'b1' }) })));
    });

    it('When "No GST" is chosen / Then no_tax is sent without a tax code', async () => {
        render(<CreateInvoiceModal isOpen onClose={vi.fn()} vendorId="v1" vendorPOs={[]} onSuccess={vi.fn()} />);
        fill();
        fireEvent.change(field('tax_code_id'), { target: { value: 'none' } });
        fireEvent.click(screen.getByText('Create Invoice'));
        await waitFor(() => expect(mockCreate).toHaveBeenCalled());
        expect(mockCreate.mock.calls[0][0]).toMatchObject({ no_tax: true });
        expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('tax_code_id');
    });

    it('When tax codes cannot load / Then the invoice still saves with GST not stated', async () => {
        mockGetTaxCodes.mockRejectedValue(new Error('core down'));
        render(<CreateInvoiceModal isOpen onClose={vi.fn()} vendorId="v1" vendorPOs={[]} onSuccess={vi.fn()} />);
        fill();
        fireEvent.click(screen.getByText('Create Invoice'));
        await waitFor(() => expect(mockCreate).toHaveBeenCalled());
        const body = mockCreate.mock.calls[0][0];
        expect(body).not.toHaveProperty('tax_code_id');
        expect(body).not.toHaveProperty('no_tax');
    });
});
