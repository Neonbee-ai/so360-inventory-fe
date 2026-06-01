/**
 * BDD Spec — itemTypes classification catalog
 *
 * Covers: the full set of selectable item classifications, including the
 * newly-added 'bundle' type, so the Items module can register bundles.
 */

import { describe, it, expect } from 'vitest';
import { ITEM_CLASSIFICATIONS } from './itemTypes';

describe('Given the item classification catalog', () => {
  describe('When the supported classifications are enumerated', () => {
    it('Then it includes every ERP-style type the Items screen must register', () => {
      const values = ITEM_CLASSIFICATIONS.map(c => c.value).sort();
      expect(values).toEqual(
        ['bundle', 'consumable', 'finished_good', 'fixed_asset', 'product', 'raw_material', 'service'].sort()
      );
    });

    it('Then "bundle" is offered as a selectable classification with a label and description', () => {
      const bundle = ITEM_CLASSIFICATIONS.find(c => c.value === 'bundle');
      expect(bundle).toBeDefined();
      expect(bundle?.label).toBe('Bundle');
      expect(bundle?.description.length).toBeGreaterThan(0);
    });

    it('Then every classification exposes a label, description and icon', () => {
      for (const c of ITEM_CLASSIFICATIONS) {
        expect(c.label.length).toBeGreaterThan(0);
        expect(c.description.length).toBeGreaterThan(0);
        expect(c.icon).toBeTruthy();
      }
    });
  });
});
