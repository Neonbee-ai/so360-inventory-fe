/**
 * The caller's Supabase access token, wherever it actually lives.
 *
 * `sb-access-token` is a LEGACY key that only some MFEs ever wrote. Supabase-js
 * stores the session as JSON under `sb-<project-ref>-auth-token`, so a
 * component that reads the legacy key alone gets null in the shell, sends
 * `Authorization: Bearer ` with nothing after it, and every request it makes
 * comes back 401 — which looks like a permissions problem rather than a
 * missing token.
 *
 * Mirrors shell-context's getAccessTokenFromStorage. Duplicated rather than
 * imported because this package does not depend on shell-context, and adding
 * that dependency to a package bundled into every MFE is a bigger change than
 * the fifteen lines it would save.
 */
export declare function getAccessToken(): string;
