import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetPOs = vi.fn();
const mockGetLocations = vi.fn();
const mockCreateGRN = vi.fn();
const mockNotice = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: { getPOs: (...a: any[]) => mockGetPOs(...a), createGRN: (...a: any[]) => mockCreateGRN(...a) },
}));
vi.mock('../../services/inventoryService', () => ({
  inventoryService: { getLocations: (...a: any[]) => mockGetLocations(...a), getOrgId: () => 'org-1' },
}));
vi.mock('../../services/receivingService', () => ({
  receivingService: { expectedReceipt: (...a: any[]) => mockNotice(...a) },
  DIRECT_TO_SITE_FLAG: 'action:inventory:procurement:direct_to_site_receipt',
  SERVICE_ACCEPTANCE_FLAG: 'action:inventory:procurement:service_acceptance',
}));

import GRNEntryPage from './GRNEntryPage';

const po = {
  id: 'po-1', po_number: '2024-001', status: 'sent', vendor: { name: 'Acme Supplies' },
  po_lines: [{ id: 'line-1', item_id: 'item-1', quantity: 100, received_quantity: 0, description: 'Widget A' }],
};

async function openForm() {
  render(<GRNEntryPage />);
  await waitFor(() => expect(screen.getByText('Acme Supplies')).toBeInTheDocument());
  fireEvent.click(screen.getByText('#PO-2024-001'));
  await waitFor(() => expect(screen.getByText(/GRN Number/i)).toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText(/GRN-2024-001/i), { target: { value: 'GRN-R-1' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPOs.mockResolvedValue([po]);
  mockGetLocations.mockResolvedValue([{ id: 'wh-1', name: 'Main Warehouse' }]);
  mockCreateGRN.mockResolvedValue({ id: 'grn-new' });
  vi.spyOn(toast, 'success').mockReturnValue('t');
  vi.spyOn(toast, 'error').mockReturnValue('t');
  vi.spyOn(toast, 'warning').mockReturnValue('t');
  vi.stubGlobal('location', { ...window.location, reload: vi.fn(), search: '' });
});
afterEach(() => vi.unstubAllGlobals());

describe('GRNEntryPage receiving (Pulse 4fe6cf16)', () => {
  it('Given a normal receipt, When posted, Then it is a warehouse receipt carrying a replay key', async () => {
    await openForm();
    fireEvent.change(screen.getByLabelText('Receiving Warehouse'), { target: { value: 'wh-1' } });
    fireEvent.click(screen.getByText(/Post Goods Receipt/i));
    await waitFor(() => expect(mockCreateGRN).toHaveBeenCalled());
    const dto = mockCreateGRN.mock.calls[0][0];
    expect(dto.receipt_kind).toBe('warehouse');
    expect(typeof dto.idempotency_key).toBe('string');
    expect(dto.idempotency_key.length).toBeGreaterThan(5);
  });

  it('Given Direct to site is chosen, Then the warehouse field is replaced by site and custody fields', async () => {
    await openForm();
    fireEvent.click(screen.getByText('Direct to site'));
    expect(screen.queryByLabelText('Receiving Warehouse')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Delivery site/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Proof of receipt/i)).toBeInTheDocument();
  });

  it('Given a direct-to-site receipt without custody proof, When posted, Then it is blocked with a warning', async () => {
    await openForm();
    fireEvent.click(screen.getByText('Direct to site'));
    fireEvent.change(screen.getByLabelText(/Delivery site/i), { target: { value: 'site-9' } });
    // Submit the form directly: the required inputs would stop a click on the button in the browser before this guard runs.
    fireEvent.submit(document.getElementById('grn-entry-form')!);
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('custody')));
    expect(mockCreateGRN).not.toHaveBeenCalled();
  });

  it('Given a service receipt without evidence, When posted, Then it is blocked', async () => {
    await openForm();
    fireEvent.click(screen.getByText('Service'));
    // Submit the form directly: the required inputs would stop a click on the button in the browser before this guard runs.
    fireEvent.submit(document.getElementById('grn-entry-form')!);
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Service acceptance')));
    expect(mockCreateGRN).not.toHaveBeenCalled();
  });

  it('Given a service receipt with a milestone reference, When posted, Then the evidence is sent and no warehouse is', async () => {
    await openForm();
    fireEvent.click(screen.getByText('Service'));
    fireEvent.change(screen.getByLabelText(/Evidence reference/i), { target: { value: 'ms-1' } });
    fireEvent.click(screen.getByText(/Post Goods Receipt/i));
    await waitFor(() => expect(mockCreateGRN).toHaveBeenCalled());
    const dto = mockCreateGRN.mock.calls[0][0];
    expect(dto).toMatchObject({ receipt_kind: 'service', acceptance_evidence: { type: 'milestone', source_module: 'projects', source_id: 'ms-1' } });
    expect(dto.warehouse_id).toBeUndefined();
  });

  it('Given a damaged delivery, When the discrepancy is chosen, Then the line is sent with it', async () => {
    await openForm();
    fireEvent.change(screen.getByLabelText('Receiving Warehouse'), { target: { value: 'wh-1' } });
    fireEvent.click(screen.getByText('Batch / QC'));
    fireEvent.change(screen.getByLabelText('Discrepancy'), { target: { value: 'damaged' } });
    fireEvent.click(screen.getByText(/Post Goods Receipt/i));
    await waitFor(() => expect(mockCreateGRN).toHaveBeenCalled());
    expect(mockCreateGRN.mock.calls[0][0].items[0].discrepancy_type).toBe('damaged');
  });

  it('Given the form is opened from an expected receipt, Then it is prefilled and the lines link to the schedule', async () => {
    vi.stubGlobal('location', { ...window.location, reload: vi.fn(), search: '?expected_receipt_id=er1' });
    mockNotice.mockResolvedValue({ id: 'er1', po_id: 'po-1', po_line_id: 'line-1', schedule_id: 's1', warehouse_id: 'wh-1', open_qty: 60, quantity: 100, due_date: '2027-03-01', inspection_required: true });
    render(<GRNEntryPage />);
    await waitFor(() => expect(screen.getByText(/Receiving against an expected delivery/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/Received quantity for Widget A/i)).toHaveValue(60);
    fireEvent.change(screen.getByPlaceholderText(/GRN-2024-001/i), { target: { value: 'GRN-R-2' } });
    fireEvent.click(screen.getByText(/Post Goods Receipt/i));
    await waitFor(() => expect(mockCreateGRN).toHaveBeenCalled());
    const dto = mockCreateGRN.mock.calls[0][0];
    expect(dto).toMatchObject({ warehouse_id: 'wh-1', inspection_status: 'pending' });
    expect(dto.items[0]).toMatchObject({ schedule_id: 's1', expected_receipt_id: 'er1', quantity_received: 60 });
  });
});
