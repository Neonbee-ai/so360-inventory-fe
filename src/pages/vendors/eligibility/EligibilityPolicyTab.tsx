import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, FormField, Select } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';

const MODES = [
  { value: 'off', label: 'Off — checks always pass' },
  { value: 'warn', label: 'Warn — blocking issues show as conditions' },
  { value: 'enforce', label: 'Enforce — blocking issues stop the action' },
];

/** Per-org eligibility policy (Pulse 66b329c3). */
export default function EligibilityPolicyTab({ canEdit }: { canEdit: boolean }) {
  const [mode, setMode] = useState('warn');
  const [warnDays, setWarnDays] = useState('30');
  const [mandatory, setMandatory] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    vendorService.getEligibilityPolicy().then((p: any) => {
      setMode(p.enforcement_mode ?? 'warn');
      setWarnDays(String(p.doc_warn_days ?? 30));
      setMandatory((p.mandatory_document_types ?? []).join(', '));
    }).catch(() => setMessage({ kind: 'error', text: 'Could not load the policy.' }));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await vendorService.saveEligibilityPolicy({
        enforcement_mode: mode,
        doc_warn_days: Number(warnDays) || 30,
        mandatory_document_types: mandatory.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setMessage({ kind: 'success', text: 'Policy saved.' });
    } catch (e: any) {
      setMessage({ kind: 'error', text: e?.message || 'Could not save the policy.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Eligibility policy" actions={canEdit ? <Button onClick={save} disabled={saving}>Save</Button> : undefined}>
      {message && <Alert variant={message.kind === 'error' ? 'error' : 'success'}>{message.text}</Alert>}
      <div className="flex flex-col gap-nb-3">
        <Select label="Enforcement" name="enforcement_mode" options={MODES} value={mode} disabled={!canEdit} onChange={(e) => setMode(e.target.value)} />
        <FormField label="Warn about documents expiring within (days)" name="doc_warn_days" type="number" value={warnDays} disabled={!canEdit} onChange={(e: any) => setWarnDays(e.target.value)} />
        <FormField label="Mandatory document types (comma separated)" name="mandatory_document_types" value={mandatory} disabled={!canEdit} onChange={(e: any) => setMandatory(e.target.value)} />
      </div>
    </Card>
  );
}
