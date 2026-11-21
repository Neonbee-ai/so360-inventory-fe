import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert, Button, Checkbox, DatePicker, FieldGrid, FieldGridItem, FormPageTemplate, FormSection,
    MultiSelect, Select, StatusBadge, Switch, TextField, Textarea,
} from '@so360/design-system';
import { useBusinessSettings } from '@so360/shell-context';
import { vendorService } from '../../services/vendorService';
import { normalizeTaxId, taxIdIssues } from '../../utils/taxIdentifiers';
import {
    GST_TREATMENT_OPTIONS, LEGAL_TYPE_OPTIONS, MSME_CATEGORY_OPTIONS, SUPPLY_TYPE_OPTIONS,
    emptyVendorMasterForm, formToPayload, missingLabels, vendorToForm, visibleFields,
    type AddressForm, type ContactForm, type VendorMasterForm,
} from '../../utils/vendorMaster';

/**
 * Add / Edit Vendor — the Vendor Master form (Pulse 3fc12200 + 652f492e).
 *
 * Comb FormPage: sections in max-w-form, labels above fields, footer
 * [Cancel][Save as draft][Save & activate]. Conditional fields follow the
 * vendor's country, legal type and registration status, so India-only or
 * company-only identifiers are never asked of anyone else. The backend owns
 * validation and completeness; a refused activation lists what is missing.
 * Bank accounts keep their own section on the vendor profile (3d833e73).
 */

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

