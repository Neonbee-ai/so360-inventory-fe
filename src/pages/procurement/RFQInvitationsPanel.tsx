import React, { useState } from 'react';
import { Badge, Button, DataTable, EmptyState, Modal, SectionCard, TextField, toast, getErrorMessage, type DataTableColumn } from '@so360/design-system';
import { rfqService } from '../../services/rfqService';
import { useInventoryFormatters } from '../../utils/formatters';

const INVITE_TONES: Record<string, 'neutral' | 'success' | 'danger' | 'warning' | 'info'> = {
    invited: 'neutral', acknowledged: 'info', quoted: 'success', declined: 'danger', no_response: 'warning', expired: 'warning', withdrawn: 'neutral',
};
const DELIVERY_TONES: Record<string, 'neutral' | 'success' | 'danger' | 'warning'> = {
    pending: 'neutral', sent: 'success', failed: 'danger', bounced: 'danger',
};
const ELIGIBILITY_TONES: Record<string, 'success' | 'warning' | 'danger'> = {
    eligible: 'success', conditional: 'warning', ineligible: 'danger',
};

interface Props {
    rfq: any;
    canAct: boolean;
    onChanged: () => Promise<void> | void;
}

/**
 * Per-vendor invitation tracking: status, delivery outcome, the RFQ version
 * each vendor was sent, reminders, the eligibility verdict (with an approved
 * exception path) and resend / acknowledge actions.
 */
const RFQInvitationsPanel: React.FC<Props> = ({ rfq, canAct, onChanged }) => {
    const formatters = useInventoryFormatters();
    const [busy, setBusy] = useState<string | null>(null);
    const [exceptionFor, setExceptionFor] = useState<any | null>(null);
    const [reason, setReason] = useState('');

    const run = async (key: string, fn: () => Promise<any>, ok: string) => {
        if (busy) return;
        setBusy(key);
        try {
            await fn();
            toast.success(ok);
            await onChanged();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Action failed'));
        } finally {
            setBusy(null);
        }
    };

    const rows: any[] = rfq.rfq_vendors || [];
    const sent = rfq.status === 'sent';
    const openCount = rows.filter(v => ['invited', 'acknowledged'].includes(v.status)).length;

    const columns: DataTableColumn<any>[] = [
        {
            key: 'vendor', header: 'Vendor',
            render: (v: any) => (<>{v.vendor_name || v.vendor_id.slice(0, 8)}{v.contact_email && <span className="block text-xs text-fg-subtle">{v.contact_email}</span>}</>),
        },
        { key: 'status', header: 'Status', render: (v: any) => <Badge tone={INVITE_TONES[v.status] || 'neutral'}>{v.status.replace(/_/g, ' ')}</Badge> },
        {
            key: 'delivery', header: 'Delivery',
            render: (v: any) => (
                <>
                    <Badge tone={DELIVERY_TONES[v.delivery_status || 'pending'] || 'neutral'}>{v.delivery_status || 'pending'}</Badge>
                    {v.delivery_error && <span className="block text-xs text-fg-subtle">{v.delivery_error}</span>}
                </>
            ),
        },
        {
            key: 'version', header: 'Version sent',
            render: (v: any) => (v.sent_rfq_version ? `v${v.sent_rfq_version}${v.needs_resend ? ' (re-send needed)' : ''}` : '-'),
        },
        {
            key: 'reminders', header: 'Reminders',
            render: (v: any) => (v.reminder_count ? `${v.reminder_count}${v.last_reminder_at ? ` · ${formatters.formatDate(v.last_reminder_at)}` : ''}` : '0'),
        },
        {
            key: 'eligibility', header: 'Eligibility',
            render: (v: any) => (v.eligibility_decision
                ? (
                    <>
                        <Badge tone={ELIGIBILITY_TONES[v.eligibility_decision] || 'neutral'}>{v.eligibility_decision}</Badge>
                        {v.eligibility_exception_status && <span className="block text-xs text-fg-subtle">Exception {v.eligibility_exception_status}</span>}
                        {(v.eligibility_reason_codes || []).length > 0 && <span className="block text-xs text-fg-subtle">{v.eligibility_reason_codes.join(', ')}</span>}
                    </>
                )
                : '-'),
        },
        {
            key: 'actions', header: '', align: 'right',
            render: (v: any) => !canAct ? null : (
                <div className="flex flex-wrap justify-end gap-nb-2">
                    {v.status === 'invited' && v.delivery_status === 'sent' && (
                        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(`ack-${v.id}`, () => rfqService.acknowledgeVendor(rfq.id, v.vendor_id), 'Acknowledgement recorded')}>Mark acknowledged</Button>
                    )}
                    {sent && ['invited', 'acknowledged'].includes(v.status) && (
                        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(`resend-${v.id}`, () => rfqService.resendToVendor(rfq.id, v.vendor_id), 'RFQ re-sent')}>Resend</Button>
                    )}
                    {v.eligibility_decision === 'ineligible' && v.eligibility_exception_status !== 'pending' && v.eligibility_exception_status !== 'approved' && (
                        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { setExceptionFor(v); setReason(''); }}>Request exception</Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <SectionCard
            title="Invitations"
            actions={canAct && sent && openCount > 0 ? (
                <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run('remind', () => rfqService.sendReminders(rfq.id), 'Reminders sent')}>
                    Send reminders ({openCount})
                </Button>
            ) : undefined}
        >
            {rows.length === 0 ? (
                <EmptyState title="No vendors invited yet." />
            ) : (
                <DataTable data-testid="rfq-invitations-table" rows={rows} rowKey={(v: any) => v.id} columns={columns} />
            )}

            <Modal
                open={!!exceptionFor}
                onClose={() => setExceptionFor(null)}
                title="Request eligibility exception"
                footer={(
                    <>
                        <Button variant="secondary" type="button" onClick={() => setExceptionFor(null)}>Cancel</Button>
                        <Button
                            type="button"
                            disabled={!reason.trim() || !!busy}
                            onClick={async () => {
                                const v = exceptionFor;
                                await run('exception', () => rfqService.requestVendorException(rfq.id, v.vendor_id, reason.trim()), 'Exception sent for approval');
                                setExceptionFor(null);
                            }}
                        >
                            Send for approval
                        </Button>
                    </>
                )}
            >
                <p className="mb-nb-3 text-nb-body text-fg-muted">
                    {exceptionFor?.vendor_name || 'This vendor'} is not eligible ({(exceptionFor?.eligibility_reason_codes || []).join(', ')}). An approver must accept the risk before the RFQ can be sent to them.
                </p>
                <TextField name="exception-reason" label="Reason (required)" value={reason} onChange={(e: any) => setReason(e.target.value)} />
            </Modal>
        </SectionCard>
    );
};

export default RFQInvitationsPanel;
