import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, Package, Layers, AlertCircle, Flame, Building2, Factory, Wrench } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Item } from '../types/inventory';
import { Table } from '../components/common/Table';
import { useAuth } from '../hooks/useAuth';
import { useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { QuotaBar, QuotaGate, FeatureGate } from '@so360/design-system';

const ItemsPage = () => {
    const navigate = useNavigate();
    const { can } = useAuth();
    const shell = useShellBridge();
    const createItemState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:items:create') : 'enabled';
    const quotaChecks = useMemo(() => [{ module_code: 'inventory', quota_key: 'max_skus' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_skus');
    const { isSandboxMode, sandboxEntryLimit, isLimited } = useSandboxLimit();
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'All' | 'product' | 'service' | 'raw_material' | 'finished_good' | 'consumable' | 'fixed_asset'>('All');
    const [error, setError] = useState<string | null>(null);

    const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await inventoryService.getItems();
            setItems(response.data || []);
        } catch (err) {
            setError('Failed to load items. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const filteredItems = items.filter(item => {
        const matchesSearch =
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
        const matchesType = typeFilter === 'All' || item.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const columns = [
        {
            header: 'Item & SKU',
            accessor: (item: Item) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                        {item.type === 'product' && <Package size={20} className="text-blue-400" />}
                        {item.type === 'consumable' && <Flame size={20} className="text-orange-400" />}
                        {item.type === 'fixed_asset' && <Building2 size={20} className="text-teal-400" />}
                        {item.type === 'raw_material' && <Layers size={20} className="text-amber-400" />}
                        {item.type === 'finished_good' && <Factory size={20} className="text-emerald-400" />}
                        {item.type === 'service' && <Wrench size={20} className="text-purple-400" />}
                        {!['product','consumable','fixed_asset','raw_material','finished_good','service'].includes(item.type) && <Package size={20} className="text-slate-400" />}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-slate-50">{item.name}</span>
                        <span className="text-xs text-slate-500 font-mono tracking-wider">{item.sku || 'NO-SKU'}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Type',
            accessor: (item: Item) => (
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold border capitalize ${
                    item.type === 'product' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    item.type === 'consumable' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    item.type === 'fixed_asset' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                    item.type === 'raw_material' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    item.type === 'finished_good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                    {item.type === 'fixed_asset' ? 'Fixed Asset' : item.type === 'raw_material' ? 'Raw Material' : item.type === 'finished_good' ? 'Finished Good' : item.type}
                </span>
            )
        },
        {
            header: 'Category',
            accessor: (item: Item) => <span className="text-slate-400">{item.item_categories?.name || 'Uncategorized'}</span>
        },
        {
            header: 'UoM',
            accessor: (item: Item) => <span className="text-slate-400">{item.units?.abbreviation || '-'}</span>
        },
        {
            header: 'Tracking',
            accessor: (item: Item) => (
                <div className="flex gap-1">
                    {item.is_batch_tracked && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold uppercase">Batch</span>
                    )}
                    {item.is_serial_tracked && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-bold uppercase">Serial</span>
                    )}
                    {!item.is_batch_tracked && !item.is_serial_tracked && <span className="text-slate-600 text-[10px]">-</span>}
                </div>
            )
        },
        {
            header: 'Status',
            accessor: (item: Item) => (
                <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold border ${item.is_active
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
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
                    <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Items</h1>
                    <p className="text-slate-400 mt-1">Manage physical products and trackable assets</p>
                </div>
                {can('create_item') && (
                    <FeatureGate state={createItemState} onUpgradeClick={() => navigate('/org/billing')}>
                    <QuotaGate
                        quotaKey="max_skus"
                        moduleCode="inventory"
                        used={quotaData?.current_usage ?? 0}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        disableOnExceeded
                    >
                        <button
                            onClick={() => navigate('/inventory/items/new')}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                        >
                            <Plus size={20} />
                            Register Item
                        </button>
                    </QuotaGate>
                    </FeatureGate>
                )}
            </header>

            {quotaData && (
                <QuotaBar
                    label="SKUs"
                    used={quotaData.current_usage}
                    limit={quotaData.limit}
                    isUnlimited={quotaData.is_unlimited}
                />
            )}

            {error && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                    <input
                        type="text"
                        placeholder="Search SKU or Item Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 pl-12 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-slate-200"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1">
                        <Filter size={16} className="text-slate-500" />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="bg-transparent text-sm text-slate-300 focus:outline-none py-1.5 cursor-pointer"
                        >
                            <option value="All">All Types</option>
                            <option value="product">Products</option>
                            <option value="consumable">Consumables</option>
                            <option value="fixed_asset">Fixed Assets</option>
                            <option value="raw_material">Raw Materials</option>
                            <option value="finished_good">Finished Goods</option>
                            <option value="service">Services</option>
                        </select>
                    </div>
                </div>
            </div>

            {isSandboxMode && isLimited(filteredItems.length) && (
                <div className="mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm flex items-center gap-2">
                    <span className="font-semibold">Sandbox mode:</span>
                    showing {sandboxEntryLimit} of {filteredItems.length} items — full list visible in production.
                </div>
            )}

            <Table
                data={isSandboxMode ? filteredItems.slice(0, sandboxEntryLimit) : filteredItems}
                columns={columns}
                isLoading={isLoading}
                onRowClick={(item) => navigate(`/inventory/items/${item.id}`)}
                emptyMessage="No items found. Register your first item to start tracking inventory."
            />

        </div>
    );
};

export default ItemsPage;
