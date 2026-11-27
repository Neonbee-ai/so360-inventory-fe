import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShellBridge } from '@so360/shell-context';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import {
    Alert, Badge, Checkbox, DataTable, EmptyState, SectionCard, TextField, WizardPageTemplate,
    toast, getErrorMessage, type DataTableColumn,
} from '@so360/design-system';

const OVERRIDE_FLAG = 'action:inventory:procurement:consolidate_override';

/**
 * Consolidate demand: pick requisition lines, review why they do (or do not)
 * belong together, confirm. Every source PR line keeps its own allocation, so
 * project, work order, cost code and need-by date stay traceable. Lines that
 * are not compatible can only be grouped with a reason and an approval.
 */
const ConsolidationWizardPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const shell = useShellBridge() as any;
    const overrideAllowed = (() => { try { return shell?.isFeatureEnabled?.(OVERRIDE_FLAG) === true; } catch { return false; } })();

    const [groups, setGroups] = useState<any[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [overrideReason, setOverrideReason] = useState('');
    const [finishing, setFinishing] = useState(false);

    useEffect(() => {
        procurementService.getConsolidationCandidates()
            .then((g: any) => setGroups(Array.isArray(g) ? g : []))
            .catch((e: any) => setError(getErrorMessage(e, 'Failed to load consolidation candidates')));
    }, []);

    const lines = useMemo(
        () => (groups || []).flatMap((g) => g.lines.map((l: any) => ({ ...l, group_key: g.group_key, rationale: g.rationale }))),
        [groups],
    );
    const chosen = lines.filter((l) => picked.has(l.pr_line_id));
    const distinctKeys = new Set(chosen.map((l) => l.group_key));
    const mismatched = distinctKeys.size > 1;
    const toggle = (id: string) => setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const lineColumns: DataTableColumn<any>[] = [
        {
            key: 'pick', header: '',
            render: (l: any) => <Checkbox name={`pick-${l.pr_line_id}`} label={`Select ${l.pr_number}`} hideLabel checked={picked.has(l.pr_line_id)} onChange={() => toggle(l.pr_line_id)} />,
        },
        { key: 'pr', header: 'Requisition', render: (l: any) => <>{l.pr_number || 'PR'}<span className="block text-xs text-fg-subtle">{l.description || l.item_id}</span></> },
        { key: 'origin', header: 'Origin', render: (l: any) => (l.source_module ? `${l.source_module} ${l.source_id ?? ''}` : '-') },
        { key: 'need', header: 'Need by', render: (l: any) => (l.required_date ? formatters.formatDate(l.required_date) : '-') },
        { key: 'qty', header: 'To buy', align: 'right', render: (l: any) => formatters.formatNumber(l.free_qty) },
    ];

    const finish = async () => {
        setFinishing(true);
        try {
            await procurementService.createConsolidationGroup({
                pr_line_ids: chosen.map((l) => l.pr_line_id),
                ...(mismatched ? { override_reason: overrideReason.trim() } : {}),
            });
            toast.success(mismatched ? 'Grouped - waiting for approval of the override' : 'Demand consolidated');
            navigate('/procurement/coverage');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not consolidate'));
            setFinishing(false);
        }
    };

    return (
        <WizardPageTemplate
            loading={groups === null && !error}
            trail={[{ label: 'Demand Coverage', onClick: () => navigate('/procurement/coverage') }]}
            title="Consolidate demand"
            description="Combine compatible requisition lines into one buying group without losing where each unit came from."
            finishLabel="Consolidate"
            finishing={finishing}
            onFinish={finish}
            onCancel={() => navigate('/procurement/coverage')}
            steps={[
                {
                    id: 'select',
                    label: 'Select lines',
                    validate: () => (chosen.length > 0 ? true : 'Select at least one requisition line'),
                    content: (error ? <Alert variant="error">{error}</Alert> : (
                        lines.length === 0 ? <EmptyState title="Nothing is waiting to be bought." /> : (
                            <div className="flex flex-col gap-nb-4">
                                {(groups || []).map((g) => (
                                    <SectionCard key={g.group_key} title={g.consolidatable ? `${g.lines.length} compatible lines - ${formatters.formatNumber(g.total_qty)} to buy` : 'Single line'}>
                                        <p className="mb-nb-2 text-nb-sm text-fg-muted">{g.rationale}</p>
                                        <DataTable columns={lineColumns} rows={g.lines} rowKey={(l: any) => l.pr_line_id} />
                                    </SectionCard>
                                ))}
                            </div>
                        )
                    )),
                },
                {
                    id: 'review',
                    label: 'Review grouping',
                    validate: () => {
                        if (!mismatched) return true;
                        if (!overrideAllowed) return 'These lines differ on item, specification, revision, UOM, destination, legal entity or need-by window and cannot be combined';
                        return overrideReason.trim() ? true : 'Give the reason for combining incompatible lines';
                    },
                    content: (
                        <div className="flex flex-col gap-nb-3">
                            {mismatched ? (
                                <Alert variant="warning" title="Incompatible lines">
                                    The selected lines do not share the same item, specification, revision, UOM, destination, legal entity and need-by window.
                                    {overrideAllowed ? ' Combining them needs a reason and approval.' : ' You do not have permission to override.'}
                                </Alert>
                            ) : (
                                <Alert variant="success">All {chosen.length} selected line(s) are compatible.</Alert>
                            )}
                            {mismatched && overrideAllowed && (
                                <TextField name="override-reason" label="Reason for the override (required)" value={overrideReason} onChange={(e: any) => setOverrideReason(e.target.value)} />
                            )}
                            <DataTable columns={lineColumns.slice(1)} rows={chosen} rowKey={(l: any) => l.pr_line_id} />
                        </div>
                    ),
                },
                {
                    id: 'confirm',
                    label: 'Confirm',
                    content: (
                        <SectionCard title="Summary">
                            <p>{chosen.length} line(s), {formatters.formatNumber(chosen.reduce((s, l) => s + l.free_qty, 0))} units to buy.</p>
                            <p className="text-nb-sm text-fg-muted">Each source requisition line keeps its own allocation (project, work order, cost code and need-by date). The original requisitions are not changed.</p>
                            {mismatched && <Badge tone="warning">Override - approval requested</Badge>}
                        </SectionCard>
                    ),
                },
            ]}
        />
    );
};

export default ConsolidationWizardPage;
