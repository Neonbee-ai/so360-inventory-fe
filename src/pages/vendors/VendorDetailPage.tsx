import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, FileText, Plus, ExternalLink } from 'lucide-react';
import {
    DetailPageTemplate, Alert, Button, Card, DataTable, DescriptionList, StatusBadge,
    Modal, ConfirmDialog, TextField, Textarea, Select, Checkbox, EmptyState,
} from '@so360/design-system';
import { vendorService } from '../../services/vendorService';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { CreateInvoiceModal } from '../../components/vendors/CreateInvoiceModal';
import { useActivity } from '@so360/shell-context';
import { useInventoryFormatters } from '../../utils/formatters';

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
    const formatters = useInventoryFormatters();
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
        if (!id || !can('suppliers.create') || ratingLoading) return;
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

    const canManage = can('suppliers.create');

    if (isLoading) {
        return (
            <DetailPageTemplate title="Vendor" trail={[{ label: 'Vendors', to: '/vendors', onClick: () => navigate('/vendors') }]}>
                <TableSkeleton />
            </DetailPageTemplate>
        );
    }
    if (error || !vendor) {
        return (
            <DetailPageTemplate title="Vendor">
                <Alert variant="error" title="Unable to load vendor">{error || 'Vendor not found'}</Alert>
                <Button variant="secondary" onClick={() => navigate('/vendors')}>Back to Vendors</Button>
            </DetailPageTemplate>
        );
    }

    const profile = vendor.vendor_profiles?.[0];
    const pos = vendor.purchase_orders ?? [];
    const invoices = vendor.vendor_invoices ?? [];

    return (
        <>
            <DetailPageTemplate
                title={vendor.name}
                trail={[{ label: 'Vendors', to: '/vendors', onClick: () => navigate('/vendors') }]}
                status={profile?.is_preferred ? <StatusBadge status="Preferred" /> : undefined}
                meta={<span className="text-nb-sm text-fg-muted capitalize">{profile?.classification || 'Supplier'}</span>}
                primaryAction={canManage ? (
                    <Button variant="primary" onClick={() => setIsInvoiceModalOpen(true)}><Plus size={16} />
                        Create Invoice
                    </Button>
                ) : undefined}
                sidePanel={(
                    <div className="flex flex-col gap-nb-4">
                    <Card title="Contact">
                        <DescriptionList
                            items={[
                                { label: 'Email', value: vendor.email || 'No email' },
                                { label: 'Phone', value: vendor.phone || 'No phone' },
                                { label: 'Address', value: vendor.address || 'No address' },
                            ]}
                        />
                    </Card>

                    <Card title="Performance rating">
                        <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map(star => {
                                const isActive = star <= (hoverRating || (profile?.performance_rating ?? 0));
                                return (
                                    <Star
                                        key={star}
                                        size={28}
                                        fill={isActive ? 'currentColor' : 'none'}
                                        className={`transition-colors ${canManage ? 'cursor-pointer' : 'cursor-default'} ${isActive ? 'text-warning' : 'text-fg-subtle'} ${ratingLoading ? 'animate-pulse' : ''}`}
                                        onMouseEnter={() => canManage && !ratingLoading && setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => handleRatingClick(star)}
                                    />
                                );
                            })}
                        </div>
                        <div className="text-3xl font-black text-fg">
                            {profile?.performance_rating ? Number(profile.performance_rating).toFixed(1) : 'N/A'}
                            <span className="text-lg font-normal text-fg-muted">/5</span>
                        </div>
                        {(profile?.rating_count ?? 0) > 0 && (
                            <p className="text-xs text-fg-muted">from {profile?.rating_count} rating{profile?.rating_count !== 1 ? 's' : ''}</p>
                        )}
                        {canManage && <p className="mt-1 text-[11px] text-fg-subtle">Click to rate</p>}
                        <p className="mt-2 text-sm text-fg-muted">Payment Terms: {profile?.payment_terms || 'Not set'}</p>
                    </Card>
                    </div>
                )}
                overflowActions={canManage ? [
                    { label: 'Edit Vendor', onSelect: handleEditClick },
                    { label: 'Delete Vendor', onSelect: () => setShowDeleteConfirm(true), danger: true },
                ] : undefined}
            >
                <div className="flex flex-col gap-nb-4">
                        <Card title="Purchase orders">
                            <DataTable
                                data-testid="vendor-pos-table"
                                rowKey={(po: any) => po.id}
                                rows={pos}
                                emptyState=<EmptyState title="No purchase orders yet" />
                                columns={[
                                    { key: 'po_number', header: 'PO Number', render: (po: any) => <span className="font-mono text-sm">{po.po_number}</span> },
                                    { key: 'status', header: 'Status', render: (po: any) => <StatusBadge status={po.status} /> },
                                    { key: 'created_at', header: 'Date', render: (po: any) => formatters.formatDate(po.created_at) },
                                    { key: 'total_amount', header: 'Amount', align: 'right', render: (po: any) => formatters.formatCurrency(po.total_amount ?? 0) },
                                ]}
                            />
                        </Card>

                        <Card title="Vendor invoices">
                            <DataTable
                                data-testid="vendor-invoices-table"
                                rowKey={(inv: any) => inv.id}
                                rows={invoices}
                                emptyState=<EmptyState title="No invoices yet" />
                                columns={[
                                    { key: 'invoice_number', header: 'Invoice', render: (inv: any) => <span className="font-mono text-sm">{inv.invoice_number}</span> },
                                    { key: 'status', header: 'Status', render: (inv: any) => <StatusBadge status={inv.status} /> },
                                    { key: 'due_date', header: 'Due Date', render: (inv: any) => (inv.due_date ? formatters.formatDate(inv.due_date) : '--') },
                                    { key: 'total_amount', header: 'Amount', align: 'right', render: (inv: any) => formatters.formatCurrency(inv.total_amount ?? 0) },
                                    {
                                        key: 'attachment_url', header: 'Attachment', align: 'center',
                                        render: (inv: any) => inv.attachment_url ? (
                                            <a href={inv.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary" title="View attachment">
                                                <FileText size={16} /><ExternalLink size={12} />
                                            </a>
                                        ) : <span className="text-fg-subtle">--</span>,
                                    },
                                ]}
                            />
                        </Card>
                    </div>
            </DetailPageTemplate>

            <CreateInvoiceModal
                isOpen={isInvoiceModalOpen}
                onClose={() => setIsInvoiceModalOpen(false)}
                vendorId={id!}
                vendorPOs={vendor.purchase_orders || []}
                onSuccess={() => { setIsInvoiceModalOpen(false); fetchVendor(); }}
            />

            <Modal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Vendor"
                dismissible={!isSaving}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button variant="primary" type="submit" form="edit-vendor-form" loading={isSaving} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </>
                }
            >
                <form id="edit-vendor-form" onSubmit={handleSaveEdit} className="space-y-4">
                    <TextField label="Vendor Name" name="name" required value={editForm.name}
                        onChange={(e: any) => setEditForm({ ...editForm, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <TextField label="Email" name="email" type="email" value={editForm.email}
                            onChange={(e: any) => setEditForm({ ...editForm, email: e.target.value })} />
                        <TextField label="Phone" name="phone" type="tel" value={editForm.phone}
                            onChange={(e: any) => setEditForm({ ...editForm, phone: e.target.value })} />
                    </div>
                    <Textarea label="Address" name="address" value={editForm.address}
                        onChange={(e: any) => setEditForm({ ...editForm, address: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Classification" name="classification" value={editForm.vendor_profile.classification}
                            options={[
                                { value: 'supplier', label: 'Supplier' },
                                { value: 'subcontractor', label: 'Subcontractor' },
                                { value: 'service_provider', label: 'Service Provider' },
                            ]}
                            onChange={(e: any) => setEditForm({ ...editForm, vendor_profile: { ...editForm.vendor_profile, classification: e.target.value } })} />
                        <Select label="Payment Terms" name="payment_terms" value={editForm.vendor_profile.payment_terms}
                            options={[
                                { value: 'Net 15', label: 'Net 15' },
                                { value: 'Net 30', label: 'Net 30' },
                                { value: 'Net 45', label: 'Net 45' },
                                { value: 'Net 60', label: 'Net 60' },
                                { value: 'COD', label: 'Cash on Delivery' },
                            ]}
                            onChange={(e: any) => setEditForm({ ...editForm, vendor_profile: { ...editForm.vendor_profile, payment_terms: e.target.value } })} />
                    </div>
                    <Checkbox name="is_preferred" label="Mark as Preferred Vendor" checked={editForm.vendor_profile.is_preferred}
                        onChange={(e: any) => setEditForm({ ...editForm, vendor_profile: { ...editForm.vendor_profile, is_preferred: e.target.checked } })} />
                </form>
            </Modal>

            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete Vendor"
                message={`Are you sure you want to delete ${vendor.name}? Vendors with purchase orders or invoices cannot be deleted.`}
                intent="danger"
                confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
                onConfirm={handleDeleteVendor}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </>
    );
};

export default VendorDetailPage;
