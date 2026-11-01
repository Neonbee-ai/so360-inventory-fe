/**
 * Inline text validation shared by create forms: trim + required, max length,
 * and an invalid-format check (control characters / angle brackets).
 * Returns the message for the field's `error` prop, or undefined when valid.
 */
// eslint-disable-next-line no-control-regex
const INVALID_CHARS = /[\u0000-\u001F\u007F<>]/;

export function validateText(
  label: string,
  value: string | null | undefined,
  opts: { required?: boolean; max?: number } = {},
): string | undefined {
  const { required = true, max = 120 } = opts;
  const v = (value ?? '').trim();
  if (!v) return required ? `${label} is required.` : undefined;
  if (v.length > max) return `${label} must be at most ${max} characters.`;
  if (INVALID_CHARS.test(v)) return `${label} is invalid: remove special characters such as < or >.`;
  return undefined;
}
