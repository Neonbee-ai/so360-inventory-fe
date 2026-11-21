/**
 * Indian tax identifiers (GSTIN / PAN) — the one normaliser and validator the
 * vendor create, update, draft and activation paths share (Pulse 086d33b1).
 * The inventory BE holds the authoritative copy in
 * `so360-inventory-be/src/vendors/tax-identifiers.ts`; keep the two in step.
 *
 * GSTIN layout (CBIC): 2-digit state code, the 10-character PAN, the entity
 * number for that PAN in the state, the default `Z`, and a mod-36 check
 * character. A format/consistency pass is not verification by the GST portal.
 */

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const GSTIN_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Whitespace anywhere (incl. NBSP) plus zero-width characters that copy/paste
// from PDFs, e-mails and the GST portal carry along. None is meaningful in a
// GSTIN or PAN, and an invisible one makes two equal-looking values differ.
const INVISIBLE_OR_SPACE = /[\s ​-‍⁠﻿]/g;

/** Upper-case and strip whitespace/invisible characters; null when empty. */
export function normalizeTaxId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const t = value.replace(INVISIBLE_OR_SPACE, "").toUpperCase();
  return t === "" ? null : t;
}

/** The mod-36 check character the first 14 GSTIN characters require. */
export function gstinCheckChar(first14: string): string | null {
  if (first14.length < 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARSET.indexOf(first14[i]);
    if (v < 0) return null;
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARSET[(36 - (sum % 36)) % 36];
}

/** The PAN embedded in a GSTIN (characters 3–12), or null. */
export function embeddedPan(gstin: string | null): string | null {
  const g = normalizeTaxId(gstin);
  return g && g.length >= 12 ? g.slice(2, 12) : null;
}

export type TaxIdField = "gst_number" | "pan_number";
export interface TaxIdIssue {
  field: TaxIdField;
  code: "gstin_format" | "gstin_checksum" | "pan_format" | "pan_mismatch";
  message: string;
}

export const TAX_ID_MESSAGES = {
  gstin_format: "Enter a valid 15-character GSTIN.",
  gstin_checksum:
    "This GSTIN's last character does not match its check digit. Please re-check the GSTIN.",
  pan_format: "Enter a valid 10-character PAN.",
} as const;

export function panMismatchMessage(gstin: string): string {
  return `The PAN entered does not match the PAN embedded in this GSTIN (${embeddedPan(gstin)}). Please verify both values.`;
}

/** Format of one GSTIN; `checksum: false` only for an unchanged legacy value. */
export function gstinIssue(
  gstin: string | null,
  opts: { checksum?: boolean } = {},
): TaxIdIssue | null {
  if (!gstin) return null;
  if (!GSTIN_RE.test(gstin)) {
    return { field: "gst_number", code: "gstin_format", message: TAX_ID_MESSAGES.gstin_format };
  }
  if (opts.checksum !== false && gstinCheckChar(gstin) !== gstin[14]) {
    return { field: "gst_number", code: "gstin_checksum", message: TAX_ID_MESSAGES.gstin_checksum };
  }
  return null;
}

export function panIssue(pan: string | null): TaxIdIssue | null {
  if (!pan) return null;
  return PAN_RE.test(pan)
    ? null
    : { field: "pan_number", code: "pan_format", message: TAX_ID_MESSAGES.pan_format };
}

/**
 * Format of each value, then — only once both are well-formed — the exact
 * match of the GSTIN's embedded PAN against the PAN. Inputs must already be
 * normalised. Returns every issue so a form can mark each field.
 */
export function taxIdIssues(
  gstin: string | null,
  pan: string | null,
  opts: { checksum?: boolean } = {},
): TaxIdIssue[] {
  const issues = [gstinIssue(gstin, opts), panIssue(pan)].filter(
    (i): i is TaxIdIssue => i !== null,
  );
  if (issues.length === 0 && gstin && pan && embeddedPan(gstin) !== pan) {
    issues.push({ field: "pan_number", code: "pan_mismatch", message: panMismatchMessage(gstin) });
  }
  return issues;
}
