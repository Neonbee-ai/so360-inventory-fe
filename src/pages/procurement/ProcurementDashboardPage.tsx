import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementInsightsService } from '../../services/procurementInsightsService';
import { useInventoryFormatters } from '../../utils/formatters';
import { Alert, Button, DashboardPageTemplate, DataTable, EmptyState, KpiCard, Progress, SectionCard, Spinner, getErrorMessage, type DataTableColumn } from '@so360/design-system';

/** Where each alert type takes the buyer when they act on it. */
const ALERT_ROUTES: Record<string, string> = {
    pr_awaiting_approval: '/procurement/pr',
    delivery_overdue: '/procurement/po',
    po_unacknowledged: '/procurement/po',
    qc_pending: '/procurement/quality',
    payment_overdue: '/procurement/po',
    returns_open: '/procurement/returns',
};

/**
 * Procurement command centre.
 *
 * Ordered the way a buyer's day runs: what needs a decision now (alerts and
 * the pipeline), then what it is costing (value and savings), then where the
 * money goes (vendor and category cuts).
 */
const ProcurementDashboardPage = () => {
    const navigate = useNavigate();
    const formatters = useInventoryFormatters();
    const [data, setData] = useState<any>(null);
    const [trends, setTrends] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [dashboard, trend] = await Promise.all([
                procurementInsightsService.getDashboard(),
                procurementInsightsService.getTrends(6).catch(() => null),
            ]);
            setData(dashboard);
            setTrends(trend);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load the procurement dashboard'));
        } finally {
            setLoading(false);
        }
    };

    const refreshAction = <Button variant="secondary" onClick={load}>Refresh</Button>;
    const title = 'Procurement Dashboard';
    const description = 'The whole purchasing pipeline — requisition to payment — in one place.';

    if (loading) {
        return (
            <DashboardPageTemplate title={title} description={description}>
                <div className="flex min-h-[400px] items-center justify-center"><Spinner aria-label="Loading dashboard" /></div>
            </DashboardPageTemplate>
        );
    }

    if (error) {
        return (
            <DashboardPageTemplate title={title} description={description} primaryAction={refreshAction}>
                <Alert variant="error">{error}</Alert>
            </DashboardPageTemplate>
        );
    }

    const k = data?.kpis || {};

    const pipeline = [
        { label: 'Pending PR', value: k.pending_requisitions ?? 0, route: '/procurement/pr' },
        { label: 'Awaiting Approval', value: k.pending_approval ?? 0, route: '/procurement/pr' },
        { label: 'RFQs Waiting', value: k.rfqs_awaiting_response ?? 0, route: '/procurement/rfq' },
        { label: 'PO Issued', value: k.po_issued ?? 0, route: '/procurement/po' },
        { label: 'PO Pending Delivery', value: k.po_pending_delivery ?? 0, route: '/procurement/po' },
        { label: 'GRNs Pending', value: k.grns_pending_inspection ?? 0, route: '/procurement/grn' },
        { label: 'Inspection Pending', value: k.quality_inspection_pending ?? 0, route: '/procurement/quality' },
        { label: 'Invoices Pending', value: k.purchase_invoices_pending ?? 0, route: '/procurement/po' },
        { label: 'Payments Pending', value: k.vendor_payments_pending ?? 0, route: '/procurement/po' },
        { label: 'Open Returns', value: k.open_returns ?? 0, route: '/procurement/returns' },
    ];

    const health = [
        {
            label: 'Procurement Lead Time',
            value: k.procurement_lead_time_days != null ? `${k.procurement_lead_time_days} days` : '—',
            hint: 'Order raised to first receipt',
        },
        {
            label: 'Approval Cycle',
            value: k.average_approval_days != null ? `${k.average_approval_days} days` : '—',
            hint: 'Requisition submitted to approved',
        },
        {
            label: 'Delayed Deliveries',
            value: k.delayed_deliveries ?? 0,
            hint: 'Past the promised date',
            danger: (k.delayed_deliveries ?? 0) > 0,
        },
        {
            label: 'Rejected Deliveries',
            value: k.rejected_deliveries ?? 0,
            hint: 'Receipts with rejected or damaged units',
            danger: (k.rejected_deliveries ?? 0) > 0,
        },
    ];

    const alerts: any[] = data?.alerts || [];
    const vendors: any[] = data?.spend_by_vendor || [];
    const topVendor = vendors[0]?.amount || 1;
    const months: any[] = trends?.monthly_spend || [];
    const maxMonth = Math.max(0, ...months.map((x: any) => x.value)) || 1;
    const topItems: any[] = trends?.top_items || [];

    const itemColumns: DataTableColumn<any>[] = [
        {
            key: 'item',
            header: 'Item',
            render: (item: any) => (
                <>
                    {item.item_name || item.item_id.slice(0, 8)}
                    {item.sku && <span className="block font-mono text-xs text-fg-subtle">{item.sku}</span>}
                </>
            ),
        },
        { key: 'quantity', header: 'Quantity', align: 'center', render: (item: any) => item.quantity },
        { key: 'value', header: 'Value', align: 'right', render: (item: any) => formatters.formatCurrency(item.value) },
    ];

    return (
        <DashboardPageTemplate
            title={title}
            description={description}
            primaryAction={refreshAction}
            secondaryActions={[
                <Button key="reports" variant="secondary" onClick={() => navigate('/procurement/reports')}>Open Reports</Button>,
                <Button key="vp" variant="secondary" onClick={() => navigate('/procurement/vendor-performance')}>Vendor Performance</Button>,
            ]}
            kpis={(
                <div className="grid grid-cols-1 gap-nb-4 md:grid-cols-4">
                    <KpiCard label="Total Procurement Value" value={formatters.formatCurrency(k.total_procurement_value || 0)} hint={`${k.po_issued || 0} orders issued · ${k.completed_orders || 0} completed`} />
                    <KpiCard label="Cost Savings" value={formatters.formatCurrency(k.cost_savings || 0)} hint="Won against higher competing quotes" />
                    <KpiCard
                        label="Budget Utilisation"
                        value={k.budget_utilisation_percent != null ? `${k.budget_utilisation_percent}%` : '—'}
                        hint={k.budget_allocated ? `of ${formatters.formatCurrency(k.budget_allocated)} allocated` : 'No budgets set on requisitions'}
                    />
                </div>
            )}
            primary={(
                <div className="flex flex-col gap-nb-4">
                    {alerts.length > 0 && (
                        <SectionCard title="Needs Attention">
                            <div className="grid grid-cols-1 gap-nb-3 md:grid-cols-2">
                                {alerts.map((alert: any) => (
                                    <KpiCard
                                        key={alert.type}
                                        label={alert.message}
                                        value={alert.count}
                                        onClick={() => navigate(ALERT_ROUTES[alert.type] || '/procurement/pr')}
                                    />
                                ))}
                            </div>
                        </SectionCard>
                    )}
                    <SectionCard title="Pipeline">
                        <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-5">
                            {pipeline.map(tile => (
                                <KpiCard key={tile.label} label={tile.label} value={tile.value} onClick={() => navigate(tile.route)} />
                            ))}
                        </div>
                    </SectionCard>
                    <SectionCard title="Process Health">
                        <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-4">
                            {health.map(tile => (
                                <KpiCard key={tile.label} label={tile.label} value={tile.value} hint={tile.hint} />
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}
            secondary={(
                <div className="grid grid-cols-1 gap-nb-4 lg:grid-cols-2">
                    <SectionCard title="Spend by Vendor">
                        {vendors.length === 0 ? (
                            <EmptyState title="No purchase orders yet." />
                        ) : (
                            <div className="flex flex-col gap-nb-3">
                                {vendors.map((row: any) => (
                                    <div key={row.vendor_id}>
                                        <div className="mb-1 flex justify-between text-sm">
                                            <span className="max-w-[60%] truncate text-fg-muted">{row.vendor_name || row.vendor_id.slice(0, 8)}</span>
                                            <span className="font-semibold text-fg">{formatters.formatCurrency(row.amount)}</span>
                                        </div>
                                        <Progress value={Math.max(2, (row.amount / topVendor) * 100)} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                    <SectionCard title="Monthly Spend">
                        {months.length === 0 ? (
                            <EmptyState title="Not enough history yet." />
                        ) : (
                            <div className="flex flex-col gap-nb-3">
                                {months.map((m: any) => (
                                    <div key={m.month} title={`${m.month}: ${formatters.formatCurrency(m.value)}`}>
                                        <div className="mb-1 flex justify-between text-xs text-fg-subtle">
                                            <span>{m.month}</span>
                                            <span className="font-semibold text-fg" data-testid="monthly-spend-value">{formatters.formatCurrency(m.value)}</span>
                                        </div>
                                        <Progress value={Math.max(4, (m.value / maxMonth) * 100)} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}
            bottom={topItems.length > 0 ? (
                <SectionCard title="Top Purchased Items">
                    <DataTable columns={itemColumns} rows={topItems} rowKey={(item: any) => item.item_id} />
                </SectionCard>
            ) : undefined}
        />
    );
};

export default ProcurementDashboardPage;
