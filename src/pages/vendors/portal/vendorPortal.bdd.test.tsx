import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const listPortalUsers = vi.fn();
const invite = vi.fn();
const revokeSessions = vi.fn();
const revokeAccess = vi.fn();
const listChangeRequests = vi.fn();
const getChangeRequest = vi.fn();
const decideChangeRequest = vi.fn();

vi.mock('../../../services/vendorPortalAdminService', () => ({
  vendorPortalAdminService: {
    listPortalUsers: (...a: any[]) => listPortalUsers(...a),
    invite: (...a: any[]) => invite(...a),
    updateRoles: vi.fn(),
    revokeSessions: (...a: any[]) => revokeSessions(...a),
    revokeAccess: (...a: any[]) => revokeAccess(...a),
    listChangeRequests: (...a: any[]) => listChangeRequests(...a),
    getChangeRequest: (...a: any[]) => getChangeRequest(...a),
    decideChangeRequest: (...a: any[]) => decideChangeRequest(...a),
  },
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'buyer-1' }, can: () => true }) }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ hasPermission: () => true }) }));

import VendorPortalPanel from './VendorPortalPanel';
import ProfileChangeRequestsPage from './ProfileChangeRequestsPage';
import ProfileChangeRequestDetailPage from './ProfileChangeRequestDetailPage';
import { changeDecisionState, changeDiffRows, isValidEmail } from '../../../utils/vendorPortal';

beforeEach(() => vi.clearAllMocks());
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const user = { access: { id: 'a1', portal_user_id: 'u1', roles: ['vendor_admin', 'rfq_responder'], status: 'active', next_access_review_at: '2027-05-01T00:00:00Z' }, user: { id: 'u1', email: 'ana@acme.com', full_name: 'Ana', status: 'active', last_login_at: null } };

describe('VendorPortalPanel', () => {
  it('Given no portal users / When loaded / Then the empty state invites the first contact', async () => {
    listPortalUsers.mockResolvedValue({ data: [] });
    wrap(<VendorPortalPanel vendorId="v1" canManage canInvite />);
    await waitFor(() => expect(screen.getByText('No portal users')).toBeTruthy());
    expect(screen.getByText('Invite contact')).toBeTruthy();
  });

  it('Given a portal user / When loaded / Then email, role labels and Never signed in show', async () => {
    listPortalUsers.mockResolvedValue({ data: [user] });
    wrap(<VendorPortalPanel vendorId="v1" canManage canInvite={false} />);
    await waitFor(() => expect(screen.getByText('ana@acme.com')).toBeTruthy());
    expect(screen.getByText('Vendor administrator, RFQ responder')).toBeTruthy();
    expect(screen.getByText('Never')).toBeTruthy();
    expect(screen.queryByText('Invite contact')).toBeNull();
  });

  it('Given no manage permission / When loaded / Then no row actions render', async () => {
    listPortalUsers.mockResolvedValue({ data: [user] });
    wrap(<VendorPortalPanel vendorId="v1" canManage={false} canInvite={false} />);
    await waitFor(() => expect(screen.getByText('ana@acme.com')).toBeTruthy());
    expect(screen.queryByText('End sessions')).toBeNull();
    expect(screen.queryByText('Remove access')).toBeNull();
  });

  it('Given the buyer ends sessions / When clicked / Then the API is called for that portal user', async () => {
    listPortalUsers.mockResolvedValue({ data: [user] });
    revokeSessions.mockResolvedValue({});
    wrap(<VendorPortalPanel vendorId="v1" canManage canInvite />);
    await waitFor(() => expect(screen.getByText('End sessions')).toBeTruthy());
    fireEvent.click(screen.getByText('End sessions'));
    await waitFor(() => expect(revokeSessions).toHaveBeenCalledWith('u1'));
  });

  it('Given the API fails / When loaded / Then an error shows', async () => {
    listPortalUsers.mockRejectedValue(new Error('x'));
    wrap(<VendorPortalPanel vendorId="v1" canManage canInvite />);
    await waitFor(() => expect(screen.getByText('Could not load portal users.')).toBeTruthy());
  });
});

