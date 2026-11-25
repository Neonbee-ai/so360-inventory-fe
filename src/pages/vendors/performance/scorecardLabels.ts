export const STANDING_LABELS: Record<string, string> = { provisional: 'Provisional', preferred: 'Preferred', good: 'Good', warning: 'Warning', review: 'Under review' };
export const STANDING_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = { preferred: 'success', good: 'info', warning: 'warning', review: 'danger', provisional: 'neutral' };

export const DIMENSION_LABELS: Record<string, string> = {
    delivery_reliability: 'Delivery reliability',
    quality_acceptance: 'Quality acceptance',
    quote_responsiveness: 'Quote responsiveness',
    commercial_competitiveness: 'Commercial competitiveness',
    service_responsiveness: 'Service responsiveness',
    first_time_completion: 'First-time completion',
    documentation_compliance: 'Documentation compliance',
    capa_discipline: 'Corrective-action discipline',
    communication_reliability: 'Communication reliability',
    safety_compliance: 'Safety compliance',
};
export const dimensionLabel = (k: string) => DIMENSION_LABELS[k] ?? k.replace(/_/g, ' ');

export const SIGNAL_LABELS: Record<string, string> = { threshold_breach: 'Below threshold', severe_event: 'Severe event', repeat_failure: 'Repeat failure after corrective action', document_lapse: 'Document lapse' };

export const WIDGET_TITLES: Record<string, string> = {
    state_counts: 'Vendors by state', onboarding_aging: 'Onboarding aging', coverage: 'Qualification coverage', evidence_expiry: 'Evidence expiry',
    delivery_quality: 'Delivery and quality (90 days)', capa: 'Corrective actions', risk: 'Risk', standing: 'Scorecard standing', data_freshness: 'Data freshness',
};

/** Sum of dimension weights; the definition can only be activated at exactly 100. */
export const weightsTotal = (dims: Array<{ weight: number | string }>) => dims.reduce((s, d) => s + (Number(d.weight) || 0), 0);

export const asPercent = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(Number(v) * 1000) / 10}%`);
