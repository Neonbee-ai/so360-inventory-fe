import React, { useEffect, useState } from 'react';
import { receivingService } from '../../services/receivingService';
import { Alert, Button, FieldGrid, FieldGridItem, Modal, Select, TextField, getErrorMessage, toast } from '@so360/design-system';

const DECISIONS = [
    { value: 'release', label: 'Release to stock' },
    { value: 'use_as_is', label: 'Use as is (authorised)' },
    { value: 'reject', label: 'Reject (claim to supplier)' },
];

/** Units still held in quarantine on an inspection line. */
export const openQuarantine = (l: any): number =>
    (Number(l.quarantined_quantity) || 0) - (Number(l.quarantine_released_quantity) || 0) - (Number(l.quarantine_rejected_quantity) || 0);

/**
 * Disposition of quarantined units (Procurement Flow 07). Quarantined goods are never "available" until Quality
 * releases them; rejecting drafts a supplier claim. Procurement does not decide technical acceptance here, the
 * inspector does, through the same permission as recording the result.
 */
const QuarantineDispositionModal = ({ inspection, onClose, onSaved }: { inspection: any | null; onClose: () => void; onSaved: () => void }) => {
    const [rows, setRows] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setRows((inspection?.quality_inspection_lines || [])
            .filter((l: any) => openQuarantine(l) > 0)
            .map((l: any) => ({ line_id: l.id, description: l.description || l.item_id?.slice(0, 8) || 'Line', open: openQuarantine(l), decision: 'release', quantity: String(openQuarantine(l)) })));
    }, [inspection]);

    const update = (idx: number, field: string, value: string) => setRows(r => r.map((x, i) => (i === idx ? { ...x, [field]: value } : x)));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const lines = rows.map(r => ({ line_id: r.line_id, decision: r.decision, quantity: parseFloat(r.quantity) || 0 })).filter(l => l.quantity > 0);
        const over = rows.find(r => (parseFloat(r.quantity) || 0) > r.open);
        if (over) {
            toast.warning(`Only ${over.open} units remain in quarantine for "${over.description}".`);
            return;
        }
        if (lines.length === 0) {
            toast.warning('Enter a quantity to disposition.');
            return;
        }
        setSaving(true);
        try {
            await receivingService.dispositionInspection(inspection.id, { lines: lines as any });
            toast.success('Quarantine dispositioned');
            onSaved();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to disposition the quarantined units'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={!!inspection}
            onClose={onClose}
            title="Quarantined units"
            description={inspection ? `${inspection.inspection_number} · ${inspection.grn?.grn_number ?? ''}` : undefined}
            size="lg"
            footer={(
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="qc-quarantine-form" loading={saving} disabled={saving}>Apply decision</Button>
                </>
            )}
        >
            <form id="qc-quarantine-form" onSubmit={submit} className="flex flex-col gap-nb-4">
                <Alert variant="warning">Quarantined units are not available to anyone until they are released. Rejected units are returned to the supplier through a claim.</Alert>
                {rows.length === 0 && <p className="text-fg-subtle">Nothing is held in quarantine.</p>}
                {rows.map((r, idx) => (
                    <div key={r.line_id} className="flex flex-col gap-nb-3 rounded-nb-md border border-line p-nb-4">
                        <div className="flex items-center justify-between">
                            <span className="text-nb-label text-fg">{r.description}</span>
                            <span className="text-nb-caption text-fg-subtle">{r.open} in quarantine</span>
                        </div>
                        <FieldGrid columns={2}>
                            <FieldGridItem>
                                <Select label="Decision" name={`qdec_${idx}`} value={r.decision} options={DECISIONS} onValueChange={(v: string) => update(idx, 'decision', v)} />
                            </FieldGridItem>
                            <FieldGridItem>
                                <TextField type="number" min="0" label="Quantity" name={`qqty_${idx}`} aria-label={`Disposition quantity for ${r.description}`} value={r.quantity} onChange={e => update(idx, 'quantity', e.target.value)} />
                            </FieldGridItem>
                        </FieldGrid>
                    </div>
                ))}
            </form>
        </Modal>
    );
};

export default QuarantineDispositionModal;
