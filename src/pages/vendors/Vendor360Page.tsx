import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, EmptyState, Tabs } from '@so360/design-system';
import VendorLifecyclePanel from './lifecycle/VendorLifecyclePanel';
import VendorQualificationsPanel from './lifecycle/VendorQualificationsPanel';
import VendorRiskPanel from './lifecycle/VendorRiskPanel';
import VendorEvidencePanel from './evidence/VendorEvidencePanel';
import VendorQualityPanel from './quality/VendorQualityPanel';
import VendorCorrectiveActionsPanel from './quality/VendorCorrectiveActionsPanel';
import VendorOutcomesPanel from './outcomes/VendorOutcomesPanel';
import VendorFinancePanel from './finance/VendorFinancePanel';
import VendorProcurementPanel from './VendorProcurementPanel';
import VendorPerformancePanel from './performance/VendorPerformancePanel';
import VendorEligibilityPanel from './eligibility/VendorEligibilityPanel';
import VendorPortalPanel from './portal/VendorPortalPanel';
import { PORTAL_FLAG, PORTAL_INVITE_FLAG, PORTAL_PERMISSION } from '../../utils/vendorPortal';
import { useShellBridge } from '@so360/shell-context';
import { vendorService } from '../../services/vendorService';

/**
 * Vendor 360 — purchase orders, goods receipts and payables on one screen.
 *
 * Same contract as Customer 360: the API composes by id from the module that
 * owns each fact (purchase orders and receipts in inventory, bills in
 * accounting); every panel carries its deep link and the permission the UI must
 * check; a panel the API marks unavailable renders a neutral state.
 *
 * The payables panel is the one to watch: it needs vendor_bills.vendor_id
 * (accounting migration 041). Until that runs it reports "unavailable" rather
 * than matching on the vendor's name and showing wrong money.
 */
type Panel = { available?: boolean; reason?: string; [k: string]: any };
type Payload = { profile: { id: string; name?: string }; panels: Record<string, Panel> };

const money = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

