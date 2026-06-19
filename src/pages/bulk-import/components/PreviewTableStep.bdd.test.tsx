import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PreviewTableStep from './PreviewTableStep';

function makeRow(
    index: number,
    status: 'valid' | 'error' | 'warning',
    name: string,
    sku: string,
    errors: string[] = [],
    warnings: string[] = [],
    hasImage = false,
) {
    return {
        row_index: index,
        status,
        errors,
        warnings,
        data: { name, sku, type: 'product', price: 9.99, product_status: 'draft', image_urls: hasImage ? ['https://cdn.example.com/img.jpg'] : [] },
    };
}

const VALID_ROW     = makeRow(1, 'valid',   'Widget A', 'WA-001');
const IMAGE_ROW     = makeRow(2, 'valid',   'Widget B', 'WA-002', [], [], true);
const WARNING_ROW   = makeRow(3, 'warning', 'Widget C', 'WA-003', [], ['category not found']);
const ERROR_ROW     = makeRow(4, 'error',   'Bad Item', '',       ['name is required']);

describe('PreviewTableStep', () => {
    let onConfirm: ReturnType<typeof vi.fn>;
    let onBack: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onConfirm = vi.fn();
        onBack = vi.fn();
    });

    describe('GIVEN 2 valid rows and 1 error row', () => {
        const rows = [VALID_ROW, IMAGE_ROW, ERROR_ROW];

        it('WHEN rendered THEN the valid count shows 2', () => {
            render(<PreviewTableStep rows={rows} onConfirm={onConfirm} onBack={onBack} />);
            expect(screen.getByText(/2 valid/)).toBeInTheDocument();
        });

        it('WHEN rendered THEN the error count shows 1', () => {
            render(<PreviewTableStep rows={rows} onConfirm={onConfirm} onBack={onBack} />);
            expect(screen.getByText(/1 error/)).toBeInTheDocument();
        });

        it('WHEN rendered THEN all 3 rows are shown in the table', () => {
            render(<PreviewTableStep rows={rows} onConfirm={onConfirm} onBack={onBack} />);
            expect(screen.getByText('Widget A')).toBeInTheDocument();
            expect(screen.getByText('Widget B')).toBeInTheDocument();
            expect(screen.getByText('Bad Item')).toBeInTheDocument();
        });

        it('WHEN rendered THEN error message appears in the row', () => {
            render(<PreviewTableStep rows={rows} onConfirm={onConfirm} onBack={onBack} />);
            expect(screen.getByText('name is required')).toBeInTheDocument();
        });

        it('WHEN the import button is clicked THEN onConfirm is called with only valid rows data', () => {
            render(<PreviewTableStep rows={rows} onConfirm={onConfirm} onBack={onBack} />);
            fireEvent.click(screen.getByText(/Import 2 valid row/));
            expect(onConfirm).toHaveBeenCalledWith([VALID_ROW.data, IMAGE_ROW.data]);
        });
    });

    describe('GIVEN a row with an image', () => {
        it('WHEN rendered THEN the image icon is shown for that row', () => {
            const { container } = render(<PreviewTableStep rows={[IMAGE_ROW]} onConfirm={onConfirm} onBack={onBack} />);
            expect(container.querySelector('[data-testid="icon-ImageIcon"]')).toBeInTheDocument();
        });
    });

    describe('GIVEN the user toggles "Show errors only"', () => {
        it('WHEN clicked THEN only error rows are shown', () => {
            render(<PreviewTableStep rows={[VALID_ROW, ERROR_ROW]} onConfirm={onConfirm} onBack={onBack} />);
            fireEvent.click(screen.getByText('Show errors only'));
            expect(screen.queryByText('Widget A')).not.toBeInTheDocument();
            expect(screen.getByText('Bad Item')).toBeInTheDocument();
        });

        it('WHEN clicked twice THEN all rows are shown again', () => {
            render(<PreviewTableStep rows={[VALID_ROW, ERROR_ROW]} onConfirm={onConfirm} onBack={onBack} />);
            fireEvent.click(screen.getByText('Show errors only'));
            fireEvent.click(screen.getByText('Show all rows'));
            expect(screen.getByText('Widget A')).toBeInTheDocument();
            expect(screen.getByText('Bad Item')).toBeInTheDocument();
        });
    });

    describe('GIVEN all rows are errors', () => {
        it('WHEN rendered THEN the Import button is disabled', () => {
            render(<PreviewTableStep rows={[ERROR_ROW]} onConfirm={onConfirm} onBack={onBack} />);
            const btn = screen.getByText(/Import 0 valid/).closest('button') as HTMLButtonElement;
            expect(btn).toBeDisabled();
        });
    });

    describe('GIVEN the Back button is clicked', () => {
        it('WHEN clicked THEN onBack is called', () => {
            render(<PreviewTableStep rows={[VALID_ROW]} onConfirm={onConfirm} onBack={onBack} />);
            fireEvent.click(screen.getByText('Back'));
            expect(onBack).toHaveBeenCalled();
        });
    });

    describe('GIVEN a warning row (valid data but unresolved category)', () => {
        it('WHEN rendered THEN warning message appears in the row', () => {
            render(<PreviewTableStep rows={[WARNING_ROW]} onConfirm={onConfirm} onBack={onBack} />);
            expect(screen.getByText('category not found')).toBeInTheDocument();
        });

        it('WHEN import clicked THEN warning rows ARE included (they are valid)', () => {
            render(<PreviewTableStep rows={[WARNING_ROW]} onConfirm={onConfirm} onBack={onBack} />);
            fireEvent.click(screen.getByText(/Import 1 valid row/));
            expect(onConfirm).toHaveBeenCalledWith([WARNING_ROW.data]);
        });
    });
});
