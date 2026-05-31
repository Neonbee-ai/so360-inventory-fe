import React, { useState, useEffect } from 'react';
import { Search, MapPin, Clock, AlertTriangle, Box, X, RefreshCcw, BookOpen } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { StockBalance } from '../types/inventory';
import { Table } from '../components/common/Table';
import { useInventoryFormatters } from '../utils/formatters';
import { useShellBridge } from '@so360/shell-context';

const PAGE_SIZE = 25;

const StockOverviewPage = () => {
    const formatters = useInventoryFormatters();
    const shell = useShellBridge();
    const canViewGlValuation = (shell?.isFeatureEnabled?.('action:inventory:stock:gl_valuation') ?? true);
    const [stockLevels, setStockLevels] = useState<StockBalance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [locationFilter, setLocationFilter] = useState('All');
    const [lowStockFilter, setLowStockFilter] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [glValuation, setGlValuation] = useState<{ gl_balance: number; source: string } | null>(null);

    const fetchStock = async () => {
        setIsLoading(true);
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
        const pollInterval = setInterval(fetchStock, 60 * 1000);
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
    const showStart = filteredStock.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const showEnd = Math.min(currentPage * PAGE_SIZE, filteredStock.length);

    const uniqueLocations = Array.from(new Set(stockLevels.map(sl => sl.warehouses?.name).filter(Boolean)));

    const columns = [
        {
            header: 'Item',
            accessor: (sl: StockBalance) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center border border-slate-700">
                        <Box size={16} className="text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-white text-sm">{sl.items?.name || 'Unknown Item'}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{sl.items?.sku || '-'}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Warehouse',
            accessor: (sl: StockBalance) => (
                <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin size={14} className="text-slate-500" />
                    <span>{sl.warehouses?.name || 'Unknown Location'}</span>
                    {sl.warehouse_locations && (
                        <span className="text-[10px] text-slate-500 bg-slate-800 px-1 rounded">
                            {sl.warehouse_locations.name}
                        </span>
                    )}
                </div>
            )
        },
        {
            header: 'Quantity',
            accessor: (sl: StockBalance) => {
                const threshold = sl.items?.min_stock_threshold;
                const isLow = threshold != null && sl.quantity < threshold;
                return (
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-lg ${isLow ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {sl.quantity}
                        </span>
                        <span className="text-xs text-slate-500 uppercase">{sl.items?.units?.abbreviation || 'PCS'}</span>
                        {isLow && (
                            <div className="group relative">
                                <AlertTriangle size={14} className="text-amber-500" />
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'Value (FIFO/W.Avg)',
            accessor: (sl: StockBalance) => (
                <span className="text-slate-300 font-mono text-sm">
                    {formatters.formatCurrency(sl.valuation || 0)}
                </span>
            )
        },
        {
            header: 'Last Update',
            accessor: (sl: StockBalance) => (
                <div className="flex items-center gap-1.5 text-slate-400 text-xs text-right">
                    <Clock size={12} />
                    <span>{new Date(sl.last_updated_at).toLocaleDateString()}</span>
                </div>
            )
        }
    ];

    return (
        <div className="p-8">
            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span>{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="hover:text-rose-300 transition-colors">
                        <X size={16} />
                    </button>
                </div>
            )}

            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Stock Overview</h1>
                    <p className="text-slate-400 mt-1">Real-time physical stock levels and valuation</p>
                </div>
                <button
                    onClick={() => { setError(null); fetchStock(); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700 hover:text-slate-50 transition-all text-sm font-medium"
                >
                    <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-slate-900/40 border border-slate-800/50 p-4 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Positions</span>
                    <div className="text-xl font-bold text-white mt-0.5">{stockLevels.length}</div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/50 p-4 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Stock Value</span>
                    <div className="text-xl font-bold text-blue-400 mt-0.5">
                        {formatters.formatCurrency(stockLevels.reduce((sum, sl) => sum + (sl.valuation || 0), 0))}
                    </div>
                </div>
                {canViewGlValuation && (
                <div className="bg-slate-900/40 border border-slate-800/50 p-4 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <BookOpen size={10} /> GL Balance
                    </span>
                    {glValuation?.source === 'accounting_gl' ? (
                        <>
                            <div className="text-xl font-bold text-emerald-400 mt-0.5">
                                {formatters.formatCurrency(glValuation.gl_balance)}
                            </div>
                            {(() => {
                                const stockVal = stockLevels.reduce((sum, sl) => sum + (sl.valuation || 0), 0);
                                const drift = Math.abs(stockVal - glValuation.gl_balance);
                                return drift > 0.01 ? (
                                    <span className="text-[10px] text-amber-400">
                                        Drift: {formatters.formatCurrency(drift)}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-emerald-500">In sync</span>
                                );
                            })()}
                        </>
                    ) : (
                        <div className="text-sm text-slate-500 mt-0.5">Unavailable</div>
                    )}
                </div>
                )}
                <div className="bg-slate-900/40 border border-slate-800/50 p-4 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Low Stock</span>
                    <div className="text-xl font-bold text-amber-400 mt-0.5">
                        {stockLevels.filter(sl =>
                            sl.items?.min_stock_threshold != null &&
                            sl.quantity < sl.items.min_stock_threshold
                        ).length}
                    </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/50 p-4 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Stock Out</span>
                    <div className="text-xl font-bold text-rose-400 mt-0.5">
                        {stockLevels.filter(sl => sl.quantity === 0).length}
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                    <input
                        type="text"
                        placeholder="Filter by item or SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 pl-12 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-slate-200"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1">
                        <MapPin size={16} className="text-slate-500" />
                        <select
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="bg-transparent text-sm text-slate-300 focus:outline-none py-1.5 cursor-pointer"
                        >
                            <option value="All">All Warehouses</option>
                            {uniqueLocations.map(loc => (
                                <option key={loc} value={loc!}>{loc}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setLowStockFilter(!lowStockFilter)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-medium ${lowStockFilter
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                    >
                        <AlertTriangle size={16} />
                        Low Stock Only
                    </button>
                </div>
            </div>

            <Table
                data={paginatedData}
                columns={columns}
                isLoading={isLoading}
                emptyMessage="No stock balances found. Perform an adjustment or transfer to see stock here."
            />

            {filteredStock.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
                    <span>Showing {showStart}–{showEnd} of {filteredStock.length} positions</span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:text-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-slate-500">Page {currentPage} of {totalPages}</span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:text-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockOverviewPage;
