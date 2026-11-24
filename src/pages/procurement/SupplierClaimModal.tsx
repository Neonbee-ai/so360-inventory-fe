import React, { useEffect, useState } from 'react';
import { receivingService, type ClaimType } from '../../services/receivingService';
import { Alert, Badge, Button, Checkbox, FieldGrid, FieldGridItem, Modal, Select, TextField, Textarea, getErrorMessage, toast } from '@so360/design-system';

export const CLAIM_TYPE_OPTIONS = [
    { value: 'return', label: 'Return to supplier' },
    { value: 'replacement', label: 'Replacement' },
    { value: 'repair', label: 'Repair' },
    { value: 'rework', label: 'Rework' },
    { value: 'credit', label: 'Credit note' },
    { value: 'debit', label: 'Debit note' },
    { value: 'price_concession', label: 'Price concession' },
    { value: 'accept_as_is', label: 'Accept as is' },
];

const NON_PHYSICAL: ClaimType[] = ['credit', 'debit', 'price_concession', 'accept_as_is'];
export const claimNeedsPhysical = (t?: string | null) => !!t && !NON_PHYSICAL.includes(t as ClaimType);

/** Which resolution parts are still open on a claim: physical return, quality and commercial evidence. */
export const claimGaps = (c: any): string[] => {
    const gaps: string[] = [];
    if (claimNeedsPhysical(c.claim_type) && !c.physical_done) gaps.push('Physical');
    if (c.inspection_id && !c.quality_done) gaps.push('Quality');
    if (!c.commercial_done) gaps.push('Commercial');
    return gaps;
};

/**
 * Supplier claim: owner, supplier response, RMA, replacement ETA and the evidence checklist. A claim cannot settle
 * until physical, quality and commercial resolution are all done (the API enforces it; this shows what is missing).
 */
const SupplierClaimModal = ({ claim, onClose, onSaved }: { claim: any | null; onClose: () => void; onSaved: () => void }) => {
    const [form, setForm] = useState<any>({});
    const [evidence, setEvidence] = useState({ name: '', url: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!claim) return;
        setForm({
            claim_type: claim.claim_type || 'return', supplier_response: claim.supplier_response || '', rma_number: claim.rma_number || '',
            replacement_eta: claim.replacement_eta || '', physical_done: !!claim.physical_done, quality_done: !!claim.quality_done, commercial_done: !!claim.commercial_done,
        });
        setEvidence({ name: '', url: '' });
    }, [claim]);

    const gaps = claim ? claimGaps({ ...claim, ...form }) : [];

    const save = async () => {
        setSaving(true);
        try {
            await receivingService.updateClaim(claim.id, {
                claim_type: form.claim_type,
                supplier_response: form.supplier_response || undefined,
                rma_number: form.rma_number || undefined,
                replacement_eta: form.replacement_eta || undefined,
                physical_done: form.physical_done,
                quality_done: form.quality_done,
                commercial_done: form.commercial_done,
                ...(evidence.name || evidence.url ? { evidence: [{ type: 'document', name: evidence.name || evidence.url, url: evidence.url || undefined }] } : {}),
            });
            toast.success('Claim updated');
            onSaved();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to update the claim'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={!!claim}
            onClose={onClose}
            title={`Supplier claim ${claim?.return_number ?? ''}`}
            description={claim?.grn?.grn_number ? `Receipt ${claim.grn.grn_number}` : undefined}
            size="2xl"
            footer={(
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
                    <Button type="button" onClick={save} loading={saving} disabled={saving}>Save claim</Button>
                </>
            )}
        >
            <div className="flex flex-col gap-nb-4">
                {gaps.length > 0 ? (
                    <Alert variant="warning">Cannot settle yet. Still open: {gaps.join(', ')}.</Alert>
                ) : (
                    <Alert variant="success">Physical, quality and commercial resolution are complete.</Alert>
                )}
                <FieldGrid columns={2}>
                    <FieldGridItem>
                        <Select label="Claim type" name="claim_type" value={form.claim_type || 'return'} options={CLAIM_TYPE_OPTIONS} onValueChange={(v: string) => setForm({ ...form, claim_type: v })} />
                    </FieldGridItem>
                    <FieldGridItem>
                        <TextField label="RMA number" name="rma_number" value={form.rma_number || ''} onChange={e => setForm({ ...form, rma_number: e.target.value })} />
                    </FieldGridItem>
                    <FieldGridItem>
                        <TextField label="Replacement ETA" name="replacement_eta" type="date" value={form.replacement_eta || ''} onChange={e => setForm({ ...form, replacement_eta: e.target.value })} />
                    </FieldGridItem>
                </FieldGrid>
                <Textarea label="Supplier response" name="supplier_response" value={form.supplier_response || ''} onChange={e => setForm({ ...form, supplier_response: e.target.value })} />

                <div className="flex flex-col gap-nb-2">
                    <span className="text-nb-label text-fg">Resolution checklist</span>
                    {claimNeedsPhysical(form.claim_type) && (
                        <Checkbox name="physical_done" label="Physical: goods returned, replaced or reworked" checked={!!form.physical_done} onChange={(e: any) => setForm({ ...form, physical_done: e.target.checked })} />
                    )}
                    {claim?.inspection_id && (
                        <Checkbox name="quality_done" label="Quality: inspection outcome recorded" checked={!!form.quality_done} onChange={(e: any) => setForm({ ...form, quality_done: e.target.checked })} />
                    )}
                    <Checkbox name="commercial_done" label="Commercial: credit, replacement or concession agreed" checked={!!form.commercial_done} onChange={(e: any) => setForm({ ...form, commercial_done: e.target.checked })} />
                </div>

                <div className="flex flex-col gap-nb-2">
                    <span className="text-nb-label text-fg">Evidence</span>
                    <div className="flex flex-wrap gap-nb-1">
                        {(claim?.evidence || []).length === 0 && <span className="text-nb-caption text-fg-subtle">No evidence attached yet.</span>}
                        {(claim?.evidence || []).map((e: any, i: number) => <Badge key={i} tone="neutral">{e.name || e.url}</Badge>)}
                    </div>
                    <FieldGrid columns={2}>
                        <FieldGridItem><TextField label="Evidence name" name="evidence_name" value={evidence.name} onChange={e => setEvidence({ ...evidence, name: e.target.value })} /></FieldGridItem>
                        <FieldGridItem><TextField label="Link" name="evidence_url" value={evidence.url} onChange={e => setEvidence({ ...evidence, url: e.target.value })} /></FieldGridItem>
                    </FieldGrid>
                </div>
            </div>
        </Modal>
    );
};

export default SupplierClaimModal;
