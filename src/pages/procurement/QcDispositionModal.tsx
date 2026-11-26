import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal, Select, toast, getErrorMessage } from '@so360/design-system';
import { qualityService } from '../../services/qualityService';

export const QC_ATTRIBUTION_OPTIONS = [
    { value: 'unknown', label: 'Not decided' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'internal_handling', label: 'Our handling' },
    { value: 'transit', label: 'Transit' },
    { value: 'production', label: 'Production' },
];
export const QC_SEVERITY_OPTIONS = [
    { value: 'minor', label: 'Minor' },
    { value: 'major', label: 'Major' },
    { value: 'critical', label: 'Critical' },
];
export const QC_DISPOSITION_OPTIONS = [
    { value: 'use_as_is', label: 'Use as is' },
    { value: 'rework', label: 'Rework' },
    { value: 'return_to_vendor', label: 'Return to vendor' },
    { value: 'scrap', label: 'Scrap' },
    { value: 'sort', label: 'Sort' },
];

interface Props {
    inspection: any | null;
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Attribution, severity, disposition and verification for the rejected lines of a completed
 * inspection (Vendor 11, Pulse aa067321). Quality owns these; only a verified vendor defect
 * counts against the supplier. Each save bumps the inspection version.
 */
export default function QcDispositionModal({ inspection, onClose, onSaved }: Props) {
    const [lines, setLines] = useState<any[]>([]);
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        setLines((inspection?.quality_inspection_lines || []).filter((l: any) => Number(l.rejected_quantity) > 0));
    }, [inspection]);

    const edit = (id: string, patch: Record<string, string>) =>
        setLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)));

    const save = async (line: any, verify?: 'verified' | 'rejected') => {
        setSavingId(line.id);
        try {
            await qualityService.updateLineDisposition(inspection.id, line.id, {
                attribution: line.attribution || undefined,
                defect_severity: line.defect_severity || undefined,
                disposition: line.disposition || undefined,
                ...(verify ? { verification_status: verify } : {}),
            });
            toast.success(verify === 'verified' ? 'Defect verified' : 'Saved');
            onSaved();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not save the disposition'));
        } finally {
            setSavingId(null);
        }
    };

    return (
        <Modal
            open={!!inspection}
            onClose={onClose}
            title="Defects and disposition"
            description={inspection ? `${inspection.inspection_number}${inspection.ncr_number ? ` · ${inspection.ncr_number}` : ''}` : undefined}
            size="3xl"
            footer={<Button type="button" variant="secondary" onClick={onClose}>Close</Button>}
        >
            <div className="flex flex-col gap-nb-4">
                <Alert variant="info">
                    Only a verified vendor defect with a defect code or reason counts against the supplier. Major or critical defects open a corrective action.
                </Alert>
                {lines.map((l) => (
                    <div key={l.id} className="flex flex-col gap-nb-3 rounded-nb-md border border-line p-nb-4">
                        <div className="flex items-center justify-between">
                            <span className="text-nb-label text-fg">{l.description || l.defect_code || 'Rejected line'}</span>
                            <span className="text-nb-caption text-fg-subtle">{Number(l.rejected_quantity)} rejected · {l.verification_status || 'pending'}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-nb-3 md:grid-cols-3">
                            <Select label="Caused by" name={`attr-${l.id}`} value={l.attribution || 'unknown'} options={QC_ATTRIBUTION_OPTIONS} onValueChange={(v: string) => edit(l.id, { attribution: v })} />
                            <Select label="Severity" name={`sev-${l.id}`} placeholder="Select severity" value={l.defect_severity || ''} options={QC_SEVERITY_OPTIONS} onValueChange={(v: string) => edit(l.id, { defect_severity: v })} />
                            <Select label="Disposition" name={`disp-${l.id}`} placeholder="Decide later" value={l.disposition || ''} options={QC_DISPOSITION_OPTIONS} onValueChange={(v: string) => edit(l.id, { disposition: v })} />
                        </div>
                        <div className="flex gap-nb-2">
                            <Button size="sm" variant="secondary" loading={savingId === l.id} onClick={() => save(l)}>Save</Button>
                            <Button size="sm" loading={savingId === l.id} onClick={() => save(l, 'verified')} disabled={l.verification_status === 'verified'}>Verify defect</Button>
                            <Button size="sm" variant="ghost" onClick={() => save(l, 'rejected')} disabled={l.verification_status === 'rejected'}>Not a defect</Button>
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}
