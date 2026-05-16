import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Building2, Mail, Phone, MapPin, AlertCircle,
    Edit2, Trash2, Save, Loader2, Star, FileText, DollarSign,
    Package, Calendar, Plus, ExternalLink
} from 'lucide-react';
import { vendorService } from '../../services/vendorService';
import { Modal } from '../../components/common/Modal';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { CreateInvoiceModal } from '../../components/vendors/CreateInvoiceModal';
import { useActivity } from '@so360/shell-context';

interface VendorDetail {
    id: string;
    name: string;
    email: string;
    phone: string;
    address?: string;
    vendor_profiles?: Array<{
        classification: string;
        is_preferred: boolean;
        performance_rating: number;
        rating_count: number;
        payment_terms?: string;
    }>;
    purchase_orders?: Array<{
        id: string;
        po_number: string;
        status: string;
        total_amount: number;
        created_at: string;
    }>;
    vendor_invoices?: Array<{
        id: string;
        invoice_number: string;
        status: string;
        total_amount: number;
        due_date: string;
        attachment_url?: string;
        po_id?: string;
    }>;
}

const VendorDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { can } = useAuth();
    const { recordActivity } = useActivity();
    const [vendor, setVendor] = useState<VendorDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        vendor_profile: {
            classification: 'supplier',
            is_preferred: false,
            payment_terms: 'Net 30',
        }
    });
    const [isSaving, setIsSaving] = useState(false);

    // Rating state
    const [hoverRating, setHoverRating] = useState(0);
    const [ratingLoading, setRatingLoading] = useState(false);

    // Delete state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Invoice modal state
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

    const fetchVendor = async () => {
        if (!id) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await vendorService.getVendorDetail(id);
            setVendor(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load vendor details');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVendor();
    }, [id]);

    const handleEditClick = () => {
        if (vendor) {
            const profile = vendor.vendor_profiles?.[0];
            setEditForm({
                name: vendor.name,
                email: vendor.email || '',
                phone: vendor.phone || '',
                address: vendor.address || '',
                vendor_profile: {
                    classification: profile?.classification || 'supplier',
                    is_preferred: profile?.is_preferred || false,
                    payment_terms: profile?.payment_terms || 'Net 30',
                }
            });
            setIsEditModalOpen(true);
        }
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        setIsSaving(true);
        try {
            await vendorService.updateVendor(id, editForm);
            recordActivity({ eventType: 'inventory.vendor.updated', eventCategory: 'data', description: `Updated vendor "${editForm.name}"`, resourceType: 'vendor', resourceId: id }).catch(() => {});
            setIsEditModalOpen(false);
            fetchVendor();
        } catch (err: any) {
            setError(err.message || 'Failed to update vendor');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteVendor = async () => {
        if (!id) return;
        setIsDeleting(true);
        try {
            await vendorService.deleteVendor(id);
            navigate('/vendors');
        } catch (err: any) {
            setError(err.message || 'Failed to delete vendor');
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleRatingClick = async (newRating: number) => {
        if (!id || !can('manage_vendors') || ratingLoading) return;
        const oldRating = vendor?.vendor_profiles?.[0]?.performance_rating;
        const oldCount = vendor?.vendor_profiles?.[0]?.rating_count ?? 0;
        // Optimistic update
        setVendor(prev => prev ? {
            ...prev,
            vendor_profiles: prev.vendor_profiles?.map(p => ({ ...p, performance_rating: newRating }))
        } : prev);
        setRatingLoading(true);
        try {
            const result = await vendorService.rateVendor(id, newRating);
            // Update with server-returned average and count
            setVendor(prev => prev ? {
                ...prev,
                vendor_profiles: prev.vendor_profiles?.map(p => ({
                    ...p,
                    performance_rating: result.average,
                    rating_count: result.count,
                }))
            } : prev);
        } catch {
            // Revert on failure
            setVendor(prev => prev ? {
                ...prev,
                vendor_profiles: prev.vendor_profiles?.map(p => ({ ...p, performance_rating: oldRating ?? 0, rating_count: oldCount }))
            } : prev);
        } finally {
            setRatingLoading(false);
        }
    };

    if (isLoading) return <div className="p-8"><TableSkeleton /></div>;
    if (error || !vendor) return (
        <div className="p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">{error || 'Vendor not found'}</h2>
            <button onClick={() => navigate('/vendors')} className="text-blue-400 hover:underline">Back to Vendors</button>
        </div>
    );

    const profile = vendor.vendor_profiles?.[0];

    return (
        <div className="p-8">
            <button
                onClick={() => navigate('/vendors')}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors group"
            >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to Vendors
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Vendor Info Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                            {profile?.is_preferred && (
                                <span className="px-2 py-1 rounded text-[10px] uppercase font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                    Preferred
                                </span>
                            )}
                            {can('manage_vendors') && (
                                <>
                                    <button
                                        onClick={handleEditClick}
                                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-blue-400"
                                        title="Edit Vendor"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-rose-400"
                                        title="Delete Vendor"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="flex items-start gap-4 mb-8 mt-6">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-xl">
                                <Building2 size={32} className="text-emerald-400" />
                            </div>
                            <div className="pt-1">
                                <h1 className="text-2xl font-bold text-white mb-1 leading-tight">{vendor.name}</h1>
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                    {profile?.classification || 'Supplier'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                <Mail size={16} className="text-slate-400" />
                                <span className="text-sm text-white">{vendor.email || 'No email'}</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                <Phone size={16} className="text-slate-400" />
                                <span className="text-sm text-white">{vendor.phone || 'No phone'}</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                <MapPin size={16} className="text-slate-400" />
                                <span className="text-sm text-white">{vendor.address || 'No address'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Rating Card */}
                    <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-900/40">
                        <div className="flex items-center gap-2 mb-3">
                            <Star size={20} fill="currentColor" className="text-yellow-300" />
                            <span className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider">Performance Rating</span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map(star => {
                                const isActive = star <= (hoverRating || (profile?.performance_rating ?? 0));
                                return (
                                    <Star
                                        key={star}
                                        size={28}
                                        fill={isActive ? 'currentColor' : 'none'}
                                        className={`transition-colors ${
                                            can('manage_vendors')
                                                ? 'cursor-pointer'
                                                : 'cursor-default'
                                        } ${
                                            isActive
                                                ? 'text-yellow-300'
                                                : 'text-emerald-300/30'
                                        } ${ratingLoading ? 'animate-pulse' : ''}`}
                                        onMouseEnter={() => can('manage_vendors') && !ratingLoading && setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => handleRatingClick(star)}
                                    />
                                );
                            })}
                        </div>
                        <div className="text-3xl font-black">
                            {profile?.performance_rating ? Number(profile.performance_rating).toFixed(1) : 'N/A'}
                            <span className="text-lg font-normal text-emerald-200">/5</span>
                        </div>
                        {(profile?.rating_count ?? 0) > 0 && (
                            <p className="text-xs text-emerald-200/80">from {profile?.rating_count} rating{profile?.rating_count !== 1 ? 's' : ''}</p>
                        )}
                        {can('manage_vendors') && (
                            <p className="mt-1 text-[11px] text-emerald-200/60">Click to rate</p>
                        )}
                        <p className="mt-2 text-sm text-emerald-200">
                            Payment Terms: {profile?.payment_terms || 'Not set'}
                        </p>
                    </div>
                </div>

                {/* Purchase Orders & Invoices */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Purchase Orders */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Package size={20} className="text-blue-400" />
                            <h2 className="text-xl font-bold text-white">Purchase Orders</h2>
                        </div>
                        {vendor.purchase_orders && vendor.purchase_orders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                            <th className="pb-3">PO Number</th>
                                            <th className="pb-3">Status</th>
                                            <th className="pb-3">Date</th>
                                            <th className="pb-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vendor.purchase_orders.map((po) => (
                                            <tr key={po.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                                <td className="py-3 font-mono text-sm text-blue-400">{po.po_number}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${
                                                        po.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        po.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                                                        'bg-slate-500/10 text-slate-400'
                                                    }`}>
                                                        {po.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-slate-400 text-sm">
                                                    {new Date(po.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="py-3 text-right font-bold text-white">
                                                    ${po.total_amount?.toLocaleString() || '0'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500">
                                <Package size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No purchase orders yet</p>
                            </div>
                        )}
                    </div>

                    {/* Invoices */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <FileText size={20} className="text-purple-400" />
                                <h2 className="text-xl font-bold text-white">Vendor Invoices</h2>
                            </div>
                            {can('manage_vendors') && (
                                <button
                                    onClick={() => setIsInvoiceModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-all"
                                >
                                    <Plus size={16} /> Create Invoice
                                </button>
                            )}
                        </div>
                        {vendor.vendor_invoices && vendor.vendor_invoices.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                            <th className="pb-3">Invoice</th>
                                            <th className="pb-3">Status</th>
                                            <th className="pb-3">Due Date</th>
                                            <th className="pb-3 text-right">Amount</th>
                                            <th className="pb-3 text-center">Attachment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vendor.vendor_invoices.map((inv) => (
                                            <tr key={inv.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                                <td className="py-3 font-mono text-sm text-purple-400">{inv.invoice_number}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${
                                                        inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        inv.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                                                        inv.status === 'overdue' ? 'bg-rose-500/10 text-rose-400' :
                                                        'bg-slate-500/10 text-slate-400'
                                                    }`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-slate-400 text-sm">
                                                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '--'}
                                                </td>
                                                <td className="py-3 text-right font-bold text-white">
                                                    ${inv.total_amount?.toLocaleString() || '0'}
                                                </td>
                                                <td className="py-3 text-center">
                                                    {inv.attachment_url ? (
                                                        <a
                                                            href={inv.attachment_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
                                                            title="View attachment"
                                                        >
                                                            <FileText size={16} />
                                                            <ExternalLink size={12} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-600">--</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500">
                                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No invoices yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Invoice Modal */}
            <CreateInvoiceModal
                isOpen={isInvoiceModalOpen}
                onClose={() => setIsInvoiceModalOpen(false)}
                vendorId={id!}
                vendorPOs={vendor.purchase_orders || []}
                onSuccess={() => { setIsInvoiceModalOpen(false); fetchVendor(); }}
            />

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Vendor"
            >
                <form onSubmit={handleSaveEdit} className="space-y-4 text-slate-200">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Vendor Name *</label>
                        <input
                            required
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Phone</label>
                            <input
                                type="tel"
                                value={editForm.phone}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Address</label>
                        <textarea
                            value={editForm.address}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-20 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Classification</label>
                            <select
                                value={editForm.vendor_profile.classification}
                                onChange={(e) => setEditForm({
                                    ...editForm,
                                    vendor_profile: { ...editForm.vendor_profile, classification: e.target.value }
                                })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            >
                                <option value="supplier">Supplier</option>
                                <option value="subcontractor">Subcontractor</option>
                                <option value="service_provider">Service Provider</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Payment Terms</label>
                            <select
                                value={editForm.vendor_profile.payment_terms}
                                onChange={(e) => setEditForm({
                                    ...editForm,
                                    vendor_profile: { ...editForm.vendor_profile, payment_terms: e.target.value }
                                })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
                            checked={editForm.vendor_profile.is_preferred}
                            onChange={(e) => setEditForm({
                                ...editForm,
                                vendor_profile: { ...editForm.vendor_profile, is_preferred: e.target.checked }
                            })}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Mark as Preferred Vendor</span>
                    </label>

                    <div className="flex gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={isSaving}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save Changes</>}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                                <Trash2 size={24} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Delete Vendor</h3>
                                <p className="text-slate-400 text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-slate-300 mb-6">
                            Are you sure you want to delete <strong className="text-white">{vendor.name}</strong>?
                            Vendors with purchase orders or invoices cannot be deleted.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteVendor}
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

export default VendorDetailPage;
