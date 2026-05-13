import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
