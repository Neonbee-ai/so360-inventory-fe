import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, Package, Layers, AlertCircle, AlertTriangle, Flame, Building2, Factory, Wrench, Upload, Info } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Item } from '../types/inventory';
import { Table } from '../components/common/Table';
import PhotoAttentionIndicator from '../components/media/PhotoAttentionIndicator';
import { useAuth } from '../hooks/useAuth';
import { useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { QuotaBar, QuotaGate, FeatureGate } from '@so360/design-system';

const ItemsPage = () => {
    const navigate = useNavigate();
    const { can } = useAuth();
    const shell = useShellBridge();
    const createItemState = (shell?.permissionsLoaded === true && (shell?.hasPermission?.('items.create') ?? false)) ? ((shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:items:create') : 'enabled') : 'hidden';
    const bulkImportState = (shell?.permissionsLoaded === true && (shell?.hasPermission?.('items.import') ?? false)) ? ((shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:bulk_import') : 'enabled') : 'hidden';
    const quotaChecks = useMemo(() => [{ module_code: 'inventory', quota_key: 'max_skus' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_skus');
    const { isSandboxMode, sandboxEntryLimit, isLimited } = useSandboxLimit();
    const [items, setItems] = useState<Item[]>([]);
    const [totalItemCount, setTotalItemCount] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'All' | 'product' | 'service' | 'raw_material' | 'finished_good' | 'consumable' | 'fixed_asset'>('All');
    const [attentionOnly, setAttentionOnly] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // "Photos need attention" asks the API to filter, so flagged items
            // beyond the first page are found too.
            const response = attentionOnly
                ? await inventoryService.getItems({ imageNeedsAttention: true, limit: 1000 })
                : await inventoryService.getItems();
            setItems(response.data || []);
            if (!attentionOnly) {
                setTotalItemCount(response.pagination?.total ?? (response.data?.length ?? 0));
            }
        } catch (err) {
            setError('Failed to load items. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [attentionOnly]);

    const filteredItems = items.filter(item => {
        const matchesSearch =
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
        const matchesType = typeFilter === 'All' || item.type === typeFilter;
        // Also checked here: until the flag exists the API ignores the filter
        // and returns everything.
        const matchesAttention = !attentionOnly || item.image_needs_attention === true;
        return matchesSearch && matchesType && matchesAttention;
    });

    const columns = [
        {
            header: 'Item & SKU',
            accessor: (item: Item) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-raised flex items-center justify-center border border-line-strong">
                        {item.type === 'product' && <Package size={20} className="text-primary" />}
                        {item.type === 'consumable' && <Flame size={20} className="text-orange-400" />}
                        {item.type === 'fixed_asset' && <Building2 size={20} className="text-teal-400" />}
                        {item.type === 'raw_material' && <Layers size={20} className="text-warning" />}
                        {item.type === 'finished_good' && <Factory size={20} className="text-success" />}
                        {item.type === 'service' && <Wrench size={20} className="text-purple-400" />}
                        {!['product','consumable','fixed_asset','raw_material','finished_good','service'].includes(item.type) && <Package size={20} className="text-fg-muted" />}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-fg flex items-center gap-2">
                            {item.name}
                            <PhotoAttentionIndicator needsAttention={item.image_needs_attention} />
                        </span>
                        <span className="text-xs text-fg-subtle font-mono tracking-wider">{item.sku || 'NO-SKU'}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Type',
            accessor: (item: Item) => (
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold border capitalize ${
                    item.type === 'product' ? 'bg-primary/10 text-primary border-primary/20' :
                    item.type === 'consumable' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    item.type === 'fixed_asset' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                    item.type === 'raw_material' ? 'bg-warning/10 text-warning border-warning/20' :
                    item.type === 'finished_good' ? 'bg-success/10 text-success border-success/20' :
                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                    {item.type === 'fixed_asset' ? 'Fixed Asset' : item.type === 'raw_material' ? 'Raw Material' : item.type === 'finished_good' ? 'Finished Good' : item.type}
                </span>
            )
        },
        {
            header: 'Category',
            accessor: (item: Item) => <span className="text-fg-muted">{item.item_categories?.name || 'Uncategorized'}</span>
        },
        {
            header: 'UoM',
            accessor: (item: Item) => <span className="text-fg-muted">{item.units?.abbreviation || '-'}</span>
        },
        {
            header: 'Tracking',
            accessor: (item: Item) => (
                <div className="flex gap-1">
                    {item.is_batch_tracked && (
                        <span className="px-1.5 py-0.5 rounded bg-warning/10 text-amber-500 border border-warning/20 text-[9px] font-bold uppercase">Batch</span>
                    )}
                    {item.is_serial_tracked && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase">Serial</span>
                    )}
                    {!item.is_batch_tracked && !item.is_serial_tracked && <span className="text-fg-subtle text-[10px]">-</span>}
                </div>
            )
        },
        {
            header: 'Status',
            accessor: (item: Item) => (
                <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold border ${item.is_active
                    ? 'bg-success/10 text-success border-success/20'
                    : 'bg-fg-subtle/10 text-fg-muted border-line-strong/20'
                    }`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                </span>
            )
        }
    ];

    return (
        <div className="p-8">
            <header className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-fg tracking-tight">Items</h1>
                    <p className="text-fg-muted mt-1">Manage physical products and trackable assets</p>
                </div>
                <div className="flex items-center gap-3">
                {can('items.import') && (
                    <FeatureGate state={bulkImportState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                        <div className="relative group/tooltip">
                            <button
                                onClick={() => navigate('/inventory/items/bulk-import')}
                                className="flex items-center gap-2 bg-surface-raised hover:bg-line-strong border border-line-strong text-fg-muted hover:text-fg px-4 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-95"
                            >
                                <Upload size={16} />
                                Bulk Import
                                <Info size={13} className="text-fg-subtle group-hover/tooltip:text-fg-muted ml-0.5" />
                            </button>
                            {/* Tooltip */}
                            <div className="absolute right-0 top-full mt-2 w-72 z-50 hidden group-hover/tooltip:block">
                                <div className="bg-surface-raised border border-line-strong rounded-xl shadow-2xl p-4 text-xs text-fg-muted space-y-2.5">
                                    <p className="font-semibold text-fg text-sm">How to bulk import</p>
                                    <div className="w-full h-px bg-line-strong" />
                                    <ol className="space-y-2 list-none">
                                        <li className="flex gap-2.5">
                                            <span className="w-5 h-5 rounded-full bg-primary/30 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                                            <span>Prepare a <strong className="text-fg">CSV file</strong> with item details — name, SKU, price, category and more.</span>
                                        </li>
                                        <li className="flex gap-2.5">
                                            <span className="w-5 h-5 rounded-full bg-primary/30 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                                            <span>Name your <strong className="text-fg">image files</strong> to match the SKU — e.g. <span className="font-mono text-primary bg-surface px-1 rounded">WA-001.jpg</span> for SKU <span className="font-mono text-primary bg-surface px-1 rounded">WA-001</span>.</span>
                                        </li>
                                        <li className="flex gap-2.5">
                                            <span className="w-5 h-5 rounded-full bg-primary/30 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                                            <span>Upload CSV → upload images → <strong className="text-fg">preview rows</strong> → confirm import.</span>
                                        </li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </FeatureGate>
                )}
                {can('items.create') && (
                    <FeatureGate state={createItemState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <QuotaGate
                        quotaKey="max_skus"
                        moduleCode="inventory"
                        used={totalItemCount ?? quotaData?.current_usage ?? 0}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        disableOnExceeded
                    >
                        <button
                            onClick={() => navigate('/inventory/items/new')}
                            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg px-4 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                        >
                            <Plus size={20} />
                            Register Item
                        </button>
                    </QuotaGate>
                    </FeatureGate>
                )}
                </div>
            </header>

            {quotaData && totalItemCount !== null && (
                <div className="mb-6">
                    <QuotaBar
                        label="SKUs"
                        used={totalItemCount}
                        limit={quotaData.limit}
                        isUnlimited={quotaData.is_unlimited}
                    />
                </div>
            )}

            {error && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" size={18} />
                    <input
                        type="text"
                        placeholder="Search SKU or Item Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface/50 border border-line pl-12 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-focus/50 focus:border-primary transition-all text-fg"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        aria-pressed={attentionOnly}
                        onClick={() => setAttentionOnly(v => !v)}
                        title="Items with a photo under 800px or far from square"
                        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm border transition-colors ${
                            attentionOnly
                                ? 'bg-warning/15 border-warning/40 text-warning'
                                : 'bg-surface/50 border-line text-fg-muted hover:text-fg'
                        }`}
                    >
                        <AlertTriangle size={15} />
                        Photos need attention
                    </button>
                    <div className="flex items-center gap-2 bg-surface/50 border border-line rounded-lg px-3 py-1">
                        <Filter size={16} className="text-fg-subtle" />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="bg-transparent text-sm text-fg-muted focus:outline-none py-1.5 cursor-pointer"
                        >
                            <option value="All">All Types</option>
                            <option value="product">Products</option>
                            <option value="consumable">Consumables</option>
                            <option value="fixed_asset">Fixed Assets</option>
                            <option value="raw_material">Raw Materials</option>
                            <option value="finished_good">Finished Goods</option>
                            <option value="bundle">Bundles</option>
                            <option value="service">Services</option>
                        </select>
                    </div>
                </div>
            </div>

            {isSandboxMode && isLimited(filteredItems.length) && (
                <div className="mb-4 px-4 py-2.5 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm flex items-center gap-2">
                    <span className="font-semibold">Sandbox mode:</span>
                    showing {sandboxEntryLimit} of {filteredItems.length} items — full list visible in production.
                </div>
            )}

            <Table
                data={isSandboxMode ? filteredItems.slice(0, sandboxEntryLimit) : filteredItems}
                columns={columns}
                isLoading={isLoading}
                onRowClick={(item) => navigate(`/inventory/items/${item.id}`)}
                emptyMessage={attentionOnly
                    ? 'No items with photos that need attention.'
                    : 'No items found. Register your first item to start tracking inventory.'}
            />

        </div>
    );
};

export default ItemsPage;
