import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetItems = vi.fn();
const mockGetLocations = vi.fn();
const mockGetTransferHistory = vi.fn();
const mockCreateTransfer = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getItems: (...args: any[]) => mockGetItems(...args),
    getLocations: (...args: any[]) => mockGetLocations(...args),
    getTransferHistory: (...args: any[]) => mockGetTransferHistory(...args),
    createTransfer: (...args: any[]) => mockCreateTransfer(...args),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, isLoading, emptyMessage }: any) => (
    <div data-testid="table">
      {isLoading ? 'Loading...' : data.length === 0 ? emptyMessage : `${data.length} rows`}
    </div>
  ),
}));

vi.mock('../components/common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

import StockTransfersPage from './StockTransfersPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItems.mockResolvedValue({ data: [{ id: 'item-1', name: 'Widget', sku: 'W-001', type: 'product' }] });
  mockGetLocations.mockResolvedValue([
    { id: 'wh-1', name: 'Warehouse A' },
    { id: 'wh-2', name: 'Warehouse B' },
  ]);
  mockGetTransferHistory.mockResolvedValue([]);
});

describe('StockTransfersPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Stock Transfers title', async () => {
      render(<StockTransfersPage />);
      expect(screen.getByText('Stock Transfers')).toBeInTheDocument();
    });

    it('When user has permission / Then shows Plan Transfer button', async () => {
      render(<StockTransfersPage />);
      expect(screen.getByText('Plan Transfer')).toBeInTheDocument();
    });

    it('When no transfers exist / Then shows empty message', async () => {
      render(<StockTransfersPage />);
      await waitFor(() => {
        expect(screen.getByTestId('table')).toHaveTextContent('No stock transfers found');
      });
    });
  });

  describe('Given the transfer modal', () => {
    it('When Plan Transfer clicked / Then opens modal', async () => {
      render(<StockTransfersPage />);
      fireEvent.click(screen.getByText('Plan Transfer'));
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText('Internal Stock Transfer')).toBeInTheDocument();
      });
    });

    it('When modal opens / Then shows source and destination selects', async () => {
      render(<StockTransfersPage />);
      fireEvent.click(screen.getByText('Plan Transfer'));
      await waitFor(() => {
        expect(screen.getByText('Select Source...')).toBeInTheDocument();
        expect(screen.getByText('Select Destination...')).toBeInTheDocument();
      });
    });

    it('When modal opens / Then shows atomic movement notice', async () => {
      render(<StockTransfersPage />);
      fireEvent.click(screen.getByText('Plan Transfer'));
      await waitFor(() => {
        expect(screen.getByText('Atomic Movement')).toBeInTheDocument();
      });
    });
  });

  describe('Given transfer validation', () => {
    it('When same source and destination selected / Then shows error', async () => {
      render(<StockTransfersPage />);
      fireEvent.click(screen.getByText('Plan Transfer'));
      await waitFor(() => screen.getByTestId('modal'));

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'item-1' } });
      fireEvent.change(selects[1], { target: { value: 'wh-1' } });
      fireEvent.change(selects[2], { target: { value: 'wh-1' } });

      const qtyInput = screen.getByRole('spinbutton');
      fireEvent.change(qtyInput, { target: { value: '10' } });

      fireEvent.click(screen.getByText('Execute Transfer'));

      await waitFor(() => {
        expect(screen.getByText('Source and destination warehouses must be different')).toBeInTheDocument();
      });
    });
  });

  describe('Given fetch failure', () => {
    it('When data fetch fails / Then shows error', async () => {
      mockGetItems.mockRejectedValue(new Error('fail'));
      render(<StockTransfersPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch transfers data')).toBeInTheDocument();
      });
    });
  });
});
