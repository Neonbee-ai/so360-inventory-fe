import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Skeleton, TableSkeleton } from './Skeleton';

describe('Skeleton (Comb wrapper)', () => {
  it('Given no className / When rendered / Then a Comb skeleton is shown', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('Given a className / When rendered / Then it still renders without error', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstChild).not.toBeNull();
    expect(container.innerHTML).not.toContain('undefined');
  });
});

describe('TableSkeleton', () => {
  it('Given the component / When rendered / Then shows 5 skeleton rows', () => {
    render(<TableSkeleton />);
    expect(screen.getAllByTestId('skeleton')).toHaveLength(5);
  });

  it('Given two renders / When compared / Then row count is stable', () => {
    const a = render(<TableSkeleton />);
    const b = render(<TableSkeleton />);
    expect(a.container.querySelectorAll('[data-testid="skeleton"]').length).toBe(
      b.container.querySelectorAll('[data-testid="skeleton"]').length,
    );
  });
});
