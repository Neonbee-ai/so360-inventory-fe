import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendorService } from '../../services/vendorService';
import { useAuth } from '../../hooks/useAuth';
import { useShellBridge, useQuota, useSandboxLimit, useBusinessSettings } from '@so360/shell-context';
import {
    Alert, Button, Checkbox, ConfirmDialog, DataTable, EmptyState, FeatureGate, ListPageTemplate,
    Modal, QuotaBar, QuotaGate, SearchInput, Select, StatusBadge, Textarea, TextField, FieldGrid,
} from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { VendorBankAccountFields } from '../../components/vendors/VendorBankAccountFields';
import {
    VENDOR_BANK_PERMS, emptyBankForm, isVendorBankEnabled, toBankPayload, validateBankForm,
    type BankFormErrors, type BankFormState,
} from '../../utils/vendorBank';

/** Optional bank step in the create-vendor form; mounted only when ticked. Defaults currency from org settings. */
const NewVendorBankStep: React.FC<{ value: BankFormState; onChange: (v: BankFormState) => void; errors: BankFormErrors }> = ({ value, onChange, errors }) => {
    const { settings } = useBusinessSettings();
    const orgCurrency = settings?.base_currency;
    useEffect(() => {
        if (!value.currency && orgCurrency) onChange({ ...value, currency: orgCurrency.toUpperCase() });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgCurrency]);
    return <VendorBankAccountFields value={value} onChange={onChange} errors={errors} showPrimaryToggle={false} />;
};

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

const CLASSIFICATION_OPTIONS = [
    { value: 'supplier', label: 'Supplier' },
    { value: 'subcontractor', label: 'Subcontractor' },
    { value: 'service_provider', label: 'Service Provider' },
];

