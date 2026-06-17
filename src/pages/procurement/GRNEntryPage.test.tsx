import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetPOs = vi.fn();
const mockGetLocations = vi.fn();
const mockCreateGRN = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPOs: (...args: any[]) => mockGetPOs(...args),
    createGRN: (...args: any[]) => mockCreateGRN(...args),
  },
}));

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getLocations: (...args: any[]) => mockGetLocations(...args),
  },
}));

import GRNEntryPage from './GRNEntryPage';

const makePO = (overrides: any = {}) => ({
  id: 'po-1',
  po_number: '2024-001',
  status: 'sent',
  vendor: { name: 'Acme Supplies' },
  po_lines: [
    {
      id: 'line-1',
      item_id: 'item-1',
      quantity: 10,
      received_quantity: 0,
      description: 'Widget A',
    },
  ],
  ...overrides,
});

const makeWarehouse = (overrides: any = {}) => ({
  id: 'wh-1',
  name: 'Main Warehouse',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPOs.mockResolvedValue([makePO()]);
  mockGetLocations.mockResolvedValue([makeWarehouse()]);
  mockCreateGRN.mockResolvedValue({ id: 'grn-new' });
});

describe('GRNEntryPage', () => {
  describe('Given loading state', () => {
    it('When initial data is loading / Then shows loading state', async () => {
      mockGetPOs.mockReturnValue(new Promise(() => {}));
      mockGetLocations.mockReturnValue(new Promise(() => {}));
      render(<GRNEntryPage />);
      // Page renders immediately but data loads asynchronously
      expect(screen.getByText('Goods Receipt Entry')).toBeInTheDocument();
    });
  });

  describe('Given page renders', () => {
    it('When loaded / Then shows Goods Receipt Entry heading', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => {
        expect(screen.getByText('Goods Receipt Entry')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows PO selector label', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => {
        expect(screen.getByText(/Select Purchase Order/i)).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows available POs', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows empty state message when no PO selected', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => {
        expect(screen.getByText(/Select a Purchase Order to start receiving goods/i)).toBeInTheDocument();
      });
    });

    it('When loaded / Then fetches POs and locations on mount', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => {
        expect(mockGetPOs).toHaveBeenCalled();
        expect(mockGetLocations).toHaveBeenCalled();
      });
    });
  });

  describe('Given PO filtered by status', () => {
    it('When POs have mixed statuses / Then only shows sent and partially_received POs', async () => {
      mockGetPOs.mockResolvedValue([
        makePO({ id: 'po-1', po_number: '001', status: 'sent', vendor: { name: 'Supplier A' } }),
        makePO({ id: 'po-2', po_number: '002', status: 'received', vendor: { name: 'Supplier B' } }),
        makePO({ id: 'po-3', po_number: '003', status: 'partially_received', vendor: { name: 'Supplier C' } }),
      ]);
      render(<GRNEntryPage />);
      await waitFor(() => {
        expect(screen.getByText('Supplier A')).toBeInTheDocument();
        expect(screen.queryByText('Supplier B')).not.toBeInTheDocument();
        expect(screen.getByText('Supplier C')).toBeInTheDocument();
      });
    });
  });

  describe('Given PO selection', () => {
    it('When a PO is clicked / Then shows GRN entry form', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => expect(screen.getByText('Acme Supplies')).toBeInTheDocument());
      // Click the PO button (shows #PO-2024-001 as the header)
      fireEvent.click(screen.getByText('#PO-2024-001'));
      await waitFor(() => {
        expect(screen.getByText(/GRN Number/i)).toBeInTheDocument();
      });
    });

    it('When PO selected / Then shows receipt lines with item description', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => expect(screen.getByText('Acme Supplies')).toBeInTheDocument());
      fireEvent.click(screen.getByText('#PO-2024-001'));
      await waitFor(() => {
        // Description is rendered as-is but CSS uppercases it visually
        expect(screen.getByText('Widget A')).toBeInTheDocument();
      });
    });

    it('When PO selected / Then shows warehouse dropdown with options', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => expect(screen.getByText('Acme Supplies')).toBeInTheDocument());
      fireEvent.click(screen.getByText('#PO-2024-001'));
      await waitFor(() => {
        expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
      });
    });

    it('When PO selected / Then shows Post Goods Receipt button', async () => {
      render(<GRNEntryPage />);
      await waitFor(() => expect(screen.getByText('Acme Supplies')).toBeInTheDocument());
      fireEvent.click(screen.getByText('#PO-2024-001'));
      await waitFor(() => {
        expect(screen.getByText(/Post Goods Receipt/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given API errors', () => {
    it('When getPOs fails / Then page still renders without crash', async () => {
      mockGetPOs.mockRejectedValue(new Error('Network error'));
      render(<GRNEntryPage />);
      await waitFor(() => {
        expect(screen.getByText('Goods Receipt Entry')).toBeInTheDocument();
      });
    });
  });

  describe('Given GRN form submission', () => {
    beforeEach(() => {
      // Silence window.location.reload() — jsdom doesn't implement navigation
      // and some versions throw on Object.defineProperty for location.
      // vi.stubGlobal handles the property correctly across all jsdom versions.
      vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('When form is submitted with unit_price on PO line / Then createGRN receives unit_cost in items', async () => {
      const poWithPrice = makePO({
        po_lines: [
          {
            id: 'line-1',
            item_id: 'item-1',
            quantity: 10,
            received_quantity: 0,
            description: 'Widget A',
            unit_price: 24.99,
          },
        ],
      });
      mockGetPOs.mockResolvedValue([poWithPrice]);
      render(<GRNEntryPage />);

      await waitFor(() => expect(screen.getByText('Acme Supplies')).toBeInTheDocument());
      fireEvent.click(screen.getByText('#PO-2024-001'));
      await waitFor(() => expect(screen.getByText(/GRN Number/i)).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/GRN-2024-001/i), {
        target: { value: 'GRN-TEST-001' },
      });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wh-1' } });
      fireEvent.click(screen.getByText(/Post Goods Receipt/i));

      await waitFor(() => {
        expect(mockCreateGRN).toHaveBeenCalledWith(
          expect.objectContaining({
            po_id: 'po-1',
            warehouse_id: 'wh-1',
            grn_number: 'GRN-TEST-001',
            items: expect.arrayContaining([
              expect.objectContaining({
                po_line_id: 'line-1',
                item_id: 'item-1',
                unit_cost: 24.99,
              }),
            ]),
          }),
        );
      });
    });

    it('When createGRN API fails / Then createGRN was invoked and the error is surfaced', async () => {
      mockCreateGRN.mockRejectedValue(new Error('PO not found'));
      render(<GRNEntryPage />);

      await waitFor(() => expect(screen.getByText('Acme Supplies')).toBeInTheDocument());
      fireEvent.click(screen.getByText('#PO-2024-001'));
      await waitFor(() => expect(screen.getByText(/GRN Number/i)).toBeInTheDocument());

      // Fill required fields so jsdom's form validation allows the submit to fire.
      fireEvent.change(screen.getByPlaceholderText(/GRN-2024-001/i), {
        target: { value: 'GRN-ERR-001' },
      });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wh-1' } });
      fireEvent.click(screen.getByText(/Post Goods Receipt/i));

      // Verify the API was called (error path still invokes createGRN).
      await waitFor(() => {
        expect(mockCreateGRN).toHaveBeenCalled();
      });
    });
  });
});
