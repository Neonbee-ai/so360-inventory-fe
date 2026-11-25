import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, DataTable, DescriptionList, EmptyState, SectionCard, Skeleton, Textarea, toast, getErrorMessage } from '@so360/design-system';
import { poApprovalService } from '../../services/poApprovalService';
import { useInventoryFormatters } from '../../utils/formatters';

const DECISION_TONES: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
    approve: 'success', auto_approved: 'success', reject: 'danger', return: 'warning', clarify: 'info',
};

export const stepState = (step: any, evidence: any[]): 'approved' | 'pending' => {
    const who = new Set(evidence.filter(e => e.step_id === step.id && e.decision === 'approve').map(e => e.on_behalf_of || e.approver_id));
    const needed = step.required === 'all' ? Math.max(step.approvers?.length || 1, 1) : Math.max(Number(step.required ?? 1), 1);
    return who.size >= needed ? 'approved' : 'pending';
};

interface Props {
    poId: string;
    status: string;
    /** Called after a decision moved the PO, so the page reloads. */
    onChanged: () => void;
}

/** Approvals tab: route, step state, evidence timeline, eligibility and budget snapshots, decision form. */
const POApprovalPanel: React.FC<Props> = ({ poId, status, onChanged }) => {
    const formatters = useInventoryFormatters();
    const [view, setView] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = () => Promise.resolve().then(() => poApprovalService.getApproval(poId)).then(setView).catch((e: any) => setError(getErrorMessage(e, 'Approval details are not available')));
    useEffect(() => { load(); }, [poId, status]);

    const decide = async (decision: 'approve' | 'reject' | 'return' | 'clarify') => {
        if (decision !== 'approve' && !reason.trim()) { toast.error('Enter a reason first'); return; }
        setBusy(decision);
        try {
            await poApprovalService.decide(poId, { decision, reason: reason.trim() || undefined });
            toast.success(decision === 'approve' ? 'Approval recorded' : 'Decision recorded');
            setReason('');
            await load();
            onChanged();
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not record the decision'));
        } finally {
            setBusy(null);
        }
    };

    if (error) return <Alert variant="warning">{error}</Alert>;
    if (!view) return <Skeleton />;
    const steps: any[] = view.route?.steps ?? [];
    const active = new Set<string>(view.progress?.active_step_ids ?? []);
    const elig = view.eligibility_snapshot;
    const budget = view.budget_check;

    return (
        <div className="flex flex-col gap-nb-4">
            <SectionCard title="Approval route" actions={view.route ? <Badge tone="neutral">{`Policy ${String(view.route.policy_version).slice(0, 14)}`}</Badge> : undefined}>
                {!view.route && <EmptyState title="Not submitted" description="Submit the PO for approval to build its route." />}
                {view.route && steps.length === 0 && <p className="text-nb-sm text-fg-muted">No approval rule applied; the PO was approved by policy.</p>}
                {steps.length > 0 && (
                    <DataTable
                        rows={steps}
                        rowKey={(s: any) => s.id}
                        columns={[
                            { key: 'name', header: 'Step', render: (s: any) => s.name },
                            { key: 'who', header: 'Approver', render: (s: any) => (s.approvers?.length ? s.approvers.map((a: string) => a.slice(0, 8)).join(', ') : s.role || 'Any approver') },
                            { key: 'why', header: 'Reason', render: (s: any) => String(s.reason || '').replace(/_/g, ' ') },
                            {
                                key: 'state', header: 'State',
                                render: (s: any) => {
                                    const done = stepState(s, view.evidence) === 'approved';
                                    return <Badge tone={done ? 'success' : active.has(s.id) ? 'warning' : 'neutral'}>{done ? 'Approved' : active.has(s.id) ? 'Waiting' : 'Queued'}</Badge>;
                                },
                            },
                        ]}
                    />
                )}
            </SectionCard>

            <SectionCard title="Evidence">
                {view.evidence.length === 0 ? <p className="text-nb-sm text-fg-muted">No decisions recorded yet.</p> : (
                    <DataTable
                        rows={view.evidence}
                        rowKey={(e: any) => e.id}
                        columns={[
                            { key: 'when', header: 'When', render: (e: any) => formatters.formatDateTime(e.created_at) },
                            { key: 'decision', header: 'Decision', render: (e: any) => <Badge tone={DECISION_TONES[e.decision] || 'neutral'}>{e.decision.replace(/_/g, ' ')}</Badge> },
                            { key: 'by', header: 'By', render: (e: any) => (e.approver_id ? e.approver_id.slice(0, 8) : 'policy') + (e.on_behalf_of ? ` for ${e.on_behalf_of.slice(0, 8)}` : '') },
                            { key: 'reason', header: 'Reason', render: (e: any) => e.reason || '-' },
                            { key: 'src', header: 'Source', render: (e: any) => e.source },
                        ]}
                    />
                )}
            </SectionCard>

            {(elig || budget) && (
                <SectionCard title="Checks at submission">
                    <DescriptionList items={[
                        ...(elig ? [{ label: 'Vendor eligibility', value: <Badge tone={elig.decision === 'eligible' ? 'success' : 'warning'}>{elig.decision}</Badge> }] : []),
                        ...(budget ? [{ label: 'Budget', value: <Badge tone={budget.status === 'ok' ? 'success' : budget.status === 'insufficient' ? 'danger' : 'neutral'}>{String(budget.status).replace(/_/g, ' ')}</Badge> }] : []),
                        ...(budget?.available != null ? [{ label: 'Budget available', value: formatters.formatCurrency(budget.available) }] : []),
                    ]} />
                </SectionCard>
            )}

            {status === 'pending_approval' && (
                <SectionCard title="Your decision">
                    <div className="flex flex-col gap-nb-3">
                        <Textarea label="Reason" name="decision-reason" id="decision-reason" value={reason} onChange={(e: any) => setReason(e.target.value)} hint="Required to return, reject or ask for clarification." />
                        <div className="flex flex-wrap gap-nb-2">
                            <Button onClick={() => decide('approve')} disabled={!!busy}>{busy === 'approve' ? 'Working...' : 'Approve'}</Button>
                            <Button variant="secondary" onClick={() => decide('return')} disabled={!!busy}>Return for changes</Button>
                            <Button variant="secondary" onClick={() => decide('clarify')} disabled={!!busy}>Ask for clarification</Button>
                            <Button variant="danger" onClick={() => decide('reject')} disabled={!!busy}>Reject</Button>
                        </div>
                    </div>
                </SectionCard>
            )}
        </div>
    );
};

export default POApprovalPanel;
