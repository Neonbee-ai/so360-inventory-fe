import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetRFQ = vi.fn();
const mockSend = vi.fn();
const mockGetEligible = vi.fn();
vi.mock('../../services/rfqService', () => ({
  rfqService: { getRFQ: (...a: any[]) => mockGetRFQ(...a), sendRFQ: (...a: any[]) => mockSend(...a), getEligibleVendors: (...a: any[]) => mockGetEligible(...a), getClarifications: vi.fn().mockResolvedValue([]), cancelRFQ: vi.fn(), recordQuotation: vi.fn() },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ id: 'rfq-1' }) }));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({ formatDate: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}` }),
}));

import RFQDetailPage from './RFQDetailPage';

const rfq = {
  id: 'rfq-1', rfq_number: 'RFQ-1', status: 'sent', rfq_lines: [],
  rfq_vendors: [{ id: 'rv1', vendor_id: 'v1', vendor_name: 'Acme', status: 'invited' }],
  vendor_quotations: [],
};
// Shape returned by GET /rfq/:id/eligible-vendors (shared eligibility service; blocked vendors are never returned).
const eligible = (vendor_id: string, name: string, decision = 'eligible') => ({ vendor_id, name, vendor_code: name.slice(0, 3).toUpperCase(), decision, explanation: 'ok', conditions: [] });
const vendors = [eligible('v1', 'Acme'), eligible('v2', 'Beta Trading'), eligible('v3', 'Gamma Co', 'conditional')];

const openSelector = async () => {
  render(<RFQDetailPage />);
  fireEvent.click(await screen.findByText('Send to New Vendors'));
  await screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRFQ.mockResolvedValue(rfq);
  mockGetEligible.mockResolvedValue({ items: vendors, next_cursor: null });
});

describe('Send to New Vendors (Pulse d282c347)', () => {
  it('Given a sent RFQ / When the button is clicked / Then the selector opens without sending anything', async () => {
    await openSelector();
    expect(await screen.findByText('Beta Trading')).toBeTruthy();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Given a vendor already invited / When listed / Then it is not selectable and conditional ones are marked', async () => {
    await openSelector();
    await screen.findByText('Beta Trading');
    expect(screen.queryByLabelText('Acme')).toBeNull();
    expect(await screen.findByText(/Conditional/)).toBeTruthy();
    expect(mockGetEligible).toHaveBeenCalledWith('rfq-1', expect.anything());
  });

  it('Given a search term / When typed / Then only matching vendors remain', async () => {
    await openSelector();
    await screen.findByText('Beta Trading');
    fireEvent.change(screen.getByPlaceholderText(/Search vendors/), { target: { value: 'gamma' } });
    expect(screen.queryByText('Beta Trading')).toBeNull();
    expect(screen.getByText('Gamma Co')).toBeTruthy();
  });

  it('Given two selected vendors / When reviewed and sent / Then sendRFQ receives exactly those vendor ids and the RFQ refreshes', async () => {
    mockSend.mockResolvedValue({ invitation_results: [{ vendor_id: 'v2', status: 'invited' }, { vendor_id: 'v3', status: 'invited' }] });
    await openSelector();
    fireEvent.click(await screen.findByLabelText('Beta Trading'));
    fireEvent.click(screen.getByLabelText('Gamma Co'));
    fireEvent.click(screen.getByText(/Review \(2\)/));
    fireEvent.click(await screen.findByText('Send to 2 vendors'));
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('rfq-1', { vendor_ids: ['v2', 'v3'] }));
    await waitFor(() => expect(mockGetRFQ).toHaveBeenCalledTimes(2));
  });

  it('Given the selector is cancelled / When closed / Then nothing is sent', async () => {
    await openSelector();
    await screen.findByText('Beta Trading');
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Given the vendor list fails to load / When opened / Then an error with Retry shows', async () => {
    mockGetEligible.mockRejectedValue(new Error('network down'));
    await openSelector();
    expect(await screen.findByText('network down')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('Given every vendor is already invited / When opened / Then an empty state explains it', async () => {
    mockGetEligible.mockResolvedValue({ items: [vendors[0]], next_cursor: null });
    await openSelector();
    expect(await screen.findByText(/No eligible vendors left/)).toBeTruthy();
  });
});
