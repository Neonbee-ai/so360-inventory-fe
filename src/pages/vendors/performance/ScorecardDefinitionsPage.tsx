import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, DataTable, EmptyState, FieldGrid, ListPageTemplate, Modal, NumberInput, Select, TextField, toast, getErrorMessage } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorScorecardService } from '../../../services/vendorScorecardService';
import { DIMENSION_LABELS, weightsTotal } from './scorecardLabels';

interface Dim { key: string; metric: string; weight: number }
const METRICS = [{ value: 'on_time', label: 'On-time delivery' }, { value: 'accepted_ratio', label: 'Accepted quantity' }, { value: 'first_time_fix', label: 'First-time fix' }, { value: 'capa_on_time', label: 'Corrective action on time' }];
const EMPTY: Dim[] = [{ key: 'delivery_reliability', metric: 'on_time', weight: 50 }, { key: 'quality_acceptance', metric: 'accepted_ratio', weight: 50 }];

/** Configuration > Scorecards (Pulse f0dace0a): versioned definitions; activation needs weights totalling 100. */
export default function ScorecardDefinitionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [minSample, setMinSample] = useState<number>(5);
  const [dims, setDims] = useState<Dim[]>(EMPTY);

  const load = () => vendorScorecardService.definitions().then((r: any) => { setRows(Array.isArray(r) ? r : []); setError(null); }).catch(() => setError('Could not load scorecards.')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const total = weightsTotal(dims);
  const patchDim = (i: number, p: Partial<Dim>) => setDims((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const save = async () => {
    try { await vendorScorecardService.createDefinition({ name, min_sample: minSample, dimensions: dims }); toast.success('Draft saved'); setOpen(false); setName(''); setDims(EMPTY); load(); }
    catch (e) { toast.error(getErrorMessage(e, 'Could not save')); }
  };
  const activate = async (id: string) => {
    try { await vendorScorecardService.activateDefinition(id); toast.success('Scorecard activated'); load(); }
    catch (e: any) { toast.error(e?.body?.code === 'WEIGHTS_MUST_TOTAL_100' ? 'Weights must total 100.' : getErrorMessage(e, 'Could not activate')); }
  };

  const cols: DataTableColumn<any>[] = [
    { key: 'n', header: 'Name', render: (r) => r.name },
    { key: 'v', header: 'Version', render: (r) => `v${r.formula_version}` },
    { key: 'p', header: 'Period', render: (r) => String(r.period).replace(/_/g, ' ') },
    { key: 'm', header: 'Min sample', align: 'right', render: (r) => r.min_sample },
    { key: 's', header: 'Status', render: (r) => <Badge tone={r.status === 'active' ? 'success' : r.status === 'draft' ? 'neutral' : 'warning'}>{r.status}</Badge> },
    { key: 'a', header: '', render: (r) => (r.status === 'draft' ? <Button size="sm" onClick={() => activate(r.id)}>Activate</Button> : null) },
  ];

  return (
    <ListPageTemplate
      trail={[]}
      title="Vendor scorecards"
      description="Define what counts, how much it weighs and how many records are needed before a score is shown."
      count={loading ? undefined : rows.length}
      loading={loading}
      loadingColumns={cols.length}
      isEmpty={!loading && !error && rows.length === 0}
      empty={<EmptyState title="No scorecard defined" description="Until you activate one, vendors show the default scorecard." />}
      primaryAction={<Button onClick={() => setOpen(true)}>New scorecard</Button>}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {rows.length > 0 && <DataTable data-testid="scorecard-definitions" columns={cols} rows={rows} rowKey={(r: any) => r.id} />}
      <Modal open={open} onClose={() => setOpen(false)} title="New scorecard" footer={<Button onClick={save} disabled={!name.trim() || total !== 100}>Save draft</Button>}>
        <div className="flex flex-col gap-nb-3">
          <TextField id="sc-name" name="sc-name" label="Name" value={name} onChange={(e: any) => setName(e.target.value)} />
          <NumberInput label="Minimum records per dimension" name="sc-min" value={minSample} onChange={(v: any) => setMinSample(Number(v?.target ? v.target.value : v) || 1)} />
          {dims.map((d, i) => (
            <FieldGrid key={i} columns={3}>
              <Select label="Dimension" name={`dim-${i}`} value={d.key} options={Object.entries(DIMENSION_LABELS).map(([value, label]) => ({ value, label }))} onChange={(e: any) => patchDim(i, { key: e.target.value })} />
              <Select label="Measured by" name={`metric-${i}`} value={d.metric} options={METRICS} onChange={(e: any) => patchDim(i, { metric: e.target.value })} />
              <NumberInput label="Weight" name={`weight-${i}`} value={d.weight} onChange={(v: any) => patchDim(i, { weight: Number(v?.target ? v.target.value : v) || 0 })} />
            </FieldGrid>
          ))}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setDims([...dims, { key: 'communication_reliability', metric: 'on_time', weight: 0 }])}>Add dimension</Button>
            <span data-testid="weights-total" className={total === 100 ? 'text-fg' : 'text-danger'}>Weights total {total} / 100</span>
          </div>
        </div>
      </Modal>
    </ListPageTemplate>
  );
}
