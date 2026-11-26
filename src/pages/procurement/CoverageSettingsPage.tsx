import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { Alert, Button, NumberInput, Select, SettingsCard, SettingsPageTemplate, toast, getErrorMessage } from '@so360/design-system';

/** Coverage settings: where stock is netted, the default purchase lead time and the consolidation window. */
const CoverageSettingsPage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        procurementService.getCoverageSettings().then(setForm).catch((e: any) => setError(getErrorMessage(e, 'Failed to load settings')));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            setForm(await procurementService.updateCoverageSettings(form));
            toast.success('Coverage settings saved');
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsPageTemplate
            loading={!form && !error}
            trail={[{ label: 'Inventory Settings', onClick: () => navigate('/inventory/settings') }]}
            title="Coverage Settings"
            description="How demand is netted against stock and supply."
        >
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                {form && (
                    <SettingsCard title="Coverage" description="Stock is only counted inside the scope below; quarantined warehouses and reserved stock never count.">
                        <div className="flex flex-col gap-nb-3">
                            <Select
                                name="coverage-scope"
                                label="Stock scope"
                                value={form.coverage_scope}
                                options={[{ value: 'warehouse', label: 'Delivery warehouse' }, { value: 'site', label: 'Delivery site' }, { value: 'org', label: 'Whole organization' }]}
                                onChange={(e: any) => setForm((f: any) => ({ ...f, coverage_scope: e?.target ? e.target.value : e }))}
                            />
                            <NumberInput name="default-lead-time" label="Default purchase lead time (days)" min={0} value={form.default_lead_time_days} onChange={(v) => setForm((f: any) => ({ ...f, default_lead_time_days: v ?? 0 }))} hint="Used when an item has no lead time of its own." />
                            <NumberInput name="consolidation-window" label="Consolidation window (days)" min={0} value={form.consolidation_window_days} onChange={(v) => setForm((f: any) => ({ ...f, consolidation_window_days: v ?? 0 }))} hint="Lines needed within the same window can be grouped." />
                            <div><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
                        </div>
                    </SettingsCard>
                )}
            </div>
        </SettingsPageTemplate>
    );
};

export default CoverageSettingsPage;
