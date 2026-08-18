import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Plus, History, MapPin, AlertCircle, Package, Search, X,
    ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, ArrowRightLeft, CheckCircle2,
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { StockMovement, Item, Warehouse } from '../types/inventory';
import { Table } from '../components/common/Table';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { useInventoryFormatters } from '../utils/formatters';
import { FeatureGate } from '@so360/design-system';

type TransactionType = 'stock_in' | 'stock_out' | 'adjustment' | 'transfer';

const SOURCE_TYPES = [
    { value: 'supplier', label: 'Supplier' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'employee', label: 'Employee' },
    { value: 'customer', label: 'Customer' },
    { value: 'production', label: 'Production' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'project_site', label: 'Project Site' },
];

const REASON_CODES: Record<TransactionType, { value: string; label: string }[]> = {
    stock_in: [
        { value: 'PURCHASE_RECEIPT', label: 'Purchase Receipt' },
        { value: 'PRODUCTION_COMPLETION', label: 'Production Completion' },
        { value: 'CUSTOMER_RETURN', label: 'Customer Return' },
        { value: 'TRANSFER_IN', label: 'Stock Transfer In' },
        { value: 'ADJUSTMENT_INCREASE', label: 'Adjustment Increase' },
    ],
    stock_out: [
        { value: 'MATERIAL_ISSUE', label: 'Material Issue' },
        { value: 'SALES_DISPATCH', label: 'Sales Dispatch' },
        { value: 'PROJECT_CONSUMPTION', label: 'Project Consumption' },
        { value: 'WORK_ORDER_ISSUE', label: 'Work Order Issue' },
        { value: 'DAMAGE', label: 'Damage' },
        { value: 'SAMPLE_ISSUE', label: 'Sample Issue' },
    ],
    adjustment: [
        { value: 'PHYSICAL_VERIFICATION', label: 'Physical Verification' },
        { value: 'CYCLE_COUNT', label: 'Cycle Count' },
        { value: 'CORRECTION_ENTRY', label: 'Correction Entry' },
        { value: 'SHRINKAGE', label: 'Shrinkage' },
        { value: 'EXCESS_STOCK', label: 'Excess Stock' },
    ],
    transfer: [],
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
    transaction_type: 'stock_in' as TransactionType,
    transaction_date: today(),
    reason_code: '',
    item_id: '',
    warehouse_id: '',
    to_warehouse_id: '',
    quantity: '' as string,
    project_id: '',
    work_order_id: '',
    source_type: '',
    source_ref_id: '',
    source_label: '',
    remarks: '',
});

