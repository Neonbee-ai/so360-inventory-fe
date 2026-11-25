import React, { useState } from 'react';
import { Alert, Button } from '@so360/design-system';
import type { EligibleVendor } from '../../services/vendorCollabService';

/** "Show N not eligible" toggle under a vendor picker: the reason text per vendor, never selectable. */
export default function IneligibleVendorsList({ blocked }: { blocked: EligibleVendor[] }) {
    const [open, setOpen] = useState(false);
    if (!blocked.length) return null;
    return (
        <div className="space-y-nb-1" data-testid="ineligible-vendors">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(!open)}>
                {open ? 'Hide' : 'Show'} {blocked.length} not eligible
            </Button>
            {open && (
                <Alert variant="warning">
                    <ul className="list-disc pl-nb-4">
                        {blocked.map((v) => (
                            <li key={v.vendor_id}>{v.vendor_name || v.name || v.vendor_id.slice(0, 8)}: {v.explanation || v.reason_codes.join(', ')}</li>
                        ))}
                    </ul>
                </Alert>
            )}
        </div>
    );
}
