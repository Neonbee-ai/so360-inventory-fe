import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RecordNotFound, NOT_FOUND_ERROR, isNotFoundError } from '../../components/RecordNotFound';
import { Send, Scale } from 'lucide-react';
import { rfqService } from '../../services/rfqService';
import { vendorService } from '../../services/vendorService';
import { useInventoryFormatters } from '../../utils/formatters';
import {
    toast, getErrorMessage, useConfirm, DetailPageTemplate, Button, Badge, StatusBadge, SectionCard, DescriptionList,
    DataTable, EmptyState, Modal, TextField, Select, FieldGrid, Grid,
} from '@so360/design-system';
import { RFQ_STATUS_TONES } from './RFQListPage';

const VENDOR_STATUS_TONES: Record<string, 'neutral' | 'success' | 'danger' | 'warning'> = {
    invited: 'neutral', quoted: 'success', declined: 'danger', no_response: 'warning',
};

/** ICC Incoterms 2020 — the supported trade-term codes. */
export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

type QuoteErrors = Record<string, string>;

const EMPTY_QUOTE_HEADER = {
    quotation_number: '', quotation_date: '', valid_until: '',
    lead_time_days: '', freight_amount: '', payment_terms: '',
    delivery_terms: '', incoterms: '', warranty_terms: '', moq_note: '',
};

/** Backend field names that can appear in a validation message. */
const SERVER_FIELDS = [
    'vendor_id', 'payment_terms', 'delivery_terms', 'incoterms', 'warranty_terms', 'moq_note',
    'lead_time_days', 'freight_amount', 'valid_until', 'quotation_date', 'quotation_number', 'items',
];

