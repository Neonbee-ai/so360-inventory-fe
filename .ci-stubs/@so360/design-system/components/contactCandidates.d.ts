import type { ContactSelection, ContactSelectorMode } from './ContactMultiSelector';
/**
 * Resolves the Core API base URL — shell-injected window global first (so a
 * pre-built remoteEntry.js reaches the right host without a rebuild), then
 * this MFE's own build-time env, then a hostname-based fallback, then
 * localhost.
 *
 * `import.meta.env.VITE_SO360_CORE_API` is read as a LITERAL: Vite only
 * substitutes the exact text, and an optional chain or cast in the middle
 * silently ships the localhost fallback to production.
 */
export declare function resolveCoreApiUrl(): string;
/**
 * CRM API base — same precedence as Core. Note crm-be has NO /v1 global
 * prefix, so paths are appended bare.
 */
export declare function resolveCrmApiUrl(): string;
/** Which module is reading. Core applies that module's own privacy policy. */
export type ContactSurface = 'support' | 'inbox';
export type CandidateGroup = 'thread' | 'saved' | 'company' | 'account';
export declare const GROUP_LABEL: Record<CandidateGroup, string>;
export interface ContactCandidate {
    id: string;
    source: ContactSelection['contact_source'];
    name: string;
    email: string;
    phone?: string | null;
    subtitle?: string | null;
    group?: CandidateGroup;
}
export interface FetchCandidatesInput {
    mode: ContactSelectorMode;
    orgId: string;
    tenantId?: string;
    partnerId?: string | null;
    leadId?: string | null;
    companyPeopleEnabled?: boolean;
    search?: string;
    surface?: ContactSurface;
}
export declare const contactAuthHeaders: (orgId: string, tenantId?: string) => {
    'X-Tenant-Id': string;
    'X-Org-Id': string;
    Authorization: string;
};
/**
 * The people a picker may offer, for either side of a customer's correspondence.
 *
 * Internal mode reads the org directory. Client mode merges three sources,
 * because any one alone leaves a dead end: the contacts already saved on the
 * customer, everyone CRM knows at the same company, and the address the
 * customer record itself was created with. Saved rows win the dedupe so a
 * person already chosen never reappears as "new".
 *
 * Throws when nothing could be read; a partial outage (CRM down) costs only
 * that section.
 */
export declare function fetchContactCandidates(input: FetchCandidatesInput): Promise<ContactCandidate[]>;
