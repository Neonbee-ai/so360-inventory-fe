/**
 * Additional edge-case tests for buildCategoryTree and flattenTree utilities.
 * Supplements the main categoryTree.spec.ts to reach higher branch coverage.
 */
import { describe, it, expect } from 'vitest';
import { buildCategoryTree, flattenTree } from './categoryTree';

const makeCategory = (overrides: any = {}) => ({
  id: 'c1',
  name: 'Root',
  description: '',
  parent_id: undefined,
  org_id: 'org-1',
  icon_url: null,
  image_url: null,
  color: null,
  sort_order: 0,
  ...overrides,
});

describe('buildCategoryTree — additional edge cases', () => {
  describe('Given multiple roots with multiple children', () => {
    it('When two roots each have children / Then tree has two top-level nodes each with children', () => {
      const cats = [
        makeCategory({ id: 'r1', name: 'Root 1' }),
        makeCategory({ id: 'r2', name: 'Root 2' }),
        makeCategory({ id: 'c1', name: 'Child 1-A', parent_id: 'r1' }),
        makeCategory({ id: 'c2', name: 'Child 1-B', parent_id: 'r1' }),
        makeCategory({ id: 'c3', name: 'Child 2-A', parent_id: 'r2' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      expect(tree).toHaveLength(2);
      const root1 = tree.find(n => n.id === 'r1');
      const root2 = tree.find(n => n.id === 'r2');
      expect(root1?.children).toHaveLength(2);
      expect(root2?.children).toHaveLength(1);
    });

    it('When four-level deep hierarchy / Then depths are 0,1,2,3', () => {
      const cats = [
        makeCategory({ id: 'l0', name: 'Level 0' }),
        makeCategory({ id: 'l1', name: 'Level 1', parent_id: 'l0' }),
        makeCategory({ id: 'l2', name: 'Level 2', parent_id: 'l1' }),
        makeCategory({ id: 'l3', name: 'Level 3', parent_id: 'l2' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      const level0 = tree[0];
      const level1 = level0.children[0];
      const level2 = level1.children[0];
      const level3 = level2.children[0];
      expect(level0.depth).toBe(0);
      expect(level1.depth).toBe(1);
      expect(level2.depth).toBe(2);
      expect(level3.depth).toBe(3);
    });
  });

  describe('Given sibling nodes (same parent)', () => {
    it('When three siblings under one parent / Then parent has 3 children', () => {
      const cats = [
        makeCategory({ id: 'p', name: 'Parent' }),
        makeCategory({ id: 's1', name: 'Sibling 1', parent_id: 'p' }),
        makeCategory({ id: 's2', name: 'Sibling 2', parent_id: 'p' }),
        makeCategory({ id: 's3', name: 'Sibling 3', parent_id: 'p' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      expect(tree[0].children).toHaveLength(3);
      expect(tree[0].children.map((c: any) => c.name)).toContain('Sibling 1');
      expect(tree[0].children.map((c: any) => c.name)).toContain('Sibling 3');
    });

    it('When all categories are leaf nodes (no children) / Then each node has empty children array', () => {
      const cats = [
        makeCategory({ id: 'a', name: 'A' }),
        makeCategory({ id: 'b', name: 'B' }),
        makeCategory({ id: 'c', name: 'C' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      for (const node of tree) {
        expect(node.children).toHaveLength(0);
      }
    });
  });

  describe('Given optional fields in nodes', () => {
    it('When category has icon_url and color / Then tree node preserves them', () => {
      const cats = [
        makeCategory({ id: 'c1', name: 'Tagged', icon_url: 'icon.png', color: '#abc' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      expect(tree[0].icon_url).toBe('icon.png');
      expect(tree[0].color).toBe('#abc');
    });

    it('When category has image_url / Then tree node preserves image_url', () => {
      const cats = [
        makeCategory({ id: 'img1', name: 'With Image', image_url: 'https://cdn.example.com/img.jpg' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      expect(tree[0].image_url).toBe('https://cdn.example.com/img.jpg');
    });
  });

  describe('Given single category', () => {
    it('When only one category exists / Then returns single root node with depth 0', () => {
      const cats = [makeCategory({ id: 'solo', name: 'Solo' })] as any[];
      const tree = buildCategoryTree(cats);
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('solo');
      expect(tree[0].depth).toBe(0);
      expect(tree[0].children).toHaveLength(0);
    });
  });
});

describe('flattenTree — additional edge cases', () => {
  describe('Given flat tree (all roots)', () => {
    it('When 5 root nodes with no children / Then flat list has 5 items in insertion order', () => {
      const cats = Array.from({ length: 5 }, (_, i) =>
        makeCategory({ id: `r${i}`, name: `Root ${i}` })
      ) as any[];
      const tree = buildCategoryTree(cats);
      const flat = flattenTree(tree);
      expect(flat).toHaveLength(5);
    });
  });

  describe('Given depth-first traversal', () => {
    it('When parent has children / Then children appear immediately after parent in flat list', () => {
      const cats = [
        makeCategory({ id: 'r1', name: 'Root 1' }),
        makeCategory({ id: 'r2', name: 'Root 2' }),
        makeCategory({ id: 'c1', name: 'Child of Root 1', parent_id: 'r1' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      const flat = flattenTree(tree);
      // Depth-first: Root 1 → Child of Root 1 → Root 2
      expect(flat[0].name).toBe('Root 1');
      expect(flat[1].name).toBe('Child of Root 1');
      expect(flat[2].name).toBe('Root 2');
    });

    it('When grandchild exists / Then grandchild appears after child in flat list', () => {
      const cats = [
        makeCategory({ id: 'p', name: 'Parent' }),
        makeCategory({ id: 'c', name: 'Child', parent_id: 'p' }),
        makeCategory({ id: 'gc', name: 'Grandchild', parent_id: 'c' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      const flat = flattenTree(tree);
      expect(flat.map(n => n.name)).toEqual(['Parent', 'Child', 'Grandchild']);
      expect(flat[0].depth).toBe(0);
      expect(flat[1].depth).toBe(1);
      expect(flat[2].depth).toBe(2);
    });
  });

  describe('Given flat node fields', () => {
    it('When category has no description / Then flat node has undefined description', () => {
      const cats = [makeCategory({ id: 'n1', name: 'No Desc', description: undefined })] as any[];
      const tree = buildCategoryTree(cats);
      const flat = flattenTree(tree);
      expect(flat[0].description).toBeUndefined();
    });

    it('When category has parent_id in flat result / Then flat node preserves parent_id', () => {
      const cats = [
        makeCategory({ id: 'p', name: 'Parent' }),
        makeCategory({ id: 'c', name: 'Child', parent_id: 'p' }),
      ] as any[];
      const tree = buildCategoryTree(cats);
      const flat = flattenTree(tree);
      const child = flat.find(n => n.id === 'c');
      expect(child?.parent_id).toBe('p');
    });
  });
});
