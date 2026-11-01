import React from 'react';
/**
 * Resolved per-feature state. Mirrors `FeatureState` in `@so360/shell-context`.
 * Kept local so the design-system stays framework-light (no shell/router dep).
 */
export type FeatureState = 'enabled' | 'read_only' | 'locked' | 'disabled' | 'hidden';
export interface FeatureGateProps {
    /** Resolved state for the gated feature (from `getFeatureState(flag)`). */
    state: FeatureState;
    children: React.ReactNode;
    /**
     * Pass `!effectiveFlagsLoaded` here to suppress the gate until the entitlement
     * matrix has resolved. Prevents the "visible → snaps hidden" flicker on first paint.
     * While true, the gate renders nothing regardless of `state`.
     */
    loading?: boolean;
    /** Rendered when the feature is `hidden`. Defaults to nothing. */
    fallback?: React.ReactNode;
    /**
     * Invoked when a `locked` feature is clicked. Wire this to the upgrade
     * prompt (e.g. open MarketingUpgradeModal / navigate to billing). Injected
     * so the design-system does not depend on shell-context or the router.
     */
    onUpgradeClick?: () => void;
    /** Overlay label shown over a `locked` feature. */
    lockedLabel?: string;
    className?: string;
}
/**
 * Shared gating primitive. One component all MFEs adopt, keyed on the resolved
 * 5-state model:
 * - enabled   → render children
 * - read_only → children visible but inert (no upgrade prompt)
 * - locked    → children dimmed; clicking opens the upgrade prompt
 * - disabled  → children dimmed + inert; NO prompt (admin turned it off)
 * - hidden    → render `fallback`
 */
export declare const FeatureGate: React.FC<FeatureGateProps>;
export interface FeatureRouteProps {
    /** Resolved state for the gated route (from `getFeatureState(flag)`). */
    state: FeatureState;
    children: React.ReactNode;
    /**
     * Pass `!effectiveFlagsLoaded` to hold the route in a neutral state until the
     * entitlement matrix resolves. Prevents bouncing users off pages they are
     * entitled to, and prevents briefly showing restricted content.
     * While true, renders `null` (the page is simply not yet shown).
     */
    loading?: boolean;
    /** Rendered while `loading` is true, instead of the default blank `null`. */
    loadingFallback?: React.ReactNode;
    /** Rendered when `hidden` — typically a redirect element (e.g. <Navigate/>). */
    hiddenFallback?: React.ReactNode;
    /** Rendered when `locked` — typically a full-page UpgradeLockOverlay. */
    lockedFallback?: React.ReactNode;
    /** Rendered when `disabled` — typically a "feature unavailable" panel. */
    disabledFallback?: React.ReactNode;
}
/**
 * Route-level variant of {@link FeatureGate}. Consumers inject the redirect /
 * overlay / panel fallbacks so this stays router-agnostic.
 * - hidden   → hiddenFallback (redirect away)
 * - locked   → lockedFallback (full-page upgrade overlay) — falls back to children
 * - disabled → disabledFallback (unavailable panel) — falls back to inert children
 * - read_only→ inert children
 * - enabled  → children
 */
export declare const FeatureRoute: React.FC<FeatureRouteProps>;
