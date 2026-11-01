import React from 'react';
/** Role names agreed with Core (party_contacts.role). */
export declare const CLIENT_RECIPIENT_ROLE = "support_client_recipient";
export declare const INTERNAL_WATCHER_ROLE = "support_internal_watcher";
export interface CommunicationContactsPanelProps {
    /** The customer these contacts belong to (Core partner id). */
    partnerId?: string | null;
    orgId: string;
    tenantId?: string;
    /** Shown when there is no customer to configure — differs per surface. */
    unlinkedHint?: string;
    className?: string;
    readOnly?: boolean;
    onSaved?: () => void;
    /**
     * Addresses seen on this conversation's inbound email (To/Cc) that are not
     * yet saved on the customer.
     *
     * A client who copies two colleagues has already told us who should be on
     * the thread; making someone re-type those addresses into a picker is how a
     * contact list stays empty. Offered as one-click additions rather than added
     * silently — a one-off Cc (an assistant, a broker) must not become a
     * permanent recipient on every future email.
     */
    suggestedClientEmails?: string[];
    /**
     * The CRM lead this customer is anchored on. Enables the "at this company"
     * suggestions and, with `allowCreateContact`, lets a brand-new address be
     * recorded as a stakeholder on that lead so CRM learns the person.
     */
    leadId?: string | null;
    /** Feature gate for the company suggestions. Default on. */
    companyPeopleEnabled?: boolean;
    /**
     * Whether the customer-side recipient picker is shown. Inbox owns who on the
     * CUSTOMER's side is written to — it is the module that holds the thread and
     * the consent for it. Support passes false and shows watchers only: an agent
     * on a ticket decides who on OUR side gets told, not who the customer's mail
     * goes to.
     *
     * Hiding it does not drop the saved recipients: they are still loaded and
     * re-sent on save, so a Support-side save never deletes what Inbox set.
     */
    showClientRecipients?: boolean;
    /**
     * Whether a new address may be written to CRM as a stakeholder. Inbox
     * passes true; Support passes false — creating CRM records from a ticket is
     * a bigger consent question than from a conversation the customer started.
     * Off, or without a lead, new addresses are saved as manual contacts only.
     */
    allowCreateContact?: boolean;
}
/**
 * Who this customer's ticket correspondence goes to.
 *
 * Deliberately per-CUSTOMER, not per-channel. The channel-level boxes this
 * replaces held one sender name and one comma-separated internal list that
 * applied to every customer the channel ever talked to — so an account with
 * its own billing contact and its own account manager could not be expressed
 * at all.
 *
 * Rendered wherever a customer is in context (a Support ticket, an Inbox
 * conversation) rather than in a settings screen, because the moment you
 * discover the wrong person is being emailed is the moment you are looking at
 * their ticket.
 */
export declare const CommunicationContactsPanel: React.FC<CommunicationContactsPanelProps>;
