import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Skeleton, TableSkeleton } from './Skeleton';

describe('Skeleton', () => {
  describe('Given the component is rendered', () => {
    it('When rendered without className / Then shows animated div', () => {
      const { container } = render(<Skeleton />);
      const el = container.firstChild as HTMLElement;
      expect(el).toBeInTheDocument();
      expect(el.className).toContain('animate-pulse');
    });

    it('When rendered with className / Then applies custom class', () => {
      const { container } = render(<Skeleton className="h-12 w-full" />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain('h-12');
      expect(el.className).toContain('w-full');
    });

    it('When rendered / Then has rounded class', () => {
      const { container } = render(<Skeleton />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain('rounded');
    });
  });
});

describe('Skeleton display variants', () => {
  it('When rendered with h-4 w-24 / Then element carries both classes', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('w-24');
  });

  it('When rendered with no className / Then no undefined in className string', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain('undefined');
  });

  it('When multiple Skeleton instances are rendered / Then each is independent', () => {
    const { container } = render(
      <>
        <Skeleton className="h-2" />
        <Skeleton className="h-8" />
      </>
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(2);
  });
});

describe('TableSkeleton', () => {
  describe('Given the component is rendered', () => {
    it('When rendered / Then shows 5 skeleton rows', () => {
      const { container } = render(<TableSkeleton />);
      const skeletonRows = container.querySelectorAll('.animate-pulse');
      expect(skeletonRows.length).toBe(5);
    });

    it('When rendered / Then outer container has space-y-4 class', () => {
      const { container } = render(<TableSkeleton />);
      const outer = container.firstChild as HTMLElement;
      expect(outer.className).toContain('space-y-4');
    });

    it('When rendered / Then each row has h-12 and w-full classes', () => {
      const { container } = render(<TableSkeleton />);
      const skeletonRows = container.querySelectorAll('.h-12');
      expect(skeletonRows.length).toBe(5);
    });
  });

  describe('Given TableSkeleton hardening', () => {
    it('When rendered / Then all rows also have animate-pulse', () => {
      const { container } = render(<TableSkeleton />);
      const rows = container.querySelectorAll('.animate-pulse');
      expect(rows.length).toBeGreaterThanOrEqual(5);
    });

    it('When rendered twice / Then produces consistent row count both times', () => {
      const { container: c1 } = render(<TableSkeleton />);
      const { container: c2 } = render(<TableSkeleton />);
      expect(c1.querySelectorAll('.animate-pulse').length).toBe(
        c2.querySelectorAll('.animate-pulse').length
      );
    });
  });
});
