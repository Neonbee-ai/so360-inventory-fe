import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, MapPin, Edit2, Trash2, Plus } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Warehouse } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import { firstError, optional, validateAddress, validateCode, validateName, ValidationResult } from '../utils/validators';
import { useActivity, useShellBridge } from '@so360/shell-context';
import {
    FeatureGate, DetailPageTemplate, DataTable, Button, IconButton, Modal, TextField, Textarea, Checkbox,
    Alert, Badge, EmptyState, KpiCard, Card,
    type DataTableColumn,
} from '@so360/design-system';

const WarehouseDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { can } = useAuth();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const warehouseState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:warehouses:create') : 'enabled';
    const canManageWarehouse = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('warehouses.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && warehouseState === 'enabled';
    const [warehouse, setWarehouse] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        code: '',
        address: '',
        is_active: true
    });
    const [isSaving, setIsSaving] = useState(false);

    // Delete state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Location CRUD state
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<any>(null);
    const [locationForm, setLocationForm] = useState({ name: '', code: '' });
    const [isSavingLocation, setIsSavingLocation] = useState(false);
    const [showLocationErrors, setShowLocationErrors] = useState(false);
    const [showEditErrors, setShowEditErrors] = useState(false);
    const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
    const [isDeletingLocation, setIsDeletingLocation] = useState(false);

    const fetchWarehouse = async () => {
        if (!id) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await inventoryService.getWarehouse(id);
            setWarehouse(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load warehouse details');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWarehouse();
    }, [id]);

    const handleEditClick = () => {
        if (warehouse) {
            setEditForm({
                name: warehouse.name,
                code: warehouse.code || '',
                address: warehouse.address || '',
                is_active: warehouse.is_active
            });
            setIsEditModalOpen(true);
        }
    };

    // Same warehouse rules as the Warehouses list page — this modal is a second
    // edit surface for the same record and must not be a way around them.
    const editErrors: Record<string, ValidationResult> = {
        name: validateName(editForm.name, 'Warehouse Name', 3, 100),
        code: validateCode(editForm.code, 'Short Code', 3, 15),
        address: optional(editForm.address, (v) => validateAddress(v)),
    };
    const editBlocked = firstError(editErrors);

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        if (editBlocked) {
            setShowEditErrors(true);
            setError(editBlocked);
            return;
        }
        setShowEditErrors(false);
        setIsSaving(true);
        try {
            await inventoryService.updateWarehouse(id, editForm);
            recordActivity({ eventType: 'inventory.warehouse.updated', eventCategory: 'data', description: `Updated warehouse "${editForm.name}"`, resourceType: 'warehouse', resourceId: id }).catch(() => {});
            setIsEditModalOpen(false);
            fetchWarehouse();
        } catch (err: any) {
            setError(err.message || 'Failed to update warehouse');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteWarehouse = async () => {
        if (!id) return;
        setIsDeleting(true);
        try {
            await inventoryService.deleteWarehouse(id);
            navigate('/inventory/locations');
        } catch (err: any) {
            setError(err.message || 'Failed to delete warehouse');
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    // Location CRUD handlers
    const openLocationModal = (loc?: any) => {
        if (loc) {
            setEditingLocation(loc);
            setLocationForm({ name: loc.name, code: loc.code });
        } else {
            setEditingLocation(null);
            setLocationForm({ name: '', code: '' });
        }
        setShowLocationErrors(false);
        setIsLocationModalOpen(true);
    };

    /**
     * Storage locations are referenced by scanners, transfer documents and
     * reports, so `)*&(^` is not a usable name and `_( )*_` is not a usable
     * code. Mirrors CreateWarehouseLocationDto on the backend, which is what
     * actually rejects a payload that skips this form.
     */
    const locationErrors: Record<string, ValidationResult> = {
        name: validateName(locationForm.name, 'Location Name', 2, 100),
        code: validateCode(locationForm.code, 'Location Code', 2, 20),
    };
    const locationBlocked = firstError(locationErrors);

    const handleSaveLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        if (locationBlocked) {
            setShowLocationErrors(true);
            setError(locationBlocked);
            return;
        }
        setShowLocationErrors(false);
        setIsSavingLocation(true);
        setError(null);
        try {
            if (editingLocation) {
                await inventoryService.updateLocation(editingLocation.id, locationForm);
            } else {
                await inventoryService.createLocation(id, locationForm);
            }
            setIsLocationModalOpen(false);
            setEditingLocation(null);
            setLocationForm({ name: '', code: '' });
            setShowLocationErrors(false);
            fetchWarehouse();
        } catch (err: any) {
            setError(err.message || 'Failed to save location');
        } finally {
            setIsSavingLocation(false);
        }
    };

    const confirmDeleteLocation = (loc: any) => {
        setDeletingLocationId(loc.id);
    };

    const handleDeleteLocation = async () => {
        if (!deletingLocationId) return;
        setIsDeletingLocation(true);
        setError(null);
        try {
            await inventoryService.deleteLocation(deletingLocationId);
            setDeletingLocationId(null);
            fetchWarehouse();
        } catch (err: any) {
            setError(err.message || 'Failed to delete location');
            setDeletingLocationId(null);
        } finally {
            setIsDeletingLocation(false);
        }
    };

    if (isLoading) return <DetailPageTemplate title="Warehouse" loading />;

    if (!warehouse) {
        return (
            <DetailPageTemplate title="Warehouse">
                <EmptyState
                    title={error || 'Warehouse not found'}
                    action={<Button variant="secondary" onClick={() => navigate('/inventory/locations')}>Back to Warehouses</Button>}
                />
            </DetailPageTemplate>
        );
    }

    const deletingLocation = warehouse.warehouse_locations?.find((l: any) => l.id === deletingLocationId);
    const canManageLocations = can('warehouses.create') && canManageWarehouse;

    const FieldErr = ({ show, message, testId }: { show: boolean; message: ValidationResult; testId: string }) =>
        show && message ? (
            <p role="alert" data-testid={testId} className="text-nb-caption text-danger">{message}</p>
        ) : null;

    const stockColumns: DataTableColumn<any>[] = [
        {
            key: 'item',
            header: 'Item',
            alwaysVisible: true,
            render: (b) => (
                <span className="inline-flex items-center gap-nb-2">
                    <Package size={16} className="text-fg-subtle" />
                    <span className="text-nb-body font-medium text-fg">{b.items?.name || 'Unknown'}</span>
                </span>
            ),
        },
        { key: 'sku', header: 'SKU', render: (b) => <span className="font-mono text-nb-caption text-fg-subtle">{b.items?.sku || '-'}</span> },
        { key: 'quantity', header: 'Quantity', align: 'right', render: (b) => <span className="font-semibold text-fg">{b.quantity}</span> },
    ];

    const closeLocationModal = () => { setIsLocationModalOpen(false); setEditingLocation(null); };

    return (
        <DetailPageTemplate
            title={warehouse.name}
            trail={[{ label: 'Warehouses', onClick: () => navigate('/inventory/locations') }]}
            status={<Badge tone={warehouse.is_active ? 'success' : 'neutral'}>{warehouse.is_active ? 'Operational' : 'Inactive'}</Badge>}
            meta={<span className="font-mono">{warehouse.code || 'NO-CODE'}</span>}
            secondaryActions={
                can('warehouses.create')
                    ? [
                        <FeatureGate key="manage" state={warehouseState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                            <>
                                <IconButton label="Edit Warehouse" icon={<Edit2 size={16} />} variant="ghost" onClick={handleEditClick} />
                                <IconButton label="Delete Warehouse" icon={<Trash2 size={16} />} variant="ghost" onClick={() => setShowDeleteConfirm(true)} />
                            </>
                        </FeatureGate>,
                    ]
                    : undefined
            }
            sidePanel={
                <div className="flex flex-col gap-nb-4">
                    <Card title="Address">
                        <span className="inline-flex items-center gap-nb-2 text-nb-body text-fg">
                            <MapPin size={16} className="text-fg-muted" />
                            {warehouse.address || 'No address set'}
                        </span>
                    </Card>
                    <KpiCard
                        label="Storage Locations"
                        value={warehouse.warehouse_locations?.length || 0}
                        hint={`${warehouse.stock_balances?.length || 0} items in stock`}
                    />
                </div>
            }
        >
            <div className="flex flex-col gap-nb-4">
                {error && (
                    <Alert variant="error" action={{ label: 'Dismiss', onClick: () => setError(null) }}>{error}</Alert>
                )}

                <Card
                    title="Storage Locations"
                    actions={
                        canManageLocations ? (
                            <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={() => openLocationModal()}>
                                Add Location
                            </Button>
                        ) : undefined
                    }
                >
                    {warehouse.warehouse_locations?.length > 0 ? (
                        <div className="flex flex-col gap-nb-3">
                            {warehouse.warehouse_locations.map((loc: any) => (
                                <div key={loc.id} className="rounded-nb-md border border-line p-nb-3">
                                    <div className="flex items-center justify-between gap-nb-2">
                                        <span className="inline-flex items-center gap-nb-2 text-nb-body font-semibold text-fg">
                                            <MapPin size={16} className="text-primary" />
                                            {loc.name}
                                        </span>
                                        <div className="flex items-center gap-nb-1">
                                            <span className="font-mono text-nb-caption text-fg-subtle">{loc.code}</span>
                                            {canManageLocations && (
                                                <>
                                                    <IconButton label="Edit Location" icon={<Edit2 size={14} />} variant="ghost" size="sm" onClick={() => openLocationModal(loc)} />
                                                    <IconButton label="Delete Location" icon={<Trash2 size={14} />} variant="ghost" size="sm" onClick={() => confirmDeleteLocation(loc)} />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {loc.warehouse_bins?.length > 0 && (
                                        <div className="mt-nb-2 flex flex-wrap gap-nb-2">
                                            {loc.warehouse_bins.map((bin: any) => (
                                                <Badge key={bin.id} tone="primary" size="sm">{bin.code}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No storage locations defined"
                            action={
                                canManageLocations ? (
                                    <Button variant="secondary" size="sm" onClick={() => openLocationModal()}>Add your first location</Button>
                                ) : undefined
                            }
                        />
                    )}
                </Card>

                <Card title="Current Stock">
                    <DataTable
                        columns={stockColumns}
                        rows={warehouse.stock_balances ?? []}
                        rowKey={(b: any) => b.id}
                        emptyState={<EmptyState title="No stock in this warehouse" />}
                    />
                </Card>
            </div>

            <Modal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Warehouse"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button variant="primary" type="submit" form="edit-warehouse-detail-form" disabled={isSaving} loading={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                }
            >
                <form id="edit-warehouse-detail-form" onSubmit={handleSaveEdit} className="flex flex-col gap-nb-4">
                    <div>
                        <TextField name="name" label="Warehouse Name" required type="text" value={editForm.name}
                            onChange={(e: any) => setEditForm({ ...editForm, name: e.target.value })} />
                        <FieldErr show={showEditErrors} message={editErrors.name} testId="error-warehouse-name" />
                    </div>
                    <div>
                        <TextField name="code" label="Short Code" required type="text" value={editForm.code}
                            onChange={(e: any) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} />
                        <FieldErr show={showEditErrors} message={editErrors.code} testId="error-warehouse-code" />
                    </div>
                    <div>
                        <Textarea name="address" label="Address" value={editForm.address}
                            onChange={(e: any) => setEditForm({ ...editForm, address: e.target.value })} />
                        <FieldErr show={showEditErrors} message={editErrors.address} testId="error-warehouse-address" />
                    </div>
                    <Checkbox name="is_active" label="Active / Operational" checked={editForm.is_active}
                        onChange={(e: any) => setEditForm({ ...editForm, is_active: e.target.checked })} />
                </form>
            </Modal>

            <Modal
                open={isLocationModalOpen}
                onClose={closeLocationModal}
                title={editingLocation ? 'Edit Storage Location' : 'Add Storage Location'}
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={closeLocationModal} disabled={isSavingLocation}>Cancel</Button>
                        <Button variant="primary" type="submit" form="location-form" disabled={isSavingLocation} loading={isSavingLocation}>
                            {isSavingLocation ? 'Saving...' : editingLocation ? 'Save Changes' : 'Add Location'}
                        </Button>
                    </div>
                }
            >
                <form id="location-form" onSubmit={handleSaveLocation} className="flex flex-col gap-nb-4">
                    <div>
                        <TextField name="location-name" label="Location Name" required type="text" value={locationForm.name}
                            placeholder="e.g. Zone A, Aisle 3"
                            onChange={(e: any) => setLocationForm({ ...locationForm, name: e.target.value })} />
                        <FieldErr show={showLocationErrors} message={locationErrors.name} testId="error-location-name" />
                    </div>
                    <div>
                        <TextField name="location-code" label="Location Code" required type="text" value={locationForm.code}
                            placeholder="e.g. ZA, A3"
                            onChange={(e: any) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })} />
                        <FieldErr show={showLocationErrors} message={locationErrors.code} testId="error-location-code" />
                    </div>
                </form>
            </Modal>

            <Modal
                open={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title="Delete Warehouse"
                description="This action cannot be undone"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteWarehouse} disabled={isDeleting} loading={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </div>
                }
            >
                <p className="text-nb-body text-fg-muted">
                    Are you sure you want to delete <strong className="text-fg">{warehouse.name}</strong>?
                    Warehouses with stock cannot be deleted.
                </p>
            </Modal>

            <Modal
                open={!!deletingLocationId}
                onClose={() => setDeletingLocationId(null)}
                title="Delete Storage Location"
                description="This action cannot be undone"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setDeletingLocationId(null)} disabled={isDeletingLocation}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteLocation} disabled={isDeletingLocation} loading={isDeletingLocation}>
                            {isDeletingLocation ? 'Deleting...' : 'Delete'}
                        </Button>
                    </div>
                }
            >
                <p className="text-nb-body text-fg-muted">
                    Are you sure you want to delete <strong className="text-fg">{deletingLocation?.name || 'this location'}</strong>?
                    Locations with stock cannot be deleted. All bins in this location will also be removed.
                </p>
            </Modal>
        </DetailPageTemplate>
    );
};

export default WarehouseDetailPage;
