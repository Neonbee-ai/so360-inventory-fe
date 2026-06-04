import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetContracts = vi.fn();

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getContracts: (...args: any[]) => mockGetContracts(...args),
  },
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
  useInventoryCurrencySymbol: () => '$',
}));

import ContractsPage from './ContractsPage';

const makeContract = (overrides: any = {}) => ({
  id: 'contract-aabbccdd',
  vendor: { name: 'Acme Supplies' },
  status: 'active',
  contract_value: '25000.00',
  start_date: '2024-01-01T00:00:00Z',
  end_date: '2024-12-31T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetContracts.mockResolvedValue([]);
});

describe('ContractsPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Subcontractor Contracts heading', async () => {
      render(<ContractsPage />);
      await waitFor(() => {
        expect(screen.getByText('Subcontractor Contracts')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Duration column header', async () => {
      render(<ContractsPage />);
      await waitFor(() => {
        expect(screen.getByText(/Duration/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given loading state', () => {
    it('When data is loading / Then shows loading indicator', () => {
      mockGetContracts.mockReturnValue(new Promise(() => {})); // never resolves
      render(<ContractsPage />);
      expect(screen.getByText(/Loading contracts/i)).toBeInTheDocument();
    });
  });

  describe('Given empty data', () => {
    it('When no contracts / Then shows empty state message', async () => {
      mockGetContracts.mockResolvedValue([]);
      render(<ContractsPage />);
      await waitFor(() => {
        expect(screen.getByText(/No active contracts found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given contracts data', () => {
    it('When contracts loaded / Then shows contract ID', async () => {
      mockGetContracts.mockResolvedValue([makeContract()]);
      render(<ContractsPage />);
      await waitFor(() => {
        // Contract ID is first 8 chars uppercased: CONTRACT-AABBCCDD -> #CONTRACT
        expect(screen.getByText(/CONTRACT/)).toBeInTheDocument();
      });
    });

    it('When contracts loaded / Then shows vendor name', async () => {
      mockGetContracts.mockResolvedValue([makeContract()]);
      render(<ContractsPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      });
    });

    it('When contracts loaded / Then shows formatted contract value', async () => {
      mockGetContracts.mockResolvedValue([makeContract({ contract_value: '25000.00' })]);
      render(<ContractsPage />);
      await waitFor(() => {
        expect(screen.getByText(/25,000/)).toBeInTheDocument();
      });
    });

    it('When contracts loaded / Then shows status badge', async () => {
      mockGetContracts.mockResolvedValue([makeContract({ status: 'active' })]);
      render(<ContractsPage />);
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
      });
    });

    it('When multiple contracts / Then renders all rows', async () => {
      const contracts = [
        makeContract({ id: 'id-00000001', contract_value: '10000' }),
        makeContract({ id: 'id-00000002', vendor: { name: 'Beta Corp' }, contract_value: '20000' }),
      ];
      mockGetContracts.mockResolvedValue(contracts);
      render(<ContractsPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
        expect(screen.getByText('Beta Corp')).toBeInTheDocument();
      });
    });
  });

  describe('Given API error', () => {
    it('When getContracts fails / Then still renders page without crashing', async () => {
      mockGetContracts.mockRejectedValue(new Error('Network error'));
      render(<ContractsPage />);
      await waitFor(() => {
        expect(screen.getByText(/No active contracts found/i)).toBeInTheDocument();
      });
    });
  });
});
