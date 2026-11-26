import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DataTable, Drawer, EmptyState, FilePickerTrigger, Select, StatusBadge, TextField, Textarea } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { CONFIDENTIALITY_LABELS, REVIEW_BADGE, REVIEW_DECISIONS, REVIEW_LABELS, typeLabel } from './evidenceLabels';

interface Version {
  id: string;
  version: number;
  review_state: string;
  expiry_date?: string | null;
  expiry_state?: string;
  document_number?: string | null;
  confidentiality: string;
  upload_state?: string;
  upload_error?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  redacted?: boolean;
}
interface Chain {
  evidence_id: string;
  document_type: string;
  latest: Version;
  effective: Version | null;
  versions: Version[];
}

interface Props {
  vendorId: string;
  canUpdate: boolean;
  canReview: boolean;
}

/** Evidence per document type: current version, history, replace, review, download (Pulse f777120a). */
export default function VendorEvidencePanel({ vendorId, canUpdate, canReview }: Props) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Chain | null>(null);
  const [mode, setMode] = useState<'history' | 'replace' | 'review'>('history');
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState('');
  const [decision, setDecision] = useState('verified');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    vendorService
      .getEvidence<{ data: Chain[] }>(vendorId)
      .then((r) => { setChains(r?.data ?? []); setError(null); })
      .catch(() => setError('Could not load documents and compliance.'))
      .finally(() => setLoading(false));
  }, [vendorId]);
  useEffect(load, [load]);

  const open = (c: Chain) => { setActive(c); setMode('history'); setFile(null); setExpiry(''); setNote(''); setDecision('verified'); setDrawerError(null); };
  const close = () => setActive(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setDrawerError(null);
    try {
      await fn();
      load();
      close();
    } catch (e: any) {
      setDrawerError(e?.message || 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const download = async (v: Version) => {
    try {
      const r = await vendorService.getDocumentDownload<{ url: string }>(v.id);
      window.open(r.url, '_blank', 'noopener');
    } catch (e: any) {
      setDrawerError(e?.message || 'You cannot download this document.');
    }
  };

  const columns: DataTableColumn<Chain>[] = [
    { key: 'type', header: 'Document', render: (c) => typeLabel(c.document_type) },
    { key: 'version', header: 'Version', align: 'right', render: (c) => `v${c.latest.version}` },
    { key: 'state', header: 'Status', render: (c) => <StatusBadge status={REVIEW_BADGE[c.latest.review_state] ?? 'default'} label={REVIEW_LABELS[c.latest.review_state] ?? c.latest.review_state} /> },
    { key: 'effective', header: 'In force', render: (c) => (c.effective ? `v${c.effective.version}` : 'None') },
    { key: 'expiry', header: 'Expires', render: (c) => (c.effective?.expiry_date ?? c.latest.expiry_date ?? '—') },
    { key: 'conf', header: 'Access', render: (c) => CONFIDENTIALITY_LABELS[c.latest.confidentiality] ?? c.latest.confidentiality },
  ];

  return (
    <>
      {error && <Alert variant="error">{error}</Alert>}
      <Card title="Documents and compliance">
        {!loading && chains.length === 0 ? (
          <EmptyState title="No documents yet" description="Certificates, licences and insurance for this vendor appear here, with every version kept." />
        ) : (
          <DataTable data-testid="vendor-evidence-table" loading={loading} columns={columns} rows={chains} rowKey={(c) => c.evidence_id} onRowClick={open} />
        )}
      </Card>

      <Drawer
        name="vendor-evidence"
        isOpen={!!active}
        onClose={close}
        title={active ? typeLabel(active.document_type) : ''}
        subtitle={active ? `${active.versions.length} version${active.versions.length === 1 ? '' : 's'}` : undefined}
        footer={
          mode === 'replace' ? (
            <>
              <Button variant="ghost" onClick={() => setMode('history')} disabled={busy}>Back</Button>
              <Button disabled={busy || !file} onClick={() => run(() => vendorService.replaceDocument(active!.latest.id, file!, { expiry_date: expiry || undefined }))}>Submit new version</Button>
            </>
          ) : mode === 'review' ? (
            <>
              <Button variant="ghost" onClick={() => setMode('history')} disabled={busy}>Back</Button>
              <Button disabled={busy} onClick={() => run(() => vendorService.reviewDocument(active!.latest.id, { decision, note: note || undefined }))}>Save decision</Button>
            </>
          ) : (
            <>
              {canUpdate && <Button variant="secondary" onClick={() => setMode('replace')}>Replace</Button>}
              {canReview && active && ['submitted', 'under_review'].includes(active.latest.review_state) && <Button onClick={() => setMode('review')}>Review</Button>}
            </>
          )
        }
      >
        {drawerError && <Alert variant="error">{drawerError}</Alert>}
        {active && mode === 'history' && (
          <ol className="flex flex-col gap-nb-3" data-testid="evidence-history">
            {active.versions.map((v) => (
              <li key={v.id} className="flex flex-col gap-nb-1 rounded-xl border border-line p-nb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-fg">Version {v.version}</span>
                  <StatusBadge status={REVIEW_BADGE[v.review_state] ?? 'default'} label={REVIEW_LABELS[v.review_state] ?? v.review_state} />
                </div>
                {v.redacted ? (
                  <p className="text-nb-sm text-fg-muted">Details are confidential. You need confidential-document access to see them.</p>
                ) : (
                  <>
                    <p className="text-nb-sm text-fg-muted">{v.document_number ? `No. ${v.document_number} · ` : ''}{v.expiry_date ? `Expires ${v.expiry_date}` : 'No expiry date'}</p>
                    {v.rejection_reason && <p className="text-nb-sm text-danger">Rejected: {v.rejection_reason}</p>}
                    {v.upload_state === 'failed' && <Alert variant="warning">The file was not stored. Choose Replace to send it again.</Alert>}
                    {v.upload_state !== 'failed' && <div><Button variant="ghost" size="sm" onClick={() => download(v)}>Download</Button></div>}
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        {active && mode === 'replace' && (
          <div className="flex flex-col gap-nb-3">
            <p className="text-nb-sm text-fg-muted">The current version stays in force until the new one is verified.</p>
            <FilePickerTrigger accept=".pdf,.png,.jpg,.jpeg" name="evidence-file" data-testid="evidence-file" onFiles={(files: File[]) => setFile(files[0] ?? null)}>
              <Button variant="secondary" size="sm">{file ? 'Change file' : 'Choose file'}</Button>
            </FilePickerTrigger>
            <span className="text-nb-sm text-fg-muted" data-testid="evidence-file-name">{file?.name ?? 'No file chosen'}</span>
            <TextField label="New expiry date" name="evidence-expiry" type="date" value={expiry} onChange={(e: any) => setExpiry(e.target.value)} />
          </div>
        )}
        {active && mode === 'review' && (
          <div className="flex flex-col gap-nb-3">
            <Select name="evidence-decision" label="Decision" value={decision} onChange={(e: any) => setDecision(e.target.value)} options={REVIEW_DECISIONS} />
            <Textarea name="evidence-note" label="Note" value={note} onChange={(e: any) => setNote(e.target.value)} />
          </div>
        )}
      </Drawer>
    </>
  );
}
