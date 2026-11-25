import { useEffect, useMemo, useState } from 'react';
import { vendorCollabService, EligibleVendor, EligibilityScope } from '../services/vendorCollabService';

export interface EligibleVendorsResult {
    /** eligible + conditional, ready to pick. */
    pickable: EligibleVendor[];
    /** not eligible, with the reason text, for the "show ineligible" toggle. */
    blocked: EligibleVendor[];
    loading: boolean;
    /** true when the eligibility search was unavailable and callers should fall back to the plain list. */
    unavailable: boolean;
}

/** One place for scope-filtered vendor pickers (RFQ invite, PO create). Re-queries when the scope changes. */
export function useEligibleVendors(scope: EligibilityScope, enabled = true): EligibleVendorsResult {
    const [items, setItems] = useState<EligibleVendor[]>([]);
    const [loading, setLoading] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const key = JSON.stringify(scope);

    useEffect(() => {
        if (!enabled) return;
        let live = true;
        setLoading(true);
        vendorCollabService.searchEligible(scope)
            .then((r) => { if (live) { setItems(r); setUnavailable(false); } })
            .catch(() => { if (live) { setItems([]); setUnavailable(true); } })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled]);

    return useMemo(() => ({
        pickable: items.filter((v) => v.decision !== 'ineligible'),
        blocked: items.filter((v) => v.decision === 'ineligible'),
        loading,
        unavailable,
    }), [items, loading, unavailable]);
}
