import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const getReviewQueue = vi.fn();
const getLifecycle = vi.fn();
const transitionVendor = vi.fn();

vi.mock('../../../services/vendorService', () => ({
  vendorService: {
    getReviewQueue: (...a: any[]) => getReviewQueue(...a),
    getLifecycle: (...a: any[]) => getLifecycle(...a),
    transitionVendor: (...a: any[]) => transitionVendor(...a),
  },
}));

import ReviewQueuePage from '../ReviewQueuePage';
import VendorLifecyclePanel from './VendorLifecyclePanel';
import { gatesFromError } from './lifecycleLabels';

beforeEach(() => vi.clearAllMocks());

describe('ReviewQueuePage', () => {
  it('Given vendors waiting / When rendered / Then each is listed with its state', async () => {
    getReviewQueue.mockResolvedValue({
      items: [{ vendor_id: 'v1', vendor_code: 'VEN-1', name: 'Gulf Trading', state: 'pending_approval', risk_tier: 'high', next_review_at: null, waiting_since: '2026-11-20T00:00:00Z' }],
    });
    render(<MemoryRouter><ReviewQueuePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Gulf Trading')).toBeInTheDocument());
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
  });
  it('Given an empty queue / When rendered / Then the empty state is shown', async () => {
    getReviewQueue.mockResolvedValue({ items: [] });
    render(<MemoryRouter><ReviewQueuePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Nothing waiting')).toBeInTheDocument());
  });
});

describe('VendorLifecyclePanel', () => {
  const lifecycle = {
    state: 'screening',
    risk_tier: null,
    next_review_at: null,
    history: [],
    pending_approvals: [],
    allowed_transitions: [
      { to_state: 'under_qualification', approval_only: false, gates: [] },
      { to_state: 'approved_active', approval_only: true, gates: [{ gate: 'documents', ok: false, message: 'iso_certificate missing' }] },
    ],
  };
  it('Given an approval-only target / When listed / Then it has no Move button', async () => {
    getLifecycle.mockResolvedValue(lifecycle);
    render(<VendorLifecyclePanel vendorId="v1" canManage />);
    await waitFor(() => expect(screen.getByText(/Approved \(needs approval\)/)).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: 'Move' })).toHaveLength(1);
  });
  it('Given a refused transition / When confirmed / Then the server gate results are shown verbatim', async () => {
    getLifecycle.mockResolvedValue(lifecycle);
    transitionVendor.mockRejectedValue(Object.assign(new Error('gates'), {
      status: 422,
      body: { code: 'VENDOR_GATE_FAILED', gates: [{ gate: 'risk_tier', ok: false, message: 'Risk tier is not set.' }] },
    }));
    render(<VendorLifecyclePanel vendorId="v1" canManage />);
    await waitFor(() => screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.getByTestId('gate-results')).toHaveTextContent('Risk tier is not set.'));
  });
  it('Given the lifecycle API fails / When rendered / Then nothing is drawn', async () => {
    getLifecycle.mockRejectedValue(new Error('403'));
    const { container } = render(<VendorLifecyclePanel vendorId="v1" canManage />);
    await waitFor(() => expect(getLifecycle).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('gatesFromError', () => {
  it('Given the scenario, When it runs, Then reads gates from a 422 body, otherwise null', () => {
    expect(gatesFromError({ body: { gates: [{ gate: 'a', ok: false, message: 'm' }] } })).toHaveLength(1);
    expect(gatesFromError({ body: {} })).toBeNull();
  });
});
