import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, DataTable, NumberInput, Select, SettingsCard, SettingsPageTemplate, TextField, toast, getErrorMessage } from '@so360/design-system';
import { poApprovalService } from '../../services/poApprovalService';

type Rules = {
    sod?: boolean; approval_required?: 'always' | 'threshold'; budget_source?: 'none' | 'projects' | 'accounting';
    budget_on_insufficient?: 'block' | 'exception'; date_tolerance_days?: number; ack_sla_hours?: number; price_tolerance_pct?: number;
    rules?: Array<{ id: string; name?: string; when?: Record<string, any>; step: { role?: string; approvers?: string[] } }>;
};

const DEFAULTS: Rules = { sod: true, approval_required: 'threshold', budget_source: 'none', budget_on_insufficient: 'exception', date_tolerance_days: 0, price_tolerance_pct: 0, rules: [] };

/** Approvals settings: value rules, separation of duties, budget control, amendment tolerances and delegations. */
const ApprovalPoliciesPage = () => {
    const navigate = useNavigate();
    const [policy, setPolicy] = useState<any | null>(null);
    const [rules, setRules] = useState<Rules>(DEFAULTS);
    const [delegations, setDelegations] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [newRule, setNewRule] = useState<{ name: string; min_total?: number; role: string }>({ name: '', role: 'finance_manager' });
    const [deleg, setDeleg] = useState({ delegate_id: '', valid_from: '', valid_to: '' });

    useEffect(() => {
        Promise.resolve().then(async () => {
            const list: any[] = await poApprovalService.listPolicies();
            const live = (list || []).find(p => p.active) ?? null;
            setPolicy(live);
            setRules({ ...DEFAULTS, ...(live?.rules ?? {}) });
            setDelegations(await poApprovalService.listDelegations());
        }).catch((e: any) => setError(getErrorMessage(e, 'Failed to load approval settings')));
    }, []);

    const patch = (next: Partial<Rules>) => setRules(r => ({ ...r, ...next }));

    const save = async () => {
        setSaving(true);
        try {
            const saved = policy ? await poApprovalService.updatePolicy(policy.id, { rules }) : await poApprovalService.createPolicy({ name: 'Purchase order approvals', rules });
            setPolicy(saved);
            toast.success('Approval settings saved');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to save'));
        } finally {
            setSaving(false);
        }
    };

    const addRule = () => {
        if (!newRule.name.trim() || !newRule.role.trim()) { toast.error('Give the rule a name and an approver role'); return; }
        const id = newRule.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
        patch({ rules: [...(rules.rules ?? []), { id, name: newRule.name.trim(), when: newRule.min_total != null ? { min_total: newRule.min_total } : {}, step: { role: newRule.role.trim() } }] });
        setNewRule({ name: '', role: newRule.role });
    };

    const addDelegation = async () => {
        try {
            await poApprovalService.createDelegation(deleg);
            setDelegations(await poApprovalService.listDelegations());
            setDeleg({ delegate_id: '', valid_from: '', valid_to: '' });
            toast.success('Delegation saved');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to save the delegation'));
        }
    };

    return (
        <SettingsPageTemplate
            trail={[{ label: 'Inventory Settings', onClick: () => navigate('/inventory/settings') }]}
            title="Purchase order approvals"
            description="Who approves a purchase order, budget control and what counts as a material change."
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                <SettingsCard title="Approval rules" description="A PO matching no rule is approved by policy unless approval is mandatory.">
                    <div className="flex flex-col gap-nb-3">
                        <Select
                            name="approval-required" label="Approval" value={rules.approval_required ?? 'threshold'}
                            options={[{ value: 'threshold', label: 'Only when a rule matches' }, { value: 'always', label: 'Every purchase order' }]}
                            onChange={(e: any) => patch({ approval_required: (e?.target ? e.target.value : e) as any })}
                        />
                        <DataTable
                            rows={rules.rules ?? []}
                            rowKey={(r: any) => r.id}
                            columns={[
                                { key: 'name', header: 'Rule', render: (r: any) => r.name || r.id },
                                { key: 'when', header: 'When total is at least', align: 'right', render: (r: any) => r.when?.min_total ?? 'any' },
                                { key: 'role', header: 'Approver', render: (r: any) => r.step?.role || (r.step?.approvers || []).join(', ') },
                                { key: 'rm', header: '', render: (r: any) => <Button variant="ghost" size="sm" onClick={() => patch({ rules: (rules.rules ?? []).filter(x => x.id !== r.id) })}>Remove</Button> },
                            ]}
                        />
                        <div className="grid grid-cols-1 gap-nb-2 md:grid-cols-4">
                            <TextField name="rule-name" label="Rule name" value={newRule.name} onChange={(e: any) => setNewRule(n => ({ ...n, name: e.target.value }))} />
                            <NumberInput name="rule-min" label="Total at least" min={0} value={newRule.min_total} onChange={(v: any) => setNewRule(n => ({ ...n, min_total: v ?? undefined }))} />
                            <TextField name="rule-role" label="Approver role" value={newRule.role} onChange={(e: any) => setNewRule(n => ({ ...n, role: e.target.value }))} />
                            <div className="flex items-end"><Button variant="secondary" onClick={addRule}>Add rule</Button></div>
                        </div>
                    </div>
                </SettingsCard>

                <SettingsCard title="Separation of duties and amendments">
                    <div className="flex flex-col gap-nb-3">
                        <Checkbox name="sod" label="The requester and the buyer cannot approve their own PO" checked={rules.sod !== false} onChange={() => patch({ sod: rules.sod === false })} />
                        <NumberInput name="date-tol" label="Delivery date shift allowed without re-approval (days)" min={0} value={rules.date_tolerance_days ?? 0} onChange={(v: any) => patch({ date_tolerance_days: v ?? 0 })} />
                        <NumberInput name="ack-sla" label="Supplier acknowledgement due (hours after issue)" min={1} value={rules.ack_sla_hours ?? 48} onChange={(v: any) => patch({ ack_sla_hours: v ?? 48 })} />
                        <NumberInput name="price-tol" label="Unit price change allowed without re-approval (%)" min={0} value={rules.price_tolerance_pct ?? 0} onChange={(v: any) => patch({ price_tolerance_pct: v ?? 0 })} />
                    </div>
                </SettingsCard>

                <SettingsCard title="Budget control" description="Needs the budget control feature. When the source has no budget the PO is never blocked.">
                    <div className="flex flex-col gap-nb-3">
                        <Select
                            name="budget-source" label="Budget source" value={rules.budget_source ?? 'none'}
                            options={[{ value: 'none', label: 'Not checked' }, { value: 'projects', label: 'Project budget' }]}
                            onChange={(e: any) => patch({ budget_source: (e?.target ? e.target.value : e) as any })}
                        />
                        <Select
                            name="budget-insufficient" label="When the budget is not enough" value={rules.budget_on_insufficient ?? 'exception'}
                            options={[{ value: 'exception', label: 'Add a budget exception approval' }, { value: 'block', label: 'Block submission' }]}
                            onChange={(e: any) => patch({ budget_on_insufficient: (e?.target ? e.target.value : e) as any })}
                        />
                        <div><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
                    </div>
                </SettingsCard>

                <SettingsCard title="Delegations" description="A delegate can approve in place of the delegator between the two dates; each decision names the delegator.">
                    {delegations.length === 0 ? <p className="text-nb-sm text-fg-muted">No delegations yet.</p> : (
                        <DataTable
                            rows={delegations}
                            rowKey={(d: any) => d.id}
                            columns={[
                                { key: 'from', header: 'Delegator', render: (d: any) => String(d.delegator_id).slice(0, 8) },
                                { key: 'to', header: 'Delegate', render: (d: any) => String(d.delegate_id).slice(0, 8) },
                                { key: 'valid', header: 'Valid', render: (d: any) => `${d.valid_from} to ${d.valid_to}` },
                            ]}
                        />
                    )}
                    <div className="mt-nb-3 grid grid-cols-1 gap-nb-2 md:grid-cols-4">
                        <TextField name="deleg-id" label="Delegate user id" value={deleg.delegate_id} onChange={(e: any) => setDeleg(d => ({ ...d, delegate_id: e.target.value }))} />
                        <TextField name="deleg-from" label="Valid from" type="date" value={deleg.valid_from} onChange={(e: any) => setDeleg(d => ({ ...d, valid_from: e.target.value }))} />
                        <TextField name="deleg-to" label="Valid to" type="date" value={deleg.valid_to} onChange={(e: any) => setDeleg(d => ({ ...d, valid_to: e.target.value }))} />
                        <div className="flex items-end"><Button variant="secondary" onClick={addDelegation}>Add delegation</Button></div>
                    </div>
                </SettingsCard>
            </div>
        </SettingsPageTemplate>
    );
};

export default ApprovalPoliciesPage;
