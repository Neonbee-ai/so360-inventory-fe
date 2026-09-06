/**
 * Normalizes an Item Name into an uppercase, alphanumeric + hyphen SKU.
 *
 * Rules:
 * - Converts to uppercase.
 * - Trims leading/trailing whitespace.
 * - Replaces '/', '\', and '_' with '-'.
 * - Replaces whitespace sequences with '-'.
 * - Strips all characters except A-Z, 0-9, and '-'.
 * - Collapses consecutive hyphens into a single hyphen.
 * - Strips leading and trailing hyphens.
 *
 * Examples:
 *   "ABC Office Chair"           -> "ABC-OFFICE-CHAIR"
 *   "Office Chair (Black)"       -> "OFFICE-CHAIR-BLACK"
 *   "LED Light 24W / Cool White" -> "LED-LIGHT-24W-COOL-WHITE"
 *   "  --Desk __ Pro--  "        -> "DESK-PRO"
 */
export function generateSkuFromName(name: string): string {
    if (!name) return '';
    return name
        .toUpperCase()
        .trim()
        .replace(/[/\\_]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^A-Z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}
