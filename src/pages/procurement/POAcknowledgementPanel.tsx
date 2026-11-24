import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, DataTable, EmptyState, NumberInput, SectionCard, Select, Skeleton, TextField, Textarea, toast, getErrorMessage } from '@so360/design-system';
import { poScheduleService, AckLineInput } from '../../services/poScheduleService';
import { useInventoryFormatters } from '../../utils/formatters';

const RISK_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { low: 'success', medium: 'warning', high: 'danger' };
const CONF_TONES: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = { confirmed: 'success', shipped: 'info', proposed: 'warning', at_risk: 'danger', requested: 'neutral' };
const RESPONSES = [
    { value: 'accepted', label: 'Accepted' },
    { value: 'partially_accepted', label: 'Partially accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'proposed_change', label: 'Proposes a change' },
];

interface Props {
    poId: string;
    poVersion: number;
    status: string;
    lines: Array<{ id: string; description?: string; items?: { name: string } }>;
    onChanged: () => void;
}

/** Schedules & Acknowledgement tab: requested / PO-promised / confirmed / forecast values, acknowledgement form, proposals, shipments. */
const POAcknowledgementPanel: React.FC<Props> = ({ poId, poVersion, status, lines, onChanged }) => {
    const formatters = useInventoryFormatters();
    const [schedules, setSchedules] = useState<any[] | null>(null);
    const [shipments, setShipments] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<Record<string, Partial<AckLineInput>>>({});
    const [contact, setContact] = useState('');
    const [comments, setComments] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [asn, setAsn] = useState({ asn_number: '', carrier: '', tracking_ref: '', eta: '', schedule_id: '', quantity: undefined as number | undefined });
    const issued = ['sent', 'acknowledged', 'partially_received'].includes(status);

    const load = () => Promise.resolve().then(async () => {
        setSchedules(await poScheduleService.schedules(poId));
        setShipments(await poScheduleService.shipments(poId));
    }).catch((e: any) => setError(getErrorMessage(e, 'Schedules are not available')));
    useEffect(() => { load(); }, [poId, status, poVersion]);

    const lineName = (id: string) => { const l = lines.find(x => x.id === id); return l?.items?.name || l?.description || id.slice(0, 8); };
    const patchForm = (id: string, p: Partial<AckLineInput>) => setForm(f => ({ ...f, [id]: { ...f[id], ...p } }));

    const submit = async () => {
        const entries = Object.entries(form).filter(([, v]) => v.response);
        if (!entries.length) { toast.error('Choose a response for at least one schedule'); return; }
        setBusy('ack');
        try {
            await poScheduleService.recordAck(poId, {
                po_version: poVersion,
                idempotency_key: `ui-${poId}-${poVersion}-${Date.now()}`,
                contact_name: contact || undefined,
                comments: comments || undefined,
                lines: entries.map(([schedule_id, v]) => ({ schedule_id, ...v } as AckLineInput)),
            });
            toast.success('Acknowledgement recorded');
            setForm({});
            await load();
            onChanged();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not record the acknowledgement'));
        } finally {
            setBusy(null);
        }
    };

    const decide = async (scheduleId: string, decision: 'accept' | 'reject') => {
        if (decision === 'reject' && !rejectReason.trim()) { toast.error('Enter a reason to reject the proposal'); return; }
        setBusy(scheduleId);
        try {
            const r = await poScheduleService.decideProposal(scheduleId, { decision, reason: rejectReason.trim() || undefined });
            toast.success(r.amended_version ? `Proposal accepted; PO version ${r.amended_version} needs approval` : decision === 'accept' ? 'Proposal accepted' : 'Proposal rejected');
            setRejectReason('');
            await load();
            onChanged();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not review the proposal'));
        } finally {
            setBusy(null);
        }
    };

    const addShipment = async () => {
        if (!asn.asn_number.trim() || !asn.schedule_id || !(Number(asn.quantity) > 0)) { toast.error('ASN number, schedule and quantity are required'); return; }
        setBusy('asn');
        try {
            await poScheduleService.recordShipment(poId, { asn_number: asn.asn_number.trim(), carrier: asn.carrier || undefined, tracking_ref: asn.tracking_ref || undefined, eta: asn.eta || undefined, lines: [{ schedule_id: asn.schedule_id, quantity: Number(asn.quantity) }] });
            toast.success('Shipment recorded');
            setAsn({ asn_number: '', carrier: '', tracking_ref: '', eta: '', schedule_id: '', quantity: undefined });
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not record the shipment'));
        } finally {
            setBusy(null);
        }
    };

    if (error) return <Alert variant="warning">{error}</Alert>;
    if (!schedules) return <Skeleton />;
    const date = (d?: string | null) => (d ? formatters.formatDate(d) : '-');
    const proposals = schedules.filter(s => s.ack_status === 'proposed_change');

    return (
        <div className="flex flex-col gap-nb-4">
            <SectionCard title="Delivery commitments" description={`PO version ${poVersion}. Requested, PO-promised, supplier-confirmed and forecast dates are kept apart.`}>
                {schedules.length === 0 ? <EmptyState title="No schedules" description="Schedules are created when the PO is submitted." /> : (
                    <DataTable
                        data-testid="po-schedules-table"
                        rows={schedules}
                        rowKey={(s: any) => s.id}
                        columns={[
                            { key: 'line', header: 'Line', render: (s: any) => lineName(s.po_line_id) },
                            { key: 'req', header: 'Requested', render: (s: any) => date(s.requested_date ?? s.need_by_date) },
                            { key: 'prom', header: 'PO promised', render: (s: any) => date(s.po_promised_date) },
                            { key: 'conf', header: 'Supplier confirmed', render: (s: any) => date(s.supplier_confirmed_date) },
                            { key: 'fc', header: 'Forecast', render: (s: any) => <span>{date(s.forecast_date)} <Badge tone={CONF_TONES[s.forecast_confidence] || 'neutral'} size="sm">{String(s.forecast_confidence || 'requested').replace(/_/g, ' ')}</Badge></span> },
                            { key: 'qty', header: 'Ordered / confirmed', align: 'right', render: (s: any) => `${s.quantity} / ${s.confirmed_quantity ?? '-'}` },
                            { key: 'open', header: 'Unconfirmed', align: 'right', render: (s: any) => s.open_quantity ?? '-' },
                            { key: 'ack', header: 'Response', render: (s: any) => <Badge tone={s.ack_status === 'accepted' ? 'success' : s.ack_status === 'rejected' ? 'danger' : s.ack_status === 'pending' ? 'neutral' : 'warning'}>{String(s.ack_status || 'pending').replace(/_/g, ' ')}</Badge> },
                            { key: 'risk', header: 'Risk', render: (s: any) => (s.risk_level ? <Badge tone={RISK_TONES[s.risk_level] || 'neutral'}>{s.risk_level}</Badge> : '-') },
                        ]}
                    />
                )}
            </SectionCard>

            {proposals.length > 0 && (
                <SectionCard title="Supplier proposals" description="Nothing is published as confirmed until you accept. Quantity, price or date changes beyond tolerance create a new PO version for approval.">
                    <div className="flex flex-col gap-nb-3">
                        {proposals.map(s => (
                            <div key={s.id} className="flex flex-wrap items-center gap-nb-2">
                                <span className="text-nb-sm">{lineName(s.po_line_id)}: forecast {date(s.forecast_date)}</span>
                                <Button size="sm" onClick={() => decide(s.id, 'accept')} disabled={busy === s.id}>Accept proposal</Button>
                                <Button size="sm" variant="secondary" onClick={() => decide(s.id, 'reject')} disabled={busy === s.id}>Reject proposal</Button>
                            </div>
                        ))}
                        <TextField name="reject-reason" label="Reason (needed to reject)" value={rejectReason} onChange={(e: any) => setRejectReason(e.target.value)} />
                    </div>
                </SectionCard>
            )}

            {issued && schedules.length > 0 && (
                <SectionCard title="Record acknowledgement" description="Record what the supplier said for this version, per schedule.">
                    <div className="flex flex-col gap-nb-3">
                        {schedules.map(s => {
                            const v = form[s.id] || {};
                            return (
                                <div key={s.id} className="grid grid-cols-1 gap-nb-2 md:grid-cols-4">
                                    <Select name={`resp-${s.id}`} label={`Response for ${lineName(s.po_line_id)}`} value={v.response ?? ''} options={[{ value: '', label: 'No response' }, ...RESPONSES]} onChange={(e: any) => patchForm(s.id, { response: (e?.target ? e.target.value : e) || undefined })} />
                                    {v.response === 'partially_accepted' && <NumberInput name={`cq-${s.id}`} label="Confirmed quantity" min={0} max={s.quantity} value={v.confirmed_quantity} onChange={(n: any) => patchForm(s.id, { confirmed_quantity: n ?? undefined })} />}
                                    {(v.response === 'accepted' || v.response === 'partially_accepted') && <TextField name={`cd-${s.id}`} label="Confirmed date" type="date" value={v.confirmed_date ?? ''} onChange={(e: any) => patchForm(s.id, { confirmed_date: e.target.value })} />}
                                    {v.response === 'proposed_change' && (
                                        <>
                                            <TextField name={`pd-${s.id}`} label="Proposed date" type="date" value={v.proposed_date ?? ''} onChange={(e: any) => patchForm(s.id, { proposed_date: e.target.value })} />
                                            <NumberInput name={`pq-${s.id}`} label="Proposed quantity" min={0} value={v.proposed_quantity} onChange={(n: any) => patchForm(s.id, { proposed_quantity: n ?? undefined })} />
                                        </>
                                    )}
                                    {(v.response === 'rejected' || v.response === 'partially_accepted') && <TextField name={`er-${s.id}`} label="Reason" value={v.exception_reason ?? ''} onChange={(e: any) => patchForm(s.id, { exception_reason: e.target.value })} />}
                                </div>
                            );
                        })}
                        <TextField name="ack-contact" label="Supplier contact" value={contact} onChange={(e: any) => setContact(e.target.value)} />
                        <Textarea name="ack-comments" label="Comments" value={comments} onChange={(e: any) => setComments(e.target.value)} />
                        <div><Button onClick={submit} disabled={busy === 'ack'}>{busy === 'ack' ? 'Saving...' : 'Record acknowledgement'}</Button></div>
                    </div>
                </SectionCard>
            )}

            <SectionCard title="Shipments">
                {shipments.length === 0 ? <p className="text-nb-sm text-fg-muted">No shipment notices yet.</p> : (
                    <DataTable
                        rows={shipments}
                        rowKey={(s: any) => s.id}
                        columns={[
                            { key: 'asn', header: 'ASN', render: (s: any) => s.asn_number },
                            { key: 'carrier', header: 'Carrier', render: (s: any) => s.carrier || '-' },
                            { key: 'track', header: 'Tracking', render: (s: any) => s.tracking_ref || '-' },
                            { key: 'eta', header: 'ETA', render: (s: any) => date(s.eta) },
                        ]}
                    />
                )}
                {issued && schedules.length > 0 && (
                    <div className="mt-nb-3 grid grid-cols-1 gap-nb-2 md:grid-cols-5">
                        <TextField name="asn-number" label="ASN number" value={asn.asn_number} onChange={(e: any) => setAsn(a => ({ ...a, asn_number: e.target.value }))} />
                        <Select name="asn-schedule" label="Schedule" value={asn.schedule_id} options={[{ value: '', label: 'Choose' }, ...schedules.map(s => ({ value: s.id, label: `${lineName(s.po_line_id)} (${s.quantity})` }))]} onChange={(e: any) => setAsn(a => ({ ...a, schedule_id: e?.target ? e.target.value : e }))} />
                        <NumberInput name="asn-qty" label="Shipped quantity" min={0} value={asn.quantity} onChange={(n: any) => setAsn(a => ({ ...a, quantity: n ?? undefined }))} />
                        <TextField name="asn-tracking" label="Tracking reference" value={asn.tracking_ref} onChange={(e: any) => setAsn(a => ({ ...a, tracking_ref: e.target.value }))} />
                        <TextField name="asn-eta" label="ETA" type="date" value={asn.eta} onChange={(e: any) => setAsn(a => ({ ...a, eta: e.target.value }))} />
                        <div><Button variant="secondary" onClick={addShipment} disabled={busy === 'asn'}>Record shipment</Button></div>
                    </div>
                )}
            </SectionCard>
        </div>
    );
};

export default POAcknowledgementPanel;
