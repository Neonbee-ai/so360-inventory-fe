import React from 'react';
export interface CrossLinkChipProps {
    /** Canonical entity type, e.g. 'crm.deal'. */
    type: string;
    /** Record id. */
    id: string;
    /** Seed label if the source payload already carries a name (skips a fetch). */
    label?: string;
    /** Render only the icon + label, no entity-type prefix. */
    compact?: boolean;
    className?: string;
}
/**
 * A clickable, module-colored reference badge that deep-links to a record in
 * any module. Resolves its label via the cross-link resolver (coalesced +
 * cached) unless a seed `label` is given. Navigates via the provider's
 * injected navigate (SPA) or falls back to an anchor href.
 *
 * Gating: if the target module is disabled for the org, the chip renders as an
 * inert muted span (label still visible, no navigation).
 */
export declare const CrossLinkChip: React.FC<CrossLinkChipProps>;
