import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetVendors = vi.fn();
const mockGetLocations = vi.fn();
const mockCreateOpeningBalance = vi.fn();
const mockGetUnlinkedMovements = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getVendors: (...args: any[]) => mockGetVendors(...args),
  },
}));

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getLocations: (...args: any[]) => mockGetLocations(...args),
  },
}));

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    createOpeningBalance: (...args: any[]) => mockCreateOpeningBalance(...args),
    getUnlinkedMovements: (...args: any[]) => mockGetUnlinkedMovements(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../components/ItemSearchSelector', () => ({
  default: ({ onSelect }: any) => (
    <button data-testid="item-selector" onClick={() => onSelect({ id: 'item-1', name: 'Widget', sku: 'W-001', price: 10 })}>
      Select Item
    </button>
  ),
}));

import OpeningBalancePage from './OpeningBalancePage';

const makeVendor = (overrides: any = {}) => ({
  id: 'vendor-1',
  name: 'Acme Supplies',
  ...overrides,
});

const makeWarehouse = (overrides: any = {}) => ({
  id: 'wh-1',
  name: 'Main Warehouse',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetVendors.mockResolvedValue([makeVendor()]);
  mockGetLocations.mockResolvedValue([makeWarehouse()]);
  mockCreateOpeningBalance.mockResolvedValue({
    po: { id: 'po-1', po_number: 'OB-2024-001', status: 'received' },
    grn: { id: 'grn-1', grn_number: 'GRN-OB-2024-001', received_at: '2024-01-15T00:00:00Z' },
    movements_linked: 3,
  });
  mockGetUnlinkedMovements.mockResolvedValue([]);
});

describe('OpeningBalancePage', () => {
  describe('Given loading state', () => {
    it('When data is loading / Then shows spinner', () => {
      mockGetVendors.mockReturnValue(new Promise(() => {}));
      const { container } = render(<OpeningBalancePage />);
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Given page renders', () => {
    it('When loaded / Then shows Opening Balance heading', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => {
        expect(screen.getByText('Opening Balance')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Back to Purchase Orders link', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => {
        expect(screen.getByText(/Back to Purchase Orders/i)).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Section A Document Info', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => {
        expect(screen.getByText(/Section A/i)).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows vendor list in dropdown', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows informational how-this-works banner', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => {
        expect(screen.getByText(/How this works/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given back navigation', () => {
    it('When Back to Purchase Orders clicked / Then navigates to PO list', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => expect(screen.getByText('Opening Balance')).toBeInTheDocument());
      fireEvent.click(screen.getByText(/Back to Purchase Orders/i));
      expect(mockNavigate).toHaveBeenCalledWith('/procurement/po');
    });
  });

  describe('Given add item line manually', () => {
    it('When add a line manually link clicked / Then shows item selector row', async () => {
      // First load unlinked stock to show the table, then add manual line
      mockGetUnlinkedMovements.mockResolvedValue([
        { item_id: 'item-1', item_name: 'Widget A', item_sku: 'W-001', warehouse_id: 'wh-1', warehouse_name: 'Main Warehouse', total_qty: 50, avg_cost: 10 },
      ]);
      render(<OpeningBalancePage />);
      await waitFor(() => expect(screen.getByText('Opening Balance')).toBeInTheDocument());
      // Get the Load Unlinked Stock button (the button element, not the strong text inside)
      const loadBtns = screen.getAllByRole('button', { name: /Load Unlinked Stock/i });
      fireEvent.click(loadBtns[0]);
      await waitFor(() => expect(screen.getByText('Widget A (W-001)')).toBeInTheDocument());
      // Now click add line manually link
      fireEvent.click(screen.getByText('+ Add line manually'));
      await waitFor(() => {
        expect(screen.getAllByTestId('item-selector').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given submit with no items', () => {
    it('When form submitted with no items / Then submit button is disabled', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => expect(screen.getByText('Opening Balance')).toBeInTheDocument());
      // Submit button is disabled when no items with item_id
      const submitBtn = screen.getByText('Create Opening Balance');
      expect(submitBtn.closest('button')).toBeDisabled();
    });
  });

  describe('Given Load Unlinked Stock', () => {
    it('When no unlinked movements / Then shows info error message', async () => {
      mockGetUnlinkedMovements.mockResolvedValue([]);
      render(<OpeningBalancePage />);
      await waitFor(() => expect(screen.getByText('Opening Balance')).toBeInTheDocument());
      const loadBtns = screen.getAllByRole('button', { name: /Load Unlinked Stock/i });
      fireEvent.click(loadBtns[0]);
      await waitFor(() => {
        expect(screen.getByText(/No unlinked stock movements found/i)).toBeInTheDocument();
      });
    });

    it('When unlinked movements exist / Then populates item lines', async () => {
      mockGetUnlinkedMovements.mockResolvedValue([
        { item_id: 'item-1', item_name: 'Widget A', item_sku: 'W-001', warehouse_id: 'wh-1', warehouse_name: 'Main Warehouse', total_qty: 50, avg_cost: 10 },
      ]);
      render(<OpeningBalancePage />);
      await waitFor(() => expect(screen.getByText('Opening Balance')).toBeInTheDocument());
      const loadBtns = screen.getAllByRole('button', { name: /Load Unlinked Stock/i });
      fireEvent.click(loadBtns[0]);
      await waitFor(() => {
        expect(screen.getByText('Widget A (W-001)')).toBeInTheDocument();
      });
    });
  });

  describe('Given successful submission', () => {
    it('When opening balance created / Then shows success screen', async () => {
      mockGetUnlinkedMovements.mockResolvedValue([
        { item_id: 'item-1', item_name: 'Widget A', item_sku: 'W-001', warehouse_id: 'wh-1', warehouse_name: 'Main Warehouse', total_qty: 50, avg_cost: 10 },
      ]);
      render(<OpeningBalancePage />);
      await waitFor(() => expect(screen.getByText('Opening Balance')).toBeInTheDocument());
      const loadBtns = screen.getAllByRole('button', { name: /Load Unlinked Stock/i });
      fireEvent.click(loadBtns[0]);
      await waitFor(() => expect(screen.getByText('Widget A (W-001)')).toBeInTheDocument());
      const submitBtn = screen.getByText('Create Opening Balance').closest('button')!;
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(screen.getByText('Opening Balance Created')).toBeInTheDocument();
      });
    });
  });

  describe('Given API calls on mount', () => {
    it('When mounted / Then fetches vendors', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => {
        expect(mockGetVendors).toHaveBeenCalled();
      });
    });

    it('When mounted / Then fetches locations', async () => {
      render(<OpeningBalancePage />);
      await waitFor(() => {
        expect(mockGetLocations).toHaveBeenCalled();
      });
    });
  });
});
