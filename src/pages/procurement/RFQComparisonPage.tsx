import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Clock, Star, TrendingDown } from 'lucide-react';
import { rfqService } from '../../services/rfqService';
import { useInventoryFormatters } from '../../utils/formatters';
import {
    toast, getErrorMessage, useConfirm, DetailPageTemplate, Button, Badge, KpiCard, Grid, GridItem, SectionCard, DataTable, EmptyState, Textarea,
} from '@so360/design-system';

/**
 * Side-by-side quotation comparison.
 *
 * Price alone rarely decides a purchase, so every commercial axis a buyer
 * weighs — landed total, lead time, terms, warranty, MOQ and the vendor's own
 * performance rating — gets its own row, with the best value in each badged.
 */
const RFQComparisonPage = () => {
    const [confirm, confirmDialog] = useConfirm();
    const { id } = useParams();
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [awarding, setAwarding] = useState<string | null>(null);
    const [justification, setJustification] = useState('');

    useEffect(() => { if (id) fetchComparison(); }, [id]);

    const fetchComparison = async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await rfqService.getComparison(id!));
        } catch (err: any) {
            setError(getErrorMessage(err, 'Failed to load comparison'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAward = async (quotationId: string, vendorName: string) => {
        if (!(await confirm({ title: 'Award RFQ', message: `Award this RFQ to ${vendorName}? A purchase order will be created.`, intent: 'default', confirmLabel: 'Award' }))) return;
        setAwarding(quotationId);
        try {
            const result = await rfqService.awardRFQ(id!, {
                quotation_id: quotationId,
                justification: justification || undefined,
            });
            toast.success(`Awarded to ${vendorName} — PO ${result?.po?.po_number || ''} created`);
            navigate(`/procurement/po/${result.po.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to award RFQ'));
            setAwarding(null);
        }
    };

    const handleGrade = async (quotationId: string, status: 'shortlisted' | 'rejected') => {
        try {
            await rfqService.gradeQuotation(quotationId, { status });
            toast.success(status === 'shortlisted' ? 'Quotation shortlisted' : 'Quotation rejected');
            await fetchComparison();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to update quotation'));
        }
    };

    if (isLoading) {
        return <DetailPageTemplate trail={[{ label: 'RFQ', onClick: () => navigate(`/procurement/rfq/${id}`) }]} title="Quotation Comparison" loading>{null}</DetailPageTemplate>;
    }

    if (error || !data) {
        return (
            <EmptyState
                title={error || 'Comparison unavailable'}
                action={{ label: 'Back to RFQs', onClick: () => navigate('/procurement/rfq') }}
            />
        );
    }

    const { rfq, lines, quotations, summary } = data;
    const isAwarded = rfq.status === 'awarded';

    type Row = { key: string; label: React.ReactNode; render: (q: any) => React.ReactNode };
    const fmt = formatters.formatCurrency;
    const criteria: Row[] = [
        { key: 'subtotal', label: 'Subtotal', render: q => fmt(q.subtotal_amount) },
        { key: 'tax', label: 'Tax', render: q => fmt(q.tax_amount) },
        { key: 'freight', label: 'Freight', render: q => fmt(q.freight_amount) },
        { key: 'discount', label: 'Discount', render: q => fmt(q.discount_amount) },
        {
            key: 'landed', label: 'Landed Total',
            render: q => <span className={`font-bold ${q.is_lowest_total ? 'text-success' : 'text-fg'}`}>{fmt(q.total_amount)}</span>,
        },
        { key: 'lead', label: 'Lead Time', render: q => q.lead_time_days != null ? `${q.lead_time_days} days` : '—' },
        { key: 'payment', label: 'Payment Terms', render: q => q.payment_terms || '—' },
        { key: 'delivery', label: 'Delivery Terms', render: q => q.delivery_terms || '—' },
        { key: 'incoterms', label: 'Incoterms', render: q => q.incoterms || '—' },
        { key: 'warranty', label: 'Warranty', render: q => q.warranty_terms || '—' },
        { key: 'moq', label: 'MOQ', render: q => q.moq_note || '—' },
        { key: 'valid', label: 'Valid Until', render: q => q.valid_until ? formatters.formatDate(q.valid_until) : '—' },
        { key: 'quality', label: 'Quality Rating', render: q => q.quality_rating != null ? `${Number(q.quality_rating).toFixed(1)} / 5` : '—' },
    ];
    const lineRows: Row[] = lines.map((l: any) => ({
        key: `line-${l.rfq_line_id}`,
        label: (
            <>
                <div className="text-xs text-fg-muted">{l.description || 'Line'}</div>
                <div className="text-xs text-fg-subtle">
                    {l.quantity} {l.uom || ''}
                    {l.target_unit_price != null && ` · target ${fmt(l.target_unit_price)}`}
                </div>
            </>
        ),
        render: (q: any) => {
            const cell = q.lines[l.rfq_line_id];
            const isLowest = cell && l.lowest_unit_price != null && cell.unit_price === l.lowest_unit_price;
            return cell
                ? <span className={isLowest ? 'text-success font-bold' : 'text-fg-muted'}>{fmt(cell.unit_price)}</span>
                : <span className="text-fg-subtle">Not quoted</span>;
        },
    }));
    const decisionRow: Row = {
        key: 'decision', label: 'Decision',
        render: q => (
            <div className="flex flex-col gap-2">
                <Button
                    size="sm"
                    onClick={() => handleAward(q.quotation_id, q.vendor_name || 'this vendor')}
                    disabled={!!awarding || q.is_expired}
                    title={q.is_expired ? 'This quotation has expired' : undefined}
                >
                    <Trophy size={12} /> Award
                </Button>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleGrade(q.quotation_id, 'shortlisted')}>Shortlist</Button>
                    <Button size="sm" variant="danger" onClick={() => handleGrade(q.quotation_id, 'rejected')}>Reject</Button>
                </div>
            </div>
        ),
    };
    const rows: Row[] = [...criteria, ...lineRows, ...(isAwarded ? [] : [decisionRow])];

    const columns = [
        { key: 'criterion', header: 'Criterion', render: (r: Row) => <span className="text-xs font-semibold text-fg-subtle">{r.label}</span> },
        ...quotations.map((q: any) => ({
            key: q.quotation_id,
            header: (
                <div>
                    <div className="font-bold text-fg">{q.vendor_name || q.vendor_id.slice(0, 8)}</div>
                    <div className="text-xs text-fg-subtle font-normal">{q.quotation_number || 'No ref'}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {q.is_lowest_total && <Badge tone="success"><TrendingDown size={10} /> Lowest</Badge>}
                        {q.is_fastest && <Badge tone="primary"><Clock size={10} /> Fastest</Badge>}
                        {q.is_best_rated && <Badge tone="warning"><Star size={10} /> Top rated</Badge>}
                        {q.is_expired && <Badge tone="danger">Expired</Badge>}
                        {q.status === 'awarded' && <Badge tone="success">Awarded</Badge>}
                    </div>
                </div>
            ),
            render: (r: Row) => r.render(q),
        })),
    ];

    return (
        <DetailPageTemplate
            trail={[{ label: 'RFQ', onClick: () => navigate(`/procurement/rfq/${id}`) }]}
            title="Quotation Comparison"
            meta={`${rfq.rfq_number}${rfq.title ? ` — ${rfq.title}` : ''}`}
        >
            {confirmDialog}
            <div className="space-y-6">
                <Grid columns="auto" gap="md">
                    <GridItem span={3}><KpiCard label="Vendors Invited" value={summary.invited_count} /></GridItem>
                    <GridItem span={3}><KpiCard label="Quotes Received" value={summary.quotation_count} /></GridItem>
                    <GridItem span={3}><KpiCard label="Lowest Total" value={summary.lowest_total != null ? fmt(summary.lowest_total) : '—'} /></GridItem>
                    <GridItem span={3}><KpiCard label="Potential Saving" value={fmt(summary.potential_saving || 0)} /></GridItem>
                </Grid>

                {quotations.length === 0 ? (
                    <EmptyState title="No quotations to compare yet." />
                ) : (
                    <DataTable data-testid="rfq-comparison-table" rows={rows} rowKey={(r: Row) => r.key} columns={columns} />
                )}

                {!isAwarded && quotations.length > 0 && (
                    <SectionCard title="Decision notes">
                        <Textarea
                            id="award-justification"
                            name="award-justification"
                            label="Award Justification"
                            value={justification}
                            onChange={(e: any) => setJustification(e.target.value)}
                            placeholder="Recorded on the RFQ — required in practice whenever the cheapest quote is not the one awarded."
                            rows={3}
                        />
                    </SectionCard>
                )}
            </div>
        </DetailPageTemplate>
    );
};

export default RFQComparisonPage;
