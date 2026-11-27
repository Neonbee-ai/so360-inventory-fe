import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, DetailPageTemplate, EmptyState } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { inventoryService } from '../services/inventoryService';

/**
 * Product 360 — stock, purchasing and selling on one screen.
 *
 * Consumes GET /products/:id/360 (inventory-be), which composes by item_id
 * from the tables that own each fact. Same contract as Customer 360: every
 * panel carries its deep link and the permission the UI must check, and a
 * panel the API marks unavailable degrades instead of blanking the page.
 */
type Panel = { available?: boolean; reason?: string; [k: string]: any };
type Payload = { profile: { id: string; sku?: string; name?: string }; panels: Record<string, Panel> };

const money = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

export default function Product360Page() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shell = useShellBridge();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    inventoryService
      .getItem360<Payload>(id)
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive) setError('Could not load this product 360.'); });
    return () => { alive = false; };
  }, [id]);

  const trail = [{ label: 'Items', to: '/inventory/items', onClick: () => navigate('/inventory/items') }];
  if (error) {
    return (
      <DetailPageTemplate title="Product 360" trail={trail}>
        <Alert variant="error">{error}</Alert>
      </DetailPageTemplate>
    );
  }

  const p = data?.panels ?? {};
  const rows = (list: any[] | undefined) => list ?? [];
  const stock = p.stock;

  return (
    <DetailPageTemplate
      title={data?.profile?.name || 'Product 360'}
      trail={trail}
      loading={!!id && !data}
      meta={data?.profile?.sku ? `SKU ${data.profile.sku}` : undefined}
      secondaryActions={[<Button key="back" variant="secondary" onClick={() => navigate(`/inventory/items/${id}`)}>Back to item</Button>]}
    >
      <div className="flex flex-col gap-nb-3">
      <Card title="Stock and movement">
        <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-fg-subtle">On hand</p>
            <p className="text-lg font-semibold text-fg">{stock?.available === false ? '—' : stock?.on_hand ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Reserved</p>
            <p className="text-lg font-semibold text-fg">{stock?.available === false ? '—' : stock?.reserved ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Available</p>
            <p className="text-lg font-semibold text-fg">{stock?.available === false ? '—' : stock?.available ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Purchase spend</p>
            <p className="text-lg font-semibold text-fg">{money(p.purchases?.spend)}</p>
          </div>
        </div>
      </Card>

      {can(p.purchases?.permissions) && p.purchases?.available !== false && (
        <Card title="Purchase history">
          {rows(p.purchases?.recent).length === 0 ? (
            <EmptyState title="Never purchased" description="Purchase order lines for this item will appear here." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(p.purchases?.recent).map((l: any) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">Qty {l.quantity ?? 0}</span>
                  <span className="text-fg-muted">{money(l.unit_price)} each</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => navigate(p.purchases.deep_link)}>Purchase orders</Button>
        </Card>
      )}

      {can(p.sales?.permissions) && p.sales?.available !== false && (
        <Card title="Sales history">
          {rows(p.sales?.recent).length === 0 ? (
            <EmptyState title="Not sold yet" description="Sales order lines for this item will appear here." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(p.sales?.recent).map((l: any) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">Qty {l.quantity ?? 0}</span>
                  <span className="text-fg-muted">{money(l.unit_price)} each</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => navigate(p.sales.deep_link)}>Sales orders</Button>
        </Card>
      )}
      </div>
    </DetailPageTemplate>
  );
}
