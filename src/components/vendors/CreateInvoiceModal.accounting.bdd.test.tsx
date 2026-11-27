import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/** BDD: the vendor-profile invoice carries its stated GST to the Accounting bill (Pulse a4e95994, c55520ce). */
const mockCreate = vi.fn();

vi.mock('../../services/procurementService', () => ({
    procurementService: { createVendorInvoice: (...a: any[]) => mockCreate(...a) },
}));
vi.mock('../../services/mediaService', () => ({ mediaService: { uploadDocument: vi.fn() } }));
vi.mock('../../services/inventoryService', () => ({
    inventoryService: { getOrgId: () => 'org-1' },
}));

import { CreateInvoiceModal } from './CreateInvoiceModal';

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;
const fill = () => {
    fireEvent.change(field('invoice_number'), { target: { value: 'INV-9' } });
    fireEvent.change(field('taxable_amount'), { target: { value: '1000' } });
};

beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ invoice: { id: 'vi1' }, accounting: { sync_status: 'synced', bill_id: 'b1' } });
});

describe('Given the Create Vendor Invoice modal', () => {
    it('When CGST + SGST are stated / Then the split and derived total are sent and onSuccess gets the response', async () => {
        const onSuccess = vi.fn();
        render(<CreateInvoiceModal isOpen onClose={vi.fn()} vendorId="v1" vendorPOs={[]} onSuccess={onSuccess} />);
        fill();
        fireEvent.change(field('gst_type'), { target: { value: 'intra' } });
        fireEvent.change(field('cgst_rate'), { target: { value: '9' } });
        fireEvent.click(screen.getByText('Create Invoice'));
        await waitFor(() => expect(mockCreate).toHaveBeenCalled());
        expect(mockCreate.mock.calls[0][0]).toMatchObject({
            vendor_id: 'v1', taxable_amount: 1000, cgst_amount: 90, sgst_amount: 90, total_amount: 1180,
        });
        expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('no_tax');
        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ accounting: expect.objectContaining({ bill_id: 'b1' }) })));
    });

    it('When "No GST" is chosen / Then no_tax is sent and the total equals the taxable amount', async () => {
        render(<CreateInvoiceModal isOpen onClose={vi.fn()} vendorId="v1" vendorPOs={[]} onSuccess={vi.fn()} />);
        fill();
        fireEvent.click(screen.getByText('Create Invoice'));
        await waitFor(() => expect(mockCreate).toHaveBeenCalled());
        expect(mockCreate.mock.calls[0][0]).toMatchObject({ no_tax: true, total_amount: 1000 });
    });
});
