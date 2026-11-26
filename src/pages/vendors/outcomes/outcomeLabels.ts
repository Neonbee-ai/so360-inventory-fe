export const EXCEPTION_LABELS: Record<string, string> = {
  missing_vendor: 'Receipt has no vendor',
  vendor_mismatch: 'Receipt vendor differs from the PO vendor',
  unmatched_po_line: 'Receipt line does not match a PO line',
  duplicate_event: 'Duplicate delivery',
  unknown_vendor: 'Vendor not found',
  stale_version: 'Outdated update ignored',
};

export const SOURCE_LABELS: Record<string, string> = {
  grn_line: 'Receipt',
  grn_line_reversal: 'Receipt reversal',
  supplier_return_line: 'Supplier return',
  qc_line: 'Inspection',
  shipment: 'Shipment',
};

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
