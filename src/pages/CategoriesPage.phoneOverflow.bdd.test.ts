import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');

describe('Categories page at 375px (no horizontal overflow)', () => {
  const tree = read('../components/categories/CategoryTreeView.tsx');
  const page = read('./CategoriesPage.tsx');

  it('given a row in edit mode, when on a phone, then the editor shrinks (min-w-0) instead of widening the page', () => {
    expect(tree).toContain('flex flex-col gap-2 flex-1 min-w-0 mt-0.5');
    expect(tree).toContain('className="flex-1 min-w-0"');
  });

  it('given the preset colour swatches, when they exceed the width, then they wrap', () => {
    expect(tree).toContain('flex flex-wrap items-center gap-1.5 max-w-full');
  });

  it('given the colour and sort-order row, when narrow, then it wraps', () => {
    expect(page).toContain('flex flex-wrap items-start gap-x-6 gap-y-3 min-w-0');
  });
});
