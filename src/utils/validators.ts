/**
 * Master-data text rules for Inventory (frontend half).
 *
 * Mirrors `so360-inventory-be/src/common/validation/business-text.validator.ts`.
 * Keep the two in step: this copy exists only to put an error next to the field
 * while the user types — the backend copy is what protects the database, and a
 * payload that slips past this one still has to survive that one.
 *
 * Every function returns `null` when the value is acceptable, or a
 * user-facing message when it is not, so a form can do:
 *
 *   const err = validateName(form.name, 'Warehouse Name');
 */

const LETTER = /\p{L}/u;
const ALNUM = /[\p{L}\p{N}]/u;

const NAME_CHARSET = /^[\p{L}\p{N}\s\-_&.,/()'"+#]+$/u;
const CODE_CHARSET = /^[\p{L}\p{N}][\p{L}\p{N}\-_]*$/u;
const REFERENCE_CHARSET = /^[\p{L}\p{N}\s\-_/#.,&()']+$/u;
const PERSON_CHARSET = /^[\p{L}\s\-.']+$/u;
const ADDRESS_CHARSET = /^[\p{L}\p{N}\s\-_/#.,&()']+$/u;

export type ValidationResult = string | null;

/**
 * Parentheses are legitimate in a name ("Chair (Black)") but unbalanced ones
 * never are — `OIU((T` is a keyboard mash, not a product. Checking the balance
 * separates the two without banning the character outright.
 */
export function hasBalancedParens(value: string): boolean {
    let depth = 0;
    for (const ch of value) {
        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth < 0) return false;
        }
    }
    return depth === 0;
}

/** Required display name: ≥ `min` chars, at least one letter, no symbol soup. */
export function validateName(
    value: string,
    label = 'Name',
    min = 3,
    max = 100,
): ValidationResult {
    const v = (value || '').trim();
    if (!v) return `${label} is required.`;
    if (v.length < min) return `${label} must contain at least ${min} characters.`;
    if (v.length > max) return `${label} must be ${max} characters or fewer.`;
    if (!LETTER.test(v)) return `${label} must contain letters, not only numbers or symbols.`;
    if (!hasBalancedParens(v)) return `${label} contains invalid characters.`;
    if (!NAME_CHARSET.test(v)) return `${label} contains invalid characters.`;
    return null;
}

/** Required short code: alphanumeric start, hyphen/underscore allowed. */
export function validateCode(
    value: string,
    label = 'Code',
    min = 2,
    max = 20,
): ValidationResult {
    const v = (value || '').trim();
    if (!v) return `${label} is required.`;
    if (v.length < min) return `${label} must contain at least ${min} characters.`;
    if (v.length > max) return `${label} must be ${max} characters or fewer.`;
    if (!ALNUM.test(v)) return `${label} cannot contain only special characters.`;
    if (!CODE_CHARSET.test(v)) {
        return `${label} may contain only letters, numbers, hyphens and underscores.`;
    }
    return null;
}

/** Audit reference / party name. Free-form, but never symbols alone. */
export function validateReference(
    value: string,
    label = 'Reference',
): ValidationResult {
    const v = (value || '').trim();
    if (!v) return `${label} is required.`;
    if (v.length < 2) return `${label} must contain at least 2 characters.`;
    if (v.length > 60) return `${label} must be 60 characters or fewer.`;
    if (!ALNUM.test(v)) return `${label} contains invalid characters.`;
    if (!REFERENCE_CHARSET.test(v)) return `${label} contains invalid characters.`;
    return null;
}

/** Human name — letters and name punctuation only. */
export function validatePersonName(
    value: string,
    label = 'Contact person',
): ValidationResult {
    const v = (value || '').trim();
    if (!v) return `${label} is required.`;
    if (v.length < 2) return `Enter a valid ${label.toLowerCase()}.`;
    if (v.length > 80) return `${label} must be 80 characters or fewer.`;
    if (!PERSON_CHARSET.test(v) || !LETTER.test(v)) {
        return `Enter a valid ${label.toLowerCase()} (letters only).`;
    }
    return null;
}

/** City / state / country — same shape as a person name. */
export function validatePlaceName(
    value: string,
    label = 'City',
): ValidationResult {
    const v = (value || '').trim();
    if (!v) return `${label} is required.`;
    if (v.length < 2 || v.length > 80 || !PERSON_CHARSET.test(v) || !LETTER.test(v)) {
        return `Please enter a valid ${label.toLowerCase()} name.`;
    }
    return null;
}

/** Street address — free-form, but must contain a letter. */
export function validateAddress(
    value: string,
    label = 'Street address',
): ValidationResult {
    const v = (value || '').trim();
    if (!v) return `${label} is required.`;
    if (v.length < 3 || v.length > 200) return `Enter a valid ${label.toLowerCase()}.`;
    if (!LETTER.test(v) || !ADDRESS_CHARSET.test(v)) {
        return `Enter a valid ${label.toLowerCase()}.`;
    }
    return null;
}

/** Phone — optional +, 7–15 digits. */
export function validatePhone(
    value: string,
    label = 'Contact phone',
): ValidationResult {
    const v = (value || '').trim();
    if (!v) return `${label} is required.`;
    if (!/^\+?[\d\s\-()]+$/.test(v)) return 'Enter a valid phone number.';
    const digits = v.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return 'Enter a valid phone number.';
    return null;
}

const BARCODE_LENGTHS = [8, 12, 13, 14];

/** Retail barcode — digits only, EAN-8 / UPC-A / EAN-13 / ITF-14 length. */
export function validateBarcode(value: string): ValidationResult {
    const v = (value || '').trim();
    if (!v) return null; // optional
    if (!/^\d+$/.test(v)) return 'Enter a valid barcode (digits only).';
    if (!BARCODE_LENGTHS.includes(v.length)) {
        return 'Barcode must be 8, 12, 13 or 14 digits.';
    }
    return null;
}

/** SKU — a code, 2–40 chars. */
export function validateSku(value: string): ValidationResult {
    return validateCode(value, 'SKU', 2, 40);
}

/** Optional variant: blank passes, anything present must be valid. */
export function optional(
    value: string,
    validator: (v: string) => ValidationResult,
): ValidationResult {
    return (value || '').trim() ? validator(value) : null;
}

/** Collapse a field→error map to the first message, or null when clean. */
export function firstError(
    errors: Record<string, ValidationResult>,
): string | null {
    for (const key of Object.keys(errors)) {
        if (errors[key]) return errors[key];
    }
    return null;
}

/** True when no field in the map carries an error. */
export function isClean(errors: Record<string, ValidationResult>): boolean {
    return firstError(errors) === null;
}
