import React from 'react';
import { resolveCrmApiUrl } from './contactCandidates';
export { resolveCrmApiUrl };
/** One chosen contact, in the shape the party_contacts API stores. */
export interface ContactSelection {
    /** Identity within `contact_source`. */
    contact_id: string;
    contact_source: 'crm_lead' | 'core_user' | 'people_connect' | 'manual';
    contact_name: string;
    contact_email: string;
    contact_phone?: string | null;
}
export type ContactSelectorMode = 'client' | 'internal';
export interface ContactMultiSelectorProps {
    /**
     * 'client'  — people on the CUSTOMER's side, from that customer's CRM
     *             contacts. Requires `partnerId`.
     * 'internal'— people on OUR side, from the org directory (Core users, plus
     *             People Connect where the org has it).
     */
    mode: ContactSelectorMode;
    value: ContactSelection[];
    onChange: (contacts: ContactSelection[]) => void;
    orgId: string;
    tenantId?: string;
    /** The customer. Required for 'client' mode; ignored for 'internal'. */
    partnerId?: string;
    /**
     * The CRM lead this customer is anchored on. With it (or, failing that,
     * `partnerId`), client mode also offers everyone CRM knows at the same
     * company — stakeholders and sibling leads — not only the contacts already
     * saved on the partner. That is the difference between "nobody added yet"
     * and an empty box.
     */
    leadId?: string | null;
    /** Gate for the company-people source (feature flag). Default on. */
    companyPeopleEnabled?: boolean;
    /**
     * Offered when the typed text is an address nobody in the list has. Returns
     * the selection to add, or null to add nothing. The caller decides what
     * "new contact" means — a CRM stakeholder, a manual entry, or a refusal.
     */
    onAddNewEmail?: (email: string) => Promise<ContactSelection | null>;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    emptyHint?: string;
}
/**
 * Pick the people a specific customer's correspondence goes to.
 *
 * Two modes rather than two components because the interaction is identical
 * and only the source differs — and keeping them together is what stops the
 * customer-side and internal-side pickers drifting apart in behaviour, which
 * is precisely the kind of drift that ends with someone emailing an internal
 * note to a client.
 *
 * Selections carry a NAME AND EMAIL SNAPSHOT alongside the foreign id. The
 * send path must be able to address a notification without a cross-service
 * call, and a contact deleted in CRM should degrade to a stale address, not a
 * notification that silently goes nowhere.
 */
export declare const ContactMultiSelector: React.FC<ContactMultiSelectorProps>;
