import React from 'react';
import { Skeleton as CombSkeleton } from '@so360/design-system';

/** Thin wrapper over the Comb Skeleton; keeps the local `className` sizing API. */
export const Skeleton = ({ className }: { className?: string }) => (
    <CombSkeleton variant="rect" className={className} />
);

export const TableSkeleton = () => (
    <div className="flex flex-col gap-nb-4" data-testid="table-skeleton">
        {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
        ))}
    </div>
);
