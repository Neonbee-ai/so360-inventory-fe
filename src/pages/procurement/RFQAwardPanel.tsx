import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, DataTable, EmptyState, SectionCard, Skeleton, getErrorMessage } from '@so360/design-system';
import { rfqService } from '../../services/rfqService';

const AWARD_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    approved: 'success', converted: 'success', pending_approval: 'warning', rejected: 'danger', cancelled: 'neutral',
};

interface Props {
    rfqId: string;
    quoteLabels: Record<string, string>;
    vendorLabels: Record<string, string>;
    canAct: boolean;
    rfqStatus: string;
}

/** Award tab: the award record(s) for the RFQ and the entry to the award wizard. */
const RFQAwardPanel: React.FC<Props> = ({ rfqId, vendorLabels, canAct, rfqStatus }) => {
    const navigate = useNavigate();
    const [awards, setAwards] = useState<any[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.resolve().then(async () => {
            const list: any[] = await rfqService.listAwards(rfqId);
            setAwards(await Promise.all((list || []).map(a => rfqService.getAward(a.id))));
        }).catch((e: any) => setError(getErrorMessage(e, 'Awards are not available')));
    }, [rfqId]);

    if (awards === null && !error) return <Skeleton />;
    const live = (awards || []).some(a => ['pending_approval', 'approved', 'converted'].includes(a.status));

    return (
        <div className="flex flex-col gap-nb-4">
            {error && <Alert variant="warning">{error}</Alert>}
            {!error && (awards || []).length === 0 && <EmptyState title="No award yet" description="Lock an evaluation, then start the award to choose vendors and quantities (a line can be split between vendors)." />}
            {(awards || []).map(a => (
                <SectionCard key={a.id} title={`Award ${a.id.slice(0, 8)}`} actions={<Badge tone={AWARD_TONES[a.status] || 'neutral'}>{a.status.replace(/_/g, ' ')}</Badge>}>
                    {a.rationale && <p className="mb-nb-2 text-nb-sm text-fg-muted">{a.rationale}</p>}
                    {a.waiver && <Alert variant="warning" title="Waiver">{a.waiver.reason} ({(a.waiver.kinds || []).join(', ')})</Alert>}
                    <DataTable
                        rows={a.lines || []}
                        rowKey={(l: any) => l.id}
                        columns={[
                            { key: 'vendor', header: 'Vendor', render: (l: any) => vendorLabels[l.vendor_id] || l.vendor_id.slice(0, 8) },
                            { key: 'qty', header: 'Awarded', align: 'right', render: (l: any) => `${l.awarded_qty} ${l.uom || ''}` },
                            { key: 'ver', header: 'Quote version', render: (l: any) => `v${l.quotation_version}` },
                            { key: 'price', header: 'Normalised unit', align: 'right', render: (l: any) => `${l.normalized_unit_price ?? '-'} ${l.base_currency || ''}` },
                        ]}
                    />
                </SectionCard>
            ))}
            {canAct && !live && !['awarded', 'cancelled'].includes(rfqStatus) && (
                <div><Button onClick={() => navigate(`/procurement/rfq/${rfqId}/award`)}>Start award</Button></div>
            )}
        </div>
    );
};

export default RFQAwardPanel;
