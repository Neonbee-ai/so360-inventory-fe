import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const getPayeeChange = vi.fn();
const getFinanceSummary = vi.fn();
const verifyPayeeChange = vi.fn();
const decidePayeeChange = vi.fn();
let currentUser = { id: 'user-req' };

vi.mock('../../../services/vendorService', () => ({
  vendorService: {
    getPayeeChange: (...a: any[]) => getPayeeChange(...a),
    getFinanceSummary: (...a: any[]) => getFinanceSummary(...a),
    verifyPayeeChange: (...a: any[]) => verifyPayeeChange(...a),
    decidePayeeChange: (...a: any[]) => decidePayeeChange(...a),
    setupFinanceAccount: vi.fn(),
  },
}));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ hasPermission: () => true }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: currentUser, can: () => true }) }));

import PayeeChangeDetailPage from './PayeeChangeDetailPage';
import VendorFinancePanel from './VendorFinancePanel';
import { buildPayeeRequest, diffRows, reviewState, validateReason } from '../../../utils/payeeChange';

beforeEach(() => { vi.clearAllMocks(); currentUser = { id: 'user-req' }; });

const request = (over: any = {}) => ({
  id: 'r1', vendor_id: 'v1', kind: 'bank_change', status: 'submitted', reason: 'Vendor moved banks', requested_by: 'user-req',
  source: 'internal', created_at: '2026-11-24T10:00:00Z', verified: false, verification: null,
  current_masked: { account_number_masked: '••••9012', bank_name: 'HDFC' },
  proposed_masked: { account_number_masked: '••••7777', bank_name: 'HDFC' },
  ...over,
});
const renderDetail = () => render(
  <MemoryRouter initialEntries={['/vendors/finance-approvals/r1']}>
    <Routes><Route path="/vendors/finance-approvals/:id" element={<PayeeChangeDetailPage />} /></Routes>
  </MemoryRouter>,
);

describe('reviewState', () => {
  it('Given the requester, When reviewing, Then neither verify nor decide is allowed and the reason says why', () => {
    const s = reviewState(request() as any, 'user-req');
    expect(s.canVerify).toBe(false);
    expect(s.canDecide).toBe(false);
    expect(s.blockedReason).toContain('another person');
  });
  it('Given an unverified bank change and a Finance user, Then they may verify but not yet approve', () => {
    const s = reviewState(request() as any, 'fin-1');
    expect(s).toMatchObject({ canVerify: true, canDecide: false });
  });
  it('Given the verifier, Then they cannot approve; a different user can', () => {
    const r = request({ verified: true, verification: { verified_by: 'fin-1' } }) as any;
    expect(reviewState(r, 'fin-1').canDecide).toBe(false);
    expect(reviewState(r, 'fin-2').canDecide).toBe(true);
  });
  it('Given a payment-terms request, Then no verification is required to approve', () => {
    expect(reviewState(request({ kind: 'payment_terms' }) as any, 'fin-2').canDecide).toBe(true);
  });
});

describe('helpers', () => {
  it('Given the scenario, When it runs, Then diffRows shows only the masked values the API sent', () => {
    const rows = diffRows({ account_number_masked: '••••9012' }, { account_number_masked: '••••7777', confirm_account_number: '1234' });
    expect(rows).toEqual([{ key: 'account_number_masked', label: 'Account number', before: '••••9012', after: '••••7777' }]);
  });
  it('Given the scenario, When it runs, Then buildPayeeRequest trims the reason and drops an empty date', () => {
    expect(buildPayeeRequest('bank_add', null, { bank_name: 'X' }, '  new bank ', '')).toMatchObject({ kind: 'bank_add', reason: 'new bank', effective_date: undefined });
  });
  it('Given the scenario, When it runs, Then validateReason needs at least three characters', () => {
    expect(validateReason(' a ')).not.toBeNull();
    expect(validateReason('abc')).toBeNull();
  });
});

describe('PayeeChangeDetailPage', () => {
  it('Given the requester opens their own request, Then approve and reject are disabled and the reason shows', async () => {
    getPayeeChange.mockResolvedValue(request());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('payee-blocked')).toBeTruthy());
    expect((screen.getByTestId('payee-approve') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('payee-verify') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Given the masked change, Then the page shows before and after and never a full number', async () => {
    getPayeeChange.mockResolvedValue(request());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('payee-diff-table')).toBeTruthy());
    expect(screen.getByText('••••9012')).toBeTruthy();
    expect(screen.getByText('••••7777')).toBeTruthy();
  });

  it('Given a verified request and a different Finance user, Then approve is enabled', async () => {
    currentUser = { id: 'fin-2' };
    getPayeeChange.mockResolvedValue(request({ verified: true, verification: { method: 'callback', verified_by: 'fin-1', note: 'called', at: '2026-11-24T11:00:00Z' } }));
    renderDetail();
    await waitFor(() => expect((screen.getByTestId('payee-approve') as HTMLButtonElement).disabled).toBe(false));
  });

  it('Given a rejected request, Then the vendor sees Rejected with the note', async () => {
    getPayeeChange.mockResolvedValue(request({ status: 'rejected', decision_note: 'Letter does not match' }));
    renderDetail();
    await waitFor(() => expect(screen.getByText(/Letter does not match/)).toBeTruthy());
    expect(screen.getByText('Rejected')).toBeTruthy();
  });
});

describe('VendorFinancePanel', () => {
  const base = { finance_account_ref: 'SUP-AB12', setup_state: 'active', sync_status: 'ok', payment_terms: 'Net 30', currency: 'INR', tax_registration_masked: { gst_number: '••••••1Z5' }, open_bills_count: 2, overdue_bills_count: 1, activity: [] };

  it('Given a caller without bill access, Then counts show and amounts are hidden', async () => {
    getFinanceSummary.mockResolvedValue({ ...base, amounts_visible: false });
    render(<MemoryRouter><VendorFinancePanel vendorId="v1" canSetup={false} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('finance-amounts-hidden')).toBeTruthy());
    expect(screen.queryByTestId('finance-open-amount')).toBeNull();
    expect(screen.getByText('SUP-AB12')).toBeTruthy();
  });

  it('Given bill access, Then amounts and linked bills show', async () => {
    getFinanceSummary.mockResolvedValue({ ...base, amounts_visible: true, open_amount: 1500, overdue_amount: 500, bills: [{ bill_id: 'b1', number: 'BILL-9', status: 'approved', amount: 1500, due_date: '2026-12-01', currency: 'INR' }] });
    render(<MemoryRouter><VendorFinancePanel vendorId="v1" canSetup={false} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('finance-open-amount')).toBeTruthy());
    expect(screen.getByText('BILL-9')).toBeTruthy();
  });

  it('Given the sync failed, Then a visible failure notice shows', async () => {
    getFinanceSummary.mockResolvedValue({ ...base, sync_status: 'failed', sync_error: 'Accounting answered HTTP 503', amounts_visible: false });
    render(<MemoryRouter><VendorFinancePanel vendorId="v1" canSetup={true} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('finance-sync-failed')).toBeTruthy());
  });
});
