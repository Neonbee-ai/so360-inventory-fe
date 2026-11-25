import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, DataTable, EmptyState, NumberInput, SectionCard, Skeleton, Textarea, toast, getErrorMessage } from '@so360/design-system';
import { poApprovalService } from '../../services/poApprovalService';
import { useInventoryFormatters } from '../../utils/formatters';

/** Line-level differences between two version snapshots (display only; the server decides materiality). */
export const diffVersions = (prev: any | null, next: any): Array<{ field: string; from: any; to: any }> => {
    if (!prev) return [];
    const out: Array<{ field: string; from: any; to: any }> = [];
    const pl = new Map<string, any>((prev.lines || []).map((l: any) => [l.id, l]));
    for (const l of next.lines || []) {
        const o = pl.get(l.id);
        if (!o) { out.push({ field: `line ${String(l.id).slice(0, 6)}`, from: null, to: `${l.quantity} x ${l.unit_price}` }); continue; }
        if (Number(o.quantity) !== Number(l.quantity)) out.push({ field: `quantity (${String(l.id).slice(0, 6)})`, from: o.quantity, to: l.quantity });
        if (Number(o.unit_price) !== Number(l.unit_price)) out.push({ field: `unit price (${String(l.id).slice(0, 6)})`, from: o.unit_price, to: l.unit_price });
    }
    for (const k of ['vendor_id', 'currency', 'payment_terms', 'delivery_terms', 'incoterms', 'expected_delivery_date', 'total_amount', 'notes']) {
        if ((prev.header?.[k] ?? null) !== (next.header?.[k] ?? null)) out.push({ field: k.replace(/_/g, ' '), from: prev.header?.[k] ?? null, to: next.header?.[k] ?? null });
    }
    return out;
};

interface Props {
    poId: string;
    lines: Array<{ id: string; description?: string; quantity: number; unit_price: number; received_quantity?: number; items?: { name: string } }>;
    canAmend: boolean;
    onChanged: () => void;
}

/** Versions tab: immutable snapshots with a diff against the previous version, plus the amendment form. */
const POVersionsPanel: React.FC<Props> = ({ poId, lines, canAmend, onChanged }) => {
    const formatters = useInventoryFormatters();
    const [versions, setVersions] = useState<any[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [edits, setEdits] = useState<Record<string, { quantity?: number; unit_price?: number }>>({});
    const [saving, setSaving] = useState(false);

    const load = () => Promise.resolve().then(() => poApprovalService.versions(poId)).then(setVersions).catch((e: any) => setError(getErrorMessage(e, 'Versions are not available')));
    useEffect(() => { load(); }, [poId]);

    const submit = async () => {
        const changed = Object.entries(edits).filter(([, v]) => v.quantity != null || v.unit_price != null).map(([id, v]) => ({ id, ...v }));
        if (!reason.trim() || changed.length === 0) { toast.error('Change at least one line and give a reason'); return; }
        setSaving(true);
        try {
            const r = await poApprovalService.amend(poId, { reason: reason.trim(), lines: changed });
            toast.success(r.material ? `Version ${r.version} created; it needs approval before it can be re-issued` : `Version ${r.version} recorded`);
            setEdits({});
            setReason('');
            await load();
            onChanged();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not amend the PO'));
        } finally {
            setSaving(false);
        }
    };

    if (error) return <Alert variant="warning">{error}</Alert>;
    if (!versions) return <Skeleton />;

    return (
        <div className="flex flex-col gap-nb-4">
            <SectionCard title="Versions">
                {versions.length === 0 ? <EmptyState title="No issued version yet" description="A version is frozen when the PO is issued." /> : (
                    <DataTable
                        rows={versions}
                        rowKey={(v: any) => v.id}
                        columns={[
                            { key: 'v', header: 'Version', render: (v: any) => <Badge tone="neutral">{`v${v.version}`}</Badge> },
                            { key: 'when', header: 'Frozen', render: (v: any) => formatters.formatDateTime(v.created_at) },
                            { key: 'why', header: 'Reason', render: (v: any) => String(v.change_reason || '').replace(/_/g, ' ') },
                            {
                                key: 'diff', header: 'Changes vs previous',
                                render: (v: any, i?: number) => {
                                    const idx = versions.findIndex(x => x.id === v.id);
                                    const d = diffVersions(idx > 0 ? versions[idx - 1].snapshot : null, v.snapshot);
                                    return d.length === 0 ? '-' : d.map(x => `${x.field}: ${x.from ?? '-'} -> ${x.to ?? '-'}`).join('; ');
                                },
                            },
                        ]}
                    />
                )}
            </SectionCard>

            {canAmend && (
                <SectionCard title="Amend this PO" description="Material changes (vendor, quantity, price, tax, dates beyond tolerance, terms) go back to approval. The issued version stays unchanged.">
                    <div className="flex flex-col gap-nb-3">
                        {lines.map(l => (
                            <div key={l.id} className="grid grid-cols-1 gap-nb-2 md:grid-cols-3">
                                <div className="text-nb-sm">{l.items?.name || l.description || l.id.slice(0, 8)}</div>
                                <NumberInput name={`qty-${l.id}`} label={`Quantity for ${l.items?.name || l.description || l.id.slice(0, 8)}`} min={l.received_quantity || 0} value={edits[l.id]?.quantity ?? l.quantity} onChange={(v: any) => setEdits(e => ({ ...e, [l.id]: { ...e[l.id], quantity: v == null || v === l.quantity ? undefined : v } }))} />
                                <NumberInput name={`price-${l.id}`} label={`Unit price for ${l.items?.name || l.description || l.id.slice(0, 8)}`} min={0} value={edits[l.id]?.unit_price ?? l.unit_price} onChange={(v: any) => setEdits(e => ({ ...e, [l.id]: { ...e[l.id], unit_price: v == null || v === l.unit_price ? undefined : v } }))} />
                            </div>
                        ))}
                        <Textarea label="Reason for the amendment" name="amend-reason" id="amend-reason" value={reason} onChange={(e: any) => setReason(e.target.value)} />
                        <div><Button onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Create new version'}</Button></div>
                    </div>
                </SectionCard>
            )}
        </div>
    );
};

export default POVersionsPanel;
