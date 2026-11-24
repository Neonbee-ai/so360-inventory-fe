import React, { useEffect, useState } from 'react';
import { Alert, DataTable, EmptyState, SectionCard, Skeleton, getErrorMessage } from '@so360/design-system';
import { poApprovalService } from '../../services/poApprovalService';
import { useInventoryFormatters } from '../../utils/formatters';

const useApproval = (poId: string, status: string) => {
    const [view, setView] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        Promise.resolve().then(() => poApprovalService.getApproval(poId)).then(setView).catch((e: any) => setError(getErrorMessage(e, 'Details are not available')));
    }, [poId, status]);
    return { view, error };
};

const lineName = (lines: any[], id: string) => {
    const l = lines.find(x => x.id === id);
    return l?.items?.name || l?.description || String(id).slice(0, 8);
};

/** Delivery schedules per PO line: need-by, requested and PO-promised dates and the ship-to. */
export const POSchedulesPanel: React.FC<{ poId: string; status: string; lines: any[] }> = ({ poId, status, lines }) => {
    const formatters = useInventoryFormatters();
    const { view, error } = useApproval(poId, status);
    if (error) return <Alert variant="warning">{error}</Alert>;
    if (!view) return <Skeleton />;
    return (
        <SectionCard title="Delivery schedules">
            {view.schedules.length === 0 ? <EmptyState title="No schedules yet" description="A default schedule per line is created when the PO is submitted." /> : (
                <DataTable
                    rows={view.schedules}
                    rowKey={(s: any) => s.id}
                    columns={[
                        { key: 'line', header: 'Line', render: (s: any) => lineName(lines, s.po_line_id) },
                        { key: 'seq', header: 'Schedule', align: 'center', render: (s: any) => s.seq },
                        { key: 'qty', header: 'Quantity', align: 'right', render: (s: any) => s.quantity },
                        { key: 'need', header: 'Need by', render: (s: any) => (s.need_by_date ? formatters.formatDate(s.need_by_date) : '-') },
                        { key: 'promised', header: 'PO promised', render: (s: any) => (s.po_promised_date ? formatters.formatDate(s.po_promised_date) : '-') },
                        { key: 'direct', header: 'Direct to site', render: (s: any) => (s.direct_to_site ? 'Yes' : 'No') },
                    ]}
                />
            )}
        </SectionCard>
    );
};

/** Where each PO line came from: PR line, project, work order, cost code. */
export const POAllocationsPanel: React.FC<{ poId: string; status: string; lines: any[] }> = ({ poId, status, lines }) => {
    const formatters = useInventoryFormatters();
    const { view, error } = useApproval(poId, status);
    if (error) return <Alert variant="warning">{error}</Alert>;
    if (!view) return <Skeleton />;
    return (
        <SectionCard title="Source allocations">
            {view.allocations.length === 0 ? <EmptyState title="No allocations" description="Allocations are created when a PO is generated from an award." /> : (
                <DataTable
                    rows={view.allocations}
                    rowKey={(a: any) => a.id}
                    columns={[
                        { key: 'line', header: 'Line', render: (a: any) => lineName(lines, a.po_line_id) },
                        { key: 'type', header: 'Source', render: (a: any) => String(a.source_type).replace(/_/g, ' ') },
                        { key: 'id', header: 'Reference', render: (a: any) => (a.source_id ? String(a.source_id).slice(0, 8) : '-') },
                        { key: 'cc', header: 'Cost code', render: (a: any) => a.cost_code || '-' },
                        { key: 'qty', header: 'Quantity', align: 'right', render: (a: any) => a.quantity ?? '-' },
                        { key: 'amt', header: 'Amount', align: 'right', render: (a: any) => (a.amount != null ? formatters.formatCurrency(Number(a.amount)) : '-') },
                    ]}
                />
            )}
        </SectionCard>
    );
};
