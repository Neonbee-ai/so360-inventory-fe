import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { procurementService } from '../../services/procurementService';
import { useShellBridge } from '@so360/shell-context';
import { useInventoryFormatters } from '../../utils/formatters';
import { FeatureGate, ListPageTemplate, Button, DataTable, SearchInput, KpiCard, EmptyState } from '@so360/design-system';

interface GRN {
    id: string;
    grn_number: string;
    created_at: string;
    warehouse?: { name: string };
    po?: { po_number: string; vendor?: { name: string } };
    grn_lines?: Array<{ quantity_received: number }>;
}

const GRNListPage = () => {
    const navigate = useNavigate();
    const shell = useShellBridge();
    const formatters = useInventoryFormatters();
    const createGrnState = (shell?.permissionsLoaded === true && (shell?.hasPermission?.('goods_receipts.create') ?? false)) ? ((shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:procurement:create_grn') : 'enabled') : 'hidden';
    const [grns, setGrns] = useState<GRN[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchGRNs();
    }, []);

    const fetchGRNs = async () => {
        try {
            const data = await procurementService.getGRNs();
            setGrns(data);
        } catch (error) {
            console.error('Failed to fetch GRNs', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredGrns = grns.filter(grn =>
        grn.grn_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.po?.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.po?.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const kpis = (
        <div className="grid grid-cols-1 wc-medium:grid-cols-3 gap-nb-4">
            <KpiCard label="Total GRNs" value={grns.length} data-testid="grn-kpi-total" />
            <KpiCard label="This Month" value={grns.filter(g => new Date(g.created_at).getMonth() === new Date().getMonth()).length} data-testid="grn-kpi-month" />
            <KpiCard label="Total Items Received" value={grns.reduce((sum, g) => sum + (g.grn_lines?.reduce((s, l) => s + l.quantity_received, 0) || 0), 0)} data-testid="grn-kpi-items" />
        </div>
    );

    return (
        <ListPageTemplate
            title="Goods Receipt Notes"
            description="Track all received shipments and inventory updates."
            count={grns.length}
            primaryAction={
                <FeatureGate state={createGrnState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                    <Button onClick={() => navigate('/procurement/grn/new')}><Plus size={16} aria-hidden="true" /> New GRN</Button>
                </FeatureGate>
            }
            kpis={kpis}
            search={
                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search by GRN number, PO, or vendor..."
                    data-testid="grn-search"
                />
            }
            loading={loading}
            isEmpty={!loading && filteredGrns.length === 0}
            empty={<EmptyState title={searchTerm ? 'No GRNs match your search.' : 'No goods receipt notes found.'} />}
        >
            <DataTable
                data-testid="grn-table"
                columns={[
                    {
                        key: 'grn_number', header: 'GRN Details',
                        render: (grn: GRN) => (
                            <div>
                                <div className="text-nb-body font-medium text-fg">{grn.grn_number}</div>
                                <div className="text-nb-caption text-fg-subtle">ID: {grn.id.slice(0, 8)}</div>
                            </div>
                        ),
                    },
                    { key: 'po', header: 'Purchase Order', render: (grn: GRN) => <span className="text-nb-body text-primary">#{grn.po?.po_number || 'N/A'}</span> },
                    { key: 'vendor', header: 'Vendor', render: (grn: GRN) => grn.po?.vendor?.name || '-' },
                    { key: 'warehouse', header: 'Warehouse', render: (grn: GRN) => grn.warehouse?.name || '-' },
                    { key: 'items', header: 'Items', align: 'right', render: (grn: GRN) => `${grn.grn_lines?.length || 0} lines` },
                    { key: 'created_at', header: 'Date', render: (grn: GRN) => formatters.formatDate(grn.created_at) },
                ]}
                rows={filteredGrns}
                rowKey={(grn: GRN) => grn.id}
                onRowClick={(grn: GRN) => navigate(`/procurement/grn/${grn.id}`)}
            />
        </ListPageTemplate>
    );
};

export default GRNListPage;
