/**
 * Normalize any thrown value — axios errors, Nest error bodies (string or
 * ValidationPipe array), fetch-wrapper `Error`s, plain strings — into one
 * user-displayable sentence. Server-provided messages win over transport noise.
 */
export declare function getErrorMessage(err: unknown, fallback?: string): string;
