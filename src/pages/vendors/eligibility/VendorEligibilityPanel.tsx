import React, { useState } from 'react';
import { Alert, Button, Card, Select, StatusBadge, TextField } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';

const MODULES = [
  { value: 'procurement', label: 'Procurement' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'projects', label: 'Projects' },
  { value: 'fulfillment', label: 'Fulfillment' },
  { value: 'maintenance', label: 'Maintenance' },
];

/** "Why is this vendor (not) eligible?" check form on Vendor 360 (Pulse 66b329c3). */
export default function VendorEligibilityPanel({ vendorId }: { vendorId: string }) {
  const [form, setForm] = useState({ module: 'procurement', action: 'po.create', territory: '', service_code: '' });
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await vendorService.checkEligibility({
        vendor_id: vendorId,
        module: form.module,
        action: form.action,
        territory: form.territory || undefined,
        scope: form.service_code ? { service_code: form.service_code } : undefined,
      }));
    } catch (e: any) {
      setError(e?.message || 'The check failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Eligibility check" actions={<Button onClick={run} disabled={busy}>Check</Button>}>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-col gap-nb-3">
        <Select label="Module" name="module" options={MODULES} value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} />
        <TextField label="Action (e.g. po.create)" name="action" value={form.action} onChange={(e: any) => setForm({ ...form, action: e.target.value })} />
        <TextField label="Territory" name="territory" value={form.territory} onChange={(e: any) => setForm({ ...form, territory: e.target.value })} />
        <TextField label="Service code" name="service_code" value={form.service_code} onChange={(e: any) => setForm({ ...form, service_code: e.target.value })} />
      </div>
      {result && (
        <div className="mt-nb-3 flex flex-col gap-nb-2" data-testid="eligibility-result">
          <StatusBadge status={result.decision} />
          <p className="text-sm text-fg">{result.explanation}</p>
          <p className="text-xs text-fg-muted">{(result.reason_codes ?? []).join(' · ')}</p>
        </div>
      )}
    </Card>
  );
}
