import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

// Lazy load pages for performance
const ItemsPage = lazy(() => import('./pages/ItemsPage'));
const ItemCreatePage = lazy(() => import('./pages/item-create/ItemCreatePage'));
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage'));
const StockLocationsPage = lazy(() => import('./pages/StockLocationsPage'));
const WarehouseDetailPage = lazy(() => import('./pages/WarehouseDetailPage'));
const StockOverviewPage = lazy(() => import('./pages/StockOverviewPage'));
const StockMovementRegisterPage = lazy(() => import('./pages/StockMovementRegisterPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ProductTypeSettingsPage = lazy(() => import('./pages/settings/ProductTypeSettingsPage'));
const PRListPage = lazy(() => import('./pages/procurement/PRListPage'));
const PRDetailPage = lazy(() => import('./pages/procurement/PRDetailPage'));
const POListPage = lazy(() => import('./pages/procurement/POListPage'));
const PODetailPage = lazy(() => import('./pages/procurement/PODetailPage'));
const GRNListPage = lazy(() => import('./pages/procurement/GRNListPage'));
const GRNDetailPage = lazy(() => import('./pages/procurement/GRNDetailPage'));
const GRNEntryPage = lazy(() => import('./pages/procurement/GRNEntryPage'));
const VendorListPage = lazy(() => import('./pages/vendors/VendorListPage'));
const VendorDetailPage = lazy(() => import('./pages/vendors/VendorDetailPage'));
const ContractsPage = lazy(() => import('./pages/vendors/ContractsPage'));
const OpeningBalancePage = lazy(() => import('./pages/procurement/OpeningBalancePage'));
const RFQListPage = lazy(() => import('./pages/procurement/RFQListPage'));
const RFQDetailPage = lazy(() => import('./pages/procurement/RFQDetailPage'));
const RFQComparisonPage = lazy(() => import('./pages/procurement/RFQComparisonPage'));
const QualityInspectionPage = lazy(() => import('./pages/procurement/QualityInspectionPage'));
const VendorReturnsPage = lazy(() => import('./pages/procurement/VendorReturnsPage'));
const ProcurementDashboardPage = lazy(() => import('./pages/procurement/ProcurementDashboardPage'));
const ProcurementReportsPage = lazy(() => import('./pages/procurement/ProcurementReportsPage'));
const VendorPerformancePage = lazy(() => import('./pages/procurement/VendorPerformancePage'));
const SalesDemandPage = lazy(() => import('./pages/procurement/SalesDemandPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const BulkImportPage = lazy(() => import('./pages/bulk-import/BulkImportPage'));



import { useShellBridge } from '@so360/shell-context';
import { FeatureRoute } from '@so360/design-system';
import { inventoryService } from './services/inventoryService';
import { procurementService } from './services/procurementService';
import { vendorService } from './services/vendorService';
import { mediaService } from './services/mediaService';


/** Shown when a submodule is `locked` — a higher plan unlocks it. */
const UpgradeLocked = () => {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
            <h2 className="text-lg font-bold text-slate-300">This feature is part of a higher plan</h2>
            <p className="text-slate-500 text-sm max-w-md">Upgrade your plan to unlock it.</p>
            <button
                type="button"
                onClick={() => navigate('/org/billing')}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
                Upgrade plan
            </button>
        </div>
    );
};

/** Shown when a submodule is `disabled` — turned off, no upgrade path. */
const FeatureUnavailable = () => (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center px-4">
        <h2 className="text-lg font-bold text-slate-300">Feature Not Available</h2>
        <p className="text-slate-500 text-sm max-w-md">This feature is not available for your organization. Contact your administrator.</p>
    </div>
);

/**
 * Feature-gated route wrapper on the resolved 5-state model via the shared FeatureRoute:
 * enabled→render · read_only→inert · locked→upgrade prompt · disabled→unavailable panel · hidden→redirect.
 * Fail-open (enabled) while shell context is resolving.
 */
const FeatureGate = ({ flagKey, children }: { flagKey: string; children: React.ReactNode }) => {
    const shell = useShellBridge();
    const state = (shell as any)?.getFeatureState ? (shell as any).getFeatureState(flagKey) : 'enabled';
    return (
        <FeatureRoute
            state={state}
            loading={(shell?.effectiveFlagsLoaded === false)}
            hiddenFallback={<Navigate to="/" replace />}
            lockedFallback={<UpgradeLocked />}
            disabledFallback={<FeatureUnavailable />}
        >
            {children}
        </FeatureRoute>
    );
};

const MfeShellInitializer = ({ children }: { children: React.ReactNode }) => {
    const shell = useShellBridge();
    const [isSynced, setIsSynced] = React.useState(false);

    React.useEffect(() => {
        if (shell?.currentOrg?.id && shell?.accessToken) {
            inventoryService.setOrgId(shell.currentOrg.id);
            inventoryService.setAccessToken(shell.accessToken);
            if (shell.currentTenant?.id) {
                inventoryService.setTenantId(shell.currentTenant.id);
            }
            mediaService.setAccessToken(shell.accessToken);
            mediaService.setTenantId(shell.currentTenant?.id || '');
            mediaService.setOrgId(shell.currentOrg?.id || '');
            // Procurement and Vendor services might need similar initialization if not shared
            (procurementService as any).accessToken = shell.accessToken;
            (vendorService as any).accessToken = shell.accessToken;
            vendorService.setUserId(shell.user?.id || '');
            setIsSynced(true);

        }
    }, [shell]);

    if (!isSynced) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="text-slate-500 font-medium animate-pulse text-sm">Connecting to shell...</div>
            </div>
        );
    }

    return <>{children}</>;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500/30">
            <MfeShellInitializer>
                <main className="w-full">
                    <Suspense fallback={
                        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            <div className="text-slate-500 font-medium animate-pulse text-sm">Loading Inventory Module...</div>
                        </div>
                    }>
                        {children}
                    </Suspense>
                </main>
            </MfeShellInitializer>
        </div>
    );
};


