import React from 'react';
import { type ContactSurface } from './contactCandidates';
/**
 * Who a customer's correspondence goes to, as two rows of circle avatars.
 *
 * The same interaction Support's ticket header uses for watchers, applied to
 * the per-CUSTOMER lists Inbox keeps in Core (party_contacts): pick a name,
 * the circle appears; click the ⊗, they are gone. Every action commits on the
 * click that expresses it — there is no Save button to forget.
 *
 * The two rows are NOT variants of each other:
 *   Client recipients — people at the customer. Amber ring. They receive mail.
 *   Watchers          — our colleagues. Slate ring. They are told, never Cc'd.
 *
 * A glance at the ring colour says whether the customer can see who is on it.
 */
export interface CommunicationContactsAvatarsProps {
    /** The customer these contacts belong to (Core partner id). */
    partnerId?: string | null;
    orgId: string;
    tenantId?: string;
    /** Shown when there is no customer to configure — differs per surface. */
    unlinkedHint?: string;
    className?: string;
    readOnly?: boolean;
    /** Fired after any add or remove has been written. */
    onChanged?: () => void;
    /**
     * Addresses seen on this conversation's inbound email (To/Cc) that are not
     * yet saved on the customer — offered as one-click additions, never added
     * silently.
     */
    suggestedClientEmails?: string[];
    /** The CRM lead this customer is anchored on; enables company suggestions. */
    leadId?: string | null;
    /** Feature gate for the company suggestions. Default on. */
    companyPeopleEnabled?: boolean;
    /** Whether the customer-side row is shown at all. Default on. */
    showClientRecipients?: boolean;
    /** Whether a brand-new address may be recorded as a CRM stakeholder. */
    allowCreateContact?: boolean;
    /**
     * Which module is reading. Core masks customer-side rows under THAT
     * module's privacy setting (Support's or Inbox's), so a masked Support
     * never forces a masked Inbox and vice versa.
     */
    surface?: ContactSurface;
    /**
     * 'card'   — bordered panel with headings and hints (Contact360 sidebar).
     * 'inline' — one bare row, `LABEL ●●● ⊕` per group, for a header strip.
     *            No card, no hints; with no customer it renders nothing and the
     *            host decides what to say. Thread addresses become a picker
     *            group ("On this thread") instead of a suggestion box.
     */
    variant?: 'card' | 'inline';
}
export declare const CommunicationContactsAvatars: React.FC<CommunicationContactsAvatarsProps>;
