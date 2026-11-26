import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { matchService } from '../../services/matchService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Badge, Button, DataTable, DescriptionList, EmptyState, Modal, SectionCard, Skeleton, Textarea, TextField, getErrorMessage, toast, type DataTableColumn } from '@so360/design-system';

interface Props {
    poId: string;
    status: string;
    onChanged: () => void;
}

/**
 * PO closeout: every balance (ordered / acknowledged / received / accepted / rejected / returned / invoiced), open
 * claims and invoice cases, and the exact reasons the PO cannot close yet. Unused quantity is released only through an
 * approved residual cancellation that keeps the reason, approver and supplier communication.
 */
const POCloseoutPanel: React.FC<Props> = ({ poId, status, onChanged }) => {
    const formatters = useInventoryFormatters();
    const shell = useShellBridge() as any;
    const canApprove = shell?.hasPermission?.('purchase_orders.approve') !== false;
    const [data, setData] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [uninvoiced, setUninvoiced] = useState('');
    const [busy, setBusy] = useState(false);
    const [residualOpen, setResidualOpen] = useState(false);
    const [residual, setResidual] = useState({ reason: '', supplier_communication_ref: '' });

    const load = useCallback(() => Promise.resolve().then(() => matchService.closeoutCheck(poId)).then(setData).catch((e: any) => setError(getErrorMessage(e, 'The closeout check is not available'))), [poId]);
    useEffect(() => { load(); }, [load]);

    const close = async () => {
        setBusy(true);
        try {
            await matchService.closePo(poId, { reason: reason || undefined, ...(uninvoiced.trim() ? { accept_uninvoiced_reason: uninvoiced.trim() } : {}) } as any);
            toast.success('PO closed');
            onChanged();
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err, 'The PO could not be closed'));
            await load();
        } finally {
            setBusy(false);
        }
    };

    const cancelResidual = async () => {
        if (!residual.reason.trim() || !residual.supplier_communication_ref.trim()) {
            toast.warning('Give the reason and how the supplier was told.');
            return;
        }
        setBusy(true);
        try {
            await matchService.cancelResidual(poId, { reason: residual.reason.trim(), supplier_communication_ref: residual.supplier_communication_ref.trim() });
            toast.success('Residual quantity cancelled');
            setResidualOpen(false);
            setResidual({ reason: '', supplier_communication_ref: '' });
            await load();
        } catch (err) {
            toast.error(getErrorMessage(err, 'The residual quantity could not be cancelled'));
        } finally {
            setBusy(false);
        }
    };

    if (error) return <Alert variant="warning">{error}</Alert>;
    if (!data) return <Skeleton className="h-40 w-full" />;

    const t = data.totals;
    const blockers: any[] = data.blockers || [];
    const needsUninvoicedReason = blockers.some((b) => b.code === 'UNINVOICED_RECEIPTS');
    const hasResidualBlocker = blockers.some((b) => b.code === 'RESIDUAL_QUANTITY');
    const closed = status === 'closed';
    const columns: DataTableColumn<any>[] = [
        { key: 'line', header: 'Line', render: (l: any) => String(l.po_line_id).slice(0, 8) },
        { key: 'ordered', header: 'Ordered', align: 'right', render: (l: any) => l.ordered },
        { key: 'acked', header: 'Acknowledged', align: 'right', render: (l: any) => l.acked },
        { key: 'received', header: 'Received', align: 'right', render: (l: any) => l.received },
        { key: 'accepted', header: 'Accepted', align: 'right', render: (l: any) => l.accepted },
        { key: 'rejected', header: 'Rejected', align: 'right', render: (l: any) => l.rejected },
        { key: 'returned', header: 'Returned', align: 'right', render: (l: any) => l.returned },
        { key: 'invoiced', header: 'Invoiced', align: 'right', render: (l: any) => l.invoiced },
        { key: 'open', header: 'Open', align: 'right', render: (l: any) => l.open_qty },
    ];

    return (
        <div className="space-y-6" data-testid="po-closeout">
            {closed ? (
                <Alert variant="success">This PO is closed. The balances below are what was checked at closing.</Alert>
            ) : blockers.length === 0 ? (
                <Alert variant="success">Everything is reconciled. This PO can be closed.</Alert>
            ) : (
                <Alert variant="warning">
                    <div>This PO cannot be closed yet:</div>
                    <ul className="mt-nb-2 list-disc pl-nb-5">{blockers.map((b) => <li key={b.code}>{b.message}</li>)}</ul>
                </Alert>
            )}
            {data.residual_cancel && (
                <Alert variant="info">
                    Residual quantity cancelled ({formatters.formatCurrency(data.residual_cancel.released_value ?? 0)} released). Reason: {data.residual_cancel.reason}. Supplier told via {data.residual_cancel.supplier_communication_ref}.
                </Alert>
            )}
            <SectionCard title="Balances">
                <DescriptionList
                    columns={3}
                    items={[
                        { label: 'Ordered value', value: formatters.formatCurrency(t.ordered_value) },
                        { label: 'Invoiced value', value: formatters.formatCurrency(t.invoiced_value) },
                        { label: 'Open quantity', value: `${t.open_qty} (${formatters.formatCurrency(t.open_value)})` },
                        { label: 'Open claims', value: (data.open_claims || []).length },
                        { label: 'Open invoice matches', value: (data.open_match_cases || []).length },
                        { label: 'Accepted, not invoiced', value: t.uninvoiced_qty },
                    ]}
                />
            </SectionCard>
            <SectionCard title="By line">
                <DataTable data-testid="closeout-lines" columns={columns} rows={data.lines || []} rowKey={(l: any) => l.po_line_id} emptyState={<EmptyState title="No lines." />} />
            </SectionCard>
            {!closed && (
                <SectionCard title="Close">
                    <div className="flex flex-col gap-nb-4">
                        {needsUninvoicedReason && (
                            <Textarea label="Why will the remaining accepted units not be invoiced?" name="uninvoiced-reason" value={uninvoiced} onChange={e => setUninvoiced(e.target.value)} />
                        )}
                        <TextField label="Closing note" name="closing-note" value={reason} onChange={e => setReason(e.target.value)} />
                        <div className="flex flex-wrap gap-nb-2">
                            {hasResidualBlocker && canApprove && !data.residual_cancel && (
                                <Button type="button" variant="secondary" onClick={() => setResidualOpen(true)}>Cancel residual quantity</Button>
                            )}
                            <Button type="button" onClick={close} loading={busy} disabled={busy || (blockers.length > 0 && !(needsUninvoicedReason && uninvoiced.trim() && blockers.every((b) => b.code === 'UNINVOICED_RECEIPTS')))}>Close PO</Button>
                        </div>
                    </div>
                </SectionCard>
            )}
            <Modal
                open={residualOpen}
                onClose={() => setResidualOpen(false)}
                title="Cancel residual quantity"
                size="lg"
                footer={(
                    <>
                        <Button type="button" variant="secondary" onClick={() => setResidualOpen(false)}>Back</Button>
                        <Button type="button" onClick={cancelResidual} loading={busy} disabled={busy}>Cancel residual</Button>
                    </>
                )}
            >
                <div className="flex flex-col gap-nb-4">
                    <Alert variant="warning">The open quantity ({t.open_qty}) will not be supplied. Your name is recorded as the approver.</Alert>
                    <Textarea label="Reason" name="residual-reason" value={residual.reason} onChange={e => setResidual({ ...residual, reason: e.target.value })} />
                    <TextField label="How the supplier was told" name="residual-ref" placeholder="Email, ticket or call reference" value={residual.supplier_communication_ref} onChange={e => setResidual({ ...residual, supplier_communication_ref: e.target.value })} />
                </div>
            </Modal>
            <Badge tone="neutral">Status: {status.replace(/_/g, ' ')}</Badge>
        </div>
    );
};

export default POCloseoutPanel;
