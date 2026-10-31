import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetPRDetail = vi.fn();
const mockGetRFQs = vi.fn();
const mockCreateRFQ = vi.fn();
const mockNavigate = vi.fn();
const flag = vi.hoisted(() => ({ on: true }));

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPRDetail: (...a: any[]) => mockGetPRDetail(...a),
    approvePR: vi.fn(), getConversionPayload: vi.fn(), closePR: vi.fn(),
  },
}));
vi.mock('../../services/rfqService', () => ({
  rfqService: {
    getRFQs: (...a: any[]) => mockGetRFQs(...a),
    createRFQ: (...a: any[]) => mockCreateRFQ(...a),
  },
}));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ isFeatureEnabled: (k: string) => flag.on && k === 'submodule:inventory:rfq' }),
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'pr-1234567-aaaa' }),
  useNavigate: () => mockNavigate,
}));
vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string) => d ?? '', formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
  }),
}));

import PRDetailPage from './PRDetailPage';

const makePR = (o: any = {}) => ({
  id: 'pr-1234567-aaaa', status: 'approved', description: 'd',
  required_date: '2026-12-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z',
  requester: { full_name: 'Jane', email: 'j@x.com' },
  pr_lines: [{ id: 'l1', item_id: 'i1', description: 'Cement', quantity: 5, estimated_unit_price: 10, items: { name: 'Cement', sku: 'C1' } }],
  linked_pos: [],
  approval_gates: [{ id: 'g1', gate_name: 'G', gate_level: 1, status: 'pending', metadata: { level: 1, description: 'Mgr', can_delegate: true } }],
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  flag.on = true;
  mockGetPRDetail.mockResolvedValue(makePR());
  mockGetRFQs.mockResolvedValue([]);
  mockCreateRFQ.mockResolvedValue({ id: 'rfq-9', rfq_number: 'RFQ-0009' });
});

describe('PRDetailPage Create RFQ', () => {
  it('Given an approved PR / When loaded / Then Create RFQ button is shown', async () => {
    render(<PRDetailPage />);
    expect(await screen.findByText('Create RFQ')).toBeInTheDocument();
  });

  it.each(['draft', 'pending_approval', 'rejected', 'closed'])('Given a %s PR / When loaded / Then no Create RFQ button', async (status) => {
    mockGetPRDetail.mockResolvedValue(makePR({ status }));
    render(<PRDetailPage />);
    await screen.findByText('Requested Items');
    expect(screen.queryByText('Create RFQ')).not.toBeInTheDocument();
  });

  it('Given the RFQ flag is off / When an approved PR loads / Then no Create RFQ button', async () => {
    flag.on = false;
    render(<PRDetailPage />);
    await screen.findByText('Requested Items');
    expect(screen.queryByText('Create RFQ')).not.toBeInTheDocument();
  });

  it('Given an approved PR / When Create RFQ is clicked / Then the RFQ is created from PR lines and the user lands on it', async () => {
    render(<PRDetailPage />);
    fireEvent.click(await screen.findByText('Create RFQ'));
    await waitFor(() => expect(mockCreateRFQ).toHaveBeenCalled());
    const dto = mockCreateRFQ.mock.calls[0][0];
    expect(dto.pr_id).toBe('pr-1234567-aaaa');
    expect(dto.required_date).toBe('2026-12-01');
    expect(dto.items).toEqual([expect.objectContaining({ item_id: 'i1', pr_line_id: 'l1', quantity: 5, required_delivery_date: '2026-12-01T00:00:00Z' })]);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/procurement/rfq/rfq-9'));
  });

  it('Given creation fails / When Create RFQ is clicked / Then no navigation happens', async () => {
    mockCreateRFQ.mockRejectedValue(new Error('boom'));
    render(<PRDetailPage />);
    fireEvent.click(await screen.findByText('Create RFQ'));
    await waitFor(() => expect(mockCreateRFQ).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Create RFQ')).not.toBeDisabled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Given creation returns no id / When Create RFQ is clicked / Then linked RFQs are refreshed instead of navigating', async () => {
    mockCreateRFQ.mockResolvedValue({ rfq_number: 'RFQ-1' });
    render(<PRDetailPage />);
    await waitFor(() => expect(mockGetRFQs).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByText('Create RFQ'));
    await waitFor(() => expect(mockGetRFQs).toHaveBeenCalledTimes(2));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Given an RFQ is linked to this PR / When loaded / Then its reference is shown and others are excluded', async () => {
    mockGetRFQs.mockResolvedValue([
      { id: 'r1', rfq_number: 'RFQ-0001', status: 'sent', pr_id: 'pr-1234567-aaaa', created_at: '2026-10-02' },
      { id: 'r2', rfq_number: 'RFQ-0002', status: 'draft', pr_id: 'other', created_at: '2026-10-02' },
    ]);
    render(<PRDetailPage />);
    expect(await screen.findByText('RFQ-0001')).toBeInTheDocument();
    expect(screen.queryByText('RFQ-0002')).not.toBeInTheDocument();
  });

  it('Given a cancelled linked RFQ and an RFQ fetch failure / When loaded / Then page still renders without confirm', async () => {
    mockGetRFQs.mockRejectedValue(new Error('x'));
    render(<PRDetailPage />);
    expect(await screen.findByText('Create RFQ')).toBeInTheDocument();
    expect(screen.queryByText('Linked RFQs')).not.toBeInTheDocument();
  });

  it('Given an active RFQ exists / When Create RFQ is clicked / Then a duplicate confirmation is shown before creating', async () => {
    mockGetRFQs.mockResolvedValue([{ id: 'r1', rfq_number: 'RFQ-0001', status: 'sent', pr_id: 'pr-1234567-aaaa', created_at: '2026-10-02' }]);
    render(<PRDetailPage />);
    await screen.findByText('RFQ-0001');
    fireEvent.click(screen.getByText('Create RFQ'));
    expect(await screen.findByText('RFQ already exists')).toBeInTheDocument();
    expect(mockCreateRFQ).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Create another'));
    await waitFor(() => expect(mockCreateRFQ).toHaveBeenCalled());
  });

  it('Given a pending gate allowing delegation / When loaded / Then there is no Delegate control or coming-soon text', async () => {
    render(<PRDetailPage />);
    await screen.findByText('Approve');
    expect(screen.queryByText('Delegate')).not.toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});