const ContextAwareIndex = () => {
    const location = useLocation();
    const basePath = location.pathname.split('/')[1]; // 'inventory' | 'procurement' | 'vendors'

    if (basePath === 'vendors') return <VendorListPage />;
    if (basePath === 'procurement') return <Navigate to="pr" replace />;
    return <Navigate to="items" replace />;
};

const App = () => {
    return (
        <Layout>
            <Routes>
                {/* Context-aware index route */}
                <Route path="/" element={<ContextAwareIndex />} />

                {/* ── Inventory routes (mounted at /inventory/*) ── */}
                <Route path="items" element={<ItemsPage />} />
                <Route path="items/bulk-import" element={<FeatureGate flagKey="action:inventory:bulk_import"><BulkImportPage /></FeatureGate>} />
                <Route path="items/new" element={<ItemCreatePage />} />
                <Route path="items/:id" element={<ItemDetailPage />} />
                <Route path="locations" element={<FeatureGate flagKey="submodule:inventory:warehouses"><StockLocationsPage /></FeatureGate>} />
                <Route path="warehouses/:id" element={<WarehouseDetailPage />} />
                <Route path="overview" element={<StockOverviewPage />} />
                <Route path="movements" element={<StockMovementRegisterPage />} />
                {/* Legacy paths kept as redirects — notification actionUrls and
                    bookmarks still point at /adjustments and /transfers. */}
                <Route path="adjustments" element={<Navigate to="../movements?type=adjustment" replace />} />
                <Route path="transfers" element={<Navigate to="../movements?type=transfer" replace />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/product-types" element={<FeatureGate flagKey="submodule:inventory:product_types"><ProductTypeSettingsPage /></FeatureGate>} />
                <Route path="categories" element={<CategoriesPage />} />

                {/* ── Procurement routes (mounted at /procurement/*) ── */}
                <Route path="pr" element={<FeatureGate flagKey="submodule:inventory:procurement"><PRListPage /></FeatureGate>} />
                <Route path="pr/:id" element={<FeatureGate flagKey="submodule:inventory:procurement"><PRDetailPage /></FeatureGate>} />
                <Route path="po" element={<FeatureGate flagKey="submodule:inventory:procurement"><POListPage /></FeatureGate>} />
                <Route path="po/:id" element={<FeatureGate flagKey="submodule:inventory:procurement"><PODetailPage /></FeatureGate>} />
                <Route path="grn" element={<FeatureGate flagKey="submodule:inventory:procurement"><GRNListPage /></FeatureGate>} />
                <Route path="grn/new" element={<FeatureGate flagKey="submodule:inventory:procurement"><GRNEntryPage /></FeatureGate>} />
                <Route path="grn/:id" element={<FeatureGate flagKey="submodule:inventory:procurement"><GRNDetailPage /></FeatureGate>} />
                <Route path="opening-balance" element={<FeatureGate flagKey="submodule:inventory:procurement"><OpeningBalancePage /></FeatureGate>} />
                <Route path="rfq" element={<FeatureGate flagKey="submodule:inventory:rfq"><RFQListPage /></FeatureGate>} />
                <Route path="rfq/:id" element={<FeatureGate flagKey="submodule:inventory:rfq"><RFQDetailPage /></FeatureGate>} />
                <Route path="rfq/:id/compare" element={<FeatureGate flagKey="submodule:inventory:rfq"><RFQComparisonPage /></FeatureGate>} />
                <Route path="quality" element={<FeatureGate flagKey="submodule:inventory:quality"><QualityInspectionPage /></FeatureGate>} />
                <Route path="returns" element={<FeatureGate flagKey="submodule:inventory:returns"><VendorReturnsPage /></FeatureGate>} />
                <Route path="dashboard" element={<FeatureGate flagKey="submodule:inventory:procurement"><ProcurementDashboardPage /></FeatureGate>} />
                <Route path="reports" element={<FeatureGate flagKey="submodule:inventory:procurement"><ProcurementReportsPage /></FeatureGate>} />
                <Route path="vendor-performance" element={<FeatureGate flagKey="submodule:inventory:procurement"><VendorPerformancePage /></FeatureGate>} />
                <Route path="sales-demand" element={<FeatureGate flagKey="submodule:inventory:procurement"><SalesDemandPage /></FeatureGate>} />

                {/* ── Vendor routes (mounted at /vendors/*) ── */}
                <Route path="contracts" element={<ContractsPage />} />
                <Route path=":id" element={<VendorDetailPage />} />

                {/* ── Backward-compat: old /inventory/procurement/... and /inventory/vendors/... ── */}
                <Route path="procurement/pr" element={<FeatureGate flagKey="submodule:inventory:procurement"><PRListPage /></FeatureGate>} />
                <Route path="procurement/pr/:id" element={<FeatureGate flagKey="submodule:inventory:procurement"><PRDetailPage /></FeatureGate>} />
                <Route path="procurement/po" element={<FeatureGate flagKey="submodule:inventory:procurement"><POListPage /></FeatureGate>} />
                <Route path="procurement/po/:id" element={<FeatureGate flagKey="submodule:inventory:procurement"><PODetailPage /></FeatureGate>} />
                <Route path="procurement/grn" element={<FeatureGate flagKey="submodule:inventory:procurement"><GRNListPage /></FeatureGate>} />
                <Route path="procurement/grn/new" element={<FeatureGate flagKey="submodule:inventory:procurement"><GRNEntryPage /></FeatureGate>} />
                <Route path="procurement/grn/:id" element={<FeatureGate flagKey="submodule:inventory:procurement"><GRNDetailPage /></FeatureGate>} />
                <Route path="procurement/opening-balance" element={<FeatureGate flagKey="submodule:inventory:procurement"><OpeningBalancePage /></FeatureGate>} />
                <Route path="procurement/rfq" element={<FeatureGate flagKey="submodule:inventory:rfq"><RFQListPage /></FeatureGate>} />
                <Route path="procurement/rfq/:id" element={<FeatureGate flagKey="submodule:inventory:rfq"><RFQDetailPage /></FeatureGate>} />
                <Route path="procurement/rfq/:id/compare" element={<FeatureGate flagKey="submodule:inventory:rfq"><RFQComparisonPage /></FeatureGate>} />
                <Route path="procurement/quality" element={<FeatureGate flagKey="submodule:inventory:quality"><QualityInspectionPage /></FeatureGate>} />
                <Route path="procurement/returns" element={<FeatureGate flagKey="submodule:inventory:returns"><VendorReturnsPage /></FeatureGate>} />
                <Route path="procurement/dashboard" element={<FeatureGate flagKey="submodule:inventory:procurement"><ProcurementDashboardPage /></FeatureGate>} />
                <Route path="procurement/reports" element={<FeatureGate flagKey="submodule:inventory:procurement"><ProcurementReportsPage /></FeatureGate>} />
                <Route path="procurement/vendor-performance" element={<FeatureGate flagKey="submodule:inventory:procurement"><VendorPerformancePage /></FeatureGate>} />
                <Route path="procurement/sales-demand" element={<FeatureGate flagKey="submodule:inventory:procurement"><SalesDemandPage /></FeatureGate>} />
                <Route path="vendors" element={<VendorListPage />} />
                <Route path="vendors/:id" element={<VendorDetailPage />} />
                <Route path="vendors/contracts" element={<ContractsPage />} />

                {/* Legacy Redirects */}
                <Route path="products" element={<Navigate to="../items" replace />} />
                <Route path="products/:id" element={<Navigate to="../../items/:id" replace />} />
            </Routes>
        </Layout>
    );
};

export default App;
