import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ currentOrg: { id: 'org-001' } }) }));
vi.mock('../../services/inventoryService', () => ({
    inventoryService: { bulkImportParseCsv: vi.fn(), bulkImportUploadImages: vi.fn(), bulkImportCommit: vi.fn(), clearOrgStaticCache: vi.fn() },
}));
vi.mock('./components/CsvUploadStep', () => ({
    default: ({ onParsed }: any) => (
        <button onClick={() => onParsed({ total: 1, valid: 1, invalid: 0, rows: [{ row_index: 1, status: 'valid', errors: [], warnings: [], data: { name: 'A', name_key: 'a', image_urls: [] } }] })}>parse-csv</button>
    ),
}));
vi.mock('./components/ImageUploadStep', () => ({ default: ({ onSkip }: any) => <button onClick={onSkip}>skip-images</button> }));
vi.mock('./components/PreviewTableStep', () => ({ default: () => <div data-testid="preview-step" /> }));
vi.mock('./components/ImportResultStep', () => ({ default: () => <div data-testid="result-step" /> }));

import BulkImportPage from './BulkImportPage';

describe('BulkImportPage (Comb form template)', () => {
    it('GIVEN the page WHEN rendered THEN it uses the form template with title and description', () => {
        const { container } = render(<BulkImportPage />);
        expect(container.querySelector('[data-template="form"]')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Bulk Import' })).toBeInTheDocument();
        expect(screen.getByText(/Import multiple inventory items/)).toBeInTheDocument();
    });

    it('GIVEN the page WHEN rendered THEN the stepper shows all four steps with the first current', () => {
        render(<BulkImportPage />);
        ['Upload CSV', 'Upload Images', 'Preview', 'Result'].forEach(l => expect(screen.getByText(l)).toBeInTheDocument());
        expect(screen.getByText('Upload CSV')).toHaveAttribute('aria-current', 'step');
    });

    it('GIVEN the page WHEN the back link is used THEN it navigates to items', () => {
        render(<BulkImportPage />);
        fireEvent.click(screen.getByLabelText('Back to Items'));
        expect(navigate).toHaveBeenCalledWith('/inventory/items');
    });

    it('GIVEN a parsed CSV WHEN images are skipped THEN the preview step is shown and the stepper advances', async () => {
        render(<BulkImportPage />);
        fireEvent.click(screen.getByText('parse-csv'));
        await waitFor(() => screen.getByText('skip-images'));
        expect(screen.getByText('Upload Images')).toHaveAttribute('aria-current', 'step');
        fireEvent.click(screen.getByText('skip-images'));
        await waitFor(() => expect(screen.getByTestId('preview-step')).toBeInTheDocument());
        expect(screen.getByText('Preview')).toHaveAttribute('aria-current', 'step');
    });
});
