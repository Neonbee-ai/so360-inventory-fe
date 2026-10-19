import React, { useEffect, useState } from 'react';
import { Alert, DataTable, EmptyState, ListPageTemplate, StatusBadge } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorService } from '../../services/vendorService';
import { useInventoryFormatters } from '../../utils/formatters';

const ContractsPage = () => {
    const formatters = useInventoryFormatters();
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await vendorService.getContracts();
                setContracts(data);
            } catch (e) {
                console.error(e);
                setError('Failed to load contracts. Please refresh the page.');
            } finally { setLoading(false); }
        };
        fetch();
    }, []);

    const columns: DataTableColumn<any>[] = [
        { key: 'id', header: 'Contract #', render: (c) => `#${c.id.slice(0, 8).toUpperCase()}` },
        { key: 'vendor', header: 'Subcontractor', render: (c) => c.vendor?.name },
        { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
        { key: 'contract_value', header: 'Value', align: 'right', render: (c) => formatters.formatCurrency(parseFloat(c.contract_value)) },
        { key: 'duration', header: 'Duration', render: (c) => `${formatters.formatDate(c.start_date)} - ${formatters.formatDate(c.end_date)}` },
    ];

    return (
        <ListPageTemplate
            title="Subcontractor Contracts"
            description="Lump-sum and value-based service agreements."
            count={loading ? undefined : contracts.length}
            loading={loading}
            isEmpty={!loading && contracts.length === 0}
            empty={<EmptyState title="No active contracts found." />}
        >
            {loading && <span className="sr-only" role="status">Loading contracts...</span>}
            {error && <Alert variant="error">{error}</Alert>}
            {!loading && contracts.length > 0 && (
                <DataTable
                    data-testid="contracts-table"
                    columns={columns}
                    rows={contracts}
                    rowKey={(c) => c.id}
                />
            )}
        </ListPageTemplate>
    );
};

export default ContractsPage;
