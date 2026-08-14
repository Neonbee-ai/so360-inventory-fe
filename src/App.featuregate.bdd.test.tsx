import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mutable holder read by the hoisted shell-context mock on every render.
const h = vi.hoisted(() => ({ state: 'enabled' as string, hasGetState: true }));

// Lazy-loaded pages — stub each so route elements render synchronously.
vi.mock('./pages/ItemsPage', () => ({ default: () => <div>Items</div> }));
vi.mock('./pages/item-create/ItemCreatePage', () => ({ default: () => <div>ItemCreate</div> }));
vi.mock('./pages/ItemDetailPage', () => ({ default: () => <div>ItemDetail</div> }));
vi.mock('./pages/StockLocationsPage', () => ({ default: () => <div>StockLocations</div> }));
vi.mock('./pages/WarehouseDetailPage', () => ({ default: () => <div>WarehouseDetail</div> }));
vi.mock('./pages/StockOverviewPage', () => ({ default: () => <div>StockOverview</div> }));
vi.mock('./pages/StockMovementRegisterPage', () => ({ default: () => <div>StockMovementRegister</div> }));
vi.mock('./pages/SettingsPage', () => ({ default: () => <div>Settings</div> }));
vi.mock('./pages/settings/ProductTypeSettingsPage', () => ({ default: () => <div data-testid="product-type-settings">ProductTypeSettings</div> }));
vi.mock('./pages/procurement/PRListPage', () => ({ default: () => <div>PRList</div> }));
vi.mock('./pages/procurement/PRDetailPage', () => ({ default: () => <div>PRDetail</div> }));
vi.mock('./pages/procurement/POListPage', () => ({ default: () => <div>POList</div> }));
vi.mock('./pages/procurement/PODetailPage', () => ({ default: () => <div>PODetail</div> }));
vi.mock('./pages/procurement/GRNListPage', () => ({ default: () => <div>GRNList</div> }));
vi.mock('./pages/procurement/GRNDetailPage', () => ({ default: () => <div>GRNDetail</div> }));
vi.mock('./pages/procurement/GRNEntryPage', () => ({ default: () => <div>GRNEntry</div> }));
vi.mock('./pages/vendors/VendorListPage', () => ({ default: () => <div>VendorList</div> }));
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
vi.mock('./pages/CategoriesPage', () => ({ default: () => <div>Categories</div> }));
vi.mock('./pages/bulk-import/BulkImportPage', () => ({ default: () => <div data-testid="bulk-import-page">BulkImport</div> }));

vi.mock('react-router-dom', () => ({
  Routes: ({ children }: any) => <div data-testid="routes">{children}</div>,
  Route: ({ element }: any) => element || null,
  Navigate: ({ to }: any) => <div data-testid="navigate-to">{to}</div>,
  useLocation: () => ({ pathname: '/inventory/settings/product-types' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentOrg: { id: 'org-1' },
    accessToken: 'token-123',
    currentTenant: { id: 'tenant-1' },
    user: { id: 'user-1' },
    ...(h.hasGetState ? { getFeatureState: () => h.state } : {}),
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

describe('App — 5-state FeatureGate route guard', () => {
  beforeEach(() => {
    h.state = 'enabled';
    h.hasGetState = true;
  });

  it('Given enabled / When a gated route renders / Then the page is shown', async () => {
    h.state = 'enabled';
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('product-type-settings').length).toBeGreaterThan(0));
  });

  it('Given hidden / When a gated route renders / Then it redirects and hides the page', async () => {
    h.state = 'hidden';
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('routes').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('product-type-settings')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('navigate-to').length).toBeGreaterThan(0);
  });

  it('Given locked / When a gated route renders / Then the upgrade prompt is shown, not the page', async () => {
    h.state = 'locked';
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('This feature is part of a higher plan').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('product-type-settings')).not.toBeInTheDocument();
  });

  it('Given disabled / When a gated route renders / Then the unavailable panel is shown, no upgrade prompt', async () => {
    h.state = 'disabled';
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('Feature Not Available').length).toBeGreaterThan(0));
    expect(screen.queryByText('This feature is part of a higher plan')).not.toBeInTheDocument();
    expect(screen.queryByTestId('product-type-settings')).not.toBeInTheDocument();
  });

  it('Given read_only / When a gated route renders / Then the page is inert (no upgrade prompt)', async () => {
    h.state = 'read_only';
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('product-type-settings').length).toBeGreaterThan(0));
    const page = screen.getAllByTestId('product-type-settings')[0];
    expect(page.closest('.pointer-events-none')).not.toBeNull();
    expect(screen.queryByText('This feature is part of a higher plan')).not.toBeInTheDocument();
  });

  it('Given the bridge has no getFeatureState / When a gated route renders / Then it fails open to enabled', async () => {
    h.hasGetState = false;
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId('product-type-settings').length).toBeGreaterThan(0));
  });
});
