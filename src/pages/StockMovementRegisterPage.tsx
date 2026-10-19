import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Plus, MapPin, AlertCircle, Package, Search, X,
    ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, ArrowRightLeft,
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { StockMovement, Item, Warehouse } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { useInventoryFormatters } from '../utils/formatters';
import { optional, validateReference } from '../utils/validators';
import {
    FeatureGate, ListPageTemplate, DataTable, Button, IconButton, Modal, TextField, Textarea, Select,
    SegmentedControl, Alert, Card, EmptyState,
    type DataTableColumn,
} from '@so360/design-system';

type TransactionType = 'stock_in' | 'stock_out' | 'adjustment' | 'transfer';

/**
 * Sources that represent a document-backed movement with an outside party.
 * A vendor receipt or a customer issue without a reference (PO-1001, GRN-00012)
 * cannot be traced back to anything, so the party field is mandatory for these.
 */
const PARTY_REQUIRED_SOURCES = new Set(['supplier', 'vendor', 'customer']);

/**
 * How each stored movement_type is presented in the register. Transfers and
 * adjustments are fundamentally different transactions — one relocates stock
 * and leaves company totals untouched, the other changes them — so they get
 * distinct colours rather than a shared grey row that has to be read carefully.
 */
const MOVEMENT_BADGES: Record<string, { label: string; className: string }> = {
    transfer: { label: 'TRANSFER', className: 'bg-primary/10 text-primary border-primary/30' },
    adjustment: { label: 'ADJUSTMENT', className: 'bg-warning/10 text-warning border-warning/30' },
    inbound: { label: 'RECEIPT', className: 'bg-success/10 text-success border-success/30' },
    purchase_receipt: { label: 'RECEIPT', className: 'bg-success/10 text-success border-success/30' },
    outbound: { label: 'ISSUE', className: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    sales_issue: { label: 'ISSUE', className: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    production: { label: 'PRODUCTION', className: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    production_receipt: { label: 'PRODUCTION', className: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    production_consumption: { label: 'PRODUCTION', className: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    return: { label: 'RETURN', className: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
};

const badgeFor = (movementType?: string | null) =>
    MOVEMENT_BADGES[(movementType || '').toLowerCase()] || {
        label: (movementType || 'MOVEMENT').replace(/_/g, ' ').toUpperCase(),
        className: 'bg-surface-high text-fg-muted border-line-strong',
    };

/** Human label for a reason code — falls back to the raw code, never blank. */
const REASON_LABELS: Record<string, string> = {
    PURCHASE_RECEIPT: 'Purchase Receipt',
    PRODUCTION_COMPLETION: 'Production Completion',
    CUSTOMER_RETURN: 'Customer Return',
    TRANSFER_IN: 'Stock Transfer In',
    ADJUSTMENT_INCREASE: 'Adjustment Increase',
    MATERIAL_ISSUE: 'Material Issue',
    SALES_DISPATCH: 'Sales Dispatch',
    PROJECT_CONSUMPTION: 'Project Consumption',
    WORK_ORDER_ISSUE: 'Work Order Issue',
    DAMAGE: 'Damage',
    SAMPLE_ISSUE: 'Sample Issue',
    PHYSICAL_VERIFICATION: 'Physical Verification',
    CYCLE_COUNT: 'Cycle Count',
    CORRECTION_ENTRY: 'Correction Entry',
    SHRINKAGE: 'Shrinkage',
    EXCESS_STOCK: 'Excess Stock',
};

const reasonLabel = (code?: string | null) =>
    code ? REASON_LABELS[code] || code.replace(/_/g, ' ') : null;

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
            <div className="flex w-full items-center justify-between rounded-nb-md border border-line-strong bg-surface-raised px-nb-4 py-nb-2">
                <span className="text-fg">{itemName}</span>
                <IconButton
                    label="Clear item"
                    variant="ghost"
                    size="sm"
                    icon={<X size={16} />}
                    onClick={() => { onSelect(null); setQuery(''); setOpen(true); }}
                />
            </div>
        );
    }

    return (
        <div className="relative">
            <TextField
                name="item-search"
                type="text"
                disabled={disabled}
                placeholder="Search by item code or name..."
                aria-label="Search items"
                leadingIcon={Search}
                value={query}
                onFocus={() => setOpen(true)}
                onChange={(e: any) => setQuery(e.target.value)}
            />
            {open && (
                <div className="absolute z-20 mt-nb-1 max-h-56 w-full overflow-y-auto rounded-nb-md border border-line-strong bg-surface-raised shadow-overlay">
                    {searching && <div className="px-nb-4 py-nb-2 text-nb-caption text-fg-muted">Searching…</div>}
                    {!searching && results.length === 0 && (
                        <div className="px-nb-4 py-nb-2 text-nb-caption text-fg-muted">No items found</div>
                    )}
                    {results.map((i) => (
                        <Button
                            key={i.id}
                            type="button"
                            variant="ghost"
                            className="w-full justify-start text-left"
                            onClick={() => { onSelect(i); setOpen(false); }}
                        >
                            <span className="font-medium">{i.name}</span>
                            <span className="ml-nb-2 text-nb-caption text-fg-muted">{i.sku}</span>
                        </Button>
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
    // Loading and failure are distinct from "empty": an unreachable Projects or
    // Manufacturing module must never be reported to the user as "no active
    // projects available", which is a claim about their data.
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState(false);
    const [workOrdersLoading, setWorkOrdersLoading] = useState(true);
    const [workOrdersError, setWorkOrdersError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            const page = await inventoryService.getMovements(active);
            setMovements(page.data || []);
        } catch {
            setError('Failed to load stock movements');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => { fetchMovements(); }, [fetchMovements]);

    const loadProjects = useCallback(async () => {
        setProjectsLoading(true);
        setProjectsError(false);
        try {
            setProjects((await inventoryService.searchProjects()) || []);
        } catch {
            setProjects([]);
            setProjectsError(true);
        } finally {
            setProjectsLoading(false);
        }
    }, []);

    const loadWorkOrders = useCallback(async () => {
        setWorkOrdersLoading(true);
        setWorkOrdersError(false);
        try {
            setWorkOrders((await inventoryService.searchWorkOrders()) || []);
        } catch {
            setWorkOrders([]);
            setWorkOrdersError(true);
        } finally {
            setWorkOrdersLoading(false);
        }
    }, []);

    useEffect(() => {
        (async () => {
            const [whData, defaults] = await Promise.all([
                inventoryService.getLocations().catch(() => []),
                inventoryService.getOrgDefaultLogic().catch(() => null),
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
        })();
        loadProjects();
        loadWorkOrders();
    }, [loadProjects, loadWorkOrders]);

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

    /**
     * Quantity rules per transaction type. Only an adjustment carries a sign —
     * it is the one transaction that can go either way. For every other type a
     * negative entry is a data-entry error, not an instruction to flip direction.
     */
    const quantityError = useMemo<string | null>(() => {
        const raw = form.quantity.trim();
        if (!raw) return 'Quantity is required.';
        const n = Number(raw);
        if (!Number.isFinite(n)) return 'Quantity must be a number.';
        if (n === 0) return 'Quantity must be greater than zero.';
        if (form.transaction_type !== 'adjustment' && n < 0) {
            return 'Quantity must be greater than zero. Use the Adjustment type to record a decrease.';
        }
        return null;
    }, [form.quantity, form.transaction_type]);

    /**
     * The signed effect on the source warehouse, or null when the quantity is
     * not usable. Returning null rather than a coerced number is the fix for
     * the register's arithmetic bug: a "-8" typed into a Stock In used to be
     * silently `Math.abs`-ed to +8, so a balance of 5 previewed as 13. Now the
     * projection refuses to render until the quantity itself is valid.
     */
    const signedQuantity = useMemo<number | null>(() => {
        if (quantityError) return null;
        const n = Number(form.quantity);
        if (form.transaction_type === 'stock_in') return n;
        if (form.transaction_type === 'stock_out') return -n;
        if (form.transaction_type === 'transfer') return -n;
        return n; // adjustment: the signed value is the user's intent
    }, [form.transaction_type, form.quantity, quantityError]);

    const projectedBalance = useMemo(() => {
        if (currentBalance === null || signedQuantity === null) return null;
        return currentBalance + signedQuantity;
    }, [currentBalance, signedQuantity]);

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
    const requiresParty = PARTY_REQUIRED_SOURCES.has(form.source_type);
    const isTransfer = form.transaction_type === 'transfer';

    /**
     * One place that decides what is wrong with the form. The modal renders
     * each entry beneath its own field and the submit button reads the same map,
     * so a message can never appear without the field it belongs to being blocked.
     */
    const fieldErrors = useMemo<Record<string, string | null>>(() => ({
        item: form.item_id ? null : 'Please select an item.',
        warehouse: form.warehouse_id
            ? null
            : isTransfer
                ? 'Please select a source warehouse.'
                : 'Please select a warehouse.',
        to_warehouse: !isTransfer
            ? null
            : !form.to_warehouse_id
                ? 'Please select a destination warehouse.'
                : form.to_warehouse_id === form.warehouse_id
                    ? 'Source and destination warehouses must be different.'
                    : null,
        quantity: quantityError,
        // A transfer relocates stock and needs no reason; every other type
        // changes company-wide quantities and is unauditable without one.
        reason: isTransfer || form.reason_code ? null : 'Please select a transaction reason.',
        source_label:
            form.source_type === 'warehouse'
                ? null
                : requiresParty
                    ? validateReference(form.source_label, 'Party / Reference')
                    : optional(form.source_label, (v) => validateReference(v, 'Party / Reference')),
        project: requiresProject && !form.project_id ? 'Please select a project.' : null,
        work_order: requiresWorkOrder && !form.work_order_id ? 'Please select a work order.' : null,
        transaction_date: dateWarning,
        stock: insufficientStock
            ? `Insufficient stock available. Current balance is ${currentBalance}.`
            : null,
    }), [
        form.item_id, form.warehouse_id, form.to_warehouse_id, form.reason_code,
        form.source_type, form.source_label, form.project_id, form.work_order_id,
        isTransfer, quantityError, requiresParty, requiresProject, requiresWorkOrder,
        dateWarning, insufficientStock, currentBalance,
    ]);

    /**
     * Work orders narrowed to the chosen project. Filtering only when a project
     * is selected keeps the full list available for unallocated issues.
     */
    const availableWorkOrders = useMemo(
        () => workOrders.filter((w) => !form.project_id || w.project_id === form.project_id),
        [workOrders, form.project_id],
    );

    const [showFieldErrors, setShowFieldErrors] = useState(false);
    const firstFieldError = useMemo(
        () => Object.values(fieldErrors).find((m) => m) || null,
        [fieldErrors],
    );
    const errorFor = (field: string) =>
        showFieldErrors ? fieldErrors[field] || null : null;

    const resetForm = () => {
        setForm(emptyForm());
        setSelectedItem(null);
        setCurrentBalance(null);
        setShowFieldErrors(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (firstFieldError) {
            setShowFieldErrors(true);
            return setError(firstFieldError);
        }

        const allocation = {
            transaction_date: form.transaction_date,
            project_id: form.project_id || undefined,
            work_order_id: form.work_order_id || undefined,
            project_name_snapshot:
                projects.find((p) => p.id === form.project_id)?.title
                || projects.find((p) => p.id === form.project_id)?.name
                || undefined,
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
                    quantity: signedQuantity as number,
                    reason_code: form.reason_code,
                    transaction_type: form.transaction_type,
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

    /**
     * Pair the two legs of each transfer by their shared reference number so
     * the register can show a route instead of two unrelated-looking rows.
     * Only reference numbers with both legs loaded produce an entry.
     */
    const transferContext = useMemo(() => {
        const byRef = new Map<string, { from?: string; to?: string }>();
        for (const m of movements) {
            const type = (m.movement_type || m.type || '').toLowerCase();
            if (type !== 'transfer' || !m.reference_number) continue;
            const entry = byRef.get(m.reference_number) || {};
            const name = m.warehouses?.name;
            if (m.quantity < 0) entry.from = name;
            else entry.to = name;
            byRef.set(m.reference_number, entry);
        }
        return byRef;
    }, [movements]);

    const columns: DataTableColumn<StockMovement>[] = [
        {
            key: 'date',
            header: 'Date',
            render: (m: StockMovement) => (
                <div className="flex flex-col">
                    <span className="text-fg">
                        {formatters.formatDate(m.transaction_date || m.created_at)}
                    </span>
                    <span className="text-fg-subtle text-xs">
                        {formatters.formatDateTime(m.created_at)}
                    </span>
                </div>
            ),
        },
        {
            key: 'transaction_type',
            header: 'Transaction Type',
            render: (m: StockMovement) => {
                const badge = badgeFor(m.movement_type || (m as any).type);
                return (
                    <span
                        data-testid="movement-type-badge"
                        className={`inline-block text-[10px] font-bold tracking-wider px-2 py-1 rounded border ${badge.className}`}
                    >
                        {badge.label}
                    </span>
                );
            },
        },
        {
            key: 'reference',
            header: 'Reference',
            render: (m: StockMovement) => (
                <span className="font-mono text-fg text-xs">
                    {m.reference_number || '—'}
                </span>
            ),
        },
        {
            key: 'item',
            header: 'Item',
            render: (m: StockMovement) => (
                <div className="flex items-center gap-2">
                    <Package size={14} className="text-fg-subtle" />
                    <span className="font-semibold text-fg">{m.items?.name || '—'}</span>
                </div>
            ),
        },
        {
            key: 'warehouse',
            header: 'Warehouse',
            render: (m: StockMovement) => {
                const context = m.reference_number
                    ? transferContext.get(m.reference_number)
                    : undefined;
                // A transfer is two rows sharing one reference number. Showing
                // only this leg's warehouse forces the reader to hunt for the
                // other half, so when both legs are on screen we state the route.
                if (context?.from && context?.to) {
                    return (
                        <div className="flex items-center gap-1.5 text-fg-muted text-xs">
                            <ArrowRightLeft size={14} className="text-primary flex-shrink-0" />
                            <span>{context.from} → {context.to}</span>
                        </div>
                    );
                }
                return (
                    <div className="flex items-center gap-1.5 text-fg-muted">
                        <MapPin size={14} className="text-fg-subtle" />
                        <span>{m.warehouses?.name || '—'}</span>
                    </div>
                );
            },
        },
        {
            key: 'qty',
            header: 'Qty',
            render: (m: StockMovement) =>
                m.quantity > 0 ? (
                    <span className="text-success font-bold">+{m.quantity}</span>
                ) : (
                    <span className="text-rose-400 font-bold">{m.quantity}</span>
                ),
        },
        {
            key: 'balance',
            header: 'Balance',
            render: (m: StockMovement) =>
                m.balance_after === null || m.balance_after === undefined ? (
                    <span className="text-fg-subtle">—</span>
                ) : (
                    // before → delta → after, so a correction reads as a
                    // complete arithmetic statement (100 → -5 → 95).
                    <span data-testid="movement-balance" className="text-fg-muted text-xs whitespace-nowrap">
                        {m.balance_before ?? '—'}
                        {' → '}
                        <span className={m.quantity < 0 ? 'text-rose-400' : 'text-success'}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                        {' → '}
                        <span className="font-bold text-fg">{m.balance_after}</span>
                    </span>
                ),
        },
        {
            key: 'allocation',
            header: 'Allocation',
            render: (m: StockMovement) => (
                <div className="flex flex-col text-xs">
                    {m.project_name_snapshot && (
                        <span className="text-fg-muted">Project: {m.project_name_snapshot}</span>
                    )}
                    {m.work_order_number_snapshot && (
                        <span className="text-fg-muted">WO: {m.work_order_number_snapshot}</span>
                    )}
                    {m.source_type && (
                        <span className="text-fg-subtle capitalize">
                            {m.source_type.replace(/_/g, ' ')}
                            {m.source_label ? ` · ${m.source_label}` : ''}
                        </span>
                    )}
                    {!m.project_name_snapshot && !m.work_order_number_snapshot && !m.source_type && (
                        <span className="text-fg-subtle">—</span>
                    )}
                </div>
            ),
        },
        {
            key: 'reason_remarks',
            header: 'Reason / Remarks',
            render: (m: StockMovement) => {
                const reason = reasonLabel(m.reason_code);
                return (
                    <div className="flex flex-col text-xs max-w-[220px]">
                        {reason && (
                            <span data-testid="movement-reason" className="text-fg-muted font-medium">
                                {reason}
                            </span>
                        )}
                        {m.remarks && <span className="text-fg-subtle">{m.remarks}</span>}
                        {!reason && !m.remarks && <span className="text-fg-subtle">—</span>}
                    </div>
                );
            },
        },
    ];

    /** Error text rendered directly beneath the field it belongs to. */
    const FieldError = ({ field }: { field: string }) => {
        const message = errorFor(field);
        if (!message) return null;
        return (
            <p role="alert" data-testid={`error-${field}`} className="mt-nb-1 text-nb-caption text-danger">
                {message}
            </p>
        );
    };
    const sectionTitle = (t: string) => t;

    const filterValues: Record<string, any> = { ...filters };
    const handleFilterChange = (next: Record<string, any>) => {
        setFilters((prev) => {
            const merged: any = { ...prev };
            Object.keys(prev).forEach((k) => { merged[k] = next[k] ? String(next[k]) : ''; });
            return merged;
        });
    };
    const clearFilters = () =>
        setFilters({
            movement_type: '', reference_number: '', warehouse_id: '', project_id: '',
            work_order_id: '', source_type: '', date_from: '', date_to: '',
        });

    const typeOptions: { value: TransactionType; label: string; icon: any }[] = [
        { value: 'stock_in', label: 'Stock In', icon: ArrowDownCircle },
        { value: 'stock_out', label: 'Stock Out', icon: ArrowUpCircle },
        { value: 'adjustment', label: 'Adjustment', icon: SlidersHorizontal },
        { value: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
    ];
    const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
    const projectPlaceholder = projectsLoading
        ? 'Loading projects…'
        : projectsError
            ? 'Could not load projects.'
            : projects.length === 0
                ? 'No active projects available.'
                : 'Not linked';
    const workOrderPlaceholder = workOrdersLoading
        ? 'Loading work orders…'
        : workOrdersError
            ? 'Could not load work orders.'
            : availableWorkOrders.length === 0
                ? 'No active work orders available.'
                : 'Not linked';

    return (
        <ListPageTemplate
            title="Stock Transactions"
            description="Inventory movement register — every movement traceable end to end"
            primaryAction={
                can('stock.adjust') ? (
                    <FeatureGate
                        state={adjustStockState}
                        loading={shell?.effectiveFlagsLoaded === false}
                        onUpgradeClick={() => navigate('/org/billing')}
                    >
                        <Button
                            variant="primary"
                            onClick={() => { resetForm(); setIsModalOpen(true); }}
                        ><Plus size={16} />
                            New Transaction
                        </Button>
                    </FeatureGate>
                ) : undefined
            }
            filterConfig={{
                fields: [
                    {
                        key: 'movement_type', label: 'Movement Type', type: 'select',
                        options: [
                            { value: 'inbound', label: 'Inbound' },
                            { value: 'outbound', label: 'Outbound' },
                            { value: 'adjustment', label: 'Adjustment' },
                            { value: 'transfer', label: 'Transfer' },
                        ],
                    },
                    {
                        key: 'reference_number', label: 'Reference Number', type: 'custom',
                        render: (v: any, set: (n: any) => void) => (
                            <TextField
                                name="filter-reference"
                                type="text"
                                value={typeof v === 'string' ? v : ''}
                                placeholder="STK-…"
                                onChange={(e: any) => set(e.target.value || null)}
                            />
                        ),
                    },
                    { key: 'warehouse_id', label: 'Warehouse', type: 'select', options: warehouseOptions },
                    { key: 'source_type', label: 'Source', type: 'select', options: SOURCE_TYPES.map((s) => ({ value: s.value, label: s.label })) },
                    { key: 'project_id', label: 'Project', type: 'select', options: projects.map((p) => ({ value: p.id, label: p.title || p.name })) },
                    { key: 'work_order_id', label: 'Work Order', type: 'select', options: workOrders.map((w) => ({ value: w.id, label: w.code || w.id })) },
                    { key: 'date_from', label: 'From Date', type: 'date' },
                    { key: 'date_to', label: 'To Date', type: 'date' },
                ],
                values: filterValues,
                onChange: handleFilterChange,
                onClear: clearFilters,
            }}
            loading={isLoading}
        >
            {error && !isModalOpen && <Alert variant="error" className="mb-nb-4">{error}</Alert>}

            <DataTable
                columns={columns}
                rows={movements}
                rowKey={(m: StockMovement) => m.id}
                loading={isLoading}
                emptyState=<EmptyState title="No stock movements found." />
            />

            <Modal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Record Stock Transaction"
                size="xl"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            type="submit"
                            form="stock-transaction-form"
                            disabled={isSubmitting || insufficientStock || !!dateWarning}
                            loading={isSubmitting}
                        >
                            {isSubmitting ? 'Recording…' : 'Record Transaction'}
                        </Button>
                    </div>
                }
            >
                <form id="stock-transaction-form" onSubmit={handleSubmit} className="flex flex-col gap-nb-5 text-fg">
                    {error && <Alert variant="error">{error}</Alert>}

                    <Card title={sectionTitle('Transaction Information')}>
                        <div className="grid grid-cols-1 gap-nb-4 md:grid-cols-3">
                            <div className="md:col-span-2">
                                <p className="mb-nb-1 text-nb-caption font-medium text-fg-muted">Transaction Type *</p>
                                <SegmentedControl
                                    aria-label="Transaction type"
                                    fullWidth
                                    value={form.transaction_type}
                                    onChange={(val: string) => setForm({ ...form, transaction_type: val as TransactionType, reason_code: '' })}
                                    options={typeOptions.map((t) => ({ value: t.value, label: t.label }))}
                                />
                            </div>
                            <div>
                                <TextField
                                    name="transaction-date"
                                    label="Transaction Date"
                                    required
                                    type="date"
                                    value={form.transaction_date}
                                    aria-label="Transaction date"
                                    onChange={(e: any) => setForm({ ...form, transaction_date: e.target.value })}
                                />
                                {dateWarning && (
                                    <p role="alert" data-testid="error-transaction_date" className="mt-nb-1 text-nb-caption text-warning">
                                        {dateWarning}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="mt-nb-4 grid grid-cols-1 gap-nb-4 md:grid-cols-2">
                            {form.transaction_type !== 'transfer' && (
                                <div>
                                    <Select
                                        name="reason"
                                        label="Reason *"
                                        aria-label="Reason"
                                        value={form.reason_code}
                                        onChange={(e: any) => setForm({ ...form, reason_code: e.target.value })}
                                        options={[
                                            { value: '', label: 'Select reason…' },
                                            ...REASON_CODES[form.transaction_type].map((r) => ({ value: r.value, label: r.label })),
                                        ]}
                                    />
                                    <FieldError field="reason" />
                                </div>
                            )}
                            <TextField name="reference-number" label="Reference Number" disabled value="Auto-generated on save" onChange={() => {}} />
                        </div>
                    </Card>

                    <Card title={sectionTitle('Item Details')}>
                        <div className="grid grid-cols-1 gap-nb-4 md:grid-cols-3">
                            <div className="md:col-span-2">
                                <p className="mb-nb-1 text-nb-caption font-medium text-fg-muted">Item *</p>
                                <ItemSearchSelect
                                    value={form.item_id}
                                    itemName={selectedItem ? `${selectedItem.name} (${selectedItem.sku})` : ''}
                                    onSelect={(item) => {
                                        setSelectedItem(item);
                                        setForm((f) => ({ ...f, item_id: item?.id || '' }));
                                    }}
                                />
                                <FieldError field="item" />
                            </div>
                            <TextField
                                name="unit"
                                label="Unit"
                                disabled
                                value={(selectedItem as any)?.units?.abbreviation || (selectedItem as any)?.unit || '—'}
                                onChange={() => {}}
                            />
                        </div>
                    </Card>

                    <Card title={sectionTitle('Movement Details')}>
                        <div className="grid grid-cols-1 gap-nb-4 md:grid-cols-3">
                            <div>
                                <Select
                                    name="warehouse"
                                    label={form.transaction_type === 'transfer' ? 'Source Warehouse *' : 'Warehouse *'}
                                    aria-label="Warehouse"
                                    value={form.warehouse_id}
                                    onChange={(e: any) => setForm({ ...form, warehouse_id: e.target.value })}
                                    options={[{ value: '', label: 'Select warehouse…' }, ...warehouseOptions]}
                                />
                                <FieldError field="warehouse" />
                            </div>
                            {form.transaction_type === 'transfer' && (
                                <div>
                                    <Select
                                        name="to-warehouse"
                                        label="Destination Warehouse *"
                                        aria-label="Destination warehouse"
                                        value={form.to_warehouse_id}
                                        onChange={(e: any) => setForm({ ...form, to_warehouse_id: e.target.value })}
                                        options={[{ value: '', label: 'Select destination…' }, ...warehouseOptions]}
                                    />
                                    <FieldError field="to_warehouse" />
                                </div>
                            )}
                            <div>
                                <TextField
                                    name="quantity"
                                    label={form.transaction_type === 'adjustment' ? 'Quantity * (signed)' : 'Quantity *'}
                                    type="number"
                                    step="any"
                                    min={form.transaction_type === 'adjustment' ? undefined : 0}
                                    value={form.quantity}
                                    aria-label="Quantity"
                                    onChange={(e: any) => {
                                        setForm({ ...form, quantity: e.target.value });
                                        setShowFieldErrors(true);
                                    }}
                                />
                                <FieldError field="quantity" />
                            </div>
                        </div>
                        <div className="mt-nb-4 grid grid-cols-2 gap-nb-4">
                            <div className="rounded-nb-md bg-surface-sunken px-nb-4 py-nb-3">
                                <p className="text-nb-caption uppercase tracking-wide text-fg-subtle">Current Balance</p>
                                <p className="text-nb-h3 font-bold text-fg">{currentBalance === null ? '—' : currentBalance}</p>
                            </div>
                            <div className={`rounded-nb-md px-nb-4 py-nb-3 ${insufficientStock ? 'border border-danger bg-danger-soft' : 'bg-surface-sunken'}`}>
                                <p className="text-nb-caption uppercase tracking-wide text-fg-subtle">Updated Balance</p>
                                <p className={`text-nb-h3 font-bold ${insufficientStock ? 'text-danger' : 'text-fg'}`}>
                                    {projectedBalance === null ? '—' : projectedBalance}
                                </p>
                            </div>
                        </div>
                        {insufficientStock && (
                            <p role="alert" data-testid="error-stock" className="mt-nb-2 flex items-center gap-nb-2 text-nb-caption text-danger">
                                <AlertCircle size={14} />
                                {fieldErrors.stock} Enable negative inventory in Inventory Settings to allow this.
                            </p>
                        )}
                    </Card>

                    <Card title={sectionTitle('Allocation')}>
                        <div className="grid grid-cols-1 gap-nb-4 md:grid-cols-2">
                            <Select
                                name="source-type"
                                label={form.transaction_type === 'stock_in' ? 'Received From' : 'Issued To'}
                                aria-label="Movement source"
                                value={form.source_type}
                                onChange={(e: any) => setForm({ ...form, source_type: e.target.value, source_ref_id: '', source_label: '' })}
                                options={[{ value: '', label: 'Select source…' }, ...SOURCE_TYPES.map((s) => ({ value: s.value, label: s.label }))]}
                            />
                            <div>
                                {form.source_type === 'warehouse' ? (
                                    <Select
                                        name="source-party"
                                        label={`Source warehouse${requiresParty ? ' *' : ''}`}
                                        aria-label="Source party"
                                        value={form.source_ref_id}
                                        onChange={(e: any) => setForm({ ...form, source_ref_id: e.target.value })}
                                        options={[{ value: '', label: 'Select warehouse…' }, ...warehouseOptions]}
                                    />
                                ) : (
                                    <TextField
                                        name="source-label"
                                        label={`Party / Reference${requiresParty ? ' *' : ''}`}
                                        type="text"
                                        placeholder="Name or reference"
                                        value={form.source_label}
                                        aria-label="Source party label"
                                        onChange={(e: any) => {
                                            setForm({ ...form, source_label: e.target.value });
                                            setShowFieldErrors(true);
                                        }}
                                    />
                                )}
                                <FieldError field="source_label" />
                            </div>
                            <div>
                                <Select
                                    name="project"
                                    label={`Project${requiresProject ? ' *' : ''}`}
                                    aria-label="Project"
                                    value={form.project_id}
                                    onChange={(e: any) => setForm({ ...form, project_id: e.target.value, work_order_id: '' })}
                                    disabled={projectsLoading || projectsError || projects.length === 0}
                                    options={[
                                        { value: '', label: projectPlaceholder },
                                        ...projects.map((p) => ({ value: p.id, label: p.title || p.name })),
                                    ]}
                                />
                                {projectsError && (
                                    <Button type="button" variant="ghost" size="sm" onClick={loadProjects}>
                                        Projects lookup failed — retry
                                    </Button>
                                )}
                                <FieldError field="project" />
                            </div>
                            <div>
                                <Select
                                    name="work-order"
                                    label={`Work Order${requiresWorkOrder ? ' *' : ''}`}
                                    aria-label="Work order"
                                    value={form.work_order_id}
                                    onChange={(e: any) => setForm({ ...form, work_order_id: e.target.value })}
                                    disabled={workOrdersLoading || workOrdersError || availableWorkOrders.length === 0}
                                    options={[
                                        { value: '', label: workOrderPlaceholder },
                                        ...availableWorkOrders.map((w) => ({
                                            value: w.id,
                                            label: [w.code || w.order_number || w.id, w.item_name || w.description, w.status]
                                                .filter(Boolean)
                                                .join(' · '),
                                        })),
                                    ]}
                                />
                                {workOrdersError && (
                                    <Button type="button" variant="ghost" size="sm" onClick={loadWorkOrders}>
                                        Work orders lookup failed — retry
                                    </Button>
                                )}
                                <FieldError field="work_order" />
                            </div>
                        </div>
                    </Card>

                    <Card title={sectionTitle('Remarks')}>
                        <Textarea
                            name="remarks"
                            rows={3}
                            value={form.remarks}
                            aria-label="Remarks"
                            onChange={(e: any) => setForm({ ...form, remarks: e.target.value })}
                            placeholder="Issue notes, adjustment reason, damage details, return reason…"
                        />
                    </Card>

                    <Alert variant="info" title="Audit Trail">
                        A reference number and running balance are recorded automatically and cannot be edited.
                    </Alert>
                </form>
            </Modal>
        </ListPageTemplate>
    );
};

export default StockMovementRegisterPage;
