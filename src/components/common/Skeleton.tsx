import React from 'react';

export const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-slate-700/50 rounded${className ? ` ${className}` : ''}`} />
);

export const TableSkeleton = () => (
    <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
        ))}
    </div>
);
