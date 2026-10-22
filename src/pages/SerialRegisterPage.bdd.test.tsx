import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockLookup = vi.fn();
const mockByCustomer = vi.fn();
vi.mock('../services/serialService', () => ({
  serialService: { lookup: (...a: any[]) => mockLookup(...a), byCustomer: (...a: any[]) => mockByCustomer(...a) },
}));
vi.mock('../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => d }) }));

import SerialRegisterPage from './SerialRegisterPage';

const row = (o: any = {}) => ({
  id: 's1', item_id: 'i1', serial_number: 'SN-100', status: 'issued', customer_id: 'c1', customer_name: 'Acme Ltd',
  sold_source_number: 'SO-7', sold_source_module: 'crm', sold_at: '2026-01-02', warranty_until: '2027-01-02',
  warranty_status: 'in_warranty', item: { id: 'i1', name: 'Pump', sku: 'P-1' }, ...o,
});

beforeEach(() => { vi.clearAllMocks(); mockLookup.mockResolvedValue([row()]); mockByCustomer.mockResolvedValue([row(), row({ id: 's2', serial_number: 'SN-101' })]); });

describe('SerialRegisterPage', () => {
  it('Given nothing typed / When rendered / Then prompt to search and no API call', () => {
    render(<SerialRegisterPage />);
    expect(screen.getByRole('heading', { name: 'Serial Register' })).toBeInTheDocument();
    expect(screen.getByText('Search a serial number to see its sale history.')).toBeInTheDocument();
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('Given a serial typed / When lookup returns / Then customer, order and warranty show', async () => {
    render(<SerialRegisterPage />);
    fireEvent.change(screen.getByPlaceholderText('Find a serial number...'), { target: { value: 'SN-1' } });
    await waitFor(() => expect(screen.getByText('SN-100')).toBeInTheDocument());
    expect(mockLookup).toHaveBeenCalledWith({ q: 'SN-1', limit: 50 });
    expect(screen.getByText('Acme Ltd')).toBeInTheDocument();
    expect(screen.getByText('SO-7')).toBeInTheDocument();
    expect(screen.getByText('In warranty')).toBeInTheDocument();
  });

  it('Given a result / When the customer is clicked / Then all of that customer\'s units load', async () => {
    render(<SerialRegisterPage />);
    fireEvent.change(screen.getByPlaceholderText('Find a serial number...'), { target: { value: 'SN-1' } });
    await waitFor(() => screen.getByText('Acme Ltd'));
    fireEvent.click(screen.getByText('Acme Ltd'));
    await waitFor(() => expect(screen.getByText('SN-101')).toBeInTheDocument());
    expect(mockByCustomer).toHaveBeenCalledWith('c1', 100);
  });

  it('Given the API fails / When searched / Then an error alert shows', async () => {
    mockLookup.mockRejectedValue(new Error('boom'));
    render(<SerialRegisterPage />);
    fireEvent.change(screen.getByPlaceholderText('Find a serial number...'), { target: { value: 'SN-1' } });
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });
});
