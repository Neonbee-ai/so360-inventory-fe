import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rfqService } from '../../services/rfqService';
import {
    Alert, Badge, DataTable, EmptyState, NumberInput, SectionCard, Skeleton, TextField, WizardPageTemplate,
    toast, getErrorMessage, type DataTableColumn,
} from '@so360/design-system';

/**
 * Award wizard: choose vendor and quantity per RFQ line (a line may be split
 * between vendors), state the rationale and any waiver, submit. The server
 * re-checks eligibility, the locked snapshot and approval policy.
 */
const RFQAwardWizardPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [ev, setEv] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [qty, setQty] = useState<Record<string, number>>({});
    const [rationale, setRationale] = useState('');
    const [waiver, setWaiver] = useState('');
    const [finishing, setFinishing] = useState(false);
    const key = (lineId: string, qid: string) => `${lineId}|${qid}`;

    useEffect(() => {
        Promise.resolve().then(async () => {
            const list: any[] = await rfqService.listEvaluations(id!);
            const locked = (list || []).find(e => e.status === 'locked');
            if (!locked) throw new Error('Lock an evaluation before awarding.');
            const [cmp, evaluation] = await Promise.all([rfqService.getComparison(id!, locked.id), rfqService.getEvaluation(id!, locked.id)]);
            setData(cmp);
            setEv(evaluation);
            const rec = evaluation.recommendation?.recommended_quotation_id;
            if (rec) setQty(Object.fromEntries((cmp.lines || []).map((l: any) => [key(l.rfq_line_id, rec), Number(l.quantity)])));
        }).catch((e: any) => setError(getErrorMessage(e, 'Could not load the evaluation')));
    }, [id]);

    const lines: any[] = data?.lines || [];
    const quotes: any[] = data?.quotations || [];
    const picked = useMemo(() => Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([k, v]) => {
        const [rfq_line_id, quotation_id] = k.split('|');
        return { rfq_line_id, quotation_id, qty: Number(v) };
    }), [qty]);
    const overAllocated = lines.filter(l => picked.filter(p => p.rfq_line_id === l.rfq_line_id).reduce((s, p) => s + p.qty, 0) > Number(l.quantity));
    const score = (qid: string) => (ev?.scores || []).find((s: any) => s.quotation_id === qid);

    const columnsFor = (l: any): DataTableColumn<any>[] => [
        { key: 'vendor', header: 'Vendor', render: (q: any) => <>{q.vendor_name || q.vendor_id.slice(0, 8)}<span className="block text-xs text-fg-subtle">v{q.normalized?.version ?? 1}</span></> },
        {
            key: 'price', header: 'Normalised unit', align: 'right',
            render: (q: any) => {
                const nl = q.normalized?.lines?.find((x: any) => x.rfq_line_id === l.rfq_line_id);
                return nl?.normalized_unit_price != null ? `${nl.normalized_unit_price} ${q.normalized.base_currency}` : <Badge tone="danger">n/a</Badge>;
            },
        },
        { key: 'flags', header: 'Flags', render: (q: any) => (q.normalized?.flags || []).map((f: string) => f.replace(/_/g, ' ').toLowerCase()).join(', ') || '-' },
        { key: 'score', header: 'Score', align: 'right', render: (q: any) => score(q.quotation_id)?.total ?? '-' },
        {
            key: 'qty', header: `Award qty (of ${l.quantity})`, align: 'right',
            render: (q: any) => (
                <NumberInput
                    name={`qty-${l.rfq_line_id}-${q.quotation_id}`} aria-label={`Quantity for ${q.vendor_name}`} min={0}
                    value={qty[key(l.rfq_line_id, q.quotation_id)] ?? 0}
                    onChange={(v: any) => setQty(prev => ({ ...prev, [key(l.rfq_line_id, q.quotation_id)]: v ?? 0 }))}
                />
            ),
        },
    ];

    const finish = async () => {
        setFinishing(true);
        try {
            const award: any = await rfqService.createAward(id!, {
                evaluation_id: ev.id,
                lines: picked,
                ...(rationale.trim() ? { rationale: rationale.trim() } : {}),
                ...(waiver.trim() ? { waiver_reason: waiver.trim() } : {}),
            });
            toast.success(award.status === 'pending_approval' ? 'Award submitted for approval' : 'Award recorded');
            navigate(`/procurement/rfq/${id}/compare`);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not create the award'));
            setFinishing(false);
        }
    };

    const body = (content: React.ReactNode) => (error ? <Alert variant="error">{error}</Alert> : !data ? <Skeleton /> : content);

    return (
        <WizardPageTemplate
            trail={[{ label: 'Comparison', onClick: () => navigate(`/procurement/rfq/${id}/compare`) }]}
            title="Award RFQ"
            description="Choose vendors and quantities from the locked evaluation. A line can be split between vendors."
            finishLabel="Submit award"
            finishing={finishing}
            onFinish={finish}
            onCancel={() => navigate(`/procurement/rfq/${id}/compare`)}
            steps={[
                {
                    id: 'select',
                    label: 'Select vendors',
                    validate: () => {
                        if (picked.length === 0) return 'Enter a quantity for at least one vendor';
                        if (overAllocated.length) return 'A line is awarded for more than the requested quantity';
                        return true;
                    },
                    content: body(
                        lines.length === 0 ? <EmptyState title="No lines to award." /> : (
                            <div className="flex flex-col gap-nb-4">
                                {lines.map(l => (
                                    <SectionCard key={l.rfq_line_id} title={l.description || 'Line'}>
                                        <DataTable rows={quotes.map(q => ({ ...q, normalized: ev?.normalized?.find((n: any) => n.quotation_id === q.quotation_id) }))} rowKey={(q: any) => q.quotation_id} columns={columnsFor(l)} />
                                    </SectionCard>
                                ))}
                            </div>
                        ),
                    ),
                },
                {
                    id: 'rationale',
                    label: 'Rationale and waiver',
                    content: (
                        <div className="flex flex-col gap-nb-3">
                            <TextField name="award-rationale" label="Award rationale" value={rationale} onChange={(e: any) => setRationale(e.target.value)} />
                            <TextField
                                name="award-waiver" label="Waiver reason" value={waiver} onChange={(e: any) => setWaiver(e.target.value)}
                                hint="Required when the award is not the lowest evaluated cost, or a quotation is non-compliant. It goes to approval."
                            />
                        </div>
                    ),
                },
                {
                    id: 'confirm',
                    label: 'Confirm',
                    content: (
                        <SectionCard title="Summary">
                            <ul className="space-y-nb-1 text-nb-body">
                                {picked.map(p => {
                                    const q = quotes.find(x => x.quotation_id === p.quotation_id);
                                    const l = lines.find(x => x.rfq_line_id === p.rfq_line_id);
                                    return <li key={`${p.rfq_line_id}${p.quotation_id}`}>{p.qty} × {l?.description || 'line'} → {q?.vendor_name || p.quotation_id.slice(0, 8)}</li>;
                                })}
                            </ul>
                            {waiver.trim() && <Badge tone="warning">Waiver - approval required</Badge>}
                        </SectionCard>
                    ),
                },
            ]}
        />
    );
};

export default RFQAwardWizardPage;