const ADDRESS_FIELDS: Array<{ key: keyof AddressForm; label: string; span?: 'full' }> = [
    { key: 'line1', label: 'Address line 1', span: 'full' },
    { key: 'line2', label: 'Address line 2', span: 'full' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State / province / region' },
    { key: 'postal_code', label: 'PIN / ZIP / postal code' },
    { key: 'country', label: 'Country' },
];

type SaveError = { message: string; missing: string[]; field?: string };

const VendorFormPage = () => {
    const { id } = useParams<{ id: string }>();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const { settings } = useBusinessSettings();
    const baseCurrency = settings?.base_currency || '';

    const [form, setForm] = useState<VendorMasterForm>(() => emptyVendorMasterForm(baseCurrency));
    const [currentStatus, setCurrentStatus] = useState<string | null>(null);
    const [serverMissing, setServerMissing] = useState<string[]>([]);
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState<null | 'draft' | 'active'>(null);
    const [error, setError] = useState<SaveError | null>(null);

    useEffect(() => {
        if (!isEdit || !id) return;
        let cancelled = false;
        (async () => {
            try {
                const vendor = await vendorService.getVendorDetail(id);
                if (cancelled) return;
                setForm(vendorToForm(vendor, baseCurrency));
                setCurrentStatus(vendor?.onboarding?.status ?? vendor?.vendor_profiles?.[0]?.onboarding_status ?? 'active');
                setServerMissing(vendor?.onboarding?.missing ?? []);
            } catch (e: any) {
                if (!cancelled) setError({ message: e?.message || 'Unable to load vendor', missing: [] });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // baseCurrency only seeds an empty currency; reloading on it would discard edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isEdit]);

    const show = useMemo(() => visibleFields(form), [form]);
    // Pulse 086d33b1: the same GSTIN/PAN rules the server applies, so a
    // mismatch is named on the field before the save round-trip.
    const [taxChecked, setTaxChecked] = useState(false);
    const gstValue = show.gstin ? normalizeTaxId(form.gst_number) : null;
    const panValue = show.india ? normalizeTaxId(form.pan_number) : null;
    const taxIssues = useMemo(() => taxIdIssues(gstValue, panValue), [gstValue, panValue]);
    const fieldError = (field: 'gst_number' | 'pan_number', fullLength: number): string | undefined => {
        const issue = taxIssues.find((i) => i.field === field);
        const value = field === 'gst_number' ? gstValue : panValue;
        if (issue && (taxChecked || issue.code !== `${field === 'gst_number' ? 'gstin' : 'pan'}_format` || (value?.length ?? 0) >= fullLength)) {
            return issue.message;
        }
        return error?.field === field ? error.message : undefined;
    };
    const set = <K extends keyof VendorMasterForm>(key: K, value: VendorMasterForm[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));
    const setAddress = (which: 'registered_address' | 'billing_address' | 'shipping_address', key: keyof AddressForm, value: string) =>
        setForm((prev) => ({ ...prev, [which]: { ...prev[which], [key]: value } }));
    const setContact = (which: 'primary_contact' | 'accounts_contact', key: keyof ContactForm, value: string) =>
        setForm((prev) => ({ ...prev, [which]: { ...prev[which], [key]: value } }));

    // An active vendor is edited in place; offering "draft" would pull it out
    // of use for purchase orders and bills.
    const canSaveDraft = !isEdit || currentStatus === 'draft';
    const listTrail = [{ label: 'Vendors', to: '/vendors', onClick: () => navigate('/vendors') }];

    const save = async (status: 'draft' | 'active') => {
        if (!form.name.trim()) {
            setError({ message: 'Vendor name is required.', missing: [] });
            return;
        }
        if (taxIssues.length > 0) {
            setTaxChecked(true);
            setError({ message: taxIssues[0].message, missing: [], field: taxIssues[0].field });
            return;
        }
        setSaving(status);
        setError(null);
        try {
            const payload = formToPayload(form, status);
            if (isEdit && id) {
                await vendorService.updateVendor(id, payload);
                navigate(`/vendors/${id}`);
            } else {
                const created = await vendorService.createVendor(payload);
                navigate(created?.id ? `/vendors/${created.id}` : '/vendors');
            }
        } catch (e: any) {
            setError({
                message: e?.message || 'Could not save the vendor.',
                missing: Array.isArray(e?.body?.missing) ? e.body.missing : [],
                field: typeof e?.body?.field === 'string' ? e.body.field : undefined,
            });
        } finally {
            setSaving(null);
        }
    };

    const addressFields = (which: 'registered_address' | 'billing_address' | 'shipping_address', prefix: string) => (
        <FieldGrid columns={2}>
            {ADDRESS_FIELDS.map((f) => (
                <FieldGridItem key={f.key} span={f.span}>
                    <TextField
                        name={`${prefix}_${f.key}`}
                        label={f.label}
                        required={which === 'registered_address' && (f.key === 'line1' || f.key === 'city' || f.key === 'country')}
                        value={form[which][f.key]}
                        onChange={(e) => setAddress(which, f.key, e.target.value)}
                    />
                </FieldGridItem>
            ))}
        </FieldGrid>
    );

    const contactFields = (which: 'primary_contact' | 'accounts_contact', prefix: string) => (
        <FieldGrid columns={2}>
            <FieldGridItem>
                <TextField name={`${prefix}_name`} label="Name" value={form[which].name} onChange={(e) => setContact(which, 'name', e.target.value)} />
            </FieldGridItem>
            {which === 'primary_contact' && (
                <FieldGridItem>
                    <TextField name={`${prefix}_designation`} label="Designation" value={form[which].designation} onChange={(e) => setContact(which, 'designation', e.target.value)} />
                </FieldGridItem>
            )}
            <FieldGridItem>
                <TextField name={`${prefix}_email`} label="Email" type="email" value={form[which].email} onChange={(e) => setContact(which, 'email', e.target.value)} />
            </FieldGridItem>
            <FieldGridItem>
                <TextField name={`${prefix}_phone`} label="Phone" hint="Include the country code, e.g. +91 98470 00000" value={form[which].phone} onChange={(e) => setContact(which, 'phone', e.target.value)} />
            </FieldGridItem>
            {which === 'primary_contact' && (
                <FieldGridItem>
                    <TextField name={`${prefix}_alt_phone`} label="Alternate phone" value={form[which].alt_phone} onChange={(e) => setContact(which, 'alt_phone', e.target.value)} />
                </FieldGridItem>
            )}
        </FieldGrid>
    );

    return (
        <FormPageTemplate
            title={isEdit ? `Edit ${form.name || 'vendor'}` : 'New vendor'}
            description="Business, tax, contact and payment details used by Procurement and Accounting."
            trail={listTrail}
            loading={loading}
            status={currentStatus ? <StatusBadge status={currentStatus === 'draft' ? 'Draft' : 'Active'} /> : undefined}
            onCancel={() => navigate(isEdit && id ? `/vendors/${id}` : '/vendors')}
            secondaryAction={canSaveDraft ? (
                <Button type="button" variant="secondary" loading={saving === 'draft'} disabled={saving !== null} onClick={() => save('draft')}>
                    Save as draft
                </Button>
            ) : undefined}
            primaryAction={
                <Button type="button" loading={saving === 'active'} disabled={saving !== null} onClick={() => save('active')}>
                    {isEdit && currentStatus !== 'draft' ? 'Save' : 'Save & activate'}
                </Button>
            }
        >
            {error && (
                <Alert variant="error" title={error.missing.length ? 'Vendor cannot be activated yet' : 'Could not save'}>
                    {error.missing.length ? `Missing: ${missingLabels(error.missing).join(', ')}.` : error.message}
                </Alert>
            )}
            {!error && serverMissing.length > 0 && (
                <Alert variant="warning" title="Profile incomplete">
                    {`Still needed before this vendor can be used: ${missingLabels(serverMissing).join(', ')}.`}
                </Alert>
            )}

            <form id="vendor-master-form" onSubmit={(e) => { e.preventDefault(); void save('active'); }} className="flex flex-col gap-nb-8">
                <FormSection title="Business information">
                    <FieldGrid columns={2}>
                        <FieldGridItem>
                            <TextField name="name" label="Vendor / company name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <Select name="legal_type" label="Vendor type" required placeholder="Select a type" value={form.legal_type} options={LEGAL_TYPE_OPTIONS} onValueChange={(v) => set('legal_type', v)} />
                        </FieldGridItem>
                        {show.legalTypeOther && (
                            <FieldGridItem>
                                <TextField name="legal_type_other" label="Describe the vendor type" value={form.legal_type_other} onChange={(e) => set('legal_type_other', e.target.value)} />
                            </FieldGridItem>
                        )}
                        {show.legalName && (
                            <FieldGridItem>
                                <TextField name="legal_entity_name" label="Legal registered name" value={form.legal_entity_name} onChange={(e) => set('legal_entity_name', e.target.value)} />
                            </FieldGridItem>
                        )}
                        <FieldGridItem>
                            <TextField name="business_name" label="Trade / brand name" value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="vendor_code" label="Vendor code" hint={isEdit ? undefined : 'Leave blank to generate the next code (VEN-00001…)'} value={form.vendor_code} onChange={(e) => set('vendor_code', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <Select name="classification" label="Classification" value={form.classification} options={CLASSIFICATION_OPTIONS} onValueChange={(v) => set('classification', v)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <MultiSelect name="supply_types" label="Supply type" options={SUPPLY_TYPE_OPTIONS} value={form.supply_types} onChange={(v) => set('supply_types', v)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="industry" label="Industry / business category" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="website" label="Website" value={form.website} onChange={(e) => set('website', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="year_established" label="Year of establishment" inputMode="numeric" value={form.year_established} onChange={(e) => set('year_established', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem span="full">
                            <Textarea name="description" label="Company description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
                        </FieldGridItem>
                    </FieldGrid>
                </FormSection>

                <FormSection title="Legal, tax and registration" description="Entered details are not verified by Neonbee.">
                    <FieldGrid columns={2}>
                        <FieldGridItem>
                            <TextField name="registration_country" label="Registration country" hint="2-letter code, e.g. IN, AE, US" maxLength={2} value={form.registration_country} onChange={(e) => set('registration_country', e.target.value.toUpperCase())} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="registration_state" label="Registration state / province" value={form.registration_state} onChange={(e) => set('registration_state', e.target.value)} />
                        </FieldGridItem>
                        {show.india && (
                            <>
                                <FieldGridItem>
                                    <Select name="gst_treatment" label="GST treatment" placeholder="Select treatment" value={form.gst_treatment} options={GST_TREATMENT_OPTIONS} onValueChange={(v) => set('gst_treatment', v)} />
                                </FieldGridItem>
                                {show.gstin && (
                                    <FieldGridItem>
                                        <TextField name="gst_number" label="GSTIN" required value={form.gst_number} error={fieldError('gst_number', 15)} onChange={(e) => set('gst_number', normalizeTaxId(e.target.value) ?? '')} />
                                    </FieldGridItem>
                                )}
                                <FieldGridItem>
                                    <TextField name="pan_number" label="PAN" required value={form.pan_number} error={fieldError('pan_number', 10)} onChange={(e) => set('pan_number', normalizeTaxId(e.target.value) ?? '')} />
                                </FieldGridItem>
                            </>
                        )}
                        {show.vat && (
                            <FieldGridItem>
                                <TextField name="vat_number" label="VAT / tax registration number" value={form.vat_number} onChange={(e) => set('vat_number', e.target.value)} />
                            </FieldGridItem>
                        )}
                        {show.cin && (
                            <FieldGridItem>
                                <TextField name="registration_number" label="CIN" required maxLength={21} value={form.registration_number} onChange={(e) => set('registration_number', e.target.value.toUpperCase())} />
                            </FieldGridItem>
                        )}
                        {!show.cin && show.legalName && (
                            <FieldGridItem>
                                <TextField name="registration_number" label="Company registration number" value={form.registration_number} onChange={(e) => set('registration_number', e.target.value)} />
                            </FieldGridItem>
                        )}
                        {show.llpin && (
                            <FieldGridItem>
                                <TextField name="llpin" label="LLPIN" required={show.india} value={form.llpin} onChange={(e) => set('llpin', e.target.value.toUpperCase())} />
                            </FieldGridItem>
                        )}
                        <FieldGridItem>
                            <TextField name="registration_authority" label="Registration authority" value={form.registration_authority} onChange={(e) => set('registration_authority', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <DatePicker name="registration_date" label="Registration date" value={form.registration_date} onChange={(v: string) => set('registration_date', v)} />
                        </FieldGridItem>
                        <FieldGridItem span="full">
                            <Switch name="msme_registered" label="MSME / Udyam registered" checked={form.msme_registered} onCheckedChange={(c) => set('msme_registered', c)} />
                        </FieldGridItem>
                        {show.msmeDetails && (
                            <>
                                <FieldGridItem>
                                    <TextField name="udyam_number" label="Udyam registration number" required placeholder="UDYAM-KL-01-0000001" value={form.udyam_number} onChange={(e) => set('udyam_number', e.target.value.toUpperCase())} />
                                </FieldGridItem>
                                <FieldGridItem>
                                    <Select name="msme_category" label="MSME category" required placeholder="Select category" value={form.msme_category} options={MSME_CATEGORY_OPTIONS} onValueChange={(v) => set('msme_category', v)} />
                                </FieldGridItem>
                            </>
                        )}
                    </FieldGrid>
                </FormSection>

                <FormSection title="Registered office address">
                    {addressFields('registered_address', 'registered')}
                </FormSection>

                <FormSection title="Billing and shipping addresses">
                    <FieldGrid columns={1}>
                        <FieldGridItem>
                            <Checkbox name="billing_same" label="Billing address is the registered address" checked={form.billing_same} onChange={(e) => set('billing_same', e.target.checked)} />
                        </FieldGridItem>
                    </FieldGrid>
                    {show.billingAddress && addressFields('billing_address', 'billing')}
                    <FieldGrid columns={1}>
                        <FieldGridItem>
                            <Checkbox name="shipping_same" label="Shipping / business address is the registered address" checked={form.shipping_same} onChange={(e) => set('shipping_same', e.target.checked)} />
                        </FieldGridItem>
                    </FieldGrid>
                    {show.shippingAddress && addressFields('shipping_address', 'shipping')}
                </FormSection>

                <FormSection title="Primary contact">
                    {contactFields('primary_contact', 'primary')}
                </FormSection>

                <FormSection title="Accounts contact" description="Who receives remittances and statements.">
                    {contactFields('accounts_contact', 'accounts')}
                </FormSection>

                <FormSection title="Payment and financial terms">
                    <FieldGrid columns={2}>
                        <FieldGridItem>
                            <Select name="payment_terms" label="Default payment terms" value={form.payment_terms} options={PAYMENT_TERMS_OPTIONS} onValueChange={(v) => set('payment_terms', v)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="credit_days" label="Credit period (days)" inputMode="numeric" value={form.credit_days} onChange={(e) => set('credit_days', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="credit_limit" label="Credit limit" inputMode="decimal" value={form.credit_limit} onChange={(e) => set('credit_limit', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="currency" label="Currency" maxLength={3} hint={baseCurrency ? `Organization currency: ${baseCurrency}` : undefined} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <TextField name="opening_balance" label="Opening balance payable" inputMode="decimal" hint="Recorded for Accounting to post through its opening-balance process." value={form.opening_balance} onChange={(e) => set('opening_balance', e.target.value)} />
                        </FieldGridItem>
                        <FieldGridItem>
                            <DatePicker name="opening_balance_date" label="Opening balance date" value={form.opening_balance_date} onChange={(v: string) => set('opening_balance_date', v)} />
                        </FieldGridItem>
                        <FieldGridItem span="full">
                            <Switch name="tds_applicable" label="TDS applicable" checked={form.tds_applicable} onCheckedChange={(c) => set('tds_applicable', c)} />
                        </FieldGridItem>
                        {show.tdsSection && (
                            <FieldGridItem>
                                <TextField name="tds_section" label="TDS section" required placeholder="194C" value={form.tds_section} onChange={(e) => set('tds_section', e.target.value.toUpperCase())} />
                            </FieldGridItem>
                        )}
                        <FieldGridItem span="full">
                            <Checkbox name="is_preferred" label="Preferred vendor" checked={form.is_preferred} onChange={(e) => set('is_preferred', e.target.checked)} />
                        </FieldGridItem>
                    </FieldGrid>
                </FormSection>

                {!isEdit && (
                    <Alert variant="info" title="Bank accounts">
                        Add bank accounts on the vendor profile after saving. Account numbers are stored encrypted and shown masked.
                    </Alert>
                )}
            </form>
        </FormPageTemplate>
    );
};

export default VendorFormPage;