const PAYMENT_TERMS_OPTIONS = [
    { value: 'Net 15', label: 'Net 15' },
    { value: 'Net 30', label: 'Net 30' },
    { value: 'Net 45', label: 'Net 45' },
    { value: 'Net 60', label: 'Net 60' },
    { value: 'COD', label: 'Cash on Delivery' },
];

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
    const [nameError, setNameError] = useState<string | null>(null);
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

    // Optional bank details on create (flag submodule:inventory:vendor_bank_details)
    const canAddBank = isVendorBankEnabled(shell) && can(VENDOR_BANK_PERMS.MANAGE);
    const [addBank, setAddBank] = useState(false);
    const [bankForm, setBankForm] = useState<BankFormState>(emptyBankForm());
    const [bankErrors, setBankErrors] = useState<BankFormErrors>({});
    const [bankWarning, setBankWarning] = useState<string | null>(null);

    // Delete state
    const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    // `ensure`: a just-created vendor. The list endpoint is cached per BE
    // instance (pm2 cluster), so an immediate refetch can miss the new row;
    // keep it visible so create -> search/edit/delete works (r282).
    const fetchData = async (ensure?: any) => {
        setLoading(true);
        setError(null);
        try {
            const data = await vendorService.getVendors();
            const list = Array.isArray(data) ? data : [];
            setVendors(ensure?.id && !list.some((v: any) => v.id === ensure.id) ? [ensure, ...list] : list);
        } catch (error: any) {
            setError(error.message || 'Failed to fetch vendors');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVendor.name.trim()) {
            setNameError('Vendor name is required.');
            return;
        }
        setNameError(null);
        const withBank = canAddBank && addBank;
        if (withBank) {
            const errs = validateBankForm(bankForm, 'create');
            setBankErrors(errs);
            if (Object.keys(errs).length) return;
        }
        setIsCreating(true);
        setError(null);
        try {
            const created: any = await vendorService.createVendor({ ...newVendor, name: newVendor.name.trim() });
            let bankFailed: string | null = null;
            if (withBank) {
                const vendorId = created?.id ?? created?.data?.id;
                try {
                    if (!vendorId) throw new Error('vendor id missing from response');
                    await vendorService.createBankAccount(vendorId, { ...toBankPayload(bankForm, 'create'), is_primary: true });
                } catch (bankErr: any) {
                    bankFailed = bankErr?.message || 'unknown error';
                }
            }
            setAddBank(false);
            setBankForm(emptyBankForm());
            setBankErrors({});
            setBankWarning(null);
            if (bankFailed) {
                setBankWarning(`Vendor created, but the bank account was not saved (${bankFailed}). Add it from the vendor profile.`);
            }
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
            const createdRow = created?.data ?? created;
            fetchData(createdRow?.id ? { vendor_profiles: [], ...createdRow, name: createdRow.name ?? newVendor.name.trim() } : undefined);
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
    const visibleVendors = isSandboxMode ? filteredVendors.slice(0, sandboxEntryLimit) : filteredVendors;
    const canDeleteVendor = can('suppliers.create') && canCreateVendor;

    const columns: DataTableColumn<Vendor>[] = [
        {
            key: 'name',
            header: 'Vendor',
            render: (v) => (
                <span className="flex items-center gap-2">
                    <span className="font-semibold text-fg">{v.name}</span>
                    {v.vendor_profiles?.[0]?.is_preferred && <StatusBadge status="Preferred" />}
                </span>
            ),
        },
        { key: 'classification', header: 'Classification', render: (v) => v.vendor_profiles?.[0]?.classification || 'Supplier' },
        { key: 'email', header: 'Email', render: (v) => v.email || 'No email provided' },
        { key: 'phone', header: 'Phone', render: (v) => v.phone || 'No phone provided' },
        { key: 'rating', header: 'Rating', align: 'right', render: (v) => v.vendor_profiles?.[0]?.performance_rating || 'N/A' },
        {
            key: 'profile',
            header: '',
            render: (v) => (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/vendors/${v.id}`)}>
                    View Profile →
                </Button>
            ),
        },
    ];

    return (
        <>
            {/* Outside the template: the empty state replaces its children. */}
            {bankWarning && <Alert variant="warning" onDismiss={() => setBankWarning(null)}>{bankWarning}</Alert>}
            <ListPageTemplate trail={[]}
                title="Vendors & Subcontractors"
                description="Manage supply chain partners and commercial contracts."
                count={loading ? undefined : filteredVendors.length}
                primaryAction={
                    can('suppliers.create') ? (
                        <FeatureGate state={createVendorState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                            <QuotaGate
                                quotaKey="max_vendors"
                                moduleCode="inventory"
                                used={vendors.length}
                                limit={quotaData?.limit ?? 0}
                                isUnlimited={quotaData?.is_unlimited}
                                disableOnExceeded
                            >
                                <Button onClick={() => setShowCreateModal(true)}>Add Vendor</Button>
                            </QuotaGate>
                        </FeatureGate>
                    ) : undefined
                }
                search={
                    <SearchInput
                        placeholder="Search vendors..."
                        value={searchTerm}
                        onChange={setSearchTerm}
                    />
                }
                loading={loading}
                isEmpty={!loading && !error && visibleVendors.length === 0}
                empty={
                    <EmptyState
                        title="No vendors found"
                        description={searchTerm ? 'Try adjusting your search.' : 'Start by adding your first supplier or subcontractor.'}
                    />
                }
            >
                {loading && <span className="sr-only" role="status">Loading vendor ecosystem...</span>}

                {(quotaData || vendors.length > 0) && (
                    <QuotaBar
                        label="Vendors"
                        used={vendors.length}
                        limit={quotaData?.limit ?? 0}
                        isUnlimited={quotaData?.is_unlimited}
                        className="mb-4"
                    />
                )}

                {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
                {successMessage && <Alert variant="success">{successMessage}</Alert>}

                {isSandboxMode && isLimited(filteredVendors.length) && (
                    <Alert variant="warning" title="Sandbox mode">
                        showing {sandboxEntryLimit} of {filteredVendors.length} vendors — full list visible in production.
                    </Alert>
                )}

                {!loading && visibleVendors.length > 0 && (
                    <DataTable
                        data-testid="vendors-table"
                        columns={columns}
                        rows={visibleVendors}
                        rowKey={(v) => v.id}
                        rowActions={canDeleteVendor ? (v) => [{ label: 'Delete Vendor', danger: true, onSelect: () => setDeletingVendor(v) }] : undefined}
                    />
                )}
            </ListPageTemplate>

            <Modal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Add New Vendor"
                dismissible={!isCreating}
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} disabled={isCreating}>
                            Cancel
                        </Button>
                        <Button type="submit" form="create-vendor-form" loading={isCreating} disabled={isCreating}>
                            {isCreating ? 'Creating...' : 'Add Vendor'}
                        </Button>
                    </>
                }
            >
                <form id="create-vendor-form" onSubmit={handleCreateVendor} className="flex flex-col gap-4">
                    <TextField
                        name="name"
                        label="Vendor Name"
                        required
                        error={nameError ?? undefined}
                        value={newVendor.name}
                        onChange={(e) => { setNameError(null); setNewVendor({ ...newVendor, name: e.target.value }); }}
                        placeholder="Company name"
                    />
                    <FieldGrid>
                        <TextField
                            name="email"
                            label="Email"
                            type="email"
                            value={newVendor.email}
                            onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                            placeholder="vendor@example.com"
                        />
                        <TextField
                            name="phone"
                            label="Phone"
                            type="tel"
                            value={newVendor.phone}
                            onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                            placeholder="+971 50 123 4567"
                        />
                    </FieldGrid>
                    <Textarea
                        name="address"
                        label="Address"
                        value={newVendor.address}
                        onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                        placeholder="Business address"
                        rows={3}
                    />
                    <FieldGrid>
                        <Select
                            name="classification"
                            label="Classification"
                            value={newVendor.vendor_profile.classification}
                            onChange={(e) => setNewVendor({
                                ...newVendor,
                                vendor_profile: { ...newVendor.vendor_profile, classification: e.target.value },
                            })}
                            options={CLASSIFICATION_OPTIONS}
                        />
                        <Select
                            name="payment_terms"
                            label="Payment Terms"
                            value={newVendor.vendor_profile.payment_terms}
                            onChange={(e) => setNewVendor({
                                ...newVendor,
                                vendor_profile: { ...newVendor.vendor_profile, payment_terms: e.target.value },
                            })}
                            options={PAYMENT_TERMS_OPTIONS}
                        />
                    </FieldGrid>
                    <Checkbox
                        name="is_preferred"
                        label="Mark as Preferred Vendor"
                        checked={newVendor.vendor_profile.is_preferred}
                        onChange={(e) => setNewVendor({
                            ...newVendor,
                            vendor_profile: { ...newVendor.vendor_profile, is_preferred: e.target.checked },
                        })}
                    />
                    {canAddBank && (
                        <Checkbox
                            name="add_bank_details"
                            label="Add bank details now"
                            description="You can also add them later from the vendor profile."
                            checked={addBank}
                            onChange={(e) => setAddBank(e.target.checked)}
                            data-testid="create-vendor-add-bank"
                        />
                    )}
                    {canAddBank && addBank && (
                        <NewVendorBankStep value={bankForm} onChange={setBankForm} errors={bankErrors} />
                    )}
                </form>
            </Modal>

            <ConfirmDialog
                open={!!deletingVendor}
                intent="danger"
                title="Delete Vendor"
                message={
                    <>
                        Are you sure you want to delete <strong>{deletingVendor?.name}</strong>?
                        Vendors with purchase orders or invoices cannot be deleted. This action cannot be undone.
                    </>
                }
                confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
                onConfirm={handleDeleteVendor}
                onCancel={() => setDeletingVendor(null)}
            />
        </>
    );
};

export default VendorListPage;
