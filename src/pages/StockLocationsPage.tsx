import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Warehouse } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import {
    firstError,
    optional,
    validateAddress,
    validateCode,
    validateName,
    validatePersonName,
    validatePhone,
    validatePlaceName,
    ValidationResult,
} from '../utils/validators';
import { useActivity, useShellBridge, useQuota } from '@so360/shell-context';
import {
    QuotaBar, QuotaGate, FeatureGate, ListPageTemplate, DataTable, Button, Modal, TextField, Select,
    Checkbox, Alert, Badge, EmptyState, Tooltip,
    type DataTableColumn,
} from '@so360/design-system';

const StockLocationsPage = () => {
    const navigate = useNavigate();
    const { can } = useAuth();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const createWarehouseState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:warehouses:create') : 'enabled';
    const canCreateWarehouse = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('warehouses.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && createWarehouseState === 'enabled';
    const quotaChecks = useMemo(() => [{ module_code: 'inventory', quota_key: 'max_warehouses' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_warehouses');
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Create form state
    const [newWarehouse, setNewWarehouse] = useState({
        name: '',
        code: '',
        address: '',
        city: '',
        state: '',
        country: '',
        contact_person: '',
        contact_phone: '',
        warehouse_type: 'general',
        is_active: true
    });
    const [isCreating, setIsCreating] = useState(false);

    // Edit state
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        code: '',
        address: '',
        city: '',
        state: '',
        country: '',
        contact_person: '',
        contact_phone: '',
        warehouse_type: 'general',
        is_active: true
    });
    const [isSaving, setIsSaving] = useState(false);

    // Delete state
    const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Which form's errors are currently allowed on screen. Errors stay hidden
    // until the user has actually tried to save that form, so an untouched
    // modal does not open covered in red.
    const [showCreateErrors, setShowCreateErrors] = useState(false);
    const [showEditErrors, setShowEditErrors] = useState(false);

    /**
     * Warehouse master-data rules. Mirrors the CreateWarehouseDto decorators in
     * so360-inventory-be — this copy exists to put the message next to the
     * field; the backend copy is what actually protects the table.
     */
    const validateWarehouse = (wh: typeof newWarehouse): Record<string, ValidationResult> => ({
        name: validateName(wh.name, 'Warehouse Name', 3, 100),
        code: validateCode(wh.code, 'Short Code', 3, 15),
        warehouse_type: wh.warehouse_type ? null : 'Please select a Warehouse Type.',
        address: optional(wh.address, (v) => validateAddress(v)),
        city: optional(wh.city, (v) => validatePlaceName(v, 'City')),
        state: optional(wh.state, (v) => validatePlaceName(v, 'State/Region')),
        country: optional(wh.country, (v) => validatePlaceName(v, 'Country')),
        contact_person: optional(wh.contact_person, (v) => validatePersonName(v)),
        contact_phone: optional(wh.contact_phone, (v) => validatePhone(v)),
    });

    const createErrors = useMemo(() => validateWarehouse(newWarehouse), [newWarehouse]);
    const editErrors = useMemo(() => validateWarehouse(editForm), [editForm]);
    const createBlocked = firstError(createErrors);
    const editBlocked = firstError(editErrors);

    // Warehouses this session has successfully deleted. The list endpoint is
    // cached server-side (and served by more than one instance in production),
    // so a refetch immediately after a delete can still contain the row we just
    // removed — which is how "deleted but still visible" was reported. Ids stay
    // here for the life of the page; a re-created warehouse gets a new id.
    const deletedIds = useRef<Set<string>>(new Set());

    const fetchWarehouses = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await inventoryService.getLocations();
            setWarehouses(
                (Array.isArray(data) ? data : []).filter((w) => !deletedIds.current.has(w.id)),
            );
        } catch (err) {
            setError('Failed to load warehouses.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const handleCreateWarehouse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (createBlocked) {
            setShowCreateErrors(true);
            setError(createBlocked);
            return;
        }
        setIsCreating(true);
        setError(null);
        try {
            await inventoryService.createWarehouse(newWarehouse);
            recordActivity({ eventType: 'inventory.location.created', eventCategory: 'data', description: `Created warehouse "${newWarehouse.name}"`, resourceType: 'location' }).catch(() => {});
            setIsCreateModalOpen(false);
            fetchWarehouses();
            setNewWarehouse({ name: '', code: '', address: '', city: '', state: '', country: '', contact_person: '', contact_phone: '', warehouse_type: 'general', is_active: true });
            setShowCreateErrors(false);
            setSuccessMessage('Warehouse created successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to create warehouse');
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditClick = (wh: Warehouse) => {
        setEditingWarehouse(wh);
        setEditForm({
            name: wh.name,
            code: wh.code || '',
            address: wh.address || '',
            city: wh.city || '',
            state: wh.state || '',
            country: wh.country || '',
            contact_person: wh.contact_person || '',
            contact_phone: wh.contact_phone || '',
            warehouse_type: wh.warehouse_type || 'general',
            is_active: wh.is_active
        });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingWarehouse) return;
        if (editBlocked) {
            setShowEditErrors(true);
            setError(editBlocked);
            return;
        }
        setShowEditErrors(false);
        setIsSaving(true);
        setError(null);
        try {
            await inventoryService.updateWarehouse(editingWarehouse.id, editForm);
            recordActivity({ eventType: 'inventory.location.updated', eventCategory: 'data', description: `Updated warehouse "${editForm.name}"`, resourceType: 'location', resourceId: editingWarehouse.id }).catch(() => {});
            setEditingWarehouse(null);
            fetchWarehouses();
            setSuccessMessage('Warehouse updated successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to update warehouse');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteWarehouse = async () => {
        if (!deletingWarehouse) return;
        setIsDeleting(true);
        setError(null);
        try {
            await inventoryService.deleteWarehouse(deletingWarehouse.id);
            // Drop the card straight away rather than waiting for the refetch.
            // The list endpoint is cached server-side, so a refetch alone could
            // return the deleted warehouse and leave it on screen — which is
            // exactly how "deleted but still visible" was reported.
            const deletedId = deletingWarehouse.id;
            deletedIds.current.add(deletedId);
            setWarehouses((prev) => prev.filter((w) => w.id !== deletedId));
            setDeletingWarehouse(null);
            fetchWarehouses();
            setSuccessMessage('Warehouse deleted successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to delete warehouse');
            setDeletingWarehouse(null);
        } finally {
            setIsDeleting(false);
        }
    };

    // Single source of truth: the warehouse limit comes from the same resolver
    // (resolve_quota_limit, via useQuota) that the backend uses to enforce creation.
    // "Used" is the live warehouse count — the ground truth for a count quota.
    const whUnlimited = quotaData?.is_unlimited ?? false;
    const whLimit = whUnlimited || quotaData == null || (quotaData.limit ?? -1) <= 0 ? null : quotaData.limit;
    const whUsed = warehouses.length;
    const atWarehouseLimit = whLimit !== null && whUsed >= whLimit;

    /** Error text rendered directly beneath the field it belongs to. */
    const FieldErr = ({ show, message, field }: { show: boolean; message: ValidationResult; field: string }) =>
        show && message ? (
            <p role="alert" data-testid={`error-${field}`} className="text-nb-caption text-danger">
                {message}
            </p>
        ) : null;

    const TYPE_OPTIONS = [
        { value: 'general', label: 'General' },
        { value: 'distribution', label: 'Distribution' },
        { value: 'cold_storage', label: 'Cold Storage' },
        { value: 'manufacturing', label: 'Manufacturing' },
        { value: 'transit', label: 'Transit / Cross-dock' },
    ];

    /** Shared field set for the create and edit modals. */
    const renderFields = (
        form: typeof newWarehouse,
        setForm: (f: typeof newWarehouse) => void,
        errors: Record<string, ValidationResult>,
        show: boolean,
    ) => {
        const text = (key: keyof typeof newWarehouse, label: string, placeholder: string, extra: Record<string, any> = {}) => (
            <div className={extra.wide ? 'wc-large:col-span-2' : undefined}>
                <TextField
                    name={key}
                    label={label}
                    required={extra.required}
                    type={extra.type ?? 'text'}
                    value={form[key] as string}
                    placeholder={placeholder}
                    onChange={(e: any) => setForm({ ...form, [key]: extra.upper ? e.target.value.toUpperCase() : e.target.value })}
                />
                <FieldErr show={show} message={errors[key]} field={key} />
            </div>
        );
        return (
            <div className="grid grid-cols-1 gap-nb-4 wc-large:grid-cols-2">
                {text('name', 'Warehouse Name', 'e.g. Dubai South Hub', { wide: true, required: true })}
                {text('code', 'Short Code', 'e.g. DXB-01', { required: true, upper: true })}
                <div>
                    <Select
                        name="warehouse_type"
                        label="Warehouse Type"
                        value={form.warehouse_type}
                        options={TYPE_OPTIONS}
                        onChange={(e: any) => setForm({ ...form, warehouse_type: e.target.value })}
                    />
                    <FieldErr show={show} message={errors.warehouse_type} field="warehouse_type" />
                </div>
                {text('address', 'Street Address', 'Street address', { wide: true })}
                {text('city', 'City', 'City')}
                {text('state', 'State / Region', 'State / Province')}
                {text('country', 'Country', 'Country')}
                {text('contact_person', 'Contact Person', 'Manager / Supervisor name')}
                {text('contact_phone', 'Contact Phone', '+971 50 000 0000', { wide: true, type: 'tel' })}
            </div>
        );
    };

    const limitTitle = atWarehouseLimit ? `Used ${whUsed} of ${whLimit} warehouses — upgrade your plan to add more` : undefined;
    const canManage = can('warehouses.create') && canCreateWarehouse;

    const columns: DataTableColumn<any>[] = [
        {
            key: 'name',
            header: 'Warehouse',
            alwaysVisible: true,
            render: (wh) => (
                <div className="flex flex-col">
                    <span className="text-nb-body font-semibold text-fg">{wh.name}</span>
                    <span className="text-nb-caption text-fg-subtle">{wh.address || 'Address not set'}</span>
                </div>
            ),
        },
        { key: 'code', header: 'Code', render: (wh) => <Badge tone="neutral">{wh.code}</Badge> },
        {
            key: 'layout',
            header: 'Storage Layout',
            render: (wh) =>
                wh.warehouse_locations?.length > 0 ? (
                    <div className="flex flex-col gap-nb-1">
                        {wh.warehouse_locations.map((loc: any) => (
                            <div key={loc.id} className="flex flex-wrap items-center gap-nb-2 text-nb-caption text-fg-muted">
                                <span>{loc.name}</span>
                                <span className="text-fg-subtle">{loc.code}</span>
                                {loc.warehouse_bins?.map((bin: any) => (
                                    <Badge key={bin.id} tone="primary" size="sm">{bin.code}</Badge>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    <span className="text-nb-caption text-fg-subtle">No locations defined</span>
                ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (wh) => <Badge tone={wh.is_active ? 'success' : 'neutral'}>{wh.is_active ? 'Operational' : 'Inactive'}</Badge>,
        },
        {
            key: 'actions',
            header: '',
            alwaysVisible: true,
            align: 'right',
            render: (wh) => (
                <div className="flex justify-end gap-nb-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/inventory/warehouses/${wh.id}`)}>View</Button>
                    {canManage && (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(wh)}>Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeletingWarehouse(wh)}>Delete</Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    const emptyState = (
        <EmptyState
            title="No warehouses yet"
            description="Add a warehouse to start tracking stock locations."
            action={
                canManage ? (
                    <Button
                        data-testid="empty-state-add-warehouse"
                        variant="primary"
                        disabled={atWarehouseLimit}
                        title={limitTitle}
                        onClick={() => !atWarehouseLimit && setIsCreateModalOpen(true)}
                    ><Plus size={16} />
                        Add New Warehouse
                    </Button>
                ) : undefined
            }
        />
    );

    const primaryAction = can('warehouses.create') ? (
        <FeatureGate state={createWarehouseState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
            <QuotaGate
                quotaKey="max_warehouses"
                moduleCode="inventory"
                used={whUsed}
                limit={quotaData?.limit ?? 0}
                isUnlimited={whUnlimited}
                disableOnExceeded
            >
                <Tooltip content={limitTitle ?? 'New Warehouse'}>
                    <Button
                        variant="primary"
                        disabled={atWarehouseLimit}
                        title={limitTitle}
                        onClick={() => !atWarehouseLimit && setIsCreateModalOpen(true)}
                    ><Plus size={16} />
                        New Warehouse
                        {atWarehouseLimit && <span> ({whUsed}/{whLimit})</span>}
                    </Button>
                </Tooltip>
            </QuotaGate>
        </FeatureGate>
    ) : undefined;

    return (
        <ListPageTemplate
            title="Warehouses"
            description="Manage physical storage facilities and fulfillment centers"
            count={warehouses.length}
            primaryAction={primaryAction}
        >
            {quotaData && (
                <QuotaBar label="Warehouses" used={whUsed} limit={quotaData.limit} isUnlimited={whUnlimited} />
            )}

            {whLimit !== null && (
                <p data-testid="warehouse-limit-banner" className="text-nb-caption text-fg-subtle">
                    {whUsed} of {whLimit} used
                </p>
            )}

            {error && (
                <Alert variant="error" action={{ label: 'Dismiss', onClick: () => setError(null) }}>
                    {error}
                </Alert>
            )}

            {successMessage && <Alert variant="success">{successMessage}</Alert>}

            <DataTable
                columns={columns}
                rows={warehouses as any[]}
                rowKey={(wh: any) => wh.id}
                loading={isLoading}
                emptyState={emptyState}
            />

            <Modal
                open={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Register New Warehouse"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)} disabled={isCreating}>Cancel</Button>
                        <Button variant="primary" type="submit" form="create-warehouse-form" disabled={isCreating} loading={isCreating}>
                            {isCreating ? 'Creating...' : 'Register Warehouse'}
                        </Button>
                    </div>
                }
            >
                <form id="create-warehouse-form" onSubmit={handleCreateWarehouse}>
                    {renderFields(newWarehouse, setNewWarehouse, createErrors as any, showCreateErrors)}
                </form>
            </Modal>

            <Modal
                open={!!editingWarehouse}
                onClose={() => setEditingWarehouse(null)}
                title="Edit Warehouse"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setEditingWarehouse(null)} disabled={isSaving}>Cancel</Button>
                        <Button variant="primary" type="submit" form="edit-warehouse-form" disabled={isSaving} loading={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                }
            >
                <form id="edit-warehouse-form" onSubmit={handleSaveEdit} className="flex flex-col gap-nb-4">
                    {renderFields(editForm as any, setEditForm as any, editErrors as any, showEditErrors)}
                    <Checkbox
                        name="is_active"
                        label="Active / Operational"
                        checked={editForm.is_active}
                        onChange={(e: any) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    />
                </form>
            </Modal>

            <Modal
                open={!!deletingWarehouse}
                onClose={() => setDeletingWarehouse(null)}
                title="Delete Warehouse"
                description="This action cannot be undone"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setDeletingWarehouse(null)} disabled={isDeleting}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteWarehouse} disabled={isDeleting} loading={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </div>
                }
            >
                <p className="text-nb-body text-fg-muted">
                    Are you sure you want to delete <strong className="text-fg">{deletingWarehouse?.name}</strong>?
                    Warehouses with stock cannot be deleted.
                </p>
            </Modal>
        </ListPageTemplate>
    );
};

export default StockLocationsPage;
