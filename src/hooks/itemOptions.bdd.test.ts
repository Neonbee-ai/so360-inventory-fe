import { describe, it, expect } from 'vitest';
import {
  ITEM_OPTIONS_FLAG,
  appliesSummary,
  attachItem,
  detachItem,
  detachWouldWiden,
  emptyGroup,
  emptyOption,
  groupBody,
  groupLinkForItem,
  isCaptureFieldsEnabled,
  isItemOptionsEnabled,
  picksSummary,
  setOptionPatch,
  toKey,
  validateGroup,
} from './itemOptions';

const group = (over: any = {}) => ({ ...emptyGroup(), name: 'Cut', ...over });

describe('item options helpers', () => {
  describe('Given the shell flags', () => {
    it('When the item options flag is on Then options are enabled', () => {
      const shell = { isFeatureEnabled: (k: string) => k === ITEM_OPTIONS_FLAG };
      expect(isItemOptionsEnabled(shell)).toBe(true);
      expect(isCaptureFieldsEnabled(shell)).toBe(false);
    });
    it('When there is no shell Then everything is off', () => {
      expect(isItemOptionsEnabled(undefined)).toBe(false);
      expect(isCaptureFieldsEnabled(null)).toBe(false);
    });
  });

  describe('Given a group draft', () => {
    it('When it has no name Then validation asks for one', () => {
      expect(validateGroup(group({ name: ' ' }))).toBe('Group name is required.');
    });
    it('When every value is unnamed Then validation asks for a value', () => {
      expect(validateGroup(group())).toBe('Add at least one value.');
    });
    it('When max picks is below min picks Then validation rejects it', () => {
      const g = group({ selection: 'multi', min_select: 3, max_select: 2, options: [{ ...emptyOption(), name: 'A' }] });
      expect(validateGroup(g)).toBe('Max picks must be at least min picks.');
    });
    it('When a single-pick group has two defaults Then validation rejects it', () => {
      const g = group({ options: [{ ...emptyOption(), name: 'A', is_default: true }, { ...emptyOption(1), name: 'B', is_default: true }] });
      expect(validateGroup(g)).toBe('Only one default is allowed for a single-pick group.');
    });
  });

  describe('Given a group being saved', () => {
    it('When it is single and required Then min=1, max=1, blank values dropped and re-ordered, ids stripped', () => {
      const g = group({
        name: '  Cut ',
        is_required: true,
        options: [
          { ...emptyOption(5), id: 'o1', name: ' Small ', price_delta: '2' as any },
          { ...emptyOption(6), name: '' },
          { ...emptyOption(7), id: 'o3', name: 'Large', price_mode: 'per_unit' },
        ],
      });
      const body = groupBody(g);
      expect(body.name).toBe('Cut');
      expect(body.min_select).toBe(1);
      expect(body.max_select).toBe(1);
      expect(body.options).toEqual([
        { name: 'Small', price_delta: 2, price_mode: 'fixed', is_default: false, sort_order: 0, is_active: true },
        { name: 'Large', price_delta: 0, price_mode: 'per_unit', is_default: false, sort_order: 1, is_active: true },
      ]);
    });
    it('When it is multi Then min/max are kept', () => {
      const body = groupBody(group({ selection: 'multi', min_select: 1, max_select: null, options: [{ ...emptyOption(), name: 'A' }] }));
      expect([body.min_select, body.max_select]).toEqual([1, null]);
    });
  });

  describe('Given a single-pick group', () => {
    it('When a value becomes default Then the others stop being default', () => {
      const g = group({ options: [{ ...emptyOption(), name: 'A', is_default: true }, { ...emptyOption(1), name: 'B' }] });
      const next = setOptionPatch(g, 1, { is_default: true });
      expect(next.options.map((o) => o.is_default)).toEqual([false, true]);
    });
    it('When the group is multi Then several defaults are allowed', () => {
      const g = group({ selection: 'multi', options: [{ ...emptyOption(), name: 'A', is_default: true }, { ...emptyOption(1), name: 'B' }] });
      expect(setOptionPatch(g, 1, { is_default: true }).options.map((o) => o.is_default)).toEqual([true, true]);
    });
  });

  describe('Given summaries', () => {
    it('Then scope and picks read naturally', () => {
      expect(appliesSummary({ item_ids: [], category_ids: [] }, [])).toBe('All items');
      expect(appliesSummary({ item_ids: ['a', 'b'], category_ids: ['c1'] }, [{ id: 'c1', name: 'Fresh' }])).toBe('Fresh, 2 items');
      expect(picksSummary(group({ is_required: true }))).toBe('pick 1 · required');
      expect(picksSummary(group({ selection: 'multi', min_select: 0, max_select: null }))).toBe('0–any · optional');
      expect(toKey(' Gross weight (kg) ')).toBe('gross_weight_kg');
    });
  });

  describe('Given an item and a group scope', () => {
    it('When the scope is empty Then the group applies to all items', () => {
      expect(groupLinkForItem(group(), 'i1', 'c1')).toBe('all');
    });
    it('When the item is listed Then it is attached directly', () => {
      expect(groupLinkForItem(group({ applies_to: { item_ids: ['i1'], category_ids: ['c1'] } }), 'i1', 'c1')).toBe('item');
    });
    it('When only the category matches Then it applies via category', () => {
      expect(groupLinkForItem(group({ applies_to: { item_ids: ['i2'], category_ids: ['c1'] } }), 'i1', 'c1')).toBe('category');
    });
    it('When nothing matches Then it does not apply', () => {
      expect(groupLinkForItem(group({ applies_to: { item_ids: ['i2'], category_ids: ['c9'] } }), 'i1', 'c1')).toBeNull();
    });
  });

  describe('Given attach/detach', () => {
    it('When attaching twice Then the item is listed once and categories are kept', () => {
      const a = attachItem(attachItem({ item_ids: [], category_ids: ['c1'] }, 'i1'), 'i1');
      expect(a).toEqual({ item_ids: ['i1'], category_ids: ['c1'] });
    });
    it('When detaching Then only that item is removed', () => {
      expect(detachItem({ item_ids: ['i1', 'i2'], category_ids: [] }, 'i1')).toEqual({ item_ids: ['i2'], category_ids: [] });
    });
    it('When detaching the last scoped item Then it would widen the group to every item', () => {
      expect(detachWouldWiden({ item_ids: ['i1'], category_ids: [] }, 'i1')).toBe(true);
      expect(detachWouldWiden({ item_ids: ['i1'], category_ids: ['c1'] }, 'i1')).toBe(false);
    });
  });
});