/** Split the joined server message back into per-field messages. */
export const mapServerErrors = (message: string): QuoteErrors => {
    const out: QuoteErrors = {};
    for (const part of message.split(/,\s(?=[a-z_]+[ .\[])/)) {
        const field = SERVER_FIELDS.find(f => part.startsWith(f));
        if (field) out[field] = out[field] ? `${out[field]}; ${part}` : part;
    }
    return out;
};

const RFQDetailPage = () => {
    const [confirm, confirmDialog] = useConfirm();
    const { id } = useParams();
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [rfq, setRfq] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [vendors, setVendors] = useState<any[]>([]);
    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [quoteVendor, setQuoteVendor] = useState('');
    const [quoteHeader, setQuoteHeader] = useState({
        quotation_number: '', quotation_date: '', valid_until: '',
        lead_time_days: '', freight_amount: '', payment_terms: '',
        delivery_terms: '', incoterms: '', warranty_terms: '', moq_note: '',
    });
    const [quoteLines, setQuoteLines] = useState<any[]>([]);
    const [quoteErrors, setQuoteErrors] = useState<QuoteErrors>({});

    useEffect(() => { if (id) fetchRFQ(); }, [id]);

    const fetchRFQ = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await rfqService.getRFQ(id!);
            setRfq(data);
        } catch (err: any) {
            setError(isNotFoundError(err) ? NOT_FOUND_ERROR : getErrorMessage(err, 'Failed to load RFQ'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!showQuoteForm || vendors.length) return;
        vendorService.getVendors().then((v: any) => setVendors(Array.isArray(v) ? v : [])).catch(() => setVendors([]));
    }, [showQuoteForm]);

    const openQuoteForm = () => {
        // Pre-fill one quotation line per RFQ line so the buyer only types prices.
        setQuoteLines((rfq?.rfq_lines || []).map((l: any) => ({
            rfq_line_id: l.id,
            item_id: l.item_id,
            description: l.description,
            item_name: l.item?.name || '',
            item_sku: l.item?.sku || '',
            specification: l.specification || '',
            target_unit_price: l.target_unit_price,
            required_delivery_date: l.required_delivery_date,
            quantity: l.quantity,
            uom: l.uom || '',
            unit_price: '',
            discount_percent: '',
            tax_rate: '',
            lead_time_days: '',
        })));
        setQuoteVendor(rfq?.rfq_vendors?.find((v: any) => v.status === 'invited')?.vendor_id || '');
        // RFQ-level commercial context is authoritative: carry it into the quotation instead of making the buyer retype it.
        setQuoteHeader({
            ...EMPTY_QUOTE_HEADER,
            delivery_terms: rfq?.delivery_terms || '',
            incoterms: rfq?.incoterms || '',
            payment_terms: rfq?.payment_terms || '',
        });
        setQuoteErrors({});
        setShowQuoteForm(true);
    };

    const handleSend = async () => {
        setBusy('send');
        try {
            await rfqService.sendRFQ(id!);
            toast.success('RFQ sent to invited vendors');
            await fetchRFQ();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to send RFQ'));
        } finally {
            setBusy(null);
        }
    };

    const handleCancel = async () => {
        if (!(await confirm({ title: 'Cancel RFQ', message: 'Cancel this RFQ? Vendors will no longer be able to quote.', intent: 'danger', confirmLabel: 'Cancel RFQ' }))) return;
        setBusy('cancel');
        try {
            await rfqService.cancelRFQ(id!);
            toast.success('RFQ cancelled');
            await fetchRFQ();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to cancel RFQ'));
        } finally {
            setBusy(null);
        }
    };

    const validateQuote = (): QuoteErrors => {
        const errs: QuoteErrors = {};
        if (!quoteVendor) errs.vendor_id = 'Select the invited vendor this quotation came from.';
        if (!quoteHeader.payment_terms.trim()) errs.payment_terms = 'Payment terms are required, e.g. "Net 30 days".';
        if (!quoteHeader.delivery_terms.trim()) errs.delivery_terms = 'Delivery terms are required, e.g. "Delivered to site within 10 working days".';
        if (!quoteHeader.incoterms) errs.incoterms = 'Select the Incoterm.';
        if (quoteHeader.lead_time_days) {
            const n = Number(quoteHeader.lead_time_days);
            if (!Number.isInteger(n) || n < 0 || n > 365) errs.lead_time_days = 'Whole days between 0 and 365.';
        }
        if (quoteHeader.freight_amount && !(Number(quoteHeader.freight_amount) >= 0)) {
            errs.freight_amount = 'Freight must be zero or more.';
        }
        if (!quoteLines.some(l => parseFloat(String(l.unit_price)) > 0)) {
            errs.items = 'Enter a unit price on at least one requested line.';
        }
        return errs;
    };

    const handleQuoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy === 'quote') return; // a double click must not create two quotations
        const errs = validateQuote();
        setQuoteErrors(errs);
        if (Object.keys(errs).length) {
            toast.warning('Fix the highlighted fields to record the quotation.');
            return;
        }
        const priced = quoteLines.filter(l => parseFloat(String(l.unit_price)) > 0);

        setBusy('quote');
        try {
            await rfqService.recordQuotation(id!, {
                vendor_id: quoteVendor,
                quotation_number: quoteHeader.quotation_number || undefined,
                quotation_date: quoteHeader.quotation_date || undefined,
                valid_until: quoteHeader.valid_until || undefined,
                currency: rfq?.currency || undefined,
                lead_time_days: quoteHeader.lead_time_days ? parseInt(quoteHeader.lead_time_days, 10) : undefined,
                freight_amount: quoteHeader.freight_amount ? parseFloat(quoteHeader.freight_amount) : undefined,
                payment_terms: quoteHeader.payment_terms.trim(),
                delivery_terms: quoteHeader.delivery_terms.trim(),
                incoterms: quoteHeader.incoterms,
                warranty_terms: quoteHeader.warranty_terms || undefined,
                moq_note: quoteHeader.moq_note || undefined,
                items: priced.map(l => ({
                    rfq_line_id: l.rfq_line_id,
                    item_id: l.item_id || undefined,
                    description: l.description || undefined,
                    quantity: parseFloat(String(l.quantity)),
                    unit_price: parseFloat(String(l.unit_price)),
                    uom: l.uom || undefined,
                    discount_percent: l.discount_percent ? parseFloat(String(l.discount_percent)) : undefined,
                    tax_rate: l.tax_rate ? parseFloat(String(l.tax_rate)) : undefined,
                    lead_time_days: l.lead_time_days ? parseInt(String(l.lead_time_days), 10) : undefined,
                })),
            });
            toast.success('Quotation recorded');
            setShowQuoteForm(false);
            setQuoteHeader(EMPTY_QUOTE_HEADER);
            setQuoteErrors({});
            await fetchRFQ();
        } catch (err) {
            // Keep the modal open with every entered value; point at the offending fields.
            const message = getErrorMessage(err, 'Failed to record quotation');
            const mapped = mapServerErrors(message);
            setQuoteErrors(mapped);
            toast.error(Object.keys(mapped).length ? 'The server rejected some fields — see the highlighted inputs.' : message);
        } finally {
            setBusy(null);
        }
    };

    const quotations = rfq?.vendor_quotations || [];
    const canAct = !!rfq && !['awarded', 'cancelled'].includes(rfq.status);
    const hdr = (key: keyof typeof quoteHeader) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuoteHeader({ ...quoteHeader, [key]: e.target.value });
        if (quoteErrors[key]) setQuoteErrors({ ...quoteErrors, [key]: '' });
    };
    const setLine = (idx: number, patch: Record<string, string>) => {
        const next = [...quoteLines];
        next[idx] = { ...next[idx], ...patch };
        setQuoteLines(next);
    };

    if (isLoading) {
        return <DetailPageTemplate trail={[{ label: 'RFQs', onClick: () => navigate('/procurement/rfq') }]} title="RFQ" loading>{null}</DetailPageTemplate>;
    }

    if (!rfq && (error === NOT_FOUND_ERROR || !error)) {
        return (
            <DetailPageTemplate trail={[{ label: 'RFQs', onClick: () => navigate('/procurement/rfq') }]} title="RFQ">
                <RecordNotFound listPath="/procurement/rfq" listLabel="RFQs" />
            </DetailPageTemplate>
        );
    }

    if (error || !rfq) {
        return (
            <EmptyState
                title={error || 'RFQ not found'}
                action={{ label: 'Back to RFQs', onClick: () => navigate('/procurement/rfq') }}
            />
        );
    }

    const secondaryActions = [
        canAct && (
            <Button key="quote" variant="secondary" onClick={openQuoteForm}>Record Quotation</Button>
        ),
        quotations.length > 0 && (
            <Button key="compare" variant="secondary" onClick={() => navigate(`/procurement/rfq/${rfq.id}/compare`)}>
                <Scale size={16} /> Compare &amp; Award
            </Button>
        ),
    ].filter(Boolean) as React.ReactElement[];

    const primaryAction = ['draft', 'sent'].includes(rfq.status) ? (
        <Button onClick={handleSend} disabled={busy === 'send'}>
            <Send size={16} /> {rfq.status === 'draft' ? 'Send to Vendors' : 'Send to New Vendors'}
        </Button>
    ) : undefined;

    const details = [
        rfq.title && { label: 'Title', value: rfq.title },
        rfq.pr_id && {
            label: 'Source Requisition',
            value: <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/pr/${rfq.pr_id}`)}>View requisition</Button>,
        },
        { label: 'Response Due', value: rfq.response_due_date ? formatters.formatDate(rfq.response_due_date) : 'Not set' },
        rfq.po_id && {
            label: 'Awarded — Purchase Order',
            value: <Button variant="ghost" size="sm" onClick={() => navigate(`/procurement/po/${rfq.po_id}`)}>View purchase order</Button>,
        },
    ].filter(Boolean) as { label: string; value: React.ReactNode }[];

    const rfqVendors = rfq.rfq_vendors || [];

    return (
        <DetailPageTemplate
            trail={[{ label: 'RFQs', onClick: () => navigate('/procurement/rfq') }]}
            title={rfq.rfq_number}
            status={<StatusBadge status={rfq.status} map={{ [rfq.status]: RFQ_STATUS_TONES[rfq.status] || 'neutral' }} />}
            secondaryActions={secondaryActions}
            primaryAction={primaryAction}
            overflowActions={canAct ? [{ label: 'Cancel RFQ', danger: true, onSelect: handleCancel, disabled: busy === 'cancel' }] : undefined}
        >
            {confirmDialog}
            <Grid>
                <Grid.Item span={4} className="space-y-6">
                    <SectionCard title="Overview"><DescriptionList items={details} /></SectionCard>
                    <SectionCard title="Invited Vendors">
                        {rfqVendors.length === 0 ? (
                            <p className="text-xs text-fg-subtle">No vendors invited yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {rfqVendors.map((v: any) => (
                                    <div key={v.id} className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm text-fg truncate">{v.vendor_name || v.vendor_id.slice(0, 8)}</div>
                                            {v.contact_email && <div className="text-xs text-fg-subtle truncate">{v.contact_email}</div>}
                                        </div>
                                        <Badge tone={VENDOR_STATUS_TONES[v.status] || 'neutral'}>{v.status.replace(/_/g, ' ')}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </Grid.Item>

                <Grid.Item span={8} className="space-y-6">
                    <SectionCard title="Requested Lines">
                        <DataTable
                            data-testid="rfq-lines-table"
                            rows={rfq.rfq_lines || []}
                            rowKey={(l: any) => l.id}
                            columns={[
                                { key: 'item', header: 'Item', render: (l: any) => l.item?.name || l.description || l.item_id?.slice(0, 8) || 'Item' },
                                { key: 'qty', header: 'Quantity', align: 'center', render: (l: any) => l.quantity },
                                { key: 'uom', header: 'UOM', align: 'center', render: (l: any) => l.uom || '—' },
                                {
                                    key: 'target', header: 'Target Price', align: 'right',
                                    render: (l: any) => (l.target_unit_price != null ? formatters.formatCurrency(l.target_unit_price) : '—'),
                                },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title="Quotations Received">
                        {quotations.length === 0 ? (
                            <p className="text-sm text-fg-subtle">No quotations yet. Record one as vendors respond.</p>
                        ) : (
                            <div className="space-y-3">
                                {quotations.map((q: any) => (
                                    <div key={q.id} className="flex items-center justify-between gap-4 border border-line rounded-lg p-3">
                                        <div>
                                            <div className="font-semibold text-fg">{q.vendor_name || q.vendor_id.slice(0, 8)}</div>
                                            <div className="text-xs text-fg-subtle">
                                                {q.quotation_number || 'No quote ref'}
                                                {q.lead_time_days != null && ` · ${q.lead_time_days} day lead time`}
                                                {q.valid_until && ` · valid to ${formatters.formatDate(q.valid_until)}`}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-fg">{formatters.formatCurrency(q.total_amount || 0)}</div>
                                            <Badge tone={q.status === 'awarded' ? 'success' : q.status === 'rejected' ? 'danger' : 'neutral'}>{q.status}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </Grid.Item>
            </Grid>

            <Modal
                open={showQuoteForm}
                onClose={() => setShowQuoteForm(false)}
                title="Record Quotation"
                footer={(
                    <>
                        <Button variant="secondary" type="button" onClick={() => setShowQuoteForm(false)}>Cancel</Button>
                        <Button type="submit" form="quote-form" disabled={busy === 'quote'}>{busy === 'quote' ? 'Saving...' : 'Save Quotation'}</Button>
                    </>
                )}
            >
                <form id="quote-form" onSubmit={handleQuoteSubmit} className="space-y-4" noValidate>
                    <DescriptionList
                        columns={3}
                        items={[
                            { label: 'RFQ', value: `${rfq.rfq_number}${rfq.title ? ` — ${rfq.title}` : ''}` },
                            { label: 'Response due', value: rfq.response_due_date ? formatters.formatDate(rfq.response_due_date) : 'Not set' },
                            { label: 'Currency', value: rfq.currency || '—' },
                        ]}
                    />
                    <FieldGrid columns={2}>
                        <Select
                            id="q-vendor" name="q-vendor" label="Vendor (invited)" placeholder="Select invited vendor" value={quoteVendor} required
                            error={quoteErrors.vendor_id || undefined}
                            onChange={(e: any) => { setQuoteVendor(e?.target ? e.target.value : e); setQuoteErrors({ ...quoteErrors, vendor_id: '' }); }}
                            options={rfqVendors.map((v: any) => ({ value: v.vendor_id, label: v.vendor_name || v.vendor_id.slice(0, 8) }))}
                        />
                        <TextField id="q-number" name="q-number" label="Quotation Ref" hint="The vendor's own quote number" value={quoteHeader.quotation_number} onChange={hdr('quotation_number')} />
                        <TextField id="q-valid" name="q-valid" label="Valid Until" type="date" error={quoteErrors.valid_until || undefined} value={quoteHeader.valid_until} onChange={hdr('valid_until')} />
                        <TextField id="q-lead" name="q-lead" label="Lead Time (days)" type="number" min="0" max="365" step="1" hint="Calendar days from order to delivery (0-365)" error={quoteErrors.lead_time_days || undefined} value={quoteHeader.lead_time_days} onChange={hdr('lead_time_days')} />
                        <TextField id="q-freight" name="q-freight" label={`Freight${rfq.currency ? ` (${rfq.currency})` : ''}`} type="number" min="0" step="0.01" hint="Flat freight amount for the whole quotation, not per unit" error={quoteErrors.freight_amount || undefined} value={quoteHeader.freight_amount} onChange={hdr('freight_amount')} />
                        <TextField id="q-payment" name="q-payment" label="Payment Terms" required hint='e.g. "Net 30 days" or "30% advance, balance on delivery"' error={quoteErrors.payment_terms || undefined} value={quoteHeader.payment_terms} onChange={hdr('payment_terms')} />
                        <TextField id="q-delivery" name="q-delivery" label="Delivery Terms" required hint='e.g. "Delivered to site within 10 working days"' error={quoteErrors.delivery_terms || undefined} value={quoteHeader.delivery_terms} onChange={hdr('delivery_terms')} />
                        <Select
                            id="q-incoterms" name="q-incoterms" label="Incoterms" placeholder="Select Incoterm" required value={quoteHeader.incoterms}
                            error={quoteErrors.incoterms || undefined}
                            onChange={(e: any) => { setQuoteHeader({ ...quoteHeader, incoterms: e?.target ? e.target.value : e }); setQuoteErrors({ ...quoteErrors, incoterms: '' }); }}
                            options={INCOTERMS.map(t => ({ value: t, label: t }))}
                        />
                        <TextField id="q-warranty" name="q-warranty" label="Warranty" hint='Duration and conditions, e.g. "2 years parts and labour"' error={quoteErrors.warranty_terms || undefined} value={quoteHeader.warranty_terms} onChange={hdr('warranty_terms')} />
                        <TextField id="q-moq" name="q-moq" label="MOQ Conditions" hint='Minimum order and unit, e.g. "Minimum 50 units per order"' error={quoteErrors.moq_note || undefined} value={quoteHeader.moq_note} onChange={hdr('moq_note')} />
                    </FieldGrid>

                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-fg-subtle">Quoted prices{rfq.currency ? ` (${rfq.currency})` : ''}</div>
                        {quoteErrors.items && <div className="text-xs text-danger" role="alert">{quoteErrors.items}</div>}
                        {quoteLines.map((l, idx) => {
                            const label = l.item_name || l.description || `Line ${idx + 1}`;
                            return (
                                <div key={l.rfq_line_id} className="border border-line rounded-lg p-3 flex flex-wrap items-center gap-3">
                                    <div className="flex-1 min-w-0 break-words">
                                        <div className="text-sm text-fg">{label}{l.item_sku ? ` · ${l.item_sku}` : ''}</div>
                                        {l.description && l.description !== label && <div className="text-xs text-fg-subtle">{l.description}</div>}
                                        {l.specification && <div className="text-xs text-fg-subtle">{l.specification}</div>}
                                        <div className="text-xs text-fg-subtle">
                                            Requested {l.quantity} {l.uom}
                                            {l.target_unit_price != null && ` · Target ${formatters.formatCurrency(l.target_unit_price)}`}
                                            {l.required_delivery_date && ` · Needed by ${formatters.formatDate(l.required_delivery_date)}`}
                                        </div>
                                    </div>
                                    <TextField name="unit-price"
                                        type="number" min="0" step="0.01" placeholder="Quoted unit price"
                                        aria-label={`Unit price for ${label}`}
                                        value={l.unit_price} onChange={(e: any) => setLine(idx, { unit_price: e.target.value })}
                                    />
                                    <TextField name="tax"
                                        type="number" min="0" step="0.01" placeholder="Tax %"
                                        aria-label={`Tax rate for ${label}`}
                                        value={l.tax_rate} onChange={(e: any) => setLine(idx, { tax_rate: e.target.value })}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </form>
            </Modal>
        </DetailPageTemplate>
    );
};

export default RFQDetailPage;
