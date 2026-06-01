import type { DocumentData, DocumentLineItem, DocumentParty } from '@so360/shell-context';

interface POLine {
    description?: string;
    quantity?: number;
    unit_price?: number;
    tax_rate?: number;
    tax_amount?: number;
    items?: { name?: string; sku?: string };
}

interface PO {
    po_number: string;
    status?: string;
    created_at: string;
    expected_delivery_date?: string;
    pr_id?: string;
    total_amount?: number;
    subtotal_amount?: number;
    tax_amount?: number;
    vendor?: { name?: string; contact_email?: string };
    po_lines?: POLine[];
}

function lineLabel(line: POLine): string {
    const name = line.items?.name || line.description || '—';
    const sku = line.items?.sku;
    return sku ? `${name} (${sku})` : name;
}

function lineToDocumentItem(line: POLine): DocumentLineItem {
    const qty = line.quantity ?? 0;
    const unitPrice = line.unit_price ?? 0;
    return {
        description: lineLabel(line),
        qty: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
        amount: qty * unitPrice,
    };
}

/**
 * Maps a Purchase Order into the shared DocumentData contract for printing
 * through the org's Core template via shell.printDocument().
 *
 * The issuing org is the seller (its letterhead heads the document); the vendor
 * is the counterparty (buyer). Totals prefer server-computed values and fall
 * back to summing the lines — matching the legacy inline print.
 */
export function poToDocumentData(
    po: PO,
    opts: { currency: string; seller: DocumentParty },
): DocumentData {
    const lines: POLine[] = po.po_lines || [];

    const subtotal = po.subtotal_amount != null && po.subtotal_amount > 0
        ? po.subtotal_amount
        : lines.reduce((sum, line) => sum + (line.quantity ?? 0) * (line.unit_price ?? 0), 0);

    const tax = po.tax_amount != null && po.tax_amount > 0
        ? po.tax_amount
        : lines.reduce((sum, line) => sum + (line.tax_amount || 0), 0);

    const total = po.total_amount || subtotal + tax;

    return {
        document_title: 'Purchase Order',
        document_number: po.po_number,
        date: po.created_at,
        due_date: po.expected_delivery_date,
        po_reference: po.pr_id || undefined,
        currency: opts.currency,
        seller: opts.seller,
        buyer: {
            name: po.vendor?.name || '—',
            email: po.vendor?.contact_email,
        },
        line_items: lines.map(lineToDocumentItem),
        subtotal,
        tax_amount: tax,
        total,
    };
}