export default function Vendor360Page() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shell = useShellBridge();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');
  // Vendor 10: receipts/returns tab only when the plan has the outcome facts (fail-open while flags resolve).
  // Vendor 16: the evidence tab rides the Vendor Master flag (the documents feature it extends).
  const evidenceOn = ((shell as any)?.getFeatureState?.('submodule:inventory:vendor_master') ?? 'enabled') === 'enabled';
  const outcomesOn = ((shell as any)?.getFeatureState?.('submodule:inventory:vendor_outcome_facts') ?? 'enabled') === 'enabled';

  // Vendor 11: supplier quality + corrective actions (fail-open while flags resolve).
  const qualityOn = ((shell as any)?.getFeatureState?.('submodule:inventory:supplier_quality') ?? 'enabled') === 'enabled';
  const vcaOn = ((shell as any)?.getFeatureState?.('submodule:inventory:vendor_corrective_actions') ?? 'enabled') === 'enabled';

  // Vendor 15: Finance tab (account state, sync, bills linked to Accounting). Growth tier flag; fail-open while flags resolve.
  const financeOn = ((shell as any)?.getFeatureState?.('submodule:inventory:vendor_finance_summary') ?? 'enabled') === 'enabled';

  // Vendor 08: RFQ & PO references tab (reads Procurement; same flag as the Vendor Master it extends).
  const procurementOn = evidenceOn;

  // Vendor 18: Performance tab (scorecards flag; fail-open while flags resolve).
  const scorecardsOn = ((shell as any)?.getFeatureState?.('submodule:inventory:vendor_scorecards') ?? 'enabled') === 'enabled';

  // Vendor 17: Portal & contacts tab (scale-tier flag; fail-open while flags resolve; needs vendors.portal.manage).
  const portalOn = ((shell as any)?.getFeatureState?.(PORTAL_FLAG) ?? 'enabled') === 'enabled';
  const portalInviteOn = ((shell as any)?.getFeatureState?.(PORTAL_INVITE_FLAG) ?? 'enabled') === 'enabled';

  const can = useMemo(
    () => (perms?: string[]) => {
      if (!perms?.length) return true;
      if (!shell) return false;
      return perms.some((p) => shell.hasPermission?.(p) ?? false);
    },
    [shell],
  );

  useEffect(() => {
    if (!id) return;
    let alive = true;
    vendorService
      .getVendor360<Payload>(id)
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive) setError('Could not load this vendor 360.'); });
    return () => { alive = false; };
  }, [id]);

  if (error) return <div className="p-6 text-fg-muted">{error}</div>;
  if (!data) return null;

  const p = data.panels ?? {};
  const rows = (list: any[] | undefined) => list ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-nb-3 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">{data.profile?.name || 'Vendor 360'}</h1>
        <Button variant="ghost" onClick={() => navigate(`/inventory/vendors/${id}`)}>Back to vendor</Button>
      </div>

      <Tabs
        name="vendor-360-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'qualifications', label: 'Categories & Capabilities' },
          { id: 'risk', label: 'Risk & Due Diligence' },
          { id: 'eligibility', label: 'Eligibility' },
          ...(evidenceOn ? [{ id: 'documents', label: 'Documents & Compliance' }] : []),
          ...(outcomesOn ? [{ id: 'outcomes', label: 'Receipts & Returns' }] : []),
          ...(qualityOn ? [{ id: 'quality', label: 'Quality' }] : []),
          ...(vcaOn ? [{ id: 'corrective', label: 'Corrective actions' }] : []),
          ...(scorecardsOn ? [{ id: 'performance', label: 'Performance' }] : []),
          ...(procurementOn ? [{ id: 'procurement', label: 'RFQs & POs' }] : []),
          ...(financeOn ? [{ id: 'finance', label: 'Finance' }] : []),
          ...(portalOn && can([PORTAL_PERMISSION]) ? [{ id: 'portal', label: 'Portal & Contacts' }] : []),
        ]}
      >
        {(active) => {
          if (active === 'portal' && portalOn) {
            return <VendorPortalPanel vendorId={id} canManage={can([PORTAL_PERMISSION])} canInvite={portalInviteOn && can([PORTAL_PERMISSION])} />;
          }
          if (active === 'qualifications') {
            return <VendorQualificationsPanel vendorId={id} canEdit={can(['suppliers.update'])} />;
          }
          if (active === 'documents' && evidenceOn) {
            return <VendorEvidencePanel vendorId={id} canUpdate={can(['suppliers.update'])} canReview={can(['vendors.compliance.review'])} />;
          }
          if (active === 'outcomes' && outcomesOn) {
            return <VendorOutcomesPanel vendorId={id} canDispute={((shell as any)?.getFeatureState?.('action:inventory:vendor_fact_dispute') ?? 'disabled') === 'enabled' && can(['suppliers.update'])} />;
          }
          if (active === 'quality' && qualityOn) {
            return <VendorQualityPanel vendorId={id} />;
          }
          if (active === 'corrective' && vcaOn) {
            return <VendorCorrectiveActionsPanel vendorId={id} />;
          }
          if (active === 'performance' && scorecardsOn) {
            return <VendorPerformancePanel vendorId={id} />;
          }
          if (active === 'procurement' && procurementOn) {
            return <VendorProcurementPanel vendorId={id} />;
          }
          if (active === 'finance' && financeOn) {
            return <VendorFinancePanel vendorId={id} canSetup={can(['vendor_finance.approve', 'vendor_finance.verify'])} />;
          }
          if (active === 'eligibility') {
            return <VendorEligibilityPanel vendorId={id} />;
          }
          if (active === 'risk') {
            return <VendorRiskPanel vendorId={id} canRestrict={can(['vendors.restrict'])} />;
          }
          return (
            <div className="flex flex-col gap-nb-3">
              <VendorLifecyclePanel vendorId={id} canManage={can(['vendors.lifecycle.manage'])} />
      <Card title="Procurement summary">
        <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-fg-subtle">Purchase orders</p>
            <p className="text-lg font-semibold text-fg">{p.purchase_orders?.count ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">PO value</p>
            <p className="text-lg font-semibold text-fg">{money(p.purchase_orders?.total_value)}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Goods receipts</p>
            <p className="text-lg font-semibold text-fg">{p.goods_receipts?.count ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Outstanding payables</p>
            <p className="text-lg font-semibold text-fg">
              {p.payables?.available === false ? '—' : money(p.payables?.outstanding)}
            </p>
          </div>
        </div>
      </Card>

      {can(p.purchase_orders?.permissions) && p.purchase_orders?.available !== false && (
        <Card title="Purchase orders">
          {rows(p.purchase_orders?.recent).length === 0 ? (
            <EmptyState title="No purchase orders" description="Orders raised to this vendor will appear here." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(p.purchase_orders?.recent).map((o: any) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{o.po_number || 'PO'}</span>
                  <span className="text-fg-muted">{o.status} · {money(o.total_amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => navigate(p.purchase_orders.deep_link)}>All purchase orders</Button>
        </Card>
      )}

      {can(p.goods_receipts?.permissions) && p.goods_receipts?.available !== false && (
        <Card title="Goods receipts">
          {rows(p.goods_receipts?.recent).length === 0 ? (
            <EmptyState title="No goods receipts" description="Receipts recorded against this vendor's orders will appear here." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(p.goods_receipts?.recent).map((r: any) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{r.receipt_number || 'Receipt'}</span>
                  <span className="text-fg-muted">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Payables">
        {p.payables?.available === false ? (
          <EmptyState
            title="Payables unavailable"
            description="Vendor bills are not linked to this vendor by id yet, so this panel stays empty rather than guessing by name."
          />
        ) : rows(p.payables?.recent).length === 0 ? (
          <EmptyState title="Nothing outstanding" description="Bills for this vendor will appear here." />
        ) : (
          <ul className="flex flex-col gap-nb-2">
            {rows(p.payables?.recent).map((b: any) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-fg">{b.bill_number || 'Bill'}</span>
                <span className="text-fg-muted">{b.status} · {money(b.total_amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
            </div>
          );
        }}
      </Tabs>
    </div>
  );
}
