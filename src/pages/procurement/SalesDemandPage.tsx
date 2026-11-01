import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementService } from '../../services/procurementService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Button, Checkbox, DataTable, EmptyState, Grid, GridItem, KpiCard, ListPageTemplate, SectionCard, toast, getErrorMessage, useConfirm, type DataTableColumn } from '@so360/design-system';

/**
 * Sales demand — the buy list a confirmed customer order creates.
 *
 * Every ordered line is netted against free stock and quantity already on
 * order, so the only number shown is what is genuinely short. Raising the
 * requisition from here means the customer order is never re-keyed by hand.
 */
const SalesDemandPage = () => {
    const [confirm, confirmDialog] = useConfirm();
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [onlyShort, setOnlyShort] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [raising, setRaising] = useState<string | null>(null);

    useEffect(() => { load(); }, [onlyShort]);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await procurementService.getSalesDemand({ only_short: onlyShort }));
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load sales demand'));
        } finally {
            setLoading(false);
        }
    };

    const raise = async (order: any) => {
        if (!(await confirm({ title: 'Raise requisition', message: `Raise a requisition for ${order.short_line_count} short line(s) on ${order.so_number}?`, intent: 'default', confirmLabel: 'Raise' }))) return;
        setRaising(order.sales_order_id);
        try {
            const res = await procurementService.raiseRequisitionForSalesOrder(order.sales_order_id);
            toast.success(`Requisition ${res?.requisition?.pr_number || ''} raised for ${order.so_number}`);
            navigate(`/procurement/pr/${res.requisition.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to raise the requisition'));
            setRaising(null);
        }
    };

    const summary = data?.summary || {};
    const orders = data?.orders || [];

    const expandedOrder = orders.find((o: any) => o.sales_order_id === expanded);

    const columns: DataTableColumn<any>[] = [
        {
            key: 'so',
            header: 'Sales Order',
            render: (o: any) => (
                <>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === o.sales_order_id ? null : o.sales_order_id)}>
                        {o.so_number}
                    </Button>
                    <div className="text-xs text-fg-subtle">{o.status}</div>
                </>
            ),
        },
        { key: 'customer', header: 'Customer', render: (o: any) => o.customer_name || '—' },
        { key: 'delivery', header: 'Delivery', render: (o: any) => o.requested_delivery_date ? formatters.formatDate(o.requested_delivery_date) : '—' },
        {
            key: 'short',
            header: 'Short Lines',
            render: (o: any) => (
                <span className={o.short_line_count > 0 ? 'font-semibold text-warning' : 'font-semibold text-success'}>
                    {o.short_line_count > 0 ? `${o.short_line_count} short` : 'Covered'}
                </span>
            ),
        },
        { key: 'shortfall', header: 'Shortfall', align: 'right', render: (o: any) => formatters.formatCurrency(o.shortfall_value || 0) },
        {
            key: 'action',
            header: 'Action',
            render: (o: any) => o.short_line_count > 0 ? (
                <Button size="sm" onClick={() => raise(o)} disabled={raising === o.sales_order_id}>
                    {raising === o.sales_order_id ? 'Raising...' : 'Raise Requisition'}
                </Button>
            ) : (
                <span className="text-sm text-fg-subtle">—</span>
            ),
        },
    ];

    const lineColumns: DataTableColumn<any>[] = [
        {
            key: 'item',
            header: 'Item',
            render: (l: any) => (
                <>
                    {l.item_name || l.sku || 'Line'}
                    {l.sku && <span className="block font-mono text-xs text-fg-subtle">{l.sku}</span>}
                </>
            ),
        },
        { key: 'ordered', header: 'Ordered', align: 'center', render: (l: any) => l.ordered_quantity },
        { key: 'stock', header: 'From Stock', align: 'center', render: (l: any) => l.covered_by_stock },
        { key: 'onorder', header: 'On Order', align: 'center', render: (l: any) => l.covered_by_open_orders },
        { key: 'short', header: 'Short', align: 'center', render: (l: any) => l.shortfall },
    ];

    return (
        <>
            {confirmDialog}
            <ListPageTemplate trail={[]}
                title="Sales Demand"
                description="Confirmed customer orders, netted against stock and open purchase orders."
                count={orders.length > 0
                    ? `${summary.order_count ?? orders.length} order(s) · ${summary.short_line_count ?? 0} short line(s) · ${formatters.formatCurrency(summary.shortfall_value || 0)} shortfall`
                    : undefined}
                toolbar={(
                    <Checkbox
                        name="only-short"
                        label="Only orders needing purchase"
                        aria-label="Only orders needing purchase"
                        checked={onlyShort}
                        onChange={(e: any) => setOnlyShort(e.target.checked)}
                    />
                )}
                loading={loading}
                isEmpty={!loading && !error && orders.length === 0}
                empty={(
                    <EmptyState
                        title={onlyShort ? 'Every confirmed order is covered by stock or existing purchase orders.' : 'No confirmed sales orders.'}
                    />
                )}
            >
                <div className="flex flex-col gap-nb-4">
                    {error && <Alert variant="error">{error}</Alert>}
                    <Grid columns="auto" data-testid="sales-demand-kpis">
                        {[
                            { label: 'Orders Shown', value: summary.order_count ?? 0 },
                            { label: 'Need Purchasing', value: summary.orders_needing_purchase ?? 0 },
                            { label: 'Short Lines', value: summary.short_line_count ?? 0 },
                            { label: 'Shortfall Value', value: formatters.formatCurrency(summary.shortfall_value || 0) },
                        ].map(s => (
                            <GridItem key={s.label} span={3}>
                                <KpiCard label={s.label} value={s.value} />
                            </GridItem>
                        ))}
                    </Grid>
                    <DataTable
                        data-testid="sales-demand-table"
                        columns={columns}
                        rows={orders}
                        rowKey={(o: any) => o.sales_order_id}
                        loading={loading}
                    />
                    {expandedOrder && (
                        <SectionCard title={`${expandedOrder.so_number} netting`}>
                            <DataTable
                                data-testid="sales-demand-lines"
                                columns={lineColumns}
                                rows={expandedOrder.lines || []}
                                rowKey={(l: any) => l.sales_order_line_id}
                            />
                        </SectionCard>
                    )}
                    <p className="text-xs text-fg-subtle">
                        Stock is a shared pool — it is allocated to orders in date sequence, so the same units are never
                        promised to two customers.
                    </p>
                </div>
            </ListPageTemplate>
        </>
    );
};

export default SalesDemandPage;
