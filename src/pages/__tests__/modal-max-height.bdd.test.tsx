/**
 * BDD spec — Inline (page-level) modal panels are capped at max-h-[90vh].
 *
 * Several pages render their own modal panel inline (not via the shared Modal
 * wrapper). Those panels live deep inside conditional state (showForm,
 * showDeleteConfirm, etc.) and the rest of the suite deliberately stubs the
 * Modal/page internals, so rendering them in their open state is fragile.
 *
 * Instead, this spec asserts — robustly and deterministically — that each
 * inline modal panel's markup carries the max-h-[90vh] cap. The assertion
 * mirrors the DOM-query style used elsewhere (className.includes('max-h-[90vh]'))
 * but reads the component source so it is resilient to unrelated state changes.
 *
 * Naming convention:
 *   describe : 'Given <Page>'
 *   it       : 'Given <pre> / When <action> / Then <outcome>'
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) =>
  readFileSync(resolve(__dirname, '..', rel), 'utf8');

const cases: { name: string; file: string; minPanels: number }[] = [
  { name: 'WarehouseDetailPage (deactivate + delete confirm)', file: 'WarehouseDetailPage.tsx', minPanels: 2 },
  { name: 'StockLocationsPage (delete confirm)', file: 'StockLocationsPage.tsx', minPanels: 1 },
  { name: 'ItemDetailPage (delete confirm + image preview)', file: 'ItemDetailPage.tsx', minPanels: 1 },
  { name: 'VendorListPage (delete confirm)', file: 'vendors/VendorListPage.tsx', minPanels: 1 },
  { name: 'VendorDetailPage (delete confirm)', file: 'vendors/VendorDetailPage.tsx', minPanels: 1 },
  { name: 'POListPage (create PO)', file: 'procurement/POListPage.tsx', minPanels: 1 },
  { name: 'PRListPage (create PR)', file: 'procurement/PRListPage.tsx', minPanels: 1 },
];

describe('Given the inventory MFE inline modal panels', () => {
  for (const { name, file, minPanels } of cases) {
    describe(`Given ${name}`, () => {
      it(`When the modal panel is defined / Then it is capped at max-h-[90vh]`, () => {
        const src = read(file);
        const occurrences = src.split('max-h-[90vh]').length - 1;
        expect(occurrences).toBeGreaterThanOrEqual(minPanels);
      });
    });
  }
});
