import React, { useState, useRef } from 'react';
import { Loader2, Upload, X, FileText } from 'lucide-react';
import { Modal } from '../common/Modal';
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
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [selectedPO, setSelectedPO] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    const resetForm = () => {
        setInvoiceNumber('');
        setInvoiceDate(new Date().toISOString().split('T')[0]);
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

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileSelect(droppedFile);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
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

    const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50';

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Create Vendor Invoice" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5 text-slate-200">
                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Invoice Number */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Invoice Number *</label>
                    <input
                        required
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV-2026-001"
                        className={inputClass}
                    />
                </div>

                {/* Invoice Date + Due Date */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Invoice Date *</label>
                        <input
                            required
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Due Date</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>

                {/* Total Amount */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Total Amount *</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                        <input
                            required
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            placeholder="0.00"
                            className={`${inputClass} pl-8`}
                        />
                    </div>
                </div>

                {/* Link to PO */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Link to Purchase Order</label>
                    <select
                        value={selectedPO}
                        onChange={(e) => setSelectedPO(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">No PO (standalone invoice)</option>
                        {vendorPOs.map((po) => (
                            <option key={po.id} value={po.id}>
                                {po.po_number} — {formatters.formatCurrency(po.total_amount ?? 0)} ({po.status})
                            </option>
                        ))}
                    </select>
                </div>

                {/* File Upload */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Attach Document</label>
                    {file ? (
                        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                            <FileText size={20} className="text-purple-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-50 truncate">{file.name}</p>
                                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFile(null)}
                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-50 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-all ${
                                dragOver
                                    ? 'border-purple-500 bg-purple-500/10'
                                    : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                            }`}
                        >
                            <Upload size={24} className="mx-auto mb-2 text-slate-500" />
                            <p className="text-sm text-slate-400">
                                Drag & drop or <span className="text-purple-400 font-medium">browse</span>
                            </p>
                            <p className="text-xs text-slate-600 mt-1">PDF, PNG, JPG up to 5MB</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFileSelect(f);
                                }}
                                className="hidden"
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold py-2.5 rounded-lg transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <><Loader2 size={18} className="animate-spin" /> Creating...</>
                        ) : (
                            <><FileText size={18} /> Create Invoice</>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
