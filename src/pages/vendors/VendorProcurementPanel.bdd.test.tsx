import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const procurementActivity = vi.fn();
vi.mock('../../services/vendorCollabService', () => ({ vendorCollabService: { procurementActivity: (...a: any[]) => procurementActivity(...a) } }));

import VendorProcurementPanel, { detailText } from './VendorProcurementPanel';

beforeEach(() => vi.clearAllMocks());

describe('VendorProcurementPanel (Pulse 84fdc5b8)', () => {
  it('Given a PO and an RFQ invitation, When loaded, Then both rows show with their numbers', async () => {
    procurementActivity.mockResolvedValue({ items: [
      { kind: 'purchase_order', id: 'p1', number: 'PO-7', status: 'sent', at: '2026-11-02', path: '/procurement/po/p1', detail: { acknowledgement_status: 'pending' } },
      { kind: 'rfq_invitation', id: 'r1', number: 'RFQ-3', status: 'quoted', at: '2026-10-20', path: '/procurement/rfq/r1', detail: { response_hours: 5 } },
    ] });
    render(<VendorProcurementPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('PO-7')).toBeTruthy());
    expect(screen.getByText('RFQ-3')).toBeTruthy();
    expect(screen.getByText('Responded in 5 h')).toBeTruthy();
  });
  it('Given nothing, Then the empty state shows', async () => {
    procurementActivity.mockResolvedValue({ items: [] });
    render(<VendorProcurementPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('No RFQs or purchase orders for this vendor yet.')).toBeTruthy());
  });
  it('Given the API fails, Then an error shows', async () => {
    procurementActivity.mockRejectedValue(new Error('x'));
    render(<VendorProcurementPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('Could not load the RFQ and PO references.')).toBeTruthy());
  });
  it('detailText: an uninvited response and a promised date', () => {
    expect(detailText({ kind: 'rfq_invitation', detail: {} } as any)).toBe('No response yet');
    expect(detailText({ kind: 'purchase_order', detail: { promised_delivery_date: '2026-12-01' } } as any)).toBe('Promised 2026-12-01');
  });
});
