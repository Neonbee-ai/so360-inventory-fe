import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rfqService } from '../../services/rfqService';
import { useInventoryFormatters } from '../../utils/formatters';
import {
    Alert, Badge, Checkbox, DataTable, EmptyState, NumberInput, SectionCard, Select, TextField, WizardPageTemplate,
    toast, getErrorMessage, type DataTableColumn,
} from '@so360/design-system';

export const SOURCING_ROUTES = [
    { value: 'competitive', label: 'Competitive RFQ' },
    { value: 'agreement', label: 'Existing agreement / catalog' },
    { value: 'tender', label: 'Tender (staged technical prequalification)' },
    { value: 'sole_source', label: 'Sole source (justification + approval)' },
    { value: 'emergency', label: 'Emergency (reason, cap + approval)' },
    { value: 'renewal', label: 'Contract / agreement renewal' },
];
const NEEDS_JUSTIFICATION = ['sole_source', 'emergency'];

/**
 * Create an RFQ from consolidated demand groups: pick the open groups, choose
 * and justify the sourcing route, confirm. The server checks the route against
 * the org sourcing policy; sole-source and emergency routes wait for approval
 * before the RFQ can be sent. Vendors are chosen on the RFQ itself, from the
 * eligible-vendor list.
 */
const RFQFromDemandWizardPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [groups, setGroups] = useState<any[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [route, setRoute] = useState('competitive');
    const [justification, setJustification] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [value, setValue] = useState<number | undefined>(undefined);
    const [finishing, setFinishing] = useState(false);

    useEffect(() => {
        Promise.resolve().then(() => rfqService.getDemandGroups())
            .then((g: any) => setGroups(Array.isArray(g) ? g : []))
            .catch((e: any) => setError(getErrorMessage(e, 'Failed to load demand groups')));
    }, []);

    const qtyOf = (g: any) => (g.procurement_demand_allocations || [])
        .filter((a: any) => a.status === 'active' && a.fulfilment === 'purchase' && !a.rfq_line_id)
        .reduce((s: number, a: any) => s + Number(a.allocated_qty || 0), 0);
    const usable = useMemo(() => (groups || []).filter(g => qtyOf(g) > 0), [groups]);
    const chosen = usable.filter(g => picked.has(g.id));
    const toggle = (id: string) => setPicked(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const columns: DataTableColumn<any>[] = [
        { key: 'pick', header: '', render: (g: any) => <Checkbox name={`pick-${g.id}`} label={`Select ${g.specification || g.item_id}`} hideLabel checked={picked.has(g.id)} onChange={() => toggle(g.id)} /> },
        { key: 'item', header: 'Item', render: (g: any) => <>{g.specification || g.service_code || g.item_id?.slice(0, 8) || 'Demand'}<span className="block text-xs text-fg-subtle">{g.rationale}</span></> },
        { key: 'qty', header: 'To source', align: 'right', render: (g: any) => `${formatters.formatNumber(qtyOf(g))} ${g.uom || ''}` },
        { key: 'need', header: 'Need by', render: (g: any) => (g.need_by_from ? formatters.formatDate(g.need_by_from) : '-') },
    ];

    const finish = async () => {
        setFinishing(true);
        try {
            const rfq: any = await rfqService.createFromDemand({
                demand_group_ids: chosen.map(g => g.id),
                sourcing_route: route,
                response_due_date: dueDate,
                ...(justification.trim() ? { route_justification: justification.trim() } : {}),
                ...(value !== undefined ? { estimated_value: value } : {}),
            });
            toast.success(rfq.status === 'pending_approval' ? 'RFQ created - waiting for route approval' : 'RFQ created');
            navigate(`/procurement/rfq/${rfq.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not create the RFQ'));
            setFinishing(false);
        }
    };

    return (
        <WizardPageTemplate
            loading={groups === null && !error}
            trail={[{ label: 'Demand Coverage', onClick: () => navigate('/procurement/coverage') }]}
            title="Create RFQ from demand"
            description="Source consolidated demand: each requisition allocation stays linked to the RFQ line it is sourced on."
            finishLabel="Create RFQ"
            finishing={finishing}
            onFinish={finish}
            onCancel={() => navigate('/procurement/coverage')}
            steps={[
                {
                    id: 'groups',
                    label: 'Demand groups',
                    validate: () => (chosen.length > 0 ? true : 'Select at least one demand group'),
                    content: error ? <Alert variant="error">{error}</Alert> : (
                        usable.length === 0
                            ? <EmptyState title="No consolidated demand is waiting to be sourced." />
                            : <DataTable columns={columns} rows={usable} rowKey={(g: any) => g.id} />
                    ),
                },
                {
                    id: 'route',
                    label: 'Sourcing route',
                    validate: () => {
                        if (!dueDate) return 'Set the response due date';
                        if (NEEDS_JUSTIFICATION.includes(route) && !justification.trim()) return 'A justification is required for this route';
                        return true;
                    },
                    content: (
                        <div className="flex flex-col gap-nb-3">
                            <Select name="sourcing-route" label="Route" value={route} onChange={(e: any) => setRoute(e?.target ? e.target.value : e)} options={SOURCING_ROUTES} />
                            <TextField name="response-due" label="Response due date" type="date" value={dueDate} onChange={(e: any) => setDueDate(e.target.value)} />
                            <NumberInput name="estimated-value" label="Estimated value (used by the sourcing policy)" value={value} onChange={(v: any) => setValue(v === '' || v == null ? undefined : Number(v))} />
                            <TextField name="route-justification" label={NEEDS_JUSTIFICATION.includes(route) ? 'Justification (required)' : 'Justification (optional)'} value={justification} onChange={(e: any) => setJustification(e.target.value)} />
                            {NEEDS_JUSTIFICATION.includes(route) && <Alert variant="warning">This route needs approval before the RFQ can be sent.</Alert>}
                        </div>
                    ),
                },
                {
                    id: 'confirm',
                    label: 'Confirm',
                    content: (
                        <SectionCard title="Summary">
                            <p>{chosen.length} demand group(s), {formatters.formatNumber(chosen.reduce((s, g) => s + qtyOf(g), 0))} units to source.</p>
                            <p className="text-nb-sm text-fg-muted">Route: {SOURCING_ROUTES.find(r => r.value === route)?.label}. Choose the vendors on the RFQ - only eligible vendors are offered.</p>
                            {NEEDS_JUSTIFICATION.includes(route) && <Badge tone="warning">Approval required</Badge>}
                        </SectionCard>
                    ),
                },
            ]}
        />
    );
};

export default RFQFromDemandWizardPage;
