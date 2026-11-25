import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const getQualityHistory = vi.fn();
const getOutcomes = vi.fn();
const listCorrectiveActions = vi.fn();
const getCorrectiveAction = vi.fn();

vi.mock('../../../services/vendorService', () => ({
  vendorService: {
    getQualityHistory: (...a: any[]) => getQualityHistory(...a),
    getOutcomes: (...a: any[]) => getOutcomes(...a),
    listCorrectiveActions: (...a: any[]) => listCorrectiveActions(...a),
    getCorrectiveAction: (...a: any[]) => getCorrectiveAction(...a),
  },
}));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ hasPermission: () => true }) }));

import VendorQualityPanel from './VendorQualityPanel';
import VendorCorrectiveActionsPanel from './VendorCorrectiveActionsPanel';
import CorrectiveActionDetailPage from './CorrectiveActionDetailPage';

beforeEach(() => vi.clearAllMocks());
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('VendorQualityPanel', () => {
  it('Given an inspection with a verified vendor defect and a VCA / When loaded / Then NCR, counted flag and VCA number show', async () => {
    getQualityHistory.mockResolvedValue({ data: [{ inspection_id: 'i1', inspection_number: 'QC-1', status: 'completed', result: 'partial', ncr_number: 'NCR-QC-1', ncr_status: 'open', link: '/procurement/quality/i1', lines: [{ attribution: 'vendor', verification_status: 'verified' }], corrective_action: { id: 'a1', vca_number: 'VCA-2026-0001', status: 'open' } }] });
    getOutcomes.mockResolvedValue({ summary: { supplier_defect_rate: 0.25 } });
    wrap(<VendorQualityPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('QC-1')).toBeTruthy());
    expect(screen.getByText('NCR-QC-1 · open')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
  });
  it('Given no inspections / When loaded / Then the empty state shows', async () => {
    getQualityHistory.mockResolvedValue({ data: [] });
    getOutcomes.mockResolvedValue(null);
    wrap(<VendorQualityPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('No inspections yet')).toBeTruthy());
  });
  it('Given the API fails / When loaded / Then an error shows', async () => {
    getQualityHistory.mockRejectedValue(new Error('x'));
    getOutcomes.mockResolvedValue(null);
    wrap(<VendorQualityPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('Could not load quality history.')).toBeTruthy());
  });
});

describe('VendorCorrectiveActionsPanel', () => {
  it('Given no corrective actions / When loaded / Then the empty state shows', async () => {
    listCorrectiveActions.mockResolvedValue({ data: [] });
    wrap(<VendorCorrectiveActionsPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('No corrective actions')).toBeTruthy());
  });
  it('Given one awaiting the vendor / When loaded / Then its status label shows', async () => {
    listCorrectiveActions.mockResolvedValue({ data: [{ id: 'a1', vca_number: 'VCA-1', status: 'awaiting_vendor', severity: 'major', due_date: null, trigger_reason: 'major vendor defect' }] });
    wrap(<VendorCorrectiveActionsPanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('Awaiting vendor')).toBeTruthy());
  });
});

describe('CorrectiveActionDetailPage', () => {
  const open = (status: string, extra: any = {}) => {
    getCorrectiveAction.mockResolvedValue({ id: 'a1', vca_number: 'VCA-1', vendor_id: 'v1', status, evidence: [], source_type: 'quality_inspection', ...extra });
    return render(<MemoryRouter initialEntries={['/vendors/corrective-actions/a1']}><Routes><Route path="/vendors/corrective-actions/:id" element={<CorrectiveActionDetailPage />} /></Routes></MemoryRouter>);
  };
  it('Given a closed VCA / When opened / Then it is read-only with no action bar', async () => {
    open('closed');
    await waitFor(() => expect(screen.getByText(/can no longer change/)).toBeTruthy());
    expect(screen.queryByTestId('vca-action-bar')).toBeNull();
  });
  it('Given an open VCA / When opened / Then the next step is offered', async () => {
    open('open');
    await waitFor(() => expect(screen.getByText('Start containment')).toBeTruthy());
  });
  it('Given effectiveness check without a result / When opened / Then Close is disabled', async () => {
    open('effectiveness_check');
    await waitFor(() => expect(screen.getByText('Close')).toBeTruthy());
    expect((screen.getByText('Close').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
  it('Given the API fails / When opened / Then an error shows', async () => {
    getCorrectiveAction.mockRejectedValue(new Error('x'));
    render(<MemoryRouter initialEntries={['/vendors/corrective-actions/a1']}><Routes><Route path="/vendors/corrective-actions/:id" element={<CorrectiveActionDetailPage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Could not load this corrective action.')).toBeTruthy());
  });
});
