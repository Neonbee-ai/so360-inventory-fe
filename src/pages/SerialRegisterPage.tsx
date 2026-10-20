import React, { useEffect, useState } from 'react';
import { serialService } from '../services/serialService';
import { useInventoryFormatters } from '../utils/formatters';
import {
    summariseSerials, serialStatusLabel, WARRANTY_LABELS, WARRANTY_TONES,
    type SerialRecord,
} from '../utils/serials';
import {
    ListPageTemplate, DataTable, Button, SearchInput, KpiCard, Grid, Badge, Alert, EmptyState,
    getErrorMessage, type DataTableColumn,
} from '@so360/design-system';

/**
 * Serial register: which customer and which order every serialised unit went to,
 * its warranty, and a sale-history lookup by serial number. Machine view per
 * customer: click a customer name. The route is gated by
 * submodule:inventory:serial_tracking in App.tsx.
 */
const SerialRegisterPage = () => {
    const formatters = useInventoryFormatters();

    const [query, setQuery] = useState('');
    const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
    const [rows, setRows] = useState<SerialRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const q = query.trim();
        if (!customer && q.length < 2) { setRows([]); setError(null); return; }
        let live = true;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const res = customer
                    ? await serialService.byCustomer(customer.id, 100)
                    : await serialService.lookup({ q, limit: 50 });
                if (live) setRows(res);
            } catch (err) {
                if (live) { setRows([]); setError(getErrorMessage(err, 'Failed to load serial numbers')); }
            } finally {
                if (live) setLoading(false);
            }
        }, 300);
        return () => { live = false; clearTimeout(timer); };
    }, [query, customer]);

    const summary = summariseSerials(rows);

    const columns: DataTableColumn<SerialRecord>[] = [
        {
            key: 'serial',
            header: 'Serial Number',
            render: (r) => <span className="font-mono font-medium">{r.serial_number}</span>,
        },
        {
            key: 'item',
            header: 'Item',
            render: (r) => (
                <>
                    {r.item?.name || '—'}
                    {r.item?.sku && <span className="block font-mono text-xs text-fg-subtle">{r.item.sku}</span>}
                </>
            ),
        },
        { key: 'status', header: 'Status', render: (r) => serialStatusLabel(r.status) },
        {
            key: 'customer',
            header: 'Customer',
            render: (r) => r.customer_name
                ? (
                    <Button variant="ghost" size="sm" onClick={() => setCustomer({ id: r.customer_id as string, name: r.customer_name as string })} disabled={!r.customer_id}>
                        {r.customer_name}
                    </Button>
                )
                : '—',
        },
        {
            key: 'order',
            header: 'Order / Invoice',
            render: (r) => r.sold_source_number
                ? (
                    <>
                        {r.sold_source_number}
                        {r.sold_source_module && <span className="block text-xs text-fg-subtle">{r.sold_source_module}</span>}
                    </>
                )
                : '—',
        },
        { key: 'sold', header: 'Sold', render: (r) => r.sold_at ? formatters.formatDate(r.sold_at) : '—' },
        {
            key: 'warranty',
            header: 'Warranty',
            render: (r) => {
                const w = r.warranty_status || 'not_sold';
                return (
                    <>
                        <Badge tone={WARRANTY_TONES[w]}>{WARRANTY_LABELS[w]}</Badge>
                        {r.warranty_until && <span className="block text-xs text-fg-subtle">until {formatters.formatDate(r.warranty_until)}</span>}
                    </>
                );
            },
        },
    ];

    const kpis = (
        <Grid columns={4} gap="md">
            <KpiCard label="Serials Found" value={summary.total} />
            <KpiCard label="Sold" value={summary.sold} />
            <KpiCard label="In Warranty" value={summary.inWarranty} />
            <KpiCard label="Out of Warranty" value={summary.outOfWarranty} />
        </Grid>
    );

    return (
            <ListPageTemplate trail={[]}
                title="Serial Register"
                description="Who bought each serialised unit, on which order, and its warranty."
                headerSecondaryActions={customer ? [
                    <Button key="clear" variant="secondary" onClick={() => setCustomer(null)}>Clear customer</Button>,
                ] : []}
                kpis={kpis}
                search={<SearchInput placeholder="Find a serial number..." value={query} onChange={setQuery} />}
                loading={loading}
                isEmpty={!loading && !error && rows.length === 0}
                empty={(
                    <EmptyState
                        title={customer || query.trim().length >= 2 ? 'No serial numbers found.' : 'Search a serial number to see its sale history.'}
                    />
                )}
            >
                <div className="flex flex-col gap-nb-4">
                    {error && <Alert variant="error">{error}</Alert>}
                    {customer && <Alert variant="info">Showing every unit sold to {customer.name}.</Alert>}
                    <DataTable
                        data-testid="serial-register-table"
                        columns={columns}
                        rows={rows}
                        rowKey={(r: SerialRecord) => r.id}
                        loading={loading}
                    />
                </div>
            </ListPageTemplate>
    );
};

export default SerialRegisterPage;
