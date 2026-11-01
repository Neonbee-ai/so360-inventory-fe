import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetContracts = vi.fn();

vi.mock('../../services/vendorService', () => ({
  vendorService: { getContracts: (...args: any[]) => mockGetContracts(...args) },
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${Number(v).toLocaleString('en-US')}`,
  }),
}));

import ContractsPage from './ContractsPage';

const contract = (o: any = {}) => ({
  id: 'abcdef12-0000',
  vendor: { name: 'Acme Supplies' },
  status: 'active',
  contract_value: '25000',
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetContracts.mockResolvedValue([]);
});

describe('ContractsPage (Comb)', () => {
  it('Given the page / When rendered / Then it uses the list template with its title', async () => {
    const { container } = render(<ContractsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Subcontractor Contracts' })).toBeInTheDocument());
    expect(container.querySelector('[data-template="list"]')).toBeInTheDocument();
  });

  it('Given a pending request / When loading / Then it shows the loading status', () => {
    mockGetContracts.mockReturnValue(new Promise(() => {}));
    render(<ContractsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading contracts...');
  });

  it('Given no contracts / When loaded / Then it shows the empty state', async () => {
    render(<ContractsPage />);
    expect(await screen.findByTestId('empty-state')).toHaveTextContent('No active contracts found.');
  });

  it('Given contracts / When loaded / Then each row shows id, vendor, status and value', async () => {
    mockGetContracts.mockResolvedValue([contract()]);
    render(<ContractsPage />);
    const table = await screen.findByTestId('contracts-table');
    expect(table).toHaveTextContent('#ABCDEF12');
    expect(table).toHaveTextContent('Acme Supplies');
    expect(table).toHaveTextContent('active');
    expect(table).toHaveTextContent('$25,000');
  });

  it('Given the API fails / When loaded / Then an error alert is shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetContracts.mockRejectedValue(new Error('boom'));
    render(<ContractsPage />);
    expect(await screen.findByText('Failed to load contracts. Please refresh the page.')).toBeInTheDocument();
  });
});
