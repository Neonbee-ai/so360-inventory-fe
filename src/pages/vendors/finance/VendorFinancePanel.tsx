import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, DataTable, DescriptionList, EmptyState } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../../services/vendorService';
import { SETUP_STATE_LABELS, SETUP_STATE_TONE } from '../../../utils/payeeChange';

const money = (n: number | null | undefined, cur?: string | null) =>
  `${cur ? `${cur} ` : ''}${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n) || 0)}`;

interface Summary {
  finance_account_ref: string | null; setup_state: string; sync_status: 'ok' | 'pending' | 'failed'; sync_error?: string | null;
  payment_terms: string | null; currency: string | null; tax_registration_masked: { gst_number?: string | null; pan_number?: string | null } | null;
  open_bills_count: number; overdue_bills_count: number; amounts_visible: boolean;
  open_amount?: number; overdue_amount?: number; last_payment_at?: string | null;
  bills?: Array<{ bill_id: string; number: string | null; status: string; amount: number; due_date: string | null; currency: string | null }>;
  activity?: Array<{ id: string; summary: string; bill_id: string | null; occurred_at: string }>;
}

/**
 * Vendor 360 "Finance" tab (Pulse 5d23afa0). Accounting owns bills and ledgers; this shows the
 * supplier-account state, sync status and linked bills. Amounts only when the server says the caller
 * may see them. Bills link out to Accounting, nothing is copied.
 */
export default function VendorFinancePanel({ vendorId, canSetup, openBill }: { vendorId: string; canSetup: boolean; openBill?: (billId: string) => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    vendorService.getFinanceSummary(vendorId)
      .then((r: any) => { setData(r); setError(null); })
      .catch(() => setError('Could not load the Finance summary.'));
  }, [vendorId]);
  useEffect(load, [load]);

  const setup = async () => {
    setBusy(true);
    try { await vendorService.setupFinanceAccount(vendorId); load(); } catch { setError('Could not ask Accounting to set up the supplier account.'); } finally { setBusy(false); }
  };

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return null;

  const billCols: DataTableColumn<NonNullable<Summary['bills']>[number]>[] = [
    { key: 'n', header: 'Bill', render: (b) => (
      <Button variant="ghost" size="sm" onClick={() => (openBill ? openBill(b.bill_id) : window.location.assign(`/accounting/bills/${b.bill_id}`))}>{b.number || 'Bill'}</Button>
    ) },
    { key: 's', header: 'Status', render: (b) => b.status },
    { key: 'a', header: 'Due amount', render: (b) => money(b.amount, b.currency) },
    { key: 'd', header: 'Due date', render: (b) => b.due_date ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-nb-3" data-testid="vendor-finance-panel">
      {data.sync_status === 'failed' && (
        <Alert variant="error" data-testid="finance-sync-failed">
          Finance sync failed{data.sync_error ? `: ${data.sync_error}` : '.'} It is listed under integration exceptions.
        </Alert>
      )}
      <Card
        title="Supplier account"
        actions={canSetup && data.setup_state !== 'active' ? <Button size="sm" disabled={busy} onClick={setup} data-testid="finance-setup">Set up in Finance</Button> : undefined}
      >
        <DescriptionList
          columns={2}
          items={[
            { label: 'Account setup', value: <Badge tone={SETUP_STATE_TONE[data.setup_state] ?? 'neutral'}>{SETUP_STATE_LABELS[data.setup_state] ?? data.setup_state}</Badge> },
            { label: 'Finance reference', value: data.finance_account_ref ?? '—' },
            { label: 'Sync', value: data.sync_status === 'ok' ? 'Up to date' : data.sync_status === 'failed' ? 'Failed' : 'Waiting' },
            { label: 'Payment terms', value: data.payment_terms ?? '—' },
            { label: 'Currency', value: data.currency ?? '—' },
            { label: 'GST / PAN', value: [data.tax_registration_masked?.gst_number, data.tax_registration_masked?.pan_number].filter(Boolean).join(' · ') || '—' },
          ]}
        />
        <p className="mt-nb-2 text-nb-sm text-fg-muted">Payment terms, currency and tax numbers are owned by Finance. Changes go through a Finance change request.</p>
      </Card>

      <Card title="Payables">
        <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-4">
          <div><p className="text-xs text-fg-subtle">Open bills</p><p className="text-lg font-semibold text-fg">{data.open_bills_count}</p></div>
          <div><p className="text-xs text-fg-subtle">Overdue bills</p><p className="text-lg font-semibold text-fg">{data.overdue_bills_count}</p></div>
          {data.amounts_visible && <>
            <div><p className="text-xs text-fg-subtle">Open amount</p><p className="text-lg font-semibold text-fg" data-testid="finance-open-amount">{money(data.open_amount)}</p></div>
            <div><p className="text-xs text-fg-subtle">Overdue amount</p><p className="text-lg font-semibold text-fg">{money(data.overdue_amount)}</p></div>
          </>}
        </div>
        {!data.amounts_visible && <p className="mt-nb-2 text-nb-sm text-fg-muted" data-testid="finance-amounts-hidden">Amounts are shown to people with Accounting bill access.</p>}
        {data.amounts_visible && (data.bills ?? []).length > 0 && (
          <div className="mt-nb-3"><DataTable data-testid="finance-bills-table" columns={billCols} rows={data.bills!} rowKey={(b) => b.bill_id} /></div>
        )}
        {data.amounts_visible && data.last_payment_at && <p className="mt-nb-2 text-nb-sm text-fg-muted">Last payment {data.last_payment_at}</p>}
      </Card>

      <Card title="Finance activity">
        {(data.activity ?? []).length === 0
          ? <EmptyState title="No Finance activity yet" description="Bill and payment updates from Accounting appear here." />
          : (
            <ul className="flex flex-col gap-nb-2">
              {data.activity!.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{a.summary}</span>
                  <span className="text-fg-muted">{String(a.occurred_at).slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
      </Card>
    </div>
  );
}

