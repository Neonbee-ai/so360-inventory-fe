/**
 * BDD spec — Inline (page-level) modal panels are height-capped for internal scroll.
 *
 * Pages used to render their own modal panel inline; they now use the shared
 * design-system Modal/ConfirmDialog, which cap height and scroll internally. Those panels live deep inside conditional state (showForm,
 * showDeleteConfirm, etc.) and the rest of the suite deliberately stubs the
 * Modal/page internals, so rendering them in their open state is fragile.
 *
 * This spec reads each page source and asserts it uses the DS overlay and no
 * hand-built `fixed inset-0` panel, so the height cap cannot regress.
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

describe('Given the inventory MFE modal panels', () => {
  for (const { name, file, minPanels } of cases) {
    describe(`Given ${name}`, () => {
      it('When the overlay is defined / Then it uses the design-system Modal or ConfirmDialog (which own the height cap and internal scroll) and no hand-built fixed overlay', () => {
        const src = read(file);
        const dsOverlays = (src.match(/<(Modal|ConfirmDialog|Drawer)\b/g) ?? []).length;
        expect(dsOverlays).toBeGreaterThanOrEqual(minPanels);
        expect(src).not.toContain('fixed inset-0');
      });
    });
  }
});
