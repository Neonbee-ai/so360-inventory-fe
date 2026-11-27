import React, { useState } from 'react';
import { Alert, Button, FileUpload, Modal, Select, TextField, FieldGrid } from '@so360/design-system';
import { procurementService } from '../../services/procurementService';
import { mediaService } from '../../services/mediaService';
import { inventoryService } from '../../services/inventoryService';
import { useInventoryFormatters } from '../../utils/formatters';

type GstType = 'none' | 'intra' | 'inter';
type GstComponent = 'cgst' | 'sgst' | 'igst';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    vendorId: string;
    vendorPOs: Array<{ id: string; po_number: string; status: string; total_amount: number }>;
    /** Receives the create response, including its Accounting bill state. */
    onSuccess: (result?: any) => void;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
    isOpen,
    onClose,
    vendorId,
    vendorPOs,
    onSuccess,
}) => {
    const formatters = useInventoryFormatters();
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(formatters.businessToday());
    const [dueDate, setDueDate] = useState('');
    // Pulse c55520ce: taxable value + separate CGST/SGST (intra-state) or IGST
    // (inter-state). The total is derived, never typed, so the parts always sum.
    const [taxableAmount, setTaxableAmount] = useState('');
    const [gstType, setGstType] = useState<GstType>('none');
    const [rates, setRates] = useState<Record<GstComponent, string>>({ cgst: '', sgst: '', igst: '' });
    const [taxAmounts, setTaxAmounts] = useState<Record<GstComponent, string>>({ cgst: '', sgst: '', igst: '' });
    const [selectedPO, setSelectedPO] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    const resetForm = () => {
        setInvoiceNumber('');
        setInvoiceDate(formatters.businessToday());
        setDueDate('');
        setTaxableAmount('');
        setGstType('none');
        setRates({ cgst: '', sgst: '', igst: '' });
        setTaxAmounts({ cgst: '', sgst: '', igst: '' });
        setSelectedPO('');
        setFile(null);
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const validateFile = (f: File): string | null => {
        if (!ALLOWED_TYPES.includes(f.type)) {
            return 'Only PDF, PNG, and JPG files are allowed';
        }
        if (f.size > MAX_SIZE) {
            return 'File size must be under 5MB';
        }
        return null;
    };

    const handleFileSelect = (f: File) => {
        const err = validateFile(f);
        if (err) {
            setError(err);
            return;
        }
        setError(null);
        setFile(f);
    };

    const activeComponents: GstComponent[] =
        gstType === 'intra' ? ['cgst', 'sgst'] : gstType === 'inter' ? ['igst'] : [];

    const taxFromRate = (taxable: string, rate: string) =>
        rate === '' ? '' : String(round2((num(taxable) * num(rate)) / 100));

    const handleTaxableChange = (value: string) => {
        setTaxableAmount(value);
        // Keep amounts that were derived from a rate in step with the base.
        setTaxAmounts((prev) => {
            const next = { ...prev };
            for (const c of activeComponents) {
                if (rates[c] !== '') next[c] = taxFromRate(value, rates[c]);
            }
            return next;
        });
    };

    const handleRateChange = (component: GstComponent, value: string) => {
        // CGST and SGST are always equal halves, so a CGST/SGST rate mirrors.
        const targets: GstComponent[] = component === 'igst' ? ['igst'] : ['cgst', 'sgst'];
        setRates((prev) => {
            const next = { ...prev };
            for (const t of targets) next[t] = value;
            return next;
        });
        setTaxAmounts((prev) => {
            const next = { ...prev };
            for (const t of targets) next[t] = taxFromRate(taxableAmount, value);
            return next;
        });
    };

    const handleAmountChange = (component: GstComponent, value: string) => {
        setTaxAmounts((prev) => ({ ...prev, [component]: value }));
    };

    const handleGstTypeChange = (value: string) => {
        setGstType(value as GstType);
        setRates({ cgst: '', sgst: '', igst: '' });
        setTaxAmounts({ cgst: '', sgst: '', igst: '' });
    };

    const totalTax = round2(activeComponents.reduce((sum, c) => sum + num(taxAmounts[c]), 0));
    const computedTotal = round2(num(taxableAmount) + totalTax);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (gstType === 'intra' && Math.abs(num(taxAmounts.cgst) - num(taxAmounts.sgst)) > 0.01) {
            setError('CGST and SGST amounts must be equal');
            return;
        }
        if (gstType !== 'none' && !(totalTax > 0)) {
            setError('Enter the GST amount charged on the invoice, or choose No GST');
            return;
        }
        setIsSubmitting(true);

        try {
            let attachmentUrl: string | undefined;

            // Upload file if selected
            if (file) {
                const orgId = inventoryService.getOrgId();
                if (!orgId) throw new Error('Organization context not available');
                const uploadResult = await mediaService.uploadDocument(file, orgId);
                attachmentUrl = uploadResult.url;
            }

            // Create the invoice
            const result = await procurementService.createVendorInvoice({
                vendor_id: vendorId,
                invoice_number: invoiceNumber,
                invoice_date: invoiceDate,
                due_date: dueDate || undefined,
                total_amount: computedTotal,
                taxable_amount: num(taxableAmount),
                ...(gstType === 'intra'
                    ? {
                        cgst_amount: num(taxAmounts.cgst),
                        sgst_amount: num(taxAmounts.sgst),
                        ...(rates.cgst !== '' ? { cgst_rate: num(rates.cgst) } : {}),
                        ...(rates.sgst !== '' ? { sgst_rate: num(rates.sgst) } : {}),
                    }
                    : {}),
                ...(gstType === 'inter'
                    ? {
                        igst_amount: num(taxAmounts.igst),
                        ...(rates.igst !== '' ? { igst_rate: num(rates.igst) } : {}),
                    }
                    : {}),
                po_id: selectedPO || undefined,
                attachment_url: attachmentUrl,
                ...(gstType === 'none' ? { no_tax: true } : {}),
            });

            resetForm();
            onSuccess(result);
        } catch (err: any) {
            setError(err.message || 'Failed to create invoice');
        } finally {
            setIsSubmitting(false);
        }
    };

    const poOptions = [
        { value: '', label: 'No PO (standalone invoice)' },
        ...vendorPOs.map((po) => ({
            value: po.id,
            label: `${po.po_number} — ${formatters.formatCurrency(po.total_amount ?? 0)} (${po.status})`,
        })),
    ];

    return (
        <Modal
            open={isOpen}
            onClose={handleClose}
            title="Create Vendor Invoice"
            size="lg"
            dismissible={!isSubmitting}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" form="create-vendor-invoice-form" loading={isSubmitting} disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create Invoice'}
                    </Button>
                </>
            }
        >
            <form id="create-vendor-invoice-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && <Alert variant="error">{error}</Alert>}

                <TextField
                    name="invoice_number"
                    label="Invoice Number"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-001"
                />

                <FieldGrid>
                    <TextField
                        name="invoice_date"
                        label="Invoice Date"
                        type="date"
                        required
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                    <TextField
                        name="due_date"
                        label="Due Date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                    />
                </FieldGrid>

                <TextField
                    name="taxable_amount"
                    label="Taxable Amount (before GST)"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={taxableAmount}
                    onChange={(e) => handleTaxableChange(e.target.value)}
                    placeholder="0.00"
                />

                <Select
                    name="gst_type"
                    label="GST charged"
                    value={gstType}
                    onChange={(e) => handleGstTypeChange(e.target.value)}
                    options={[
                        { value: 'none', label: 'No GST' },
                        { value: 'intra', label: 'CGST + SGST (same state)' },
                        { value: 'inter', label: 'IGST (other state)' },
                    ]}
                />

                {activeComponents.map((c) => (
                    <FieldGrid key={c}>
                        <TextField
                            name={`${c}_rate`}
                            label={`${c.toUpperCase()} Rate %`}
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={rates[c]}
                            onChange={(e) => handleRateChange(c, e.target.value)}
                            placeholder="Rate"
                        />
                        <TextField
                            name={`${c}_amount`}
                            label={`${c.toUpperCase()} Amount`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={taxAmounts[c]}
                            onChange={(e) => handleAmountChange(c, e.target.value)}
                            placeholder="Amount"
                        />
                    </FieldGrid>
                ))}

                <TextField
                    name="total_amount"
                    label="Total Amount (incl. GST)"
                    type="number"
                    readOnly
                    value={taxableAmount === '' ? '' : String(computedTotal)}
                    placeholder="Calculated"
                />

                <Select
                    name="po_id"
                    label="Link to Purchase Order"
                    value={selectedPO}
                    onChange={(e) => setSelectedPO(e.target.value)}
                    options={poOptions}
                />

                <FileUpload
                    name="attachment"
                    label="Attach Document (PDF, PNG, JPG up to 5MB)"
                    accept=".pdf,.png,.jpg,.jpeg"
                    maxSize={MAX_SIZE}
                    value={file ? [file] : []}
                    onChange={(files) => {
                        const f = files[0];
                        if (!f) {
                            setFile(null);
                            return;
                        }
                        handleFileSelect(f);
                    }}
                    onReject={(rejections) => {
                        const r = rejections[0];
                        setError(r?.reason === 'size' ? 'File size must be under 5MB' : 'Only PDF, PNG, and JPG files are allowed');
                    }}
                />
            </form>
        </Modal>
    );
};
