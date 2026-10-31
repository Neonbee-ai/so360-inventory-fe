import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
        delivery_terms: '', warranty_terms: '', moq_note: '',
    });
    const [quoteLines, setQuoteLines] = useState<any[]>([]);

    useEffect(() => { if (id) fetchRFQ(); }, [id]);

    const fetchRFQ = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await rfqService.getRFQ(id!);
            setRfq(data);
        } catch (err: any) {
            setError(getErrorMessage(err, 'Failed to load RFQ'));
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
            quantity: l.quantity,
            uom: l.uom || '',
            unit_price: '',
            discount_percent: '',
            tax_rate: '',
            lead_time_days: '',
        })));
        setQuoteVendor(rfq?.rfq_vendors?.find((v: any) => v.status === 'invited')?.vendor_id || '');
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

    const handleQuoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quoteVendor) {
            toast.warning('Select the vendor this quotation came from.');
            return;
        }
        const priced = quoteLines.filter(l => parseFloat(String(l.unit_price)) > 0);
        if (priced.length === 0) {
            toast.warning('Enter a unit price on at least one line.');
            return;
        }

        setBusy('quote');
        try {
            await rfqService.recordQuotation(id!, {
                vendor_id: quoteVendor,
                quotation_number: quoteHeader.quotation_number || undefined,
                quotation_date: quoteHeader.quotation_date || undefined,
                valid_until: quoteHeader.valid_until || undefined,
                lead_time_days: quoteHeader.lead_time_days ? parseInt(quoteHeader.lead_time_days, 10) : undefined,
                freight_amount: quoteHeader.freight_amount ? parseFloat(quoteHeader.freight_amount) : undefined,
                payment_terms: quoteHeader.payment_terms || undefined,
                delivery_terms: quoteHeader.delivery_terms || undefined,
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
            setQuoteHeader({
                quotation_number: '', quotation_date: '', valid_until: '',
                lead_time_days: '', freight_amount: '', payment_terms: '',
                delivery_terms: '', warranty_terms: '', moq_note: '',
            });
            await fetchRFQ();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to record quotation'));
        } finally {
            setBusy(null);
        }
    };

    const quotations = rfq?.vendor_quotations || [];
    const canAct = !!rfq && !['awarded', 'cancelled'].includes(rfq.status);
    const hdr = (key: keyof typeof quoteHeader) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setQuoteHeader({ ...quoteHeader, [key]: e.target.value });
    const setLine = (idx: number, patch: Record<string, string>) => {
        const next = [...quoteLines];
        next[idx] = { ...next[idx], ...patch };
        setQuoteLines(next);
    };

    if (isLoading) {
        return <DetailPageTemplate trail={[{ label: 'RFQs', onClick: () => navigate('/procurement/rfq') }]} title="RFQ" loading>{null}</DetailPageTemplate>;
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
                                { key: 'item', header: 'Item', render: (l: any) => l.description || l.item_id?.slice(0, 8) || 'Item' },
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
                <form id="quote-form" onSubmit={handleQuoteSubmit} className="space-y-4">
                    <FieldGrid columns={2}>
                        <Select
                            id="q-vendor" name="q-vendor" label="Vendor" placeholder="Select vendor" value={quoteVendor}
                            onChange={(e: any) => setQuoteVendor(e?.target ? e.target.value : e)}
                            options={[
                                ...rfqVendors.map((v: any) => ({ value: v.vendor_id, label: v.vendor_name || v.vendor_id.slice(0, 8) })),
                                ...vendors
                                    .filter(v => !rfqVendors.some((rv: any) => rv.vendor_id === v.id))
                                    .map(v => ({ value: v.id, label: `${v.name} (not invited)` })),
                            ]}
                        />
                        <TextField id="q-number" name="q-number" label="Quotation Ref" value={quoteHeader.quotation_number} onChange={hdr('quotation_number')} />
                        <TextField id="q-valid" name="q-valid" label="Valid Until" type="date" value={quoteHeader.valid_until} onChange={hdr('valid_until')} />
                        <TextField id="q-lead" name="q-lead" label="Lead Time (days)" type="number" min="0" value={quoteHeader.lead_time_days} onChange={hdr('lead_time_days')} />
                        <TextField id="q-freight" name="q-freight" label="Freight" type="number" min="0" step="0.01" value={quoteHeader.freight_amount} onChange={hdr('freight_amount')} />
                        <TextField id="q-payment" name="q-payment" label="Payment Terms" value={quoteHeader.payment_terms} onChange={hdr('payment_terms')} />
                        <TextField id="q-warranty" name="q-warranty" label="Warranty" value={quoteHeader.warranty_terms} onChange={hdr('warranty_terms')} />
                        <TextField id="q-moq" name="q-moq" label="MOQ Conditions" value={quoteHeader.moq_note} onChange={hdr('moq_note')} />
                    </FieldGrid>

                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-fg-subtle">Quoted prices</div>
                        {quoteLines.map((l, idx) => (
                            <div key={l.rfq_line_id} className="border border-line rounded-lg p-3 flex flex-wrap items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-fg truncate">{l.description || 'Line'}</div>
                                    <div className="text-xs text-fg-subtle">Qty {l.quantity} {l.uom}</div>
                                </div>
                                <TextField name="unit-price"
                                    type="number" min="0" step="0.01" placeholder="Unit price"
                                    aria-label={`Unit price for ${l.description || `line ${idx + 1}`}`}
                                    value={l.unit_price} onChange={(e: any) => setLine(idx, { unit_price: e.target.value })}
                                />
                                <TextField name="tax"
                                    type="number" min="0" step="0.01" placeholder="Tax %"
                                    aria-label={`Tax rate for ${l.description || `line ${idx + 1}`}`}
                                    value={l.tax_rate} onChange={(e: any) => setLine(idx, { tax_rate: e.target.value })}
                                />
                            </div>
                        ))}
                    </div>
                </form>
            </Modal>
        </DetailPageTemplate>
    );
};

export default RFQDetailPage;
