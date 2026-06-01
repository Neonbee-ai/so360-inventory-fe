/**
 * poToDocumentData — BDD specs.
 *
 * Maps a Purchase Order into the shared DocumentData contract for printing
 * through the org's Core template. Invariants:
 *   - number/date map straight; expected_delivery_date → due_date; pr_id → po_reference
 *   - issuing org is the seller (from opts); vendor is the buyer
 *   - line amount = qty * unit_price; item name + sku fold into description
 *   - totals prefer server values, fall back to summing the lines
 */

import { describe, it, expect } from 'vitest';
import { poToDocumentData } from './poToDocumentData';

const SELLER = { name: 'Naiz Trading LLC' };

function basePO(overrides: Record<string, any> = {}) {
    return {
        po_number: 'PO-001',
        status: 'sent',
        created_at: '2026-06-01',
        expected_delivery_date: '2026-06-15',
        total_amount: 210,
        subtotal_amount: 200,
        tax_amount: 10,
        vendor: { name: 'Acme Supplies', contact_email: 'acme@example.com' },
        po_lines: [],
        ...overrides,
    };
}

describe('poToDocumentData > header & references', () => {
    it('Given a PO, Then title/number/date map through', () => {
        const d = poToDocumentData(basePO(), { currency: 'AED', seller: SELLER });
        expect(d.document_title).toBe('Purchase Order');
        expect(d.document_number).toBe('PO-001');
        expect(d.date).toBe('2026-06-01');
        expect(d.currency).toBe('AED');
        expect(d.seller).toBe(SELLER);
    });

    it('Given an expected delivery date, Then it maps to due_date', () => {
        const d = poToDocumentData(basePO(), { currency: 'AED', seller: SELLER });
        expect(d.due_date).toBe('2026-06-15');
    });

    it('Given a pr_id, Then it maps to po_reference', () => {
        const d = poToDocumentData(basePO({ pr_id: 'PR-9' }), { currency: 'AED', seller: SELLER });
        expect(d.po_reference).toBe('PR-9');
    });

    it('Given no pr_id, Then po_reference is undefined', () => {
        const d = poToDocumentData(basePO(), { currency: 'AED', seller: SELLER });
        expect(d.po_reference).toBeUndefined();
    });
});

describe('poToDocumentData > buyer (vendor)', () => {
    it('Given a vendor, Then it is the buyer with email', () => {
        const d = poToDocumentData(basePO(), { currency: 'AED', seller: SELLER });
        expect(d.buyer.name).toBe('Acme Supplies');
        expect(d.buyer.email).toBe('acme@example.com');
    });

    it('Given no vendor, Then buyer name falls back to a dash', () => {
        const d = poToDocumentData(basePO({ vendor: undefined }), { currency: 'AED', seller: SELLER });
        expect(d.buyer.name).toBe('—');
    });
});

describe('poToDocumentData > line items', () => {
    it('Given a line with item name and sku, Then description folds both and amount = qty * unit_price', () => {
        const d = poToDocumentData(
            basePO({ po_lines: [{ items: { name: 'Widget', sku: 'WGT-1' }, quantity: 3, unit_price: 100, tax_rate: 5 }] }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items).toHaveLength(1);
        expect(d.line_items[0]).toMatchObject({ description: 'Widget (WGT-1)', qty: 3, unit_price: 100, tax_rate: 5, amount: 300 });
    });

    it('Given a line with only a description and no sku, Then description uses it without parentheses', () => {
        const d = poToDocumentData(
            basePO({ po_lines: [{ description: 'Freeform item', quantity: 1, unit_price: 50 }] }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items[0].description).toBe('Freeform item');
    });

    it('Given a line missing qty/unit_price, Then amount is 0', () => {
        const d = poToDocumentData(
            basePO({ po_lines: [{ items: { name: 'X' } }] }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items[0].amount).toBe(0);
    });
});

describe('poToDocumentData > totals', () => {
    it('Given server-computed totals, Then they are used as-is', () => {
        const d = poToDocumentData(basePO(), { currency: 'AED', seller: SELLER });
        expect(d.subtotal).toBe(200);
        expect(d.tax_amount).toBe(10);
        expect(d.total).toBe(210);
    });

    it('Given no server totals, Then subtotal/tax fall back to summing the lines', () => {
        const d = poToDocumentData(
            basePO({
                subtotal_amount: 0,
                tax_amount: 0,
                total_amount: 0,
                po_lines: [
                    { quantity: 2, unit_price: 100, tax_amount: 8 },
                    { quantity: 1, unit_price: 50, tax_amount: 4 },
                ],
            }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.subtotal).toBe(250);
        expect(d.tax_amount).toBe(12);
        expect(d.total).toBe(262);
    });
});
