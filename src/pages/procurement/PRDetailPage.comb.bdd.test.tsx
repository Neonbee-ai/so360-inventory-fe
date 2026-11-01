import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetPRDetail = vi.fn();
const mockApprovePR = vi.fn();
const mockGetConversionPayload = vi.fn();
const mockClosePR = vi.fn();
const mockNavigate = vi.fn();
vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPRDetail: (...a: any[]) => mockGetPRDetail(...a),
    approvePR: (...a: any[]) => mockApprovePR(...a),
    getConversionPayload: (...a: any[]) => mockGetConversionPayload(...a),
    closePR: (...a: any[]) => mockClosePR(...a),
  },
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'abcdef12-0000-0000-0000-000000000000' }), useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '', formatCurrency: (v: number) => `$${v}`,
  }),
}));

import PRDetailPage from './PRDetailPage';

const makePR = (o: any = {}) => ({
  id: 'abcdef12-0000-0000-0000-000000000000', status: 'approved', description: 'Need stuff', required_date: '2025-03-01',
  created_at: '2025-01-01', requester: { full_name: 'Jane', email: 'j@x.com' },
  pr_lines: [{ id: 'l1', item_id: 'i1', description: 'Pens', quantity: 2, estimated_unit_price: 10 }],
  linked_pos: [], approval_gates: [], ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPRDetail.mockResolvedValue(makePR());
  mockGetConversionPayload.mockResolvedValue({ is_fully_converted: false });
});

describe('PRDetailPage (Comb)', () => {
  it('Given the API answers 404 / When loaded / Then it settles on "PR not found" inside the page shell', async () => {
    mockGetPRDetail.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    render(<PRDetailPage />);
    expect(await screen.findByText('PR not found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Purchase Requisition' })).toBeInTheDocument();
  });

  it('Given the API answers 400 for a malformed id / When loaded / Then it shows "PR not found"', async () => {
    mockGetPRDetail.mockRejectedValue(Object.assign(new Error('Validation failed'), { status: 400 }));
    render(<PRDetailPage />);
    expect(await screen.findByText('PR not found')).toBeInTheDocument();
  });

  it('Given an approved PR, When it loads, Then the title and Create PO primary action show', async () => {
    render(<PRDetailPage />);
    expect(await screen.findByRole('heading', { name: '#PR-ABCDEF12' })).toBeTruthy();
    expect(screen.getByText('Create PO from this PR')).toBeTruthy();
  });

  it('Given the PR is loading, When rendered, Then the skeleton slot shows', () => {
    mockGetPRDetail.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PRDetailPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it('Given a PR with no approval gates, When it loads, Then the empty workflow message shows', async () => {
    render(<PRDetailPage />);
    expect(await screen.findByText('No approval workflow configured')).toBeTruthy();
  });

  it('Given a pending gate, When Approve is clicked, Then approvePR is called with the gate name', async () => {
    mockGetPRDetail.mockResolvedValue(makePR({ status: 'pending_approval', approval_gates: [{ id: 'g1', gate_name: 'mgr', gate_level: 1, status: 'pending' }] }));
    mockApprovePR.mockResolvedValue({});
    render(<PRDetailPage />);
    fireEvent.click(await screen.findByText('Approve'));
    await waitFor(() => expect(mockApprovePR).toHaveBeenCalledWith('abcdef12-0000-0000-0000-000000000000', expect.objectContaining({ gate_name: 'mgr', status: 'approved' })));
  });

  it('Given a pending-approval PR, When it loads, Then Create PO and Close PR actions are hidden', async () => {
    mockGetPRDetail.mockResolvedValue(makePR({ status: 'pending_approval' }));
    render(<PRDetailPage />);
    await screen.findByRole('heading', { name: '#PR-ABCDEF12' });
    expect(screen.queryByText('Create PO from this PR')).toBeNull();
    expect(screen.queryByText('Close PR')).toBeNull();
  });

  it('Given an approved PR, When Create PO is clicked, Then it navigates to /procurement/po with the payload', async () => {
    render(<PRDetailPage />);
    fireEvent.click(await screen.findByText('Create PO from this PR'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/procurement/po', { state: { convertFromPR: { is_fully_converted: false } } }));
  });
});