describe('ProfileChangeRequestsPage', () => {
  it('Given a submitted address change / When loaded / Then the kind, fields and status label show', async () => {
    listChangeRequests.mockResolvedValue({ data: [{ id: 'r1', vendor_id: 'v1', kind: 'location', status: 'submitted', reason: 'moved', created_at: '2026-11-25T00:00:00Z', fields: { billing_address: {} } }] });
    wrap(<ProfileChangeRequestsPage />);
    await waitFor(() => expect(screen.getByText('Addresses')).toBeTruthy());
    expect(screen.getByText('billing address')).toBeTruthy();
    expect(screen.getByText('Awaiting review')).toBeTruthy();
  });

  it('Given none waiting / When loaded / Then the empty state shows', async () => {
    listChangeRequests.mockResolvedValue({ data: [] });
    wrap(<ProfileChangeRequestsPage />);
    await waitFor(() => expect(screen.getByText('Nothing waiting')).toBeTruthy());
  });
});

describe('ProfileChangeRequestDetailPage', () => {
  const req = (over: any = {}) => ({ id: 'r1', vendor_id: 'v1', kind: 'contact', status: 'submitted', requested_by: 'pu-1', requested_by_kind: 'portal_user', created_at: '2026-11-25T00:00:00Z', reason: 'new buyer', fields: { contacts: { old: [], new: [{ name: 'New' }] } }, ...over });
  const renderDetail = () => render(<MemoryRouter initialEntries={['/vendors/change-requests/r1']}><Routes><Route path="/vendors/change-requests/:id" element={<ProfileChangeRequestDetailPage />} /></Routes></MemoryRouter>);

  it('Given an open request by a supplier / When opened / Then the diff shows and Approve is enabled', async () => {
    getChangeRequest.mockResolvedValue(req());
    renderDetail();
    await waitFor(() => expect(screen.getByText('Approve and apply')).toBeTruthy());
    expect(screen.getByText('contacts')).toBeTruthy();
    expect((screen.getByText('Approve and apply') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Given the viewer raised the request / When opened / Then Approve is disabled with the reason', async () => {
    getChangeRequest.mockResolvedValue(req({ requested_by: 'buyer-1', requested_by_kind: 'user' }));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('change-blocked')).toBeTruthy());
    expect((screen.getByText('Approve and apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Given a capability request / When opened / Then it explains the qualification workflow decides it', async () => {
    getChangeRequest.mockResolvedValue(req({ kind: 'capability' }));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('change-blocked').textContent).toContain('qualification workflow'));
  });

  it('Given approve is clicked / When confirmed / Then the decision API is called', async () => {
    getChangeRequest.mockResolvedValue(req());
    decideChangeRequest.mockResolvedValue({});
    renderDetail();
    await waitFor(() => expect(screen.getByText('Approve and apply')).toBeTruthy());
    fireEvent.click(screen.getByText('Approve and apply'));
    await waitFor(() => expect(decideChangeRequest).toHaveBeenCalledWith('r1', 'approve', undefined));
  });
});

describe('vendorPortal helpers', () => {
  it('Given old/new fields / Then diff rows are readable', () => {
    expect(changeDiffRows({ billing_address: { old: null, new: { city: 'X' } } })).toEqual([{ field: 'billing address', before: '—', after: '{"city":"X"}' }]);
  });
  it('Given a request raised by the viewer or handled elsewhere / Then it cannot be decided here', () => {
    expect(changeDecisionState({ status: 'submitted', kind: 'contact', requested_by: 'me' }, 'me').canDecide).toBe(false);
    expect(changeDecisionState({ status: 'submitted', kind: 'capability', requested_by: 'p' }, 'me').canDecide).toBe(false);
    expect(changeDecisionState({ status: 'approved', kind: 'contact', requested_by: 'p' }, 'me').open).toBe(false);
    expect(changeDecisionState({ status: 'submitted', kind: 'contact', requested_by: 'p' }, 'me').canDecide).toBe(true);
  });
  it('Given emails / Then only valid ones pass', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
  });
});
