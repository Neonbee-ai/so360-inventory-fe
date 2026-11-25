import React, { useEffect, useState } from 'react';
import { Badge, Button, EmptyState, Select, SectionCard, TextField, toast, getErrorMessage } from '@so360/design-system';
import { rfqService } from '../../services/rfqService';
import { useInventoryFormatters } from '../../utils/formatters';

interface Props {
    rfqId: string;
    vendors: Array<{ vendor_id: string; vendor_name?: string | null }>;
    canAct: boolean;
}

/**
 * Clarifications on the RFQ. A question may target one vendor or be a buyer
 * broadcast. An answer stays private to the asker or is shared with every
 * vendor, anonymised - other vendors never see who asked.
 */
const RFQClarificationsPanel: React.FC<Props> = ({ rfqId, vendors, canAct }) => {
    const formatters = useInventoryFormatters();
    const [items, setItems] = useState<any[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [target, setTarget] = useState('');
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [visibility, setVisibility] = useState<Record<string, 'private' | 'shared_anonymised'>>({});
    const [busy, setBusy] = useState(false);

    const load = () => Promise.resolve().then(() => rfqService.getClarifications(rfqId))
        .then((r: any) => { setItems(Array.isArray(r) ? r : []); setError(null); })
        .catch((e: any) => setError(getErrorMessage(e, 'Could not load clarifications')));
    useEffect(() => { load(); }, [rfqId]);

    const vendorName = (id?: string | null) => (id ? vendors.find(v => v.vendor_id === id)?.vendor_name || id.slice(0, 8) : 'All vendors');

    const ask = async () => {
        if (busy || !question.trim()) return;
        setBusy(true);
        try {
            await rfqService.askClarification(rfqId, { question: question.trim(), ...(target ? { vendor_id: target } : {}) });
            setQuestion('');
            await load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Could not record the question'));
        } finally { setBusy(false); }
    };

    const answer = async (c: any) => {
        if (busy || !(answers[c.id] || '').trim()) return;
        setBusy(true);
        try {
            await rfqService.answerClarification(rfqId, c.id, { answer: answers[c.id].trim(), visibility: visibility[c.id] || 'private' });
            await load();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Could not save the answer'));
        } finally { setBusy(false); }
    };

    return (
        <SectionCard title="Clarifications">
            {error && <p className="text-xs text-danger" role="alert">{error}</p>}
            {items && items.length === 0 && <EmptyState title="No clarifications yet." />}
            <div className="space-y-nb-3">
                {(items || []).map(c => (
                    <div key={c.id} className="rounded-lg border border-line p-nb-3 space-y-nb-2">
                        <div className="flex flex-wrap items-center justify-between gap-nb-2">
                            <span className="text-nb-body text-fg break-words">{c.question}</span>
                            <Badge tone="neutral" size="sm">{vendorName(c.vendor_id)} · {formatters.formatDate(c.asked_at)}</Badge>
                        </div>
                        {c.answer ? (
                            <div className="text-nb-body text-fg-muted">
                                {c.answer}
                                <Badge tone={c.visibility === 'shared_anonymised' ? 'info' : 'neutral'} size="sm" className="ml-nb-2">
                                    {c.visibility === 'shared_anonymised' ? 'Shared (anonymised)' : 'Private'}
                                </Badge>
                            </div>
                        ) : canAct && (
                            <div className="flex flex-wrap items-end gap-nb-2">
                                <TextField name={`answer-${c.id}`} label="Answer" value={answers[c.id] || ''} onChange={(e: any) => setAnswers({ ...answers, [c.id]: e.target.value })} />
                                <Select
                                    name={`vis-${c.id}`} label="Visibility" value={visibility[c.id] || 'private'}
                                    onChange={(e: any) => setVisibility({ ...visibility, [c.id]: e?.target ? e.target.value : e })}
                                    options={[{ value: 'private', label: 'Private to asker' }, { value: 'shared_anonymised', label: 'Share with all vendors (anonymised)' }]}
                                />
                                <Button size="sm" disabled={busy || !(answers[c.id] || '').trim()} onClick={() => answer(c)}>Save answer</Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {canAct && (
                <div className="mt-nb-4 flex flex-wrap items-end gap-nb-2">
                    <TextField name="clarification-question" label="New question" value={question} onChange={(e: any) => setQuestion(e.target.value)} />
                    <Select
                        name="clarification-target" label="To" placeholder="All vendors" value={target}
                        onChange={(e: any) => setTarget(e?.target ? e.target.value : e)}
                        options={vendors.map(v => ({ value: v.vendor_id, label: v.vendor_name || v.vendor_id.slice(0, 8) }))}
                    />
                    <Button size="sm" disabled={busy || !question.trim()} onClick={ask}>Record question</Button>
                </div>
            )}
        </SectionCard>
    );
};

export default RFQClarificationsPanel;
