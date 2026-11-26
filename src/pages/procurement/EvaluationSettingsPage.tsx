import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rfqService } from '../../services/rfqService';
import { Alert, Button, Checkbox, NumberInput, Select, SettingsCard, SettingsPageTemplate, Skeleton, toast, getErrorMessage } from '@so360/design-system';

const WEIGHT_KEYS = [
    { key: 'price', label: 'Price (evaluated cost)' },
    { key: 'lead_time', label: 'Lead time' },
    { key: 'quality', label: 'Supplier quality history' },
    { key: 'risk', label: 'Eligibility risk' },
    { key: 'terms', label: 'Commercial terms' },
];
const DEFAULT_WEIGHTS: Record<string, number> = { price: 40, lead_time: 20, quality: 15, risk: 10, terms: 15 };

/** Evaluation settings: default scoring weights, landed-cost policy, FX date basis and the award approval threshold. */
const EvaluationSettingsPage = () => {
    const navigate = useNavigate();
    const [policy, setPolicy] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        Promise.resolve().then(() => rfqService.getSourcingPolicy()).then(setPolicy).catch((e: any) => setError(getErrorMessage(e, 'Failed to load settings')));
    }, []);

    const evaluation = policy?.evaluation ?? {};
    const weights = { ...DEFAULT_WEIGHTS, ...(evaluation.weights ?? {}) };
    const landed = { include_freight: true, include_charges: true, ...(evaluation.landed_cost ?? {}) };
    const patch = (next: Record<string, any>) => setPolicy((p: any) => ({ ...p, evaluation: { ...(p.evaluation ?? {}), ...next } }));
    const total = Object.values(weights).reduce((s: number, v: any) => s + Number(v || 0), 0);

    const save = async () => {
        setSaving(true);
        try {
            setPolicy(await rfqService.saveSourcingPolicy(policy));
            toast.success('Evaluation settings saved');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsPageTemplate
            trail={[{ label: 'Inventory Settings', onClick: () => navigate('/inventory/settings') }]}
            title="Evaluation Settings"
            description="How quotations are scored, costed and compared."
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                {!policy && !error && <Skeleton />}
                {policy && (
                    <>
                        <SettingsCard title="Scoring weights" description={`Criteria without data are left out and the rest re-weighted. Current total: ${total}.`}>
                            <div className="flex flex-col gap-nb-3">
                                {WEIGHT_KEYS.map(w => (
                                    <NumberInput key={w.key} name={`weight-${w.key}`} label={w.label} min={0} max={100} value={weights[w.key]} onChange={(v: any) => patch({ weights: { ...weights, [w.key]: v ?? 0 } })} />
                                ))}
                            </div>
                        </SettingsCard>
                        <SettingsCard title="Landed cost" description="Evaluated cost = goods + the components below - header discount. Tax is always shown separately.">
                            <div className="flex flex-col gap-nb-2">
                                <Checkbox name="landed-freight" label="Include freight" checked={landed.include_freight} onChange={() => patch({ landed_cost: { ...landed, include_freight: !landed.include_freight } })} />
                                <Checkbox name="landed-charges" label="Include duty, handling and installation charges" checked={landed.include_charges} onChange={() => patch({ landed_cost: { ...landed, include_charges: !landed.include_charges } })} />
                            </div>
                        </SettingsCard>
                        <SettingsCard title="Exchange rates and approval" description="The rate is taken from Core exchange rates and stored with the evaluation.">
                            <div className="flex flex-col gap-nb-3">
                                <Select
                                    name="fx-basis" label="Exchange-rate date" value={evaluation.fx_date_basis ?? 'quotation'}
                                    options={[{ value: 'quotation', label: 'Quotation date' }, { value: 'evaluation', label: 'Evaluation date' }]}
                                    onChange={(e: any) => patch({ fx_date_basis: e?.target ? e.target.value : e })}
                                />
                                <NumberInput
                                    name="award-threshold" label="Award approval threshold (base currency)" min={0} value={policy.award_approval_threshold ?? undefined}
                                    hint="Awards above this value need approval. Leave empty for no value threshold (waivers always need approval)."
                                    onChange={(v: any) => setPolicy((p: any) => ({ ...p, award_approval_threshold: v ?? null }))}
                                />
                                <div><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
                            </div>
                        </SettingsCard>
                    </>
                )}
            </div>
        </SettingsPageTemplate>
    );
};

export default EvaluationSettingsPage;
