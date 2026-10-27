/**
 * Shared avatar tokens for people circles.
 *
 * Lifted from Support's ticket header so the owner circle, the watcher
 * circles and the Inbox recipient circles all derive initials and colour the
 * same way — the same colleague appearing as a different colour in two
 * modules reads as two different people.
 */
/** Up to two letters, from a name if we have one, else the address. */
export declare const initialsOf: (label: string) => string;
/** Stable per-person tint, so the same person keeps the same circle. */
export declare const tintFor: (key: string) => string;
