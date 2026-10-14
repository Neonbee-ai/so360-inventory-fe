import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendorService } from '../../services/vendorService';
import { Plus, Search, Trash2, Loader2, X, AlertCircle } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { QuotaBar, QuotaGate, FeatureGate } from '@so360/design-system';

interface Vendor {
    id: string;
    name: string;
    email: string;
    phone: string;
    address?: string;
    vendor_profiles?: [{
        classification: string;
        is_preferred: boolean;
        performance_rating: number;
        payment_terms?: string;
    }];
}

const VendorListPage = () => {
    const navigate = useNavigate();
    const { can } = useAuth();
    const shell = useShellBridge();
    const createVendorState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:vendors:create') : 'enabled';
    const canCreateVendor = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('suppliers.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && createVendorState === 'enabled';
    const quotaChecks = useMemo(() => [{ module_code: 'inventory', quota_key: 'max_vendors' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_vendors');
    const { isSandboxMode, sandboxEntryLimit, isLimited } = useSandboxLimit();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Create form state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newVendor, setNewVendor] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        vendor_profile: {
            classification: 'supplier',
            is_preferred: false,
            payment_terms: 'Net 30'
        }
    });

    // Delete state
    const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await vendorService.getVendors();
            setVendors(data);
        } catch (error: any) {
            setError(error.message || 'Failed to fetch vendors');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        setError(null);
        try {
            await vendorService.createVendor(newVendor);
            setShowCreateModal(false);
            setNewVendor({
                name: '',
                email: '',
                phone: '',
                address: '',
                vendor_profile: {
                    classification: 'supplier',
                    is_preferred: false,
                    payment_terms: 'Net 30'
                }
            });
            fetchData();
            setSuccessMessage('Vendor created successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to create vendor');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteVendor = async () => {
        if (!deletingVendor) return;
        setIsDeleting(true);
        setError(null);
        try {
            await vendorService.deleteVendor(deletingVendor.id);
            setDeletingVendor(null);
            fetchData();
            setSuccessMessage('Vendor deleted successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to delete vendor');
            setDeletingVendor(null);
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredVendors = vendors.filter(vendor =>
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                        Vendors & Subcontractors
                    </h1>
                    <p className="text-fg-muted mt-2 font-medium">Manage supply chain partners and commercial contracts.</p>
                </div>
                {can('suppliers.create') && (
                    <FeatureGate state={createVendorState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <QuotaGate
                        quotaKey="max_vendors"
                        moduleCode="inventory"
                        used={vendors.length}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        disableOnExceeded
                    >
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-success hover:bg-success text-primary-fg rounded-xl font-semibold transition-all shadow-lg shadow-emerald-900/20 active:scale-95 flex items-center gap-2"
                        >
                            <Plus size={20} /> Add Vendor
                        </button>
                    </QuotaGate>
                    </FeatureGate>
                )}
            </div>

            {(quotaData || vendors.length > 0) && (
                <QuotaBar
                    label="Vendors"
                    used={vendors.length}
                    limit={quotaData?.limit ?? 0}
                    isUnlimited={quotaData?.is_unlimited}
                    className="mb-6"
                />
            )}

            {/* Messages */}
            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto hover:text-rose-300">
                        <X size={16} />
                    </button>
                </div>
            )}

            {successMessage && (
                <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg">
                    {successMessage}
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" size={18} />
                <input
                    type="text"
                    placeholder="Search vendors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface/50 border border-line pl-12 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-success/50 focus:border-success transition-all text-fg"
                />
            </div>

            {/* Sandbox limit notice */}
            {isSandboxMode && isLimited(filteredVendors.length) && (
                <div className="px-4 py-2.5 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm flex items-center gap-2">
                    <span className="font-semibold">Sandbox mode:</span>
                    showing {sandboxEntryLimit} of {filteredVendors.length} vendors — full list visible in production.
                </div>
            )}

            {/* Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-12 text-center text-fg-subtle animate-pulse font-medium">Loading vendor ecosystem...</div>
                ) : (isSandboxMode ? filteredVendors.slice(0, sandboxEntryLimit) : filteredVendors).length === 0 ? (
                    <div className="col-span-full py-12 text-center text-fg-subtle bg-surface/30 border border-dashed border-line rounded-3xl">
                        <div className="text-4xl mb-4">🤝</div>
                        <div className="text-lg font-semibold text-fg-muted">No vendors found</div>
                        <p className="text-fg-subtle mt-1">
                            {searchTerm ? 'Try adjusting your search.' : 'Start by adding your first supplier or subcontractor.'}
                        </p>
                    </div>
                ) : (isSandboxMode ? filteredVendors.slice(0, sandboxEntryLimit) : filteredVendors).map((vendor) => {
                    const profile = vendor.vendor_profiles?.[0];
                    return (
                        <div key={vendor.id} className="bg-surface/50 border border-line rounded-3xl p-6 group hover:border-success/50 transition-all hover:bg-surface-raised/30 backdrop-blur-sm shadow-xl shadow-black/10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center text-success font-bold text-xl border border-success/20">
                                    {vendor.name.charAt(0)}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {profile?.is_preferred && (
                                        <span className="bg-success/20 text-success text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border border-success/30">
                                            Preferred
                                        </span>
                                    )}
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle bg-surface-raised px-2 py-1 rounded-md">
                                        {profile?.classification || 'Supplier'}
                                    </span>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-fg group-hover:text-success transition-colors uppercase tracking-tight">{vendor.name}</h3>
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center gap-3 text-sm text-fg-muted">
                                    <span className="opacity-50 text-base">📧</span>
                                    <span className="truncate">{vendor.email || 'No email provided'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-fg-muted">
                                    <span className="opacity-50 text-base">📞</span>
                                    <span>{vendor.phone || 'No phone provided'}</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-line flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                    <span className="text-warning font-bold">{profile?.performance_rating || 'N/A'}</span>
                                    <span className="text-[10px] text-fg-subtle font-bold uppercase">Rating</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => navigate(`/vendors/${vendor.id}`)}
                                        className="text-xs font-bold text-primary hover:text-primary uppercase tracking-widest transition-colors"
                                    >
                                        View Profile →
                                    </button>
                                    {can('suppliers.create') && canCreateVendor && (
                                        <button
                                            onClick={() => setDeletingVendor(vendor)}
                                            className="text-fg-subtle hover:text-rose-400 transition-colors"
                                            title="Delete Vendor"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Add New Vendor"
            >
                <form onSubmit={handleCreateVendor} className="space-y-4 text-fg">
                    <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1.5">Vendor Name *</label>
                        <input
                            required
                            type="text"
                            value={newVendor.name}
                            onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                            className="w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-success/50"
                            placeholder="Company name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-fg-muted mb-1.5">Email</label>
                            <input
                                type="email"
                                value={newVendor.email}
                                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                                className="w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-success/50"
                                placeholder="vendor@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fg-muted mb-1.5">Phone</label>
                            <input
                                type="tel"
                                value={newVendor.phone}
                                onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                                className="w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-success/50"
                                placeholder="+971 50 123 4567"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1.5">Address</label>
                        <textarea
                            value={newVendor.address}
                            onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                            className="w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-success/50 h-20 resize-none"
                            placeholder="Business address"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-fg-muted mb-1.5">Classification</label>
                            <select
                                value={newVendor.vendor_profile.classification}
                                onChange={(e) => setNewVendor({
                                    ...newVendor,
                                    vendor_profile: { ...newVendor.vendor_profile, classification: e.target.value }
                                })}
                                className="w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-success/50"
                            >
                                <option value="supplier">Supplier</option>
                                <option value="subcontractor">Subcontractor</option>
                                <option value="service_provider">Service Provider</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fg-muted mb-1.5">Payment Terms</label>
                            <select
                                value={newVendor.vendor_profile.payment_terms}
                                onChange={(e) => setNewVendor({
                                    ...newVendor,
                                    vendor_profile: { ...newVendor.vendor_profile, payment_terms: e.target.value }
                                })}
                                className="w-full bg-surface-raised border border-line-strong rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-success/50"
                            >
                                <option value="Net 15">Net 15</option>
                                <option value="Net 30">Net 30</option>
                                <option value="Net 45">Net 45</option>
                                <option value="Net 60">Net 60</option>
                                <option value="COD">Cash on Delivery</option>
                            </select>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={newVendor.vendor_profile.is_preferred}
                            onChange={(e) => setNewVendor({
                                ...newVendor,
                                vendor_profile: { ...newVendor.vendor_profile, is_preferred: e.target.checked }
                            })}
                            className="w-4 h-4 rounded border-line-strong bg-surface-raised text-emerald-600 focus:ring-success/50"
                        />
                        <span className="text-sm text-fg-muted group-hover:text-fg transition-colors">Mark as Preferred Vendor</span>
                    </label>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(false)}
                            disabled={isCreating}
                            className="flex-1 bg-surface-raised hover:bg-line-strong text-fg font-semibold py-2.5 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="flex-1 bg-success hover:bg-success disabled:bg-success/50 text-primary-fg font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                        >
                            {isCreating ? <><Loader2 size={18} className="animate-spin" /> Creating...</> : 'Add Vendor'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            {deletingVendor && (
                <div className="fixed inset-0 bg-overlay/60 backdrop-blur-sm flex items-center justify-center z-[600]">
                    <div className="bg-surface border border-line rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                                <Trash2 size={24} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-fg">Delete Vendor</h3>
                                <p className="text-fg-muted text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-fg-muted mb-6">
                            Are you sure you want to delete <strong className="text-fg">{deletingVendor.name}</strong>?
                            Vendors with purchase orders or invoices cannot be deleted.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingVendor(null)}
                                disabled={isDeleting}
                                className="flex-1 bg-surface-raised hover:bg-line-strong text-fg font-semibold py-2.5 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteVendor}
                                disabled={isDeleting}
                                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-primary-fg font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
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

export default VendorListPage;
