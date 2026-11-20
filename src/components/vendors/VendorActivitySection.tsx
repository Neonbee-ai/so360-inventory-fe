import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DataTable, EmptyState } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { vendorService } from '../../services/vendorService';
import { useAuth } from '../../hooks/useAuth';
import { useInventoryFormatters } from '../../utils/formatters';
import { isVendorMasterEnabled } from '../../utils/vendorMaster';
import { activityLabel, changedFieldsText } from '../../utils/vendorDocuments';

const PAGE = 20;

/**
 * Vendor activity history (Pulse 652f492e): profile changes, document and
 * bank-detail events, newest first. Shows which fields changed, never values.
 */
export const VendorActivitySection: React.FC<{ vendorId: string }> = ({ vendorId }) => {
    const shell = useShellBridge();
    const { can } = useAuth();
    const formatters = useInventoryFormatters();
    const enabled = isVendorMasterEnabled(shell);
    const canRead = can('suppliers.read');

    const [items, setItems] = useState<any[]>([]);
    const [limit, setLimit] = useState(PAGE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (n: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await vendorService.getActivity(vendorId, n);
            setItems(Array.isArray(res?.data) ? res.data : []);
        } catch (e: any) {
            setError(e?.message ? String(e.message) : 'Could not load activity.');
        } finally {
            setLoading(false);
        }
    }, [vendorId]);

    useEffect(() => {
        if (enabled && canRead && vendorId) load(limit);
    }, [enabled, canRead, vendorId, limit, load]);

    if (!enabled || !canRead) return null;

    const more = items.length >= limit && limit < 200;

    return (
        <Card
            title="Activity"
            data-testid="vendor-activity-section"
            footer={more ? (
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => Math.min(l + PAGE * 2, 200))} data-testid="activity-more">
                    Show more
                </Button>
            ) : undefined}
        >
            <div className="flex flex-col gap-nb-3">
                {error && (
                    <Alert variant="error" onDismiss={() => setError(null)}
                        action={{ label: 'Retry', onClick: () => load(limit) }}>{error}</Alert>
                )}
                <DataTable
                    data-testid="vendor-activity-table"
                    rowKey={(i: any) => i.id}
                    rows={items}
                    loading={loading}
                    emptyState={<EmptyState title="No activity yet" />}
                    columns={[
                        {
                            key: 'what', header: 'What happened',
                            render: (i: any) => {
                                const fields = changedFieldsText(i.changed_fields);
                                return (
                                    <div className="flex flex-col">
                                        <span className="font-medium">{activityLabel(i.action, i.description)}</span>
                                        {fields && <span className="text-nb-sm text-fg-muted">{`Changed: ${fields}`}</span>}
                                    </div>
                                );
                            },
                        },
                        {
                            key: 'by', header: 'By',
                            render: (i: any) => i.actor_name || (i.actor_id ? `User ${String(i.actor_id).slice(0, 8)}` : 'System'),
                        },
                        {
                            key: 'at', header: 'When',
                            render: (i: any) => (i.at ? formatters.formatDateTime(i.at) : '—'),
                        },
                    ]}
                />
            </div>
        </Card>
    );
};

export default VendorActivitySection;
