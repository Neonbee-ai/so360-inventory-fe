import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, DataTable, EmptyState, SectionCard, TextField, toast, getErrorMessage } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
import { vendorCollabService } from '../../services/vendorCollabService';

interface Link { id: string; expires_at: string; revoked_at: string | null; last_used_at: string | null; created_at: string }

export const linkState = (l: Pick<Link, 'expires_at' | 'revoked_at'>, now = Date.now()) =>
    l.revoked_at ? 'Revoked' : Date.parse(l.expires_at) <= now ? 'Expired' : 'Active';

/** Supplier link card on the PO page (Pulse 84fdc5b8). The URL is shown once; only a hash is stored. */
export default function POVendorLinkPanel({ poId, status }: { poId: string; status: string }) {
    const [links, setLinks] = useState<Link[]>([]);
    const [fresh, setFresh] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const issued = ['sent', 'acknowledged', 'partially_received'].includes(status);

    const load = useCallback(() => {
        vendorCollabService.listPoLinks(poId).then((r: any) => setLinks(Array.isArray(r) ? r : [])).catch(() => setError('Could not load supplier links.'));
    }, [poId]);
    useEffect(load, [load]);

    const create = async () => {
        setBusy(true);
        try {
            const r: any = await vendorCollabService.createPoLink(poId);
            setFresh(r.url);
            setError(null);
            load();
        } catch (e) { toast.error(getErrorMessage(e, 'Could not create the link')); } finally { setBusy(false); }
    };
    const revoke = async (id: string) => {
        try { await vendorCollabService.revokePoLink(poId, id); toast.success('Link revoked'); load(); } catch (e) { toast.error(getErrorMessage(e, 'Could not revoke the link')); }
    };

    const cols: DataTableColumn<Link>[] = [
        { key: 's', header: 'State', render: (l) => linkState(l) },
        { key: 'c', header: 'Created', render: (l) => l.created_at.slice(0, 10) },
        { key: 'e', header: 'Expires', render: (l) => l.expires_at.slice(0, 10) },
        { key: 'u', header: 'Last opened', render: (l) => (l.last_used_at ? l.last_used_at.slice(0, 10) : 'Never') },
        { key: 'r', header: '', render: (l) => (linkState(l) === 'Active' ? <Button size="sm" variant="ghost" onClick={() => revoke(l.id)}>Revoke</Button> : null) },
    ];

    return (
        <SectionCard title="Supplier link" actions={<Button onClick={create} disabled={busy || !issued}>Create link</Button>}>
            {!issued && <Alert variant="info">Issue the PO before sharing it with the supplier.</Alert>}
            {error && <Alert variant="error">{error}</Alert>}
            {fresh && (
                <div className="mb-nb-3" data-testid="fresh-link">
                    <TextField id="po-vendor-link" name="po-vendor-link" label="Copy this link now; it is not shown again" value={fresh} readOnly onChange={() => undefined} />
                </div>
            )}
            {links.length === 0 ? <EmptyState title="No supplier links yet." /> : <DataTable columns={cols} rows={links} rowKey={(l: Link) => l.id} />}
        </SectionCard>
    );
}
