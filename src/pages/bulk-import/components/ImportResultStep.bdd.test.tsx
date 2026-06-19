import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ImportResultStep from './ImportResultStep';

function makeResult(succeeded: number, failed: number) {
    const results = [
        ...Array.from({ length: succeeded }, (_, i) => ({
            row_index: i + 1, status: 'success' as const, item_id: `item-${i + 1}`,
        })),
        ...Array.from({ length: failed }, (_, i) => ({
            row_index: succeeded + i + 1, status: 'error' as const, reason: `SKU already exists`,
        })),
    ];
    return { total: succeeded + failed, succeeded, failed, results };
}

const SUBMITTED = [
    { name: 'Widget A', sku: 'WA-001' },
    { name: 'Widget B', sku: 'WA-002' },
    { name: 'Bad Item', sku: 'DUPE' },
];

describe('ImportResultStep', () => {
    let onGoToItems: ReturnType<typeof vi.fn>;
    let onReset: ReturnType<typeof vi.fn>;
    let onNavigateToItem: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onGoToItems = vi.fn();
        onReset = vi.fn();
        onNavigateToItem = vi.fn();
    });

    describe('GIVEN loading is true', () => {
        it('WHEN rendered THEN a loading spinner and item count message is shown', () => {
            render(<ImportResultStep result={null} loading={true} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            expect(screen.getByText(/Importing 3 items/)).toBeInTheDocument();
        });

        it('WHEN loading THEN Go to Items button is not shown', () => {
            render(<ImportResultStep result={null} loading={true} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            expect(screen.queryByText('Go to Items')).not.toBeInTheDocument();
        });
    });

    describe('GIVEN all rows succeeded', () => {
        const result = makeResult(2, 0);

        it('WHEN rendered THEN "Import complete" heading is shown', () => {
            render(<ImportResultStep result={result} loading={false} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            expect(screen.getByText('Import complete')).toBeInTheDocument();
        });

        it('WHEN rendered THEN succeeded count is displayed', () => {
            render(<ImportResultStep result={result} loading={false} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            expect(screen.getByText(/2 succeeded · 0 failed/)).toBeInTheDocument();
        });

        it('WHEN rendered THEN item names from submitted rows are shown as links', () => {
            render(<ImportResultStep result={result} loading={false} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            expect(screen.getByText('Widget A')).toBeInTheDocument();
            expect(screen.getByText('Widget B')).toBeInTheDocument();
        });

        it('WHEN an item row is clicked THEN onNavigateToItem is called with its id', () => {
            render(<ImportResultStep result={result} loading={false} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            fireEvent.click(screen.getByText('Widget A'));
            expect(onNavigateToItem).toHaveBeenCalledWith('item-1');
        });
    });

    describe('GIVEN partial success (2 ok, 1 failed)', () => {
        const result = makeResult(2, 1);

        it('WHEN rendered THEN "Partial import" heading is shown', () => {
            render(<ImportResultStep result={result} loading={false} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            expect(screen.getByText('Partial import')).toBeInTheDocument();
        });

        it('WHEN rendered THEN the failure reason appears in the failed section', () => {
            render(<ImportResultStep result={result} loading={false} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            expect(screen.getByText('SKU already exists')).toBeInTheDocument();
        });
    });

    describe('GIVEN the Go to Items button is clicked', () => {
        it('WHEN clicked THEN onGoToItems is called', () => {
            render(<ImportResultStep result={makeResult(1, 0)} loading={false} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            fireEvent.click(screen.getByText('Go to Items'));
            expect(onGoToItems).toHaveBeenCalled();
        });
    });

    describe('GIVEN the Start new import button is clicked', () => {
        it('WHEN clicked THEN onReset is called', () => {
            render(<ImportResultStep result={makeResult(1, 0)} loading={false} submittedRows={SUBMITTED} onGoToItems={onGoToItems} onReset={onReset} onNavigateToItem={onNavigateToItem} />);
            fireEvent.click(screen.getByText('Start new import'));
            expect(onReset).toHaveBeenCalled();
        });
    });
});
