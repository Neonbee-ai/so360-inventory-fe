import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Home, Edit2, AlertCircle, Trash2, Loader2, X, Save } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { Warehouse } from '../types/inventory';
import { Modal } from '../components/common/Modal';
import { TableSkeleton } from '../components/common/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useActivity, useShellBridge, useQuota } from '@so360/shell-context';
import { QuotaBar, QuotaGate } from '@so360/design-system';

const StockLocationsPage = () => {
    const navigate = useNavigate();
    const { can } = useAuth();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateWarehouse = (shell?.isFeatureEnabled?.('action:inventory:warehouses:create') ?? true);
    const quotaChecks = useMemo(() => [{ module_code: 'inventory', quota_key: 'max_warehouses' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_warehouses');
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [maxWarehouses, setMaxWarehouses] = useState<number | null>(null);

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

    const fetchWarehouses = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await inventoryService.getLocations();
            setWarehouses(data);
        } catch (err) {
            setError('Failed to load warehouses.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWarehouseLimit = async () => {
        try {
            const data = await inventoryService.request('/warehouses/entitlement-limits', { method: 'GET' }).catch(() => null);
            if (data?.max_warehouses !== undefined) {
                setMaxWarehouses(data.max_warehouses);
                return;
            }
        } catch {}
        // Fallback: fetch directly from subscription service
        try {
            const subOrigin = (import.meta as any)?.env?.VITE_SO360_SUBSCRIPTION_API || 'http://localhost:3026';
            const resp = await fetch(`${subOrigin}/v1/entitlements/effective-matrix`, {
                headers: {
                    'X-Tenant-Id': inventoryService['tenantId'] || '',
                    'X-Org-Id': inventoryService['orgId'] || '',
                },
            });
            if (resp.ok) {
                const matrix = await resp.json();
                setMaxWarehouses(matrix?.limits?.max_warehouses ?? null);
            }
        } catch {}
    };

    useEffect(() => {
        fetchWarehouses();
        fetchWarehouseLimit();
    }, []);

    const handleCreateWarehouse = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        setError(null);
        try {
            await inventoryService.createWarehouse(newWarehouse);
            recordActivity({ eventType: 'inventory.location.created', eventCategory: 'data', description: `Created warehouse "${newWarehouse.name}"`, resourceType: 'location' }).catch(() => {});
            setIsCreateModalOpen(false);
            fetchWarehouses();
            setNewWarehouse({ name: '', code: '', address: '', city: '', state: '', country: '', contact_person: '', contact_phone: '', warehouse_type: 'general', is_active: true });
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

    const atWarehouseLimit = maxWarehouses !== null && warehouses.length >= maxWarehouses;

    return (
        <div className="p-8">
            <header className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Warehouses</h1>
                    <p className="text-slate-400 mt-1">Manage physical storage facilities and fulfillment centers</p>
                </div>
                {can('manage_locations') && canCreateWarehouse && (
                    <QuotaGate
                        quotaKey="max_warehouses"
                        moduleCode="inventory"
                        used={quotaData?.current_usage ?? 0}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        disableOnExceeded
                    >
                        <button
                            onClick={() => !atWarehouseLimit && setIsCreateModalOpen(true)}
                            disabled={atWarehouseLimit}
                            title={atWarehouseLimit ? `${warehouses.length}/${maxWarehouses} warehouses used — upgrade your plan to add more` : undefined}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all shadow-lg active:scale-95 ${atWarehouseLimit ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'}`}
                        >
                            <Plus size={20} />
                            New Warehouse
                            {atWarehouseLimit && <span className="text-xs font-normal ml-1">({warehouses.length}/{maxWarehouses})</span>}
                        </button>
                    </QuotaGate>
                )}
            </header>

            {quotaData && (
                <QuotaBar
                    label="Warehouses"
                    used={quotaData.current_usage}
                    limit={quotaData.limit}
                    isUnlimited={quotaData.is_unlimited}
                />
            )}

            {maxWarehouses !== null && (
                <div className="mb-6 flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2.5">
                    <span className="text-sm text-slate-400">
                        Warehouse limit: <span className={`font-semibold ${atWarehouseLimit ? 'text-amber-400' : 'text-slate-200'}`}>{warehouses.length} / {maxWarehouses} used</span>
                    </span>
                    {atWarehouseLimit && (
                        <a href="/settings/subscription" className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                            Upgrade Plan →
                        </a>
                    )}
                </div>
            )}

            {error && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto hover:text-rose-300">
                        <X size={16} />
                    </button>
                </div>
            )}

            {successMessage && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <span>{successMessage}</span>
                </div>
            )}

            {isLoading ? (
                <TableSkeleton />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {warehouses.map((wh) => (
                        <div key={wh.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all group flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl border bg-slate-800 border-slate-700 text-slate-400 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors`}>
                                    <Home size={24} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-500 border border-slate-700 px-2 py-1 rounded">
                                    {wh.code}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1 uppercase tracking-tight">{wh.name}</h3>
                            <p className="text-slate-500 text-xs mb-6 flex-grow uppercase font-bold tracking-widest">{wh.address || 'Address not set'}</p>

                            {/* Locations & Bins Mini View */}
                            <div className="space-y-3 mb-6">
                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Storage Layout</label>
                                {(wh as any).warehouse_locations?.length > 0 ? (
                                    <div className="space-y-2">
                                        {(wh as any).warehouse_locations.map((loc: any) => (
                                            <div key={loc.id} className="bg-slate-950/50 rounded-lg p-2 border border-slate-800/50">
                                                <div className="text-[11px] font-bold text-slate-400 flex justify-between">
                                                    <span>📍 {loc.name}</span>
                                                    <span className="text-slate-600">{loc.code}</span>
                                                </div>
                                                {loc.warehouse_bins?.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {loc.warehouse_bins.map((bin: any) => (
                                                            <span key={bin.id} className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                                {bin.code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-slate-600 italic">No locations defined</div>
                                )}
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-auto">
                                <span className={`text-[10px] font-bold uppercase ${wh.is_active ? 'text-emerald-500' : 'text-slate-600'}`}>
                                    {wh.is_active ? 'Operational' : 'Inactive'}
                                </span>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => navigate(`/inventory/warehouses/${wh.id}`)}
                                        className="text-slate-400 hover:text-blue-400 text-[10px] font-bold uppercase tracking-widest transition-colors"
                                    >
                                        View
                                    </button>
                                    {can('manage_locations') && canCreateWarehouse && (
                                        <>
                                            <button
                                                onClick={() => handleEditClick(wh)}
                                                className="text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => setDeletingWarehouse(wh)}
                                                className="text-slate-400 hover:text-rose-400 text-[10px] font-bold uppercase tracking-widest transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}


                    {can('manage_locations') && canCreateWarehouse && (
                        <button
                            onClick={() => !atWarehouseLimit && setIsCreateModalOpen(true)}
                            disabled={atWarehouseLimit}
                            title={atWarehouseLimit ? `${warehouses.length}/${maxWarehouses} warehouses used — upgrade your plan to add more` : undefined}
                            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all gap-3 h-full min-h-[200px] ${atWarehouseLimit ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-800 text-slate-500 hover:border-slate-400 hover:bg-slate-900/30'}`}
                        >
                            <div className="p-3 rounded-full bg-slate-800/50">
                                <Plus size={24} />
                            </div>
                            <span className="font-semibold text-sm">Add New Warehouse</span>
                            {atWarehouseLimit && <span className="text-xs text-amber-500/70">Plan limit reached</span>}
                        </button>
                    )}
                </div>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Register New Warehouse"
            >
                <form onSubmit={handleCreateWarehouse} className="space-y-4 text-slate-200">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Warehouse Name *</label>
                            <input
                                required
                                type="text"
                                value={newWarehouse.name}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="e.g. Dubai South Hub"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Short Code *</label>
                            <input
                                required
                                type="text"
                                value={newWarehouse.code}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, code: e.target.value.toUpperCase() })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                placeholder="e.g. DXB-01"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Warehouse Type</label>
                            <select
                                value={newWarehouse.warehouse_type}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, warehouse_type: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-200"
                            >
                                <option value="general">General</option>
                                <option value="distribution">Distribution</option>
                                <option value="cold_storage">Cold Storage</option>
                                <option value="manufacturing">Manufacturing</option>
                                <option value="transit">Transit / Cross-dock</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Street Address</label>
                            <input
                                type="text"
                                value={newWarehouse.address}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="Street address"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">City</label>
                            <input
                                type="text"
                                value={newWarehouse.city}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, city: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="City"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">State / Region</label>
                            <input
                                type="text"
                                value={newWarehouse.state}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, state: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="State / Province"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Country</label>
                            <input
                                type="text"
                                value={newWarehouse.country}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, country: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="Country"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Contact Person</label>
                            <input
                                type="text"
                                value={newWarehouse.contact_person}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, contact_person: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="Manager / Supervisor name"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Contact Phone</label>
                            <input
                                type="tel"
                                value={newWarehouse.contact_phone}
                                onChange={(e) => setNewWarehouse({ ...newWarehouse, contact_phone: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="+971 50 000 0000"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(false)}
                            disabled={isCreating}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            {isCreating ? <><Loader2 size={18} className="animate-spin" /> Creating...</> : 'Register Warehouse'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingWarehouse}
                onClose={() => setEditingWarehouse(null)}
                title="Edit Warehouse"
            >
                <form onSubmit={handleSaveEdit} className="space-y-4 text-slate-200">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
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
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Short Code *</label>
                            <input
                                required
                                type="text"
                                value={editForm.code}
                                onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Warehouse Type</label>
                            <select
                                value={editForm.warehouse_type}
                                onChange={(e) => setEditForm({ ...editForm, warehouse_type: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-200"
                            >
                                <option value="general">General</option>
                                <option value="distribution">Distribution</option>
                                <option value="cold_storage">Cold Storage</option>
                                <option value="manufacturing">Manufacturing</option>
                                <option value="transit">Transit / Cross-dock</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Street Address</label>
                            <input
                                type="text"
                                value={editForm.address}
                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">City</label>
                            <input
                                type="text"
                                value={editForm.city}
                                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">State / Region</label>
                            <input
                                type="text"
                                value={editForm.state}
                                onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Country</label>
                            <input
                                type="text"
                                value={editForm.country}
                                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Contact Person</label>
                            <input
                                type="text"
                                value={editForm.contact_person}
                                onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Contact Phone</label>
                            <input
                                type="tel"
                                value={editForm.contact_phone}
                                onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Active / Operational</span>
                    </label>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setEditingWarehouse(null)}
                            disabled={isSaving}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-all"
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

            {/* Delete Confirmation */}
            {deletingWarehouse && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                                <Trash2 size={24} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Delete Warehouse</h3>
                                <p className="text-slate-400 text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-slate-300 mb-6">
                            Are you sure you want to delete <strong className="text-white">{deletingWarehouse.name}</strong>?
                            Warehouses with stock cannot be deleted.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingWarehouse(null)}
                                disabled={isDeleting}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-all"
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
        </div>
    );
};

export default StockLocationsPage;
