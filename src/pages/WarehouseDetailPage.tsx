import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Home, MapPin, Package, AlertCircle,
    Edit2, Trash2, Plus, Loader2, Save, X
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Warehouse } from '../types/inventory';
import { Modal } from '../components/common/Modal';
import { TableSkeleton } from '../components/common/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useActivity, useShellBridge } from '@so360/shell-context';
import { FeatureGate } from '@so360/design-system';

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

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
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
        setIsLocationModalOpen(true);
    };

    const handleSaveLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
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

    if (isLoading) return <div className="p-8"><TableSkeleton /></div>;
    if (error && !warehouse) return (
        <div className="p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-50 mb-2">{error || 'Warehouse not found'}</h2>
            <button onClick={() => navigate('/inventory/locations')} className="text-blue-400 hover:underline">Back to Warehouses</button>
        </div>
    );

    if (!warehouse) return (
        <div className="p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-50 mb-2">Warehouse not found</h2>
            <button onClick={() => navigate('/inventory/locations')} className="text-blue-400 hover:underline">Back to Warehouses</button>
        </div>
    );

    const deletingLocation = warehouse.warehouse_locations?.find((l: any) => l.id === deletingLocationId);

    return (
        <div className="p-8">
            {error && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                    <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-300">
                        <X size={16} />
                    </button>
                </div>
            )}

            <button
                onClick={() => navigate('/inventory/locations')}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-50 mb-6 transition-colors group"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to Warehouses
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Warehouse Info Card */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${warehouse.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                                {warehouse.is_active ? 'Operational' : 'Inactive'}
                            </span>
                            {can('warehouses.create') && (
                                <FeatureGate state={warehouseState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                                <>
                                    <button
                                        onClick={handleEditClick}
                                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-blue-400"
                                        title="Edit Warehouse"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-rose-400"
                                        title="Delete Warehouse"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                                </FeatureGate>
                            )}
                        </div>

                        <div className="flex items-start gap-4 mb-8 mt-6">
                            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700 shadow-xl">
                                <Home size={32} className="text-blue-400" />
                            </div>
                            <div className="pt-1">
                                <h1 className="text-2xl font-bold text-slate-50 mb-1 leading-tight">{warehouse.name}</h1>
                                <span className="text-xs font-mono text-slate-500 tracking-widest">{warehouse.code || 'NO-CODE'}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                <MapPin size={16} className="text-slate-400" />
                                <span className="text-sm text-slate-50">{warehouse.address || 'No address set'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Locations Summary Card */}
                    <div className="mt-6 bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-900/40">
                        <span className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">Storage Locations</span>
                        <div className="text-5xl font-black mt-2">
                            {warehouse.warehouse_locations?.length || 0}
                        </div>
                        <p className="mt-2 text-sm text-blue-200">
                            {warehouse.stock_balances?.length || 0} items in stock
                        </p>
                    </div>
                </div>

                {/* Locations & Stock */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Locations */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-50">Storage Locations</h2>
                            {can('warehouses.create') && canManageWarehouse && (
                                <button
                                    onClick={() => openLocationModal()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                                >
                                    <Plus size={16} />
                                    Add Location
                                </button>
                            )}
                        </div>

                        {warehouse.warehouse_locations?.length > 0 ? (
                            <div className="space-y-4">
                                {warehouse.warehouse_locations.map((loc: any) => (
                                    <div key={loc.id} className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={16} className="text-blue-400" />
                                                <span className="font-semibold text-slate-50">{loc.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-mono text-slate-500 mr-2">{loc.code}</span>
                                                {can('warehouses.create') && canManageWarehouse && (
                                                    <>
                                                        <button
                                                            onClick={() => openLocationModal(loc)}
                                                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-blue-400"
                                                            title="Edit Location"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDeleteLocation(loc)}
                                                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-rose-400"
                                                            title="Delete Location"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {loc.warehouse_bins?.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {loc.warehouse_bins.map((bin: any) => (
                                                    <span key={bin.id} className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">
                                                        {bin.code}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500">
                                <MapPin size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No storage locations defined</p>
                                {can('warehouses.create') && canManageWarehouse && (
                                    <button
                                        onClick={() => openLocationModal()}
                                        className="mt-3 text-blue-400 hover:text-blue-300 text-sm font-medium"
                                    >
                                        Add your first location
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stock in Warehouse */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-slate-50 mb-6">Current Stock</h2>
                        {warehouse.stock_balances?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                            <th className="pb-3">Item</th>
                                            <th className="pb-3">SKU</th>
                                            <th className="pb-3 text-right">Quantity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {warehouse.stock_balances.map((balance: any) => (
                                            <tr key={balance.id} className="border-b border-slate-800/50">
                                                <td className="py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Package size={16} className="text-slate-500" />
                                                        <span className="text-slate-50 font-medium">{balance.items?.name || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-slate-500 font-mono text-sm">{balance.items?.sku || '-'}</td>
                                                <td className="py-3 text-right font-bold text-slate-50">{balance.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500">
                                <Package size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No stock in this warehouse</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Warehouse Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Warehouse"
            >
                <form onSubmit={handleSaveEdit} className="space-y-4 text-slate-200">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Warehouse Name *</label>
                        <input
                            required
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Short Code</label>
                        <input
                            type="text"
                            value={editForm.code}
                            onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Address</label>
                        <textarea
                            value={editForm.address}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 h-24 resize-none"
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-slate-50 transition-colors">Active / Operational</span>
                    </label>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={isSaving}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold py-2.5 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save Changes</>}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Location Add/Edit Modal */}
            <Modal
                isOpen={isLocationModalOpen}
                onClose={() => { setIsLocationModalOpen(false); setEditingLocation(null); }}
                title={editingLocation ? 'Edit Storage Location' : 'Add Storage Location'}
            >
                <form onSubmit={handleSaveLocation} className="space-y-4 text-slate-200">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Location Name *</label>
                        <input
                            required
                            type="text"
                            value={locationForm.name}
                            onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                            placeholder="e.g. Zone A, Aisle 3"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Location Code *</label>
                        <input
                            required
                            type="text"
                            value={locationForm.code}
                            onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })}
                            placeholder="e.g. ZA, A3"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                        />
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => { setIsLocationModalOpen(false); setEditingLocation(null); }}
                            disabled={isSavingLocation}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold py-2.5 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingLocation}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            {isSavingLocation ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> {editingLocation ? 'Save Changes' : 'Add Location'}</>}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Warehouse Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[600]">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                                <Trash2 size={24} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-50">Delete Warehouse</h3>
                                <p className="text-slate-400 text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-slate-300 mb-6">
                            Are you sure you want to delete <strong className="text-slate-50">{warehouse.name}</strong>?
                            Warehouses with stock cannot be deleted.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold py-2.5 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteWarehouse}
                                disabled={isDeleting}
                                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                {isDeleting ? <><Loader2 size={18} className="animate-spin" /> Deleting...</> : <><Trash2 size={18} /> Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Location Confirmation */}
            {deletingLocationId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[600]">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                                <Trash2 size={24} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-50">Delete Storage Location</h3>
                                <p className="text-slate-400 text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-slate-300 mb-6">
                            Are you sure you want to delete <strong className="text-slate-50">{deletingLocation?.name || 'this location'}</strong>?
                            Locations with stock cannot be deleted. All bins in this location will also be removed.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingLocationId(null)}
                                disabled={isDeletingLocation}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold py-2.5 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteLocation}
                                disabled={isDeletingLocation}
                                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                {isDeletingLocation ? <><Loader2 size={18} className="animate-spin" /> Deleting...</> : <><Trash2 size={18} /> Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarehouseDetailPage;
