/**
 * BDD specs: timezone-aware date rendering across Inventory MFE pages.
 *
 * All pages use useInventoryFormatters() → @so360/formatters stub which is
 * aliased in vitest.config.ts to src/test/__mocks__/formatters.ts.
 * With timezone='UTC' and locale='en-US':
 *   formatDate('2025-06-01T10:00:00Z') → 'Jun 1, 2025'
 *   formatDate('2025-03-15T00:00:00Z') → 'Mar 15, 2025'
 *   formatDateTime('2025-06-01T10:30:00Z') → 'Jun 1, 2025, 10:30 AM'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Service mocks — hoisted so vi.mock factories can reference them
// ---------------------------------------------------------------------------

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getStockOverview: vi.fn(),
    getGLInventoryValuation: vi.fn(),
    getItems: vi.fn(),
    getLocations: vi.fn(),
    getTransferHistory: vi.fn(),
    getMovements: vi.fn(),
    getOrgDefaultLogic: vi.fn(),
    searchProjects: vi.fn(),
    searchWorkOrders: vi.fn(),
    getStockAvailability: vi.fn(),
    createAdjustment: vi.fn(),
    getItem: vi.fn(),
    getLedger: vi.fn(),
    getTaxCodes: vi.fn(),
    createTransfer: vi.fn(),
  },
}));

vi.mock('../services/procurementService', () => ({
  procurementService: {
    getPRs: vi.fn(),
    getPRDetail: vi.fn(),
    getGRNDetail: vi.fn(),
    approvePR: vi.fn(),
    createPR: vi.fn(),
    deletePR: vi.fn(),
  },
}));

// Stub heavy sub-components used only in ItemDetailPage
vi.mock('../pages/item-create/components/TabNavigation', () => ({
  default: () => <div data-testid="tab-navigation" />,
}));
vi.mock('../pages/item-create/components/FormSection', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../pages/item-create/tabs/BasicInfoTab', () => ({
  default: () => <div data-testid="basic-info-tab" />,
}));
vi.mock('../pages/item-create/tabs/MediaTab', () => ({
  default: () => <div data-testid="media-tab" />,
}));
vi.mock('../pages/item-create/tabs/PricingTab', () => ({
  default: () => <div data-testid="pricing-tab" />,
}));
vi.mock('../pages/item-create/tabs/CategoryTab', () => ({
  default: () => <div data-testid="category-tab" />,
}));
vi.mock('../pages/item-create/tabs/StockTrackingTab', () => ({
  default: () => <div data-testid="stock-tracking-tab" />,
}));
vi.mock('../pages/item-create/tabs/ShippingTab', () => ({
  default: () => <div data-testid="shipping-tab" />,
}));
vi.mock('../pages/item-create/tabs/AttributesTab', () => ({
  default: () => <div data-testid="attributes-tab" />,
}));
vi.mock('../components/lifecycle/LifecycleStatusPanel', () => ({
  default: () => <div data-testid="lifecycle-panel" />,
}));
vi.mock('../components/ItemSearchSelector', () => ({
  default: () => <div data-testid="item-search-selector" />,
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock calls)
// ---------------------------------------------------------------------------

import StockOverviewPage from '../pages/StockOverviewPage';
import StockMovementRegisterPage from '../pages/StockMovementRegisterPage';
import PRListPage from '../pages/procurement/PRListPage';
import PRDetailPage from '../pages/procurement/PRDetailPage';
import GRNDetailPage from '../pages/procurement/GRNDetailPage';
import ItemDetailPage from '../pages/ItemDetailPage';
import { inventoryService } from '../services/inventoryService';
import { procurementService } from '../services/procurementService';

const inv = inventoryService as any;
const proc = procurementService as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderPage = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const renderWithId = (element: React.ReactElement, id = 'test-id') =>
  render(
    <MemoryRouter initialEntries={[`/item/${id}`]}>
      <Routes>
        <Route path="/item/:id" element={element} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.resetAllMocks();
});

// ===========================================================================
// StockOverviewPage
// ===========================================================================

describe('StockOverviewPage — timezone date rendering', () => {
  describe('Given stock levels with UTC last_updated_at', () => {
    beforeEach(() => {
      inv.getStockOverview.mockResolvedValue([
        {
          id: 'sb1',
          item_id: 'item1',
          warehouse_id: 'wh1',
          quantity: 42,
          valuation: 1000,
          last_updated_at: '2025-06-01T10:00:00Z',
          items: { id: 'item1', name: 'Test Widget', sku: 'TW-001', min_stock_threshold: 10, units: { abbreviation: 'PCS' } },
          warehouses: { id: 'wh1', name: 'Main Warehouse' },
          warehouse_locations: null,
        },
      ]);
      inv.getGLInventoryValuation.mockResolvedValue({ gl_balance: 5000, source: 'fifo' });
    });

    it('When the page renders / Then the last update date shows Jun 1, 2025', async () => {
      renderPage(<StockOverviewPage />);
      await waitFor(() => expect(screen.getByText('Test Widget')).toBeInTheDocument());
      expect(screen.getByText('Jun 1, 2025')).toBeInTheDocument();
    });

    it('When the page renders / Then the stock quantity is shown', async () => {
      renderPage(<StockOverviewPage />);
      await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    });

    it('When the page renders / Then the warehouse name is shown', async () => {
      renderPage(<StockOverviewPage />);
      await waitFor(() => expect(screen.getAllByText('Main Warehouse').length).toBeGreaterThan(0));
    });
  });

  describe('Given stock with a March UTC last_updated_at', () => {
    beforeEach(() => {
      inv.getStockOverview.mockResolvedValue([
        {
          id: 'sb2',
          item_id: 'item2',
          warehouse_id: 'wh1',
          quantity: 10,
          valuation: 200,
          last_updated_at: '2025-03-15T00:00:00Z',
          items: { id: 'item2', name: 'Spring Item', sku: 'SP-002', min_stock_threshold: null, units: null },
          warehouses: { id: 'wh1', name: 'Warehouse B' },
          warehouse_locations: null,
        },
      ]);
      inv.getGLInventoryValuation.mockResolvedValue({ gl_balance: 200, source: 'wavg' });
    });

    it('When the page renders / Then the date shows Mar 15, 2025', async () => {
      renderPage(<StockOverviewPage />);
      await waitFor(() => expect(screen.getByText('Spring Item')).toBeInTheDocument());
      expect(screen.getByText('Mar 15, 2025')).toBeInTheDocument();
    });
  });

  describe('Given getStockOverview rejects', () => {
    beforeEach(() => {
      inv.getStockOverview.mockRejectedValue(new Error('Network error'));
      inv.getGLInventoryValuation.mockRejectedValue(new Error('Network error'));
    });

    it('When fetch fails / Then error message is shown', async () => {
      renderPage(<StockOverviewPage />);
      await waitFor(() =>
        expect(screen.getByText(/Failed to load stock data/i)).toBeInTheDocument(),
      );
    });
  });
});

// ===========================================================================
// StockMovementRegisterPage (replaced StockTransfersPage)
// ===========================================================================

describe('StockMovementRegisterPage — timezone date rendering', () => {
  describe('Given a movement with UTC created_at', () => {
    beforeEach(() => {
      inv.getLocations.mockResolvedValue([]);
      inv.getOrgDefaultLogic.mockResolvedValue({
        allow_negative_stock: false,
        auto_approve_transfers: false,
      });
      inv.searchProjects.mockResolvedValue([]);
      inv.searchWorkOrders.mockResolvedValue([]);
      inv.getMovements.mockResolvedValue([
        {
          id: 'mv1',
          quantity: -5,
          created_at: '2025-06-01T10:30:00Z',
          transaction_date: '2025-06-01',
          movement_type: 'transfer',
          items: { name: 'Transferred Item' },
          warehouses: { name: 'Source WH' },
        },
      ]);
    });

    it('When the page renders / Then the movement date shows Jun 1, 2025', async () => {
      renderPage(<StockMovementRegisterPage />);
      await waitFor(() =>
        expect(screen.getAllByText('Jun 1, 2025').length).toBeGreaterThan(0),
      );
    });

    it('When the page renders / Then item name is shown', async () => {
      renderPage(<StockMovementRegisterPage />);
      await waitFor(() =>
        expect(screen.getByText('Transferred Item')).toBeInTheDocument(),
      );
    });
  });

  describe('Given a movement with a December UTC created_at', () => {
    beforeEach(() => {
      inv.getLocations.mockResolvedValue([]);
      inv.getOrgDefaultLogic.mockResolvedValue({
        allow_negative_stock: false,
        auto_approve_transfers: false,
      });
      inv.searchProjects.mockResolvedValue([]);
      inv.searchWorkOrders.mockResolvedValue([]);
      inv.getMovements.mockResolvedValue([
        {
          id: 'mv2',
          quantity: -20,
          created_at: '2025-12-25T00:00:00Z',
          transaction_date: '2025-12-25',
          movement_type: 'transfer',
          items: { name: 'Holiday Stock' },
          warehouses: { name: 'WH-North' },
        },
      ]);
    });

    it('When the page renders / Then the movement date shows Dec 25, 2025', async () => {
      renderPage(<StockMovementRegisterPage />);
      await waitFor(() =>
        expect(screen.getAllByText('Dec 25, 2025').length).toBeGreaterThan(0),
      );
    });
  });

  describe('Given no movements exist', () => {
    beforeEach(() => {
      inv.getLocations.mockResolvedValue([]);
      inv.getOrgDefaultLogic.mockResolvedValue({
        allow_negative_stock: false,
        auto_approve_transfers: false,
      });
      inv.searchProjects.mockResolvedValue([]);
      inv.searchWorkOrders.mockResolvedValue([]);
      inv.getMovements.mockResolvedValue([]);
    });

    it('When the page renders / Then empty state is shown', async () => {
      renderPage(<StockMovementRegisterPage />);
      await waitFor(() =>
        expect(screen.getByText(/No stock movements found/i)).toBeInTheDocument(),
      );
    });
  });
});

// ===========================================================================
// PRListPage
// ===========================================================================

describe('PRListPage — timezone date rendering', () => {
  describe('Given a PR with UTC created_at and required_date', () => {
    beforeEach(() => {
      proc.getPRs.mockResolvedValue([
        {
          id: 'pr-abc12345',
          status: 'pending_approval',
          description: 'Q2 office supplies',
          created_at: '2025-06-01T10:00:00Z',
          required_date: '2025-06-15T00:00:00Z',
          requester: { full_name: 'Alice Manager' },
          pr_lines: [{ id: 'l1', description: 'Pens', quantity: 10, estimated_unit_price: 1 }],
        },
      ]);
    });

    it('When the page renders / Then created_at shows Jun 1, 2025 in Requested cell', async () => {
      renderPage(<PRListPage />);
      await waitFor(() => expect(screen.getByText('Alice Manager')).toBeInTheDocument());
      expect(screen.getByText(/Jun 1, 2025/)).toBeInTheDocument();
    });

    it('When the page renders / Then required_date shows Jun 15, 2025', async () => {
      renderPage(<PRListPage />);
      await waitFor(() => expect(screen.getByText('Alice Manager')).toBeInTheDocument());
      expect(screen.getByText('Jun 15, 2025')).toBeInTheDocument();
    });

    it('When the page renders / Then requester name is shown', async () => {
      renderPage(<PRListPage />);
      await waitFor(() => expect(screen.getByText('Alice Manager')).toBeInTheDocument());
    });

    it('When the page renders / Then PR line count is shown', async () => {
      renderPage(<PRListPage />);
      await waitFor(() => expect(screen.getByText('1 items')).toBeInTheDocument());
    });
  });

  describe('Given a PR with March required_date', () => {
    beforeEach(() => {
      proc.getPRs.mockResolvedValue([
        {
          id: 'pr-march001',
          status: 'draft',
          description: 'March procurement',
          created_at: '2025-02-28T23:00:00Z',
          required_date: '2025-03-15T00:00:00Z',
          requester: { full_name: 'Bob Buyer' },
          pr_lines: [],
        },
      ]);
    });

    it('When the page renders / Then required_date shows Mar 15, 2025', async () => {
      renderPage(<PRListPage />);
      await waitFor(() => expect(screen.getByText('Bob Buyer')).toBeInTheDocument());
      expect(screen.getByText('Mar 15, 2025')).toBeInTheDocument();
    });
  });

  describe('Given no PRs exist', () => {
    beforeEach(() => {
      proc.getPRs.mockResolvedValue([]);
    });

    it('When the page renders / Then empty state is shown', async () => {
      renderPage(<PRListPage />);
      await waitFor(() =>
        expect(screen.getByText(/No purchase requisitions found/i)).toBeInTheDocument(),
      );
    });
  });
});

// ===========================================================================
// PRDetailPage
// ===========================================================================

describe('PRDetailPage — timezone date rendering', () => {
  describe('Given a PR detail with UTC required_date and created_at', () => {
    beforeEach(() => {
      proc.getPRDetail.mockResolvedValue({
        id: 'pr-detail-001',
        status: 'approved',
        description: 'Approved requisition',
        required_date: '2025-06-15T00:00:00Z',
        created_at: '2025-06-01T10:30:00Z',
        requester: { full_name: 'Charlie Lead', email: 'charlie@example.com' },
        pr_lines: [],
        linked_pos: [],
        approval_gates: [],
      });
    });

    it('When the page renders / Then required_date shows Jun 15, 2025', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/pr/pr-detail-001']}>
          <Routes>
            <Route path="/procurement/pr/:id" element={<PRDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByText('Jun 15, 2025')).toBeInTheDocument());
    });

    it('When the page renders / Then created_at shows Jun 1, 2025, 10:30 AM', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/pr/pr-detail-001']}>
          <Routes>
            <Route path="/procurement/pr/:id" element={<PRDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(screen.getByText('Jun 1, 2025, 10:30 AM')).toBeInTheDocument(),
      );
    });

    it('When the page renders / Then requester name is shown', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/pr/pr-detail-001']}>
          <Routes>
            <Route path="/procurement/pr/:id" element={<PRDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByText('Charlie Lead')).toBeInTheDocument());
    });
  });

  describe('Given getPRDetail rejects', () => {
    beforeEach(() => {
      proc.getPRDetail.mockRejectedValue(new Error('PR not found'));
    });

    it('When fetch fails / Then error message is shown', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/pr/bad-id']}>
          <Routes>
            <Route path="/procurement/pr/:id" element={<PRDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(screen.getByText(/PR not found/i)).toBeInTheDocument(),
      );
    });
  });
});

// ===========================================================================
// GRNDetailPage
// ===========================================================================

describe('GRNDetailPage — timezone date rendering', () => {
  describe('Given a GRN with UTC created_at', () => {
    beforeEach(() => {
      proc.getGRNDetail.mockResolvedValue({
        id: 'grn-001',
        grn_number: 'GRN-20250601',
        created_at: '2025-06-01T10:30:00Z',
        notes: 'First batch received',
        warehouse: { id: 'wh1', name: 'Central Warehouse' },
        po: {
          id: 'po-001',
          po_number: 'PO-20250501',
          vendor: { id: 'v1', name: 'ACME Supplies', contact_email: 'vendor@acme.com' },
        },
        received_by: { full_name: 'Dave Receiver' },
        grn_lines: [
          {
            id: 'gl1',
            item_id: 'item1',
            quantity_received: 50,
            po_line: {
              quantity: 50,
              unit_price: 10,
              description: 'Blue Pens',
              items: { name: 'Blue Pen', sku: 'BP-001' },
            },
          },
        ],
      });
    });

    it('When the page renders / Then received date shows Jun 1, 2025, 10:30 AM', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/grn/grn-001']}>
          <Routes>
            <Route path="/procurement/grn/:id" element={<GRNDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(screen.getByText('Jun 1, 2025, 10:30 AM')).toBeInTheDocument(),
      );
    });

    it('When the page renders / Then GRN number is shown', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/grn/grn-001']}>
          <Routes>
            <Route path="/procurement/grn/:id" element={<GRNDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByText('GRN-20250601')).toBeInTheDocument());
    });

    it('When the page renders / Then vendor name is shown', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/grn/grn-001']}>
          <Routes>
            <Route path="/procurement/grn/:id" element={<GRNDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByText('ACME Supplies')).toBeInTheDocument());
    });

    it('When the page renders / Then receiving warehouse is shown', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/grn/grn-001']}>
          <Routes>
            <Route path="/procurement/grn/:id" element={<GRNDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByText('Central Warehouse')).toBeInTheDocument());
    });
  });

  describe('Given getGRNDetail rejects', () => {
    beforeEach(() => {
      proc.getGRNDetail.mockRejectedValue(new Error('GRN not found'));
    });

    it('When fetch fails / Then error state is shown', async () => {
      render(
        <MemoryRouter initialEntries={['/procurement/grn/bad-id']}>
          <Routes>
            <Route path="/procurement/grn/:id" element={<GRNDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(screen.getByText(/GRN not found/i)).toBeInTheDocument(),
      );
    });
  });
});

// ===========================================================================
// ItemDetailPage
// ===========================================================================

describe('ItemDetailPage — timezone date rendering', () => {
  const mockItem = {
    id: 'item-001',
    name: 'Premium Widget',
    sku: 'PW-001',
    type: 'product' as const,
    price: 49.99,
    cost: 20.00,
    category_id: null,
    unit_id: null,
    is_active: true,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T08:00:00Z',
    description: '',
    brand: '',
    barcode: '',
    image_urls: [],
    min_stock_threshold: 5,
    reorder_level: 10,
    is_batch_tracked: false,
    is_serial_tracked: false,
    weight: null,
    weight_unit: null,
    dimensions_length: null,
    dimensions_width: null,
    dimensions_height: null,
    dimensions_unit: null,
    tax_class: null,
    hsn_code: null,
    product_type_id: null,
    custom_attributes: {},
    cost_center_id: null,
    default_warehouse_id: null,
    is_online_visible: false,
    tax_code_id: null,
    units: null,
  };

  const mockLedgerEntry = {
    id: 'le1',
    item_id: 'item-001',
    quantity: 10,
    type: 'inbound',
    created_at: '2025-06-01T10:30:00Z',
    reference: 'GRN-001',
    notes: null,
  };

  describe('Given an item with UTC created_at and a ledger entry', () => {
    beforeEach(() => {
      inv.getItem.mockResolvedValue(mockItem);
      inv.getLedger.mockResolvedValue([mockLedgerEntry]);
      inv.getTaxCodes.mockResolvedValue([]);
    });

    it('When the page renders on the basic tab / Then item created_at shows Jun 1, 2025', async () => {
      renderWithId(<ItemDetailPage />, 'item-001');
      await waitFor(() => expect(screen.getAllByText('Premium Widget').length).toBeGreaterThan(0));
      expect(screen.getAllByText(/Jun 1, 2025/).length).toBeGreaterThan(0);
    });
  });

  describe('Given getItem rejects', () => {
    beforeEach(() => {
      inv.getItem.mockRejectedValue(new Error('Item not found'));
      inv.getLedger.mockResolvedValue([]);
      inv.getTaxCodes.mockResolvedValue([]);
    });

    it('When fetch fails / Then error is shown', async () => {
      renderWithId(<ItemDetailPage />, 'bad-id');
      await waitFor(() =>
        expect(screen.getByText(/Failed to load item details/i)).toBeInTheDocument(),
      );
    });
  });
});
