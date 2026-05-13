import { describe, it, expect } from 'vitest';
import { buildCategoryTree, flattenTree } from './categoryTree';

const makeCategory = (overrides: any = {}) => ({
  id: 'c1',
  name: 'Electronics',
  description: 'Electronic items',
  parent_id: undefined,
  org_id: 'org-1',
  icon_url: null,
  image_url: null,
  color: null,
  sort_order: 0,
  ...overrides,
});

describe('buildCategoryTree', () => {
  describe('Given flat categories with no parents', () => {
    it('When all are roots / Then returns all as root nodes', () => {
      const categories = [
        makeCategory({ id: 'c1', name: 'Electronics' }),
        makeCategory({ id: 'c2', name: 'Clothing' }),
      ] as any[];
      const tree = buildCategoryTree(categories);
      expect(tree).toHaveLength(2);
      expect(tree[0].depth).toBe(0);
      expect(tree[1].depth).toBe(0);
    });
  });

  describe('Given parent-child relationships', () => {
    it('When child has parent_id / Then nests under parent', () => {
      const categories = [
        makeCategory({ id: 'c1', name: 'Electronics' }),
        makeCategory({ id: 'c2', name: 'Phones', parent_id: 'c1' }),
      ] as any[];
      const tree = buildCategoryTree(categories);
      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].name).toBe('Phones');
      expect(tree[0].children[0].depth).toBe(1);
    });

    it('When three-level hierarchy / Then sets depths correctly', () => {
      const categories = [
        makeCategory({ id: 'c1', name: 'Electronics' }),
        makeCategory({ id: 'c2', name: 'Phones', parent_id: 'c1' }),
        makeCategory({ id: 'c3', name: 'Smartphones', parent_id: 'c2' }),
      ] as any[];
      const tree = buildCategoryTree(categories);
      expect(tree[0].depth).toBe(0);
      expect(tree[0].children[0].depth).toBe(1);
      expect(tree[0].children[0].children[0].depth).toBe(2);
    });
  });

  describe('Given orphaned categories', () => {
    it('When parent_id references missing node / Then treated as root', () => {
      const categories = [
        makeCategory({ id: 'c1', name: 'Orphan', parent_id: 'missing-parent' }),
      ] as any[];
      const tree = buildCategoryTree(categories);
      expect(tree).toHaveLength(1);
      expect(tree[0].depth).toBe(0);
    });
  });

  describe('Given empty input', () => {
    it('When no categories / Then returns empty array', () => {
      const tree = buildCategoryTree([]);
      expect(tree).toHaveLength(0);
    });
  });
});

describe('flattenTree', () => {
  describe('Given a tree structure', () => {
    it('When tree has nested nodes / Then flattens depth-first', () => {
      const categories = [
        makeCategory({ id: 'c1', name: 'Electronics' }),
        makeCategory({ id: 'c2', name: 'Phones', parent_id: 'c1' }),
        makeCategory({ id: 'c3', name: 'Clothing' }),
      ] as any[];
      const tree = buildCategoryTree(categories);
      const flat = flattenTree(tree);
      expect(flat).toHaveLength(3);
      expect(flat[0].name).toBe('Electronics');
      expect(flat[0].depth).toBe(0);
      expect(flat[1].name).toBe('Phones');
      expect(flat[1].depth).toBe(1);
      expect(flat[2].name).toBe('Clothing');
      expect(flat[2].depth).toBe(0);
    });

    it('When tree is empty / Then returns empty array', () => {
      const flat = flattenTree([]);
      expect(flat).toHaveLength(0);
    });

    it('When flattened / Then preserves id, name, parent_id, depth', () => {
      const categories = [
        makeCategory({ id: 'c1', name: 'Root', icon_url: 'icon.png', image_url: 'img.jpg', color: '#ff0000' }),
      ] as any[];
      const tree = buildCategoryTree(categories);
      const flat = flattenTree(tree);
      expect(flat[0].id).toBe('c1');
      expect(flat[0].icon_url).toBe('icon.png');
      expect(flat[0].image_url).toBe('img.jpg');
      expect(flat[0].color).toBe('#ff0000');
    });
  });
});
