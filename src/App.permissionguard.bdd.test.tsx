import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mutable holder read by the hoisted shell-context mock on every render, so a
// spec can vary the signed-in user's entitlements without re-importing App.
const h = vi.hoisted(() => ({ loaded: true, granted: [] as string[] }));

// Lazy-loaded pages — stub each so route elements render synchronously.
vi.mock('./pages/ItemsPage', () => ({ default: () => <div data-testid="items-page">Items</div> }));
vi.mock('./pages/item-create/ItemCreatePage', () => ({ default: () => <div>ItemCreate</div> }));
vi.mock('./pages/ItemDetailPage', () => ({ default: () => <div>ItemDetail</div> }));
vi.mock('./pages/StockLocationsPage', () => ({ default: () => <div>StockLocations</div> }));
vi.mock('./pages/WarehouseDetailPage', () => ({ default: () => <div>WarehouseDetail</div> }));
vi.mock('./pages/StockOverviewPage', () => ({ default: () => <div>StockOverview</div> }));
vi.mock('./pages/StockMovementRegisterPage', () => ({ default: () => <div>StockMovementRegister</div> }));
vi.mock('./pages/SettingsPage', () => ({ default: () => <div>Settings</div> }));
vi.mock('./pages/settings/ProductTypeSettingsPage', () => ({ default: () => <div>ProductTypeSettings</div> }));
vi.mock('./pages/procurement/PRListPage', () => ({ default: () => <div>PRList</div> }));
vi.mock('./pages/procurement/PRDetailPage', () => ({ default: () => <div>PRDetail</div> }));
vi.mock('./pages/procurement/POListPage', () => ({ default: () => <div>POList</div> }));
vi.mock('./pages/procurement/PODetailPage', () => ({ default: () => <div>PODetail</div> }));
vi.mock('./pages/procurement/GRNListPage', () => ({ default: () => <div>GRNList</div> }));
vi.mock('./pages/procurement/GRNDetailPage', () => ({ default: () => <div>GRNDetail</div> }));
vi.mock('./pages/procurement/GRNEntryPage', () => ({ default: () => <div>GRNEntry</div> }));
vi.mock('./pages/vendors/VendorListPage', () => ({ default: () => <div data-testid="vendor-list-page">VendorList</div> }));
vi.mock('./pages/vendors/VendorDetailPage', () => ({ default: () => <div>VendorDetail</div> }));
vi.mock('./pages/vendors/ContractsPage', () => ({ default: () => <div>Contracts</div> }));
vi.mock('./pages/procurement/OpeningBalancePage', () => ({ default: () => <div>OpeningBalance</div> }));
vi.mock('./pages/procurement/RFQListPage', () => ({ default: () => <div>RFQList</div> }));
vi.mock('./pages/procurement/RFQDetailPage', () => ({ default: () => <div>RFQDetail</div> }));
vi.mock('./pages/procurement/RFQComparisonPage', () => ({ default: () => <div>RFQComparison</div> }));
vi.mock('./pages/procurement/QualityInspectionPage', () => ({ default: () => <div>QualityInspection</div> }));
vi.mock('./pages/procurement/VendorReturnsPage', () => ({ default: () => <div>VendorReturns</div> }));
vi.mock('./pages/procurement/ProcurementDashboardPage', () => ({ default: () => <div>ProcurementDashboard</div> }));
vi.mock('./pages/procurement/ProcurementReportsPage', () => ({ default: () => <div>ProcurementReports</div> }));
vi.mock('./pages/procurement/VendorPerformancePage', () => ({ default: () => <div>VendorPerformance</div> }));
vi.mock('./pages/procurement/SalesDemandPage', () => ({ default: () => <div>SalesDemand</div> }));
vi.mock('./pages/CategoriesPage', () => ({ default: () => <div>Categories</div> }));
vi.mock('./pages/bulk-import/BulkImportPage', () => ({ default: () => <div>BulkImport</div> }));

// Route renders its element regardless of path, so every route in App is
// exercised in a single render — exactly what a "can any URL be typed" guard
// test wants.
vi.mock('react-router-dom', () => ({
  Routes: ({ children }: any) => <div data-testid="routes">{children}</div>,
  Route: ({ element }: any) => element || null,
  Navigate: ({ to }: any) => <div data-testid="navigate-to">{to}</div>,
  useLocation: () => ({ pathname: '/vendors' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentOrg: { id: 'org-1' },
    accessToken: 'token-123',
    currentTenant: { id: 'tenant-1' },
    user: { id: 'user-1' },
    permissionsLoaded: h.loaded,
    hasPermission: (code: string) => h.granted.includes(code),
    hasAnyPermission: (...codes: string[]) => codes.some((c) => h.granted.includes(c)),
  }),
}));

vi.mock('./services/inventoryService', () => ({
  inventoryService: { setOrgId: vi.fn(), setAccessToken: vi.fn(), setTenantId: vi.fn() },
}));
vi.mock('./services/procurementService', () => ({ procurementService: {} }));
vi.mock('./services/vendorService', () => ({ vendorService: { setUserId: vi.fn() } }));
vi.mock('./services/mediaService', () => ({
  mediaService: { setAccessToken: vi.fn(), setTenantId: vi.fn(), setOrgId: vi.fn() },
}));

import App from './App';

const DENIAL = /don’t have access to this page|don't have access to this page/;

describe('App — role-permission route guard', () => {
  beforeEach(() => {
    h.loaded = true;
    h.granted = [];
  });

  it('Given the user holds the page permission / When the route renders / Then the page is not withheld', async () => {
    h.granted = ['items.read'];
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('items-page').length).toBeGreaterThan(0));
  });

  it('Given the user lacks the page permission / When the route renders / Then the access notice replaces the page', async () => {
    h.granted = ['suppliers.read'];
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('routes').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('items-page')).not.toBeInTheDocument();
    expect(screen.getAllByText(DENIAL).length).toBeGreaterThan(0);
  });

  it('Given entitlements have not resolved yet / When routes render / Then nothing is denied (no flash)', async () => {
    h.loaded = false;
    h.granted = ['items.read'];
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('routes').length).toBeGreaterThan(0));
    expect(screen.queryByText(DENIAL)).not.toBeInTheDocument();
    expect(screen.queryByTestId('items-page')).not.toBeInTheDocument();
  });

  it('Given the user holds zero permissions / When the index route renders / Then it stays reachable', async () => {
    h.granted = [];
    render(<App />);
    // pathname is /vendors, so the context-aware index renders the vendor list
    // directly — it is deliberately ungated, unlike the `vendors` route itself.
    await waitFor(() => expect(screen.getAllByTestId('vendor-list-page').length).toBe(1));
  });
});
