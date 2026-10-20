import React, { useState } from 'react';
import { Alert, Button, FileUpload, Modal, Select, TextField, FieldGrid } from '@so360/design-system';
import { procurementService } from '../../services/procurementService';
import { mediaService } from '../../services/mediaService';
import { inventoryService } from '../../services/inventoryService';
import { useInventoryFormatters } from '../../utils/formatters';

interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    vendorId: string;
    vendorPOs: Array<{ id: string; po_number: string; status: string; total_amount: number }>;
    onSuccess: () => void;
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
    const [totalAmount, setTotalAmount] = useState('');
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
        setTotalAmount('');
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
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
            await procurementService.createVendorInvoice({
                vendor_id: vendorId,
                invoice_number: invoiceNumber,
                invoice_date: invoiceDate,
                due_date: dueDate || undefined,
                total_amount: parseFloat(totalAmount),
                po_id: selectedPO || undefined,
                attachment_url: attachmentUrl,
            });

            resetForm();
            onSuccess();
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
                    name="total_amount"
                    label="Total Amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
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
