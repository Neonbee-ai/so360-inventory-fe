import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const getOutcomes = vi.fn();
const getIntegrationExceptions = vi.fn();
const resolveIntegrationException = vi.fn();
const getVendors = vi.fn();

vi.mock('../../../services/vendorService', () => ({
  vendorService: {
    getOutcomes: (...a: any[]) => getOutcomes(...a),
    getIntegrationExceptions: (...a: any[]) => getIntegrationExceptions(...a),
    resolveIntegrationException: (...a: any[]) => resolveIntegrationException(...a),
    getVendors: (...a: any[]) => getVendors(...a),
  },
}));

import VendorOutcomesPanel from './VendorOutcomesPanel';
import VendorIntegrationExceptionsPage from './VendorIntegrationExceptionsPage';

beforeEach(() => {
  vi.clearAllMocks();
  getVendors.mockResolvedValue([{ id: 'v2', name: 'Vendor B' }]);
});

describe('VendorOutcomesPanel', () => {
  it('Given a receipt and a vendor return / When loaded / Then both rows and the on-time rate show', async () => {
    getOutcomes.mockResolvedValue({
      data: [
        { id: 'f1', source_type: 'grn_line', actual_at: '2026-11-19T00:00:00Z', received_qty: 40, accepted_qty: 40, rejected_qty: 0, quarantined_qty: 0, returned_qty: null, on_time: true, attributable_to: 'vendor' },
        { id: 'f2', source_type: 'supplier_return_line', actual_at: '2026-11-20T00:00:00Z', received_qty: null, accepted_qty: null, rejected_qty: null, quarantined_qty: null, returned_qty: 2, on_time: null, attributable_to: 'internal' },
      ],
      summary: { receipts: 1, on_time_rate: 1, fill_rate: 0.4, reject_rate: 0 },
    });
    render(<VendorOutcomesPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('Receipt')).toBeTruthy());
    expect(screen.getByText('Supplier return')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('Given no facts / When loaded / Then the empty state shows', async () => {
    getOutcomes.mockResolvedValue({ data: [], summary: null });
    render(<VendorOutcomesPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('No receipts or returns yet')).toBeTruthy());
  });

  it('Given the API fails / When loaded / Then an error is shown', async () => {
    getOutcomes.mockRejectedValue(new Error('boom'));
    render(<VendorOutcomesPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('Could not load receipts and returns.')).toBeTruthy());
  });
});

describe('VendorIntegrationExceptionsPage', () => {
  const row = { id: 'e1', vendor_id: null, source_module: 'inventory', source_type: 'grn', source_id: 'g1', exception_code: 'missing_vendor', status: 'open', detail: {}, created_at: '2026-11-20T00:00:00Z', resolution_note: null };

  it('Given an open exception / When the page loads / Then the plain-language problem shows', async () => {
    getIntegrationExceptions.mockResolvedValue({ data: [row] });
    render(<VendorIntegrationExceptionsPage />);
    await waitFor(() => expect(screen.getByText('Receipt has no vendor')).toBeTruthy());
  });

  it('Given an open exception / When Resolve is chosen with a vendor / Then the API gets the vendor and the list reloads', async () => {
    getIntegrationExceptions.mockResolvedValue({ data: [row] });
    resolveIntegrationException.mockResolvedValue({});
    render(<VendorIntegrationExceptionsPage />);
    await waitFor(() => screen.getByText('Receipt has no vendor'));
    fireEvent.click(screen.getByText('Resolve'));
    const buttons = await waitFor(() => { const b = screen.getAllByText('Resolve'); if (b.length < 2) throw new Error('drawer'); return b; });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(resolveIntegrationException).toHaveBeenCalledWith('e1', expect.objectContaining({ status: 'resolved' })));
    expect(getIntegrationExceptions.mock.calls.length).toBeGreaterThan(1);
  });

  it('Given a failure on resolve / When submitted / Then the error shows in the drawer', async () => {
    getIntegrationExceptions.mockResolvedValue({ data: [row] });
    resolveIntegrationException.mockRejectedValue(new Error('Exception is already closed'));
    render(<VendorIntegrationExceptionsPage />);
    await waitFor(() => screen.getByText('Receipt has no vendor'));
    fireEvent.click(screen.getByText('Resolve'));
    const buttons = await waitFor(() => { const b = screen.getAllByText('Resolve'); if (b.length < 2) throw new Error('drawer'); return b; });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(screen.getByText('Exception is already closed')).toBeTruthy());
  });

  it('Given a user without resolve rights / When rendered / Then there is no Resolve button', async () => {
    getIntegrationExceptions.mockResolvedValue({ data: [row] });
    render(<VendorIntegrationExceptionsPage canResolve={false} />);
    await waitFor(() => screen.getByText('Receipt has no vendor'));
    expect(screen.queryByText('Resolve')).toBeNull();
  });
});
