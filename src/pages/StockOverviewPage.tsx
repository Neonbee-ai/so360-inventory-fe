import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { StockBalance } from '../types/inventory';
import { useInventoryFormatters } from '../utils/formatters';
import { useShellBridge } from '@so360/shell-context';
import { FeatureGate, ListPageTemplate, DataTable, Button, SearchInput, KpiCard, Grid, Badge, Alert, EmptyState, Pagination, type DataTableColumn, type FilterValues } from '@so360/design-system';

const PAGE_SIZE = 25;

const StockOverviewPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const shell = useShellBridge();
    const viewGlValuationState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:stock:gl_valuation') : 'enabled';
    const [stockLevels, setStockLevels] = useState<StockBalance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [locationFilter, setLocationFilter] = useState('All');
    const [lowStockFilter, setLowStockFilter] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [glValuation, setGlValuation] = useState<{ gl_balance: number; source: string } | null>(null);

    // `showSkeleton` toggles the table-replacing skeleton. It stays true for the
    // first load and manual refresh, but background poll ticks pass false so the
    // table is refreshed in place instead of flashing back to a skeleton every
    // minute. Same data, no flash.
    const fetchStock = async (showSkeleton = true) => {
        if (showSkeleton) setIsLoading(true);
        setError(null);
        try {
            const [stockLevelsData, glData] = await Promise.all([
                inventoryService.getStockOverview(),
                inventoryService.getGLInventoryValuation(),
            ]);
            setStockLevels(stockLevelsData);
            setGlValuation(glData);
        } catch (err) {
            console.error('Failed to fetch stock levels', err);
            setError('Failed to load stock data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
        // Skip the 60s refresh while the tab is hidden so backgrounded tabs stop
        // polling the stock endpoint.
        const pollInterval = setInterval(() => {
            if (!document.hidden) fetchStock(false);
        }, 60 * 1000);
        return () => clearInterval(pollInterval);
    }, []);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, locationFilter, lowStockFilter]);

    const filteredStock = stockLevels.filter(sl => {
        const item = sl.items;
        const warehouse = sl.warehouses;
        const matchesSearch =
            item?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
        const matchesLocation = locationFilter === 'All' || warehouse?.name === locationFilter;
        const matchesLowStock = !lowStockFilter ||
            (sl.items?.min_stock_threshold != null && sl.quantity < sl.items.min_stock_threshold);
        return matchesSearch && matchesLocation && matchesLowStock;
    });

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredStock.length / PAGE_SIZE));
    const paginatedData = filteredStock.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const uniqueLocations = Array.from(new Set(stockLevels.map(sl => sl.warehouses?.name).filter(Boolean)));

    const isLowRow = (sl: StockBalance) => sl.items?.min_stock_threshold != null && sl.quantity < sl.items.min_stock_threshold;

    const columns: DataTableColumn<StockBalance>[] = [
        {
            key: 'item',
            header: 'Item',
            alwaysVisible: true,
            render: (sl) => (
                <div className="flex flex-col">
                    <span className="text-nb-body font-semibold text-fg">{sl.items?.name || 'Unknown Item'}</span>
                    <span className="text-nb-caption text-fg-subtle font-mono">{sl.items?.sku || '-'}</span>
                </div>
            ),
        },
        {
            key: 'warehouse',
            header: 'Warehouse',
            render: (sl) => (
                <div className="flex items-center gap-nb-2 text-fg-muted">
                    <span>{sl.warehouses?.name || 'Unknown Location'}</span>
                    {sl.warehouse_locations && <Badge size="sm">{sl.warehouse_locations.name}</Badge>}
                </div>
            ),
        },
        {
            key: 'quantity',
            header: 'Quantity',
            align: 'right',
            render: (sl) => (
                <div className="flex items-center justify-end gap-nb-2">
                    <span className={`text-nb-body font-semibold tabular-nums ${isLowRow(sl) ? 'text-danger' : 'text-success'}`}>{sl.quantity}</span>
                    <span className="text-nb-caption text-fg-subtle">{sl.items?.units?.abbreviation || 'PCS'}</span>
                    {isLowRow(sl) && <Badge tone="warning" size="sm">Low</Badge>}
                </div>
            ),
        },
        {
            key: 'valuation',
            header: 'Value (FIFO/W.Avg)',
            align: 'right',
            render: (sl) => <span className="text-fg-muted tabular-nums">{formatters.formatCurrency(sl.valuation || 0)}</span>,
        },
        {
            key: 'last_updated_at',
            header: 'Last Update',
            render: (sl) => <span className="text-fg-muted text-nb-sm">{formatters.formatDate(sl.last_updated_at)}</span>,
        },
    ];

    const totalValue = stockLevels.reduce((sum, sl) => sum + (sl.valuation || 0), 0);
    const drift = glValuation ? Math.abs(totalValue - glValuation.gl_balance) : 0;
    const filterValues: FilterValues = {
        warehouse: locationFilter === 'All' ? null : locationFilter,
        lowStock: lowStockFilter || null,
    };

    const kpis = (
        <Grid columns={5} gap="md">
            <KpiCard label="Total Positions" value={stockLevels.length} />
            <KpiCard label="Stock Value" value={formatters.formatCurrency(totalValue)} />
            <FeatureGate state={viewGlValuationState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                <KpiCard
                    label="GL Balance"
                    value={glValuation?.source === 'accounting_gl' ? formatters.formatCurrency(glValuation.gl_balance) : 'Unavailable'}
                    hint={glValuation?.source === 'accounting_gl' ? (drift > 0.01 ? `Drift: ${formatters.formatCurrency(drift)}` : 'In sync') : undefined}
                />
            </FeatureGate>
            <KpiCard label="Low Stock" value={stockLevels.filter(isLowRow).length} />
            <KpiCard label="Stock Out" value={stockLevels.filter(sl => sl.quantity === 0).length} />
        </Grid>
    );

    return (
        <ListPageTemplate trail={[]}
            title="Stock Overview"
            description="Real-time physical stock levels and valuation"
            headerSecondaryActions={[
                <Button key="refresh" variant="secondary" onClick={() => { setError(null); fetchStock(); }}><RefreshCcw size={16} />
                    Refresh
                </Button>,
            ]}
            kpis={kpis}
            search={<SearchInput placeholder="Filter by item or SKU..." value={searchTerm} onChange={setSearchTerm} />}
            filterConfig={{
                fields: [
                    { key: 'warehouse', label: 'Warehouse', type: 'select', options: uniqueLocations.map(loc => ({ value: loc as string, label: loc as string })) },
                    { key: 'lowStock', label: 'Low Stock Only', type: 'boolean' },
                ],
                values: filterValues,
                onChange: (v) => {
                    setLocationFilter(typeof v.warehouse === 'string' && v.warehouse ? v.warehouse : 'All');
                    setLowStockFilter(v.lowStock === true);
                },
                onClear: () => { setLocationFilter('All'); setLowStockFilter(false); },
            }}
            pagination={filteredStock.length > PAGE_SIZE ? (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredStock.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setCurrentPage}
                />
            ) : undefined}
        >
            {error && <Alert variant="error" className="mb-nb-4">{error}</Alert>}
            <DataTable
                columns={columns}
                rows={paginatedData}
                rowKey={(sl) => sl.id}
                loading={isLoading}
                emptyState=<EmptyState title="No stock balances found. Perform an adjustment or transfer to see stock here." />
            />
        </ListPageTemplate>
    );
};

export default StockOverviewPage;
