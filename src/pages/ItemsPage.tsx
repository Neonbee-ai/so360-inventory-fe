import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Item } from '../types/inventory';
import PhotoAttentionIndicator from '../components/media/PhotoAttentionIndicator';
import { useAuth } from '../hooks/useAuth';
import { useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { QuotaBar, QuotaGate, FeatureGate, ListPageTemplate, DataTable, Button, SearchInput, StatusBadge, Badge, EmptyState, Alert, Tooltip, type DataTableColumn, type FilterValues } from '@so360/design-system';

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

    const TYPE_LABEL: Record<string, string> = {
        product: 'Product', consumable: 'Consumable', fixed_asset: 'Fixed Asset', raw_material: 'Raw Material',
        finished_good: 'Finished Good', service: 'Service', bundle: 'Bundle',
    };
    const TYPE_TONE: Record<string, 'primary' | 'warning' | 'success' | 'info' | 'neutral'> = {
        product: 'primary', raw_material: 'warning', finished_good: 'success', fixed_asset: 'info',
    };

    const columns: DataTableColumn<Item>[] = [
        {
            key: 'name',
            header: 'Item & SKU',
            alwaysVisible: true,
            render: (item) => (
                <div className="flex flex-col">
                    <span className="text-nb-body font-semibold text-fg flex items-center gap-nb-2">
                        {item.name}
                        <PhotoAttentionIndicator needsAttention={item.image_needs_attention} />
                    </span>
                    <span className="text-nb-caption text-fg-subtle font-mono">{item.sku || 'NO-SKU'}</span>
                </div>
            ),
        },
        {
            key: 'type',
            header: 'Type',
            render: (item) => <Badge tone={TYPE_TONE[item.type] ?? 'neutral'}>{TYPE_LABEL[item.type] ?? item.type}</Badge>,
        },
        { key: 'category', header: 'Category', render: (item) => <span className="text-fg-muted">{item.item_categories?.name || 'Uncategorized'}</span> },
        { key: 'uom', header: 'UoM', render: (item) => <span className="text-fg-muted">{item.units?.abbreviation || '-'}</span> },
        {
            key: 'tracking',
            header: 'Tracking',
            render: (item) => (
                <div className="flex gap-nb-1">
                    {item.is_batch_tracked && <Badge tone="warning" size="sm">Batch</Badge>}
                    {item.is_serial_tracked && <Badge tone="primary" size="sm">Serial</Badge>}
                    {!item.is_batch_tracked && !item.is_serial_tracked && <span className="text-fg-subtle">-</span>}
                </div>
            ),
        },
        { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.is_active ? 'Active' : 'Inactive'} /> },
    ];

    const filterValues: FilterValues = {
        type: typeFilter === 'All' ? null : typeFilter,
        attention: attentionOnly || null,
    };
    const handleFilterChange = (v: FilterValues) => {
        setTypeFilter((typeof v.type === 'string' && v.type ? v.type : 'All') as typeof typeFilter);
        setAttentionOnly(v.attention === true);
    };
    const visibleItems = isSandboxMode ? filteredItems.slice(0, sandboxEntryLimit) : filteredItems;
    const importAllowed = can('items.import');
    const createAllowed = can('items.create');

    return (
        <ListPageTemplate
            trail={[]}
            title="Items"
            description="Manage physical products and trackable assets"
            headerSecondaryActions={importAllowed ? [
                <FeatureGate key="bulk" state={bulkImportState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <Tooltip content="Upload a CSV of items, name image files after the SKU, preview the rows, then confirm.">
                        <Button variant="secondary" onClick={() => navigate('/inventory/items/bulk-import')}><Upload size={16} />
                            Bulk Import
                        </Button>
                    </Tooltip>
                </FeatureGate>,
            ] : undefined}
            primaryAction={createAllowed ? (
                <FeatureGate state={createItemState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <QuotaGate
                        quotaKey="max_skus"
                        moduleCode="inventory"
                        used={totalItemCount ?? quotaData?.current_usage ?? 0}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        disableOnExceeded
                    >
                        <Button onClick={() => navigate('/inventory/items/new')}><Plus size={18} />
                            Register Item
                        </Button>
                    </QuotaGate>
                </FeatureGate>
            ) : undefined}
            search={<SearchInput placeholder="Search SKU or Item Name..." value={searchTerm} onChange={setSearchTerm} />}
            filterConfig={{
                fields: [
                    {
                        key: 'type', label: 'Type', type: 'select',
                        options: [
                            { value: 'product', label: 'Products' },
                            { value: 'consumable', label: 'Consumables' },
                            { value: 'fixed_asset', label: 'Fixed Assets' },
                            { value: 'raw_material', label: 'Raw Materials' },
                            { value: 'finished_good', label: 'Finished Goods' },
                            { value: 'bundle', label: 'Bundles' },
                            { value: 'service', label: 'Services' },
                        ],
                    },
                    { key: 'attention', label: 'Photos need attention', type: 'boolean' },
                ],
                values: filterValues,
                onChange: handleFilterChange,
                onClear: () => { setTypeFilter('All'); setAttentionOnly(false); },
            }}
            loading={isLoading && items.length === 0}
        >
            {quotaData && totalItemCount !== null && (
                <div className="mb-nb-4">
                    <QuotaBar label="SKUs" used={totalItemCount} limit={quotaData.limit} isUnlimited={quotaData.is_unlimited} />
                </div>
            )}
            {error && <Alert variant="error" className="mb-nb-4">{error}</Alert>}
            {isSandboxMode && isLimited(filteredItems.length) && (
                <Alert variant="warning" title="Sandbox mode" className="mb-nb-4">
                    showing {sandboxEntryLimit} of {filteredItems.length} items — full list visible in production.
                </Alert>
            )}
            <DataTable
                columns={columns}
                rows={visibleItems}
                rowKey={(item) => item.id}
                loading={isLoading && items.length === 0}
                onRowClick={(item) => navigate(`/inventory/items/${item.id}`)}
                getRowProps={(item) => ({ 'data-testid': `row-${item.id}` })}
                emptyState={
                    <EmptyState
                        title={attentionOnly
                            ? 'No items with photos that need attention.'
                            : 'No items found. Register your first item to start tracking inventory.'}
                    />
                }
            />
        </ListPageTemplate>
    );
};

export default ItemsPage;