/** Debounced typeahead over the item master. */
const ItemSearchSelect = ({
    value, itemName, onSelect, disabled,
}: {
    value: string;
    itemName: string;
    onSelect: (item: Item | null) => void;
    disabled?: boolean;
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Item[]>([]);
    const [open, setOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const timer = useRef<any>(null);

    useEffect(() => {
        if (!open) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await inventoryService.getItems(
                    query ? { search: query, limit: 25 } : { limit: 25 },
                );
                setResults(res?.data || []);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [query, open]);

    if (value && !open) {
        return (
            <div className="flex items-center justify-between w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
                <span className="text-slate-50">{itemName}</span>
                <button
                    type="button"
                    aria-label="Clear item"
                    onClick={() => { onSelect(null); setQuery(''); setOpen(true); }}
                    className="text-slate-400 hover:text-slate-50"
                >
                    <X size={16} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/50">
                <Search size={16} className="text-slate-500" />
                <input
                    type="text"
                    disabled={disabled}
                    placeholder="Search by item code or name..."
                    aria-label="Search items"
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 bg-transparent focus:outline-none text-slate-50"
                />
            </div>
            {open && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                    {searching && <div className="px-4 py-2 text-slate-400 text-sm">Searching…</div>}
                    {!searching && results.length === 0 && (
                        <div className="px-4 py-2 text-slate-400 text-sm">No items found</div>
                    )}
                    {results.map((i) => (
                        <button
                            key={i.id}
                            type="button"
                            onClick={() => { onSelect(i); setOpen(false); }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-100"
                        >
                            <span className="font-medium">{i.name}</span>
                            <span className="text-slate-400 text-xs ml-2">{i.sku}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const StockMovementRegisterPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { can } = useAuth();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const formatters = useInventoryFormatters();
    const adjustStockState = (shell?.permissionsLoaded === true && (shell?.hasPermission?.('stock.adjust') ?? false))
        ? ((shell as any)?.getFeatureState
            ? (shell as any).getFeatureState('action:inventory:stock:adjust')
            : 'enabled')
        : 'hidden';

    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const [orgDefaults, setOrgDefaults] = useState({
        allow_negative_stock: false,
        allow_backdated_transactions: false,
        backdate_max_days: 0,
        allow_future_dated_transactions: false,
    });

    const [filters, setFilters] = useState({
        movement_type: searchParams.get('type') || '',
        reference_number: '',
        warehouse_id: '',
        project_id: '',
        work_order_id: '',
        source_type: '',
        date_from: '',
        date_to: '',
    });

    const [form, setForm] = useState(emptyForm());
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);

    const fetchMovements = useCallback(async () => {
        setIsLoading(true);
        try {
            const active = Object.fromEntries(
                Object.entries(filters).filter(([, v]) => v),
            );
            const data = await inventoryService.getMovements(active);
            setMovements(data || []);
        } catch {
            setError('Failed to load stock movements');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => { fetchMovements(); }, [fetchMovements]);

    useEffect(() => {
        (async () => {
            const [whData, defaults, projectList, woList] = await Promise.all([
                inventoryService.getLocations().catch(() => []),
                inventoryService.getOrgDefaultLogic().catch(() => null),
                inventoryService.searchProjects(),
                inventoryService.searchWorkOrders(),
            ]);
            setWarehouses(whData || []);
            if (defaults) {
                setOrgDefaults({
                    allow_negative_stock: !!defaults.allow_negative_stock,
                    allow_backdated_transactions: !!defaults.allow_backdated_transactions,
                    backdate_max_days: defaults.backdate_max_days ?? 0,
                    allow_future_dated_transactions: !!defaults.allow_future_dated_transactions,
                });
            }
            setProjects(projectList);
            setWorkOrders(woList);
        })();
    }, []);

    // Live balance for the selected item + warehouse
    useEffect(() => {
        if (!form.item_id || !form.warehouse_id) {
            setCurrentBalance(null);
            return;
        }
        let cancelled = false;
        inventoryService
            .getStockAvailability(form.item_id, form.warehouse_id)
            .then((res) => {
                if (!cancelled) {
                    const val = res?.available ?? res?.total_quantity ?? (res as any)?.total ?? 0;
                    setCurrentBalance(Number(val) || 0);
                }
            })
            .catch(() => !cancelled && setCurrentBalance(null));
        return () => { cancelled = true; };
    }, [form.item_id, form.warehouse_id]);

    const quantityNum = Number(form.quantity) || 0;

    const signedQuantity = useMemo(() => {
        if (form.transaction_type === 'stock_in') return Math.abs(quantityNum);
        if (form.transaction_type === 'stock_out') return -Math.abs(quantityNum);
        return quantityNum; // adjustment accepts a signed value; transfer uses positive
    }, [form.transaction_type, quantityNum]);

    const projectedBalance = useMemo(() => {
        if (currentBalance === null) return null;
        if (form.transaction_type === 'transfer') return currentBalance - Math.abs(quantityNum);
        return currentBalance + signedQuantity;
    }, [currentBalance, signedQuantity, quantityNum, form.transaction_type]);

    const insufficientStock =
        projectedBalance !== null &&
        projectedBalance < 0 &&
        !orgDefaults.allow_negative_stock;

    const dateWarning = useMemo(() => {
        if (!form.transaction_date) return null;
        if (form.transaction_date > today() && !orgDefaults.allow_future_dated_transactions) {
            return 'Future-dated transactions are not enabled for this organization.';
        }
        if (form.transaction_date < today() && !orgDefaults.allow_backdated_transactions) {
            return 'Backdated transactions are not enabled for this organization.';
        }
        return null;
    }, [form.transaction_date, orgDefaults]);

    const requiresWorkOrder = form.source_type === 'production';
    const requiresProject = form.source_type === 'project_site';

    const resetForm = () => {
        setForm(emptyForm());
        setSelectedItem(null);
        setCurrentBalance(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.item_id) return setError('Item is required');
        if (quantityNum === 0) return setError('Quantity must be greater than zero');
        if (form.transaction_type !== 'adjustment' && quantityNum < 0) {
            return setError('Quantity must be a positive number');
        }
        if (dateWarning) return setError(dateWarning);
        if (insufficientStock) {
            return setError(
                `Insufficient stock: available ${currentBalance}, requested ${Math.abs(quantityNum)}`,
            );
        }
        if (requiresWorkOrder && !form.work_order_id) {
            return setError('Work Order is required for production movements');
        }
        if (requiresProject && !form.project_id) {
            return setError('Project is required for project-site movements');
        }
        if (form.transaction_type === 'transfer') {
            if (!form.to_warehouse_id) return setError('Destination warehouse is required');
            if (form.warehouse_id === form.to_warehouse_id) {
                return setError('Source and destination warehouses must be different');
            }
        }

        const allocation = {
            transaction_date: form.transaction_date,
            project_id: form.project_id || undefined,
            work_order_id: form.work_order_id || undefined,
            project_name_snapshot:
                projects.find((p) => p.id === form.project_id)?.name || undefined,
            work_order_number_snapshot:
                workOrders.find((w) => w.id === form.work_order_id)?.code || undefined,
            source_type: form.source_type || undefined,
            source_ref_id: form.source_ref_id || undefined,
            source_label: form.source_label || undefined,
            remarks: form.remarks || undefined,
        };

        setIsSubmitting(true);
        try {
            if (form.transaction_type === 'transfer') {
                await inventoryService.createTransfer({
                    item_id: form.item_id,
                    from_warehouse_id: form.warehouse_id,
                    to_warehouse_id: form.to_warehouse_id,
                    quantity: Math.abs(quantityNum),
                    ...allocation,
                });
            } else {
                await inventoryService.createAdjustment({
                    item_id: form.item_id,
                    warehouse_id: form.warehouse_id,
                    quantity: signedQuantity,
                    reason_code: form.reason_code || undefined,
                    ...allocation,
                });
            }
            recordActivity({
                eventType: 'movement.recorded',
                eventCategory: 'inventory',
                description: `${form.transaction_type} of ${Math.abs(quantityNum)} for "${selectedItem?.name || 'item'}"`,
                resourceType: 'stock_movement',
            }).catch(() => {});
            setIsModalOpen(false);
            resetForm();
            fetchMovements();
        } catch (err: any) {
            setError(err.message || 'Failed to record stock transaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns = [
        {
            header: 'Date',
            accessor: (m: StockMovement) => (
                <div className="flex flex-col">
                    <span className="text-slate-200">
                        {formatters.formatDate(m.transaction_date || m.created_at)}
                    </span>
                    <span className="text-slate-500 text-xs">
                        {formatters.formatDateTime(m.created_at)}
                    </span>
                </div>
            ),
        },
        {
            header: 'Reference',
            accessor: (m: StockMovement) => (
                <div className="flex flex-col">
                    <span className="font-mono text-slate-200 text-xs">
                        {m.reference_number || '—'}
                    </span>
                    <span className="text-slate-500 text-xs capitalize">
                        {(m.movement_type || m.type || '').replace(/_/g, ' ')}
                    </span>
                </div>
            ),
        },
        {
            header: 'Item',
            accessor: (m: StockMovement) => (
                <div className="flex items-center gap-2">
                    <Package size={14} className="text-slate-500" />
                    <span className="font-semibold text-slate-50">{m.items?.name || '—'}</span>
                </div>
            ),
        },
        {
            header: 'Warehouse',
            accessor: (m: StockMovement) => (
                <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin size={14} className="text-slate-500" />
                    <span>{m.warehouses?.name || '—'}</span>
                </div>
            ),
        },
        {
            header: 'Qty',
            accessor: (m: StockMovement) =>
                m.quantity > 0 ? (
                    <span className="text-emerald-400 font-bold">+{m.quantity}</span>
                ) : (
                    <span className="text-rose-400 font-bold">{m.quantity}</span>
                ),
        },
        {
            header: 'Balance',
            accessor: (m: StockMovement) =>
                m.balance_after === null || m.balance_after === undefined ? (
                    <span className="text-slate-600">—</span>
                ) : (
                    <span className="text-slate-300">
                        {m.balance_before ?? '—'} → <span className="font-bold text-slate-50">{m.balance_after}</span>
                    </span>
                ),
        },
        {
            header: 'Allocation',
            accessor: (m: StockMovement) => (
                <div className="flex flex-col text-xs">
                    {m.project_name_snapshot && (
                        <span className="text-slate-300">Project: {m.project_name_snapshot}</span>
                    )}
                    {m.work_order_number_snapshot && (
                        <span className="text-slate-300">WO: {m.work_order_number_snapshot}</span>
                    )}
                    {m.source_type && (
                        <span className="text-slate-500 capitalize">
                            {m.source_type.replace(/_/g, ' ')}
                            {m.source_label ? ` · ${m.source_label}` : ''}
                        </span>
                    )}
                    {!m.project_name_snapshot && !m.work_order_number_snapshot && !m.source_type && (
                        <span className="text-slate-600">—</span>
                    )}
                </div>
            ),
        },
        {
            header: 'Remarks',
            accessor: (m: StockMovement) => (
                <span className="text-slate-400 text-xs">{m.remarks || m.reason_code || '—'}</span>
            ),
            className: 'max-w-[220px]',
        },
    ];

    const inputClass =
        'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50';
    const labelClass = 'block text-sm font-medium text-slate-400 mb-1.5';
    const sectionClass = 'border border-slate-800 rounded-xl p-4 bg-slate-900/40 space-y-4';
    const sectionTitle = 'text-xs font-bold uppercase tracking-wide text-slate-400';

    return (
        <div className="p-8">
            <header className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
                        <History className="text-blue-500" /> Stock Transactions
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Inventory movement register — every movement traceable end to end
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters((s) => !s)}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2.5 rounded-lg font-semibold transition-all"
                    >
                        <SlidersHorizontal size={18} />
                        Filters
                    </button>
                    {can('create_adjustment') && (
                        <FeatureGate
                            state={adjustStockState}
                            loading={shell?.effectiveFlagsLoaded === false}
                            onUpgradeClick={() => navigate('/org/billing')}
                        >
                            <button
                                onClick={() => { resetForm(); setIsModalOpen(true); }}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                            >
                                <Plus size={20} />
                                New Transaction
                            </button>
                        </FeatureGate>
                    )}
                </div>
            </header>

            {error && !isModalOpen && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {showFilters && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                    <div>
                        <label className={labelClass}>Movement Type</label>
                        <select
                            value={filters.movement_type}
                            aria-label="Filter movement type"
                            onChange={(e) => setFilters({ ...filters, movement_type: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">All</option>
                            <option value="inbound">Inbound</option>
                            <option value="outbound">Outbound</option>
                            <option value="adjustment">Adjustment</option>
                            <option value="transfer">Transfer</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Reference Number</label>
                        <input
                            type="text"
                            value={filters.reference_number}
                            onChange={(e) => setFilters({ ...filters, reference_number: e.target.value })}
                            placeholder="STK-…"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Warehouse</label>
                        <select
                            value={filters.warehouse_id}
                            aria-label="Filter warehouse"
                            onChange={(e) => setFilters({ ...filters, warehouse_id: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">All</option>
                            {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Source</label>
                        <select
                            value={filters.source_type}
                            aria-label="Filter source"
                            onChange={(e) => setFilters({ ...filters, source_type: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">All</option>
                            {SOURCE_TYPES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Project</label>
                        <select
                            value={filters.project_id}
                            aria-label="Filter project"
                            onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">All</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Work Order</label>
                        <select
                            value={filters.work_order_id}
                            aria-label="Filter work order"
                            onChange={(e) => setFilters({ ...filters, work_order_id: e.target.value })}
                            className={inputClass}
                        >
                            <option value="">All</option>
                            {workOrders.map((w) => (
                                <option key={w.id} value={w.id}>{w.code || w.id}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>From Date</label>
                        <input
                            type="date"
                            value={filters.date_from}
                            aria-label="Filter from date"
                            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>To Date</label>
                        <input
                            type="date"
                            value={filters.date_to}
                            aria-label="Filter to date"
                            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                            className={inputClass}
                        />
                    </div>
                </div>
            )}

            <Table
                data={movements}
                columns={columns}
                isLoading={isLoading}
                emptyMessage="No stock movements found."
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Record Stock Transaction"
                size="xl"
            >
                <form onSubmit={handleSubmit} className="space-y-5 text-slate-200">
                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3 text-sm">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Section 1 — Transaction Information */}
                    <section className={sectionClass}>
                        <h4 className={sectionTitle}>Transaction Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className={labelClass}>Transaction Type *</label>
                                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-800 rounded-lg border border-slate-700">
                                    {([
                                        ['stock_in', 'Stock In', ArrowDownCircle],
                                        ['stock_out', 'Stock Out', ArrowUpCircle],
                                        ['adjustment', 'Adjustment', SlidersHorizontal],
                                        ['transfer', 'Transfer', ArrowRightLeft],
                                    ] as [TransactionType, string, any][]).map(([val, label, Icon]) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setForm({ ...form, transaction_type: val, reason_code: '' })}
                                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                                                form.transaction_type === val
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <Icon size={14} /> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Transaction Date *</label>
                                <input
                                    required
                                    type="date"
                                    value={form.transaction_date}
                                    aria-label="Transaction date"
                                    onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                                    className={inputClass}
                                />
                                {dateWarning && (
                                    <p className="text-amber-400 text-xs mt-1">{dateWarning}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {form.transaction_type !== 'transfer' && (
                                <div>
                                    <label className={labelClass}>Reason</label>
                                    <select
                                        value={form.reason_code}
                                        aria-label="Reason"
                                        onChange={(e) => setForm({ ...form, reason_code: e.target.value })}
                                        className={inputClass}
                                    >
                                        <option value="">Select reason…</option>
                                        {REASON_CODES[form.transaction_type].map((r) => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className={labelClass}>Reference Number</label>
                                <input
                                    disabled
                                    value="Auto-generated on save"
                                    className={`${inputClass} opacity-60 cursor-not-allowed`}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2 — Item Details */}
                    <section className={sectionClass}>
                        <h4 className={sectionTitle}>Item Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className={labelClass}>Item *</label>
                                <ItemSearchSelect
                                    value={form.item_id}
                                    itemName={selectedItem ? `${selectedItem.name} (${selectedItem.sku})` : ''}
                                    onSelect={(item) => {
                                        setSelectedItem(item);
                                        setForm((f) => ({ ...f, item_id: item?.id || '' }));
                                    }}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Unit</label>
                                <input
                                    disabled
                                    value={(selectedItem as any)?.units?.abbreviation || (selectedItem as any)?.unit || '—'}
                                    className={`${inputClass} opacity-60`}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 3 — Movement Details */}
                    <section className={sectionClass}>
                        <h4 className={sectionTitle}>Movement Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>
                                    {form.transaction_type === 'transfer' ? 'Source Warehouse *' : 'Warehouse *'}
                                </label>
                                <select
                                    required
                                    value={form.warehouse_id}
                                    aria-label="Warehouse"
                                    onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                                    className={inputClass}
                                >
                                    <option value="">Select warehouse…</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            {form.transaction_type === 'transfer' && (
                                <div>
                                    <label className={labelClass}>Destination Warehouse *</label>
                                    <select
                                        required
                                        value={form.to_warehouse_id}
                                        aria-label="Destination warehouse"
                                        onChange={(e) => setForm({ ...form, to_warehouse_id: e.target.value })}
                                        className={inputClass}
                                    >
                                        <option value="">Select destination…</option>
                                        {warehouses.map((w) => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className={labelClass}>
                                    Quantity *
                                    {form.transaction_type === 'adjustment' && (
                                        <span className="text-slate-500 font-normal"> (signed)</span>
                                    )}
                                </label>
                                <input
                                    required
                                    type="number"
                                    step="any"
                                    value={form.quantity}
                                    aria-label="Quantity"
                                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                                    className={`${inputClass} text-center font-bold`}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800/60 rounded-lg px-4 py-3">
                                <p className="text-[11px] uppercase tracking-wide text-slate-500">Current Balance</p>
                                <p className="text-lg font-bold text-slate-100">
                                    {currentBalance === null ? '—' : currentBalance}
                                </p>
                            </div>
                            <div className={`rounded-lg px-4 py-3 ${insufficientStock ? 'bg-rose-500/10 border border-rose-500/30' : 'bg-slate-800/60'}`}>
                                <p className="text-[11px] uppercase tracking-wide text-slate-500">Updated Balance</p>
                                <p className={`text-lg font-bold ${insufficientStock ? 'text-rose-400' : 'text-slate-100'}`}>
                                    {projectedBalance === null ? '—' : projectedBalance}
                                </p>
                            </div>
                        </div>
                        {insufficientStock && (
                            <p className="text-rose-400 text-xs flex items-center gap-2">
                                <AlertCircle size={14} />
                                Insufficient stock — enable negative inventory in Inventory Settings to allow this.
                            </p>
                        )}
                    </section>

                    {/* Section 4 — Allocation */}
                    <section className={sectionClass}>
                        <h4 className={sectionTitle}>Allocation</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>
                                    {form.transaction_type === 'stock_in' ? 'Received From' : 'Issued To'}
                                </label>
                                <select
                                    value={form.source_type}
                                    aria-label="Movement source"
                                    onChange={(e) => setForm({ ...form, source_type: e.target.value, source_ref_id: '', source_label: '' })}
                                    className={inputClass}
                                >
                                    <option value="">Select source…</option>
                                    {SOURCE_TYPES.map((s) => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>
                                    {form.source_type === 'warehouse' ? 'Warehouse' : 'Party / Reference'}
                                </label>
                                {form.source_type === 'warehouse' ? (
                                    <select
                                        value={form.source_ref_id}
                                        aria-label="Source party"
                                        onChange={(e) => setForm({ ...form, source_ref_id: e.target.value })}
                                        className={inputClass}
                                    >
                                        <option value="">Select warehouse…</option>
                                        {warehouses.map((w) => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Name or reference"
                                        value={form.source_label}
                                        aria-label="Source party label"
                                        onChange={(e) => setForm({ ...form, source_label: e.target.value })}
                                        className={inputClass}
                                    />
                                )}
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Project {requiresProject && <span className="text-rose-400">*</span>}
                                </label>
                                <select
                                    value={form.project_id}
                                    aria-label="Project"
                                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                                    className={inputClass}
                                >
                                    <option value="">Not linked</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Work Order {requiresWorkOrder && <span className="text-rose-400">*</span>}
                                </label>
                                <select
                                    value={form.work_order_id}
                                    aria-label="Work order"
                                    onChange={(e) => setForm({ ...form, work_order_id: e.target.value })}
                                    className={inputClass}
                                >
                                    <option value="">Not linked</option>
                                    {workOrders
                                        .filter((w) => !form.project_id || w.project_id === form.project_id)
                                        .map((w) => (
                                            <option key={w.id} value={w.id}>{w.code || w.id}</option>
                                        ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Section 5 — Remarks */}
                    <section className={sectionClass}>
                        <h4 className={sectionTitle}>Remarks</h4>
                        <textarea
                            rows={3}
                            value={form.remarks}
                            aria-label="Remarks"
                            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                            placeholder="Issue notes, adjustment reason, damage details, return reason…"
                            className={inputClass}
                        />
                    </section>

                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
                        <CheckCircle2 size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="text-[11px] text-blue-300">
                            <p className="font-bold mb-1 uppercase tracking-tight">Audit Trail</p>
                            <p className="opacity-70">
                                A reference number and running balance are recorded automatically and cannot be edited.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold py-2.5 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || insufficientStock || !!dateWarning}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-900/20"
                        >
                            {isSubmitting ? 'Recording…' : 'Record Transaction'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default StockMovementRegisterPage;
