import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const listPoLinks = vi.fn();
const createPoLink = vi.fn();
const revokePoLink = vi.fn();
vi.mock('../../services/vendorCollabService', () => ({
  vendorCollabService: { listPoLinks: (...a: any[]) => listPoLinks(...a), createPoLink: (...a: any[]) => createPoLink(...a), revokePoLink: (...a: any[]) => revokePoLink(...a) },
}));

import POVendorLinkPanel, { linkState } from './POVendorLinkPanel';

beforeEach(() => { vi.clearAllMocks(); listPoLinks.mockResolvedValue([]); });

describe('POVendorLinkPanel (Pulse 84fdc5b8)', () => {
  it('Given an issued PO, When Create link is pressed, Then the one-time URL shows', async () => {
    createPoLink.mockResolvedValue({ id: 'l1', url: 'https://x/vendor-po/tok', expires_at: '2027-01-01' });
    render(<POVendorLinkPanel poId="po1" status="sent" />);
    fireEvent.click(screen.getByText('Create link'));
    await waitFor(() => expect(screen.getByTestId('fresh-link')).toBeTruthy());
  });
  it('Given a draft PO, Then creating is disabled and the reason shows', async () => {
    render(<POVendorLinkPanel poId="po1" status="draft" />);
    expect(screen.getByText('Issue the PO before sharing it with the supplier.')).toBeTruthy();
    expect((screen.getByText('Create link').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
  it('Given the scenario, When it runs, Then linkState: revoked, expired and active', () => {
    expect(linkState({ revoked_at: 'x', expires_at: '2099-01-01' })).toBe('Revoked');
    expect(linkState({ revoked_at: null, expires_at: '2000-01-01' })).toBe('Expired');
    expect(linkState({ revoked_at: null, expires_at: '2099-01-01' })).toBe('Active');
  });
});
