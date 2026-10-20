import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockAvail = vi.fn();
vi.mock('../../services/serialService', () => ({ serialService: { availableForItem: (...a: any[]) => mockAvail(...a) } }));
import { SerialPicker } from './SerialPicker';

const s = (id: string, wh?: string) => ({ id, item_id: 'i', serial_number: `SN-${id}`, status: 'in_stock', warehouse_id: wh });
beforeEach(() => { vi.clearAllMocks(); mockAvail.mockResolvedValue([s('1', 'w1'), s('2', 'w2')]); });

describe('SerialPicker', () => {
  it('Given in-stock serials / When one is ticked / Then onChange gets it and a shortfall is flagged', async () => {
    const onChange = vi.fn();
    render(<SerialPicker itemId="i" quantity={2} selected={['SN-1']} onChange={onChange} />);
    await waitFor(() => screen.getByLabelText('Serial SN-2'));
    expect(screen.getByTestId('serial-picker-error')).toHaveTextContent('Select exactly 2');
    fireEvent.click(screen.getByLabelText('Serial SN-2'));
    expect(onChange).toHaveBeenCalledWith(['SN-1', 'SN-2']);
  });

  it('Given a warehouse / When rendered / Then only that warehouse\'s serials are listed', async () => {
    render(<SerialPicker itemId="i" quantity={1} selected={[]} onChange={() => {}} warehouseId="w1" />);
    await waitFor(() => screen.getByLabelText('Serial SN-1'));
    expect(screen.queryByLabelText('Serial SN-2')).toBeNull();
  });

  it('Given none in stock / When rendered / Then a warning shows', async () => {
    mockAvail.mockResolvedValue([]);
    render(<SerialPicker itemId="i" quantity={1} selected={[]} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('No in-stock serial numbers for this item.')).toBeInTheDocument());
  });

  it('Given the load fails / When rendered / Then the error shows', async () => {
    mockAvail.mockRejectedValue(new Error('nope'));
    render(<SerialPicker itemId="i" quantity={1} selected={[]} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('nope')).toBeInTheDocument());
  });
});
