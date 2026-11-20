import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert, Badge, Button, Card, ConfirmDialog, DataTable, DatePicker, Drawer, EmptyState,
    FieldGrid, FilePickerTrigger, Modal, Select, TextField, Textarea,
} from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { vendorService } from '../../services/vendorService';
import { useAuth } from '../../hooks/useAuth';
import { useInventoryFormatters } from '../../utils/formatters';
import { isVendorMasterEnabled } from '../../utils/vendorMaster';
import {
    ACCEPTED_DOCUMENT_FILES, VENDOR_DOCUMENT_TYPES, documentTypeLabel, emptyDocumentForm, expiryBadge,
    toDocumentMeta, validateDocumentForm, verificationBadge, type DocumentFormState,
} from '../../utils/vendorDocuments';

const errMsg = (e: any, fallback: string) => (e?.message ? String(e.message) : fallback);

type Pending = { kind: 'verify' | 'remove'; doc: any } | null;

/**
 * Compliance documents card on the vendor profile (Pulse 3fc12200). Files are
 * filed in the private Documents hub by the API; this card keeps the type,
 * number, validity and verification. Gated by submodule:inventory:vendor_master.
 */
export const VendorDocumentsSection: React.FC<{ vendorId: string }> = ({ vendorId }) => {
    const shell = useShellBridge();
    const { can } = useAuth();
    const formatters = useInventoryFormatters();
    const enabled = isVendorMasterEnabled(shell);
    const canRead = can('suppliers.read');
    const canManage = can('suppliers.update');

    const [docs, setDocs] = useState<any[]>([]);
    const [summary, setSummary] = useState<{ expired: number; expiring_soon: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [form, setForm] = useState<DocumentFormState>(emptyDocumentForm());
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [drawerError, setDrawerError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [pending, setPending] = useState<Pending>(null);
    const [rejecting, setRejecting] = useState<any | null>(null);
    const [reason, setReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await vendorService.listDocuments(vendorId);
            setDocs(Array.isArray(res?.data) ? res.data : []);
            setSummary(res?.summary ?? null);
        } catch (e) {
            setError(errMsg(e, 'Could not load documents.'));
        } finally {
            setLoading(false);
        }
    }, [vendorId]);

    useEffect(() => {
        if (enabled && canRead && vendorId) load();
    }, [enabled, canRead, vendorId, load]);

    if (!enabled || !canRead) return null;

    const set = (k: keyof DocumentFormState, v: any) => setForm((f) => ({ ...f, [k]: v }));

    const openAdd = () => {
        setForm(emptyDocumentForm());
        setFormErrors({});
        setDrawerError(null);
        setDrawerOpen(true);
    };

    const save = async () => {
        const errors = validateDocumentForm(form);
        setFormErrors(errors);
        if (Object.keys(errors).length > 0) return;
        setSaving(true);
        setDrawerError(null);
        try {
            await vendorService.uploadDocument(vendorId, form.file as File, toDocumentMeta(form));
            setDrawerOpen(false);
            setNotice('Document added. It is pending review.');
            await load();
        } catch (e) {
            setDrawerError(errMsg(e, 'Could not upload the document.'));
        } finally {
            setSaving(false);
        }
    };

    const confirmPending = async () => {
        if (!pending) return;
        const { kind, doc } = pending;
        setPending(null);
        try {
            if (kind === 'verify') {
                await vendorService.verifyDocument(vendorId, doc.id, 'verified');
                setNotice('Document marked as verified.');
            } else {
                await vendorService.archiveDocument(vendorId, doc.id);
                setNotice('Document removed.');
            }
            await load();
        } catch (e) {
            setError(errMsg(e, 'The action could not be completed.'));
        }
    };

    const confirmReject = async () => {
        if (!rejecting || !reason.trim()) return;
        const doc = rejecting;
        setRejecting(null);
        try {
            await vendorService.verifyDocument(vendorId, doc.id, 'rejected', reason.trim());
            setNotice('Document rejected.');
            await load();
        } catch (e) {
            setError(errMsg(e, 'Could not reject the document.'));
        }
    };

    const columns = [
        {
            key: 'type', header: 'Document',
            render: (d: any) => (
                <div className="flex flex-col">
                    <span className="font-medium">{documentTypeLabel(d.document_type)}</span>
                    <span className="text-nb-sm text-fg-muted">{d.document_number || d.file_name || '—'}</span>
                </div>
            ),
        },
        {
            key: 'expiry', header: 'Valid until',
            render: (d: any) => {
                const b = expiryBadge(d.expiry_state, d.days_to_expiry);
                return (
                    <div className="flex flex-col gap-nb-1">
                        <span>{d.expiry_date ? formatters.formatDate(d.expiry_date) : '—'}</span>
                        <Badge tone={b.tone} data-testid={`doc-expiry-${d.id}`}>{b.label}</Badge>
                    </div>
                );
            },
        },
        {
            key: 'verification', header: 'Review',
            render: (d: any) => {
                const b = verificationBadge(d.verification_status);
                return (
                    <div className="flex flex-col gap-nb-1">
                        <Badge tone={b.tone} data-testid={`doc-review-${d.id}`}>{b.label}</Badge>
                        {d.verification_status === 'rejected' && d.rejection_reason && (
                            <span className="text-nb-sm text-fg-muted">{d.rejection_reason}</span>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'actions', header: '',
            render: (d: any) => canManage ? (
                <div className="flex flex-wrap justify-end gap-nb-1">
                    {d.verification_status !== 'verified' && (
                        <Button size="sm" variant="secondary" data-testid={`doc-verify-${d.id}`}
                            onClick={() => setPending({ kind: 'verify', doc: d })}>Verify</Button>
                    )}
                    {d.verification_status !== 'rejected' && (
                        <Button size="sm" variant="secondary" data-testid={`doc-reject-${d.id}`}
                            onClick={() => { setReason(''); setRejecting(d); }}>Reject</Button>
                    )}
                    <Button size="sm" variant="danger" data-testid={`doc-remove-${d.id}`}
                        onClick={() => setPending({ kind: 'remove', doc: d })}>Remove</Button>
                </div>
            ) : null,
        },
    ];

    const attention = (summary?.expired ?? 0) + (summary?.expiring_soon ?? 0);

    return (
        <Card
            title="Compliance documents"
            data-testid="vendor-documents-section"
            actions={canManage ? <Button size="sm" onClick={openAdd} data-testid="doc-add">Add document</Button> : undefined}
        >
            <div className="flex flex-col gap-nb-3">
                {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
                {notice && <Alert variant="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}
                {attention > 0 && (
                    <Alert variant="warning" data-testid="doc-expiry-alert">
                        {`${summary?.expired ?? 0} expired and ${summary?.expiring_soon ?? 0} expiring within 30 days. Ask the vendor for renewed copies.`}
                    </Alert>
                )}
                <DataTable
                    data-testid="vendor-documents-table"
                    rowKey={(d: any) => d.id}
                    rows={docs}
                    loading={loading}
                    columns={columns}
                    emptyState={<EmptyState title="No documents yet"
                        description="Add GST, PAN, registration and bank proofs so the vendor can be verified."
                        action={canManage ? { label: 'Add document', onClick: openAdd } : undefined} />}
                />
            </div>

            <Drawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title="Add document"
                subtitle="PDF, PNG or JPG up to 5 MB. Stored privately in Documents."
                size="md"
                name="vendor-document"
                footer={
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={save} disabled={saving} data-testid="doc-save">{saving ? 'Uploading…' : 'Upload'}</Button>
                    </div>
                }
            >
                {drawerError && <Alert variant="error" className="mb-nb-3">{drawerError}</Alert>}
                <div className="flex flex-col gap-nb-3">
                    <Select label="Document type" name="document_type" required value={form.document_type}
                        placeholder="Choose a type" options={VENDOR_DOCUMENT_TYPES} error={formErrors.document_type}
                        onChange={(e: any) => set('document_type', e?.target ? e.target.value : e)} />
                    <TextField label="Document number" name="document_number" value={form.document_number}
                        onChange={(e: any) => set('document_number', e.target.value)} />
                    <FieldGrid>
                        <DatePicker name="issue_date" label="Issue date" value={form.issue_date}
                            onChange={(v: string) => set('issue_date', v)} />
                        <DatePicker name="expiry_date" label="Expiry date" value={form.expiry_date}
                            error={formErrors.expiry_date} onChange={(v: string) => set('expiry_date', v)} />
                    </FieldGrid>
                    <Textarea label="Notes" name="notes" value={form.notes}
                        onChange={(e: any) => set('notes', e.target.value)} />
                    <div className="flex flex-col gap-nb-1">
                        <FilePickerTrigger accept={ACCEPTED_DOCUMENT_FILES} name="file" data-testid="doc-file"
                            onFiles={(files: File[]) => set('file', files[0] ?? null)}>
                            <Button variant="secondary" size="sm">{form.file ? 'Change file' : 'Choose file'}</Button>
                        </FilePickerTrigger>
                        <span className="text-nb-sm text-fg-muted" data-testid="doc-file-name">{form.file?.name ?? 'No file chosen'}</span>
                        {formErrors.file && <span className="text-nb-sm text-danger" role="alert">{formErrors.file}</span>}
                    </div>
                </div>
            </Drawer>

            <ConfirmDialog
                open={!!pending}
                title={pending?.kind === 'remove' ? 'Remove document?' : 'Mark document as verified?'}
                message={pending?.kind === 'remove'
                    ? 'It is taken off the vendor profile. The file stays in Documents for the audit trail.'
                    : 'Confirm you checked it against the original. Your name and the time are recorded.'}
                confirmLabel={pending?.kind === 'remove' ? 'Remove' : 'Mark verified'}
                intent={pending?.kind === 'remove' ? 'danger' : 'default'}
                onConfirm={confirmPending}
                onCancel={() => setPending(null)}
            />

            <Modal
                open={!!rejecting}
                onClose={() => setRejecting(null)}
                title="Reject document?"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmReject} disabled={!reason.trim()} data-testid="doc-reject-confirm">Reject</Button>
                    </>
                }
            >
                <Textarea label="Reason" name="reject_reason" required value={reason}
                    onChange={(e: any) => setReason(e.target.value)} />
            </Modal>
        </Card>
    );
};

export default VendorDocumentsSection;
