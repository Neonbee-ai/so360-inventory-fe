/**
 * Identity for a contact that exists nowhere but here.
 *
 * `party_contacts.contact_id` is a uuid column, and the row's identity is
 * (party, contact_source, contact_id). A manually entered address has no
 * record anywhere to point at, so its id is derived from the address itself:
 * deterministic, so the same person typed twice dedupes on the unique index
 * rather than saving twice; case- and whitespace-insensitive, so
 * "Sara@X.com " and "sara@x.com" are one person.
 *
 * The earlier scheme stored the lowercased email as the id — a 22P02 the
 * moment Postgres tried to cast it. Four FNV-1a passes with distinct seeds
 * give 128 bits; the version/variant nibbles are set so the value reads as a
 * name-based (v5-style) uuid. Collision resistance is that of a 122-bit
 * non-cryptographic hash, which is ample for one customer's contact list.
 */
export declare function manualContactId(email: string): string;
