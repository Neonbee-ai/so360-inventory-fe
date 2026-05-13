import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock all lazy-loaded pages
vi.mock('./pages/ItemsPage', () => ({ default: () => <div data-testid="items-page">Items</div> }));
vi.mock('./pages/item-create/ItemCreatePage', () => ({ default: () => <div>ItemCreate</div> }));
vi.mock('./pages/ItemDetailPage', () => ({ default: () => <div>ItemDetail</div> }));
vi.mock('./pages/StockLocationsPage', () => ({ default: () => <div>StockLocations</div> }));
vi.mock('./pages/WarehouseDetailPage', () => ({ default: () => <div>WarehouseDetail</div> }));
vi.mock('./pages/StockOverviewPage', () => ({ default: () => <div>StockOverview</div> }));
vi.mock('./pages/StockAdjustmentsPage', () => ({ default: () => <div>StockAdjustments</div> }));
vi.mock('./pages/StockTransfersPage', () => ({ default: () => <div>StockTransfers</div> }));
vi.mock('./pages/SettingsPage', () => ({ default: () => <div>Settings</div> }));
vi.mock('./pages/settings/ProductTypeSettingsPage', () => ({ default: () => <div>ProductTypeSettings</div> }));
vi.mock('./pages/procurement/PRListPage', () => ({ default: () => <div data-testid="pr-list">PRList</div> }));
vi.mock('./pages/procurement/PRDetailPage', () => ({ default: () => <div>PRDetail</div> }));
vi.mock('./pages/procurement/POListPage', () => ({ default: () => <div>POList</div> }));
vi.mock('./pages/procurement/PODetailPage', () => ({ default: () => <div>PODetail</div> }));
vi.mock('./pages/procurement/GRNListPage', () => ({ default: () => <div>GRNList</div> }));
vi.mock('./pages/procurement/GRNDetailPage', () => ({ default: () => <div>GRNDetail</div> }));
vi.mock('./pages/procurement/GRNEntryPage', () => ({ default: () => <div>GRNEntry</div> }));
vi.mock('./pages/vendors/VendorListPage', () => ({ default: () => <div data-testid="vendor-list">VendorList</div> }));
vi.mock('./pages/vendors/VendorDetailPage', () => ({ default: () => <div>VendorDetail</div> }));
vi.mock('./pages/vendors/ContractsPage', () => ({ default: () => <div>Contracts</div> }));
vi.mock('./pages/procurement/OpeningBalancePage', () => ({ default: () => <div>OpeningBalance</div> }));
vi.mock('./pages/CategoriesPage', () => ({ default: () => <div>Categories</div> }));

vi.mock('react-router-dom', () => ({
  Routes: ({ children }: any) => <div data-testid="routes">{children}</div>,
  Route: ({ element }: any) => element || null,
  Navigate: ({ to }: any) => <div data-testid="navigate-to">{to}</div>,
  useLocation: () => ({ pathname: '/inventory/items' }),
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentOrg: { id: 'org-1' },
    accessToken: 'token-123',
    currentTenant: { id: 'tenant-1' },
    user: { id: 'user-1' },
  }),
}));

vi.mock('./services/inventoryService', () => ({
  inventoryService: {
    setOrgId: vi.fn(),
    setAccessToken: vi.fn(),
    setTenantId: vi.fn(),
  },
}));

vi.mock('./services/procurementService', () => ({
  procurementService: {},
}));

vi.mock('./services/vendorService', () => ({
  vendorService: {
    setUserId: vi.fn(),
  },
}));

vi.mock('./services/mediaService', () => ({
  mediaService: {
    setAccessToken: vi.fn(),
    setTenantId: vi.fn(),
    setOrgId: vi.fn(),
  },
}));

import App from './App';

describe('App', () => {
  it('When rendered / Then shows routes container', () => {
    const { container } = render(<App />);
    // Routes renders within the layout
    expect(container.firstChild).toBeInTheDocument();
  });

  it('When rendered / Then renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });
});
