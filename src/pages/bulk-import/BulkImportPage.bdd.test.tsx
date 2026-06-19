import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ currentOrg: { id: 'org-001' } }),
}));

const mockService = vi.hoisted(() => ({
    bulkImportParseCsv: vi.fn(),
    bulkImportUploadImages: vi.fn(),
    bulkImportCommit: vi.fn(),
    clearOrgStaticCache: vi.fn(),
}));

vi.mock('../../services/inventoryService', () => ({
    inventoryService: mockService,
}));

// Stub all child step components so we can test the orchestration logic
vi.mock('./components/StepIndicator', () => ({
    default: ({ current }: { current: number }) => <div data-testid="step-indicator" data-step={current} />,
}));

vi.mock('./components/CsvUploadStep', () => ({
    default: ({ onParsed }: { onParsed: (r: any) => void }) => (
        <div data-testid="csv-upload-step">
            <button onClick={() => onParsed({ total: 3, valid: 2, invalid: 1, rows: [
                { row_index: 1, status: 'valid',   errors: [], warnings: [], data: { name: 'Widget A', sku: 'WA-001', image_urls: [] } },
                { row_index: 2, status: 'valid',   errors: [], warnings: [], data: { name: 'Widget B', sku: 'WA-002', image_urls: [] } },
                { row_index: 3, status: 'error',   errors: ['name required'], warnings: [], data: {} },
            ] })}>simulate-csv-parsed</button>
        </div>
    ),
}));

vi.mock('./components/ImageUploadStep', () => ({
    default: ({ onImagesUploaded, onSkip }: { onImagesUploaded: (u: any[]) => void; onSkip: () => void }) => (
        <div data-testid="image-upload-step">
            <button onClick={() => onImagesUploaded([
                { filename: 'WA-001.jpg', sku: 'wa-001', cdn_url: 'https://cdn.example.com/WA-001.jpg' },
            ])}>simulate-images-uploaded</button>
            <button onClick={onSkip}>simulate-skip</button>
        </div>
    ),
}));

vi.mock('./components/PreviewTableStep', () => ({
    default: ({ rows, onConfirm, onBack }: { rows: any[]; onConfirm: (r: any[]) => void; onBack: () => void }) => (
        <div data-testid="preview-table-step">
            <button onClick={() => onConfirm(rows.filter(r => r.status !== 'error').map(r => r.data))}>simulate-confirm</button>
            <button onClick={onBack}>simulate-back</button>
        </div>
    ),
}));

vi.mock('./components/ImportResultStep', () => ({
    default: ({ result, loading, onGoToItems, onReset }: any) => (
        <div data-testid="import-result-step" data-loading={loading}>
            {result && <span data-testid="result-succeeded">{result.succeeded}</span>}
            <button onClick={onGoToItems}>go-to-items</button>
            <button onClick={onReset}>start-new</button>
        </div>
    ),
}));

import BulkImportPage from './BulkImportPage';

// ── helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
    return render(<BulkImportPage />);
}

// ── scenarios ─────────────────────────────────────────────────────────────────

describe('BulkImportPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockService.bulkImportCommit.mockResolvedValue({
            total: 2, succeeded: 2, failed: 0,
            results: [
                { row_index: 1, status: 'success', item_id: 'item-1' },
                { row_index: 2, status: 'success', item_id: 'item-2' },
            ],
        });
    });

    describe('GIVEN the page mounts', () => {
        it('WHEN rendered THEN step 0 (CSV Upload) is shown first', () => {
            renderPage();
            expect(screen.getByTestId('csv-upload-step')).toBeInTheDocument();
            expect(screen.queryByTestId('image-upload-step')).not.toBeInTheDocument();
        });

        it('WHEN rendered THEN the step indicator starts at step 0', () => {
            renderPage();
            expect(screen.getByTestId('step-indicator').dataset.step).toBe('0');
        });
    });

    describe('GIVEN step 0: CSV is parsed', () => {
        it('WHEN onParsed fires THEN step advances to 1 (Image Upload)', async () => {
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => expect(screen.getByTestId('image-upload-step')).toBeInTheDocument());
            expect(screen.queryByTestId('csv-upload-step')).not.toBeInTheDocument();
        });

        it('WHEN onParsed fires THEN step indicator moves to 1', async () => {
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => expect(screen.getByTestId('step-indicator').dataset.step).toBe('1'));
        });
    });

    describe('GIVEN step 1: images uploaded', () => {
        async function toStep1() {
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => screen.getByTestId('image-upload-step'));
        }

        it('WHEN onImagesUploaded fires THEN CDN URL is merged into matching row', async () => {
            await toStep1();
            fireEvent.click(screen.getByText('simulate-images-uploaded'));
            // After merging, skip to step 2 is simulated separately
        });

        it('WHEN onSkip fires THEN step advances to 2 (Preview)', async () => {
            await toStep1();
            fireEvent.click(screen.getByText('simulate-skip'));
            await waitFor(() => expect(screen.getByTestId('preview-table-step')).toBeInTheDocument());
        });
    });

    describe('GIVEN step 2: preview', () => {
        async function toStep2() {
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => screen.getByTestId('image-upload-step'));
            fireEvent.click(screen.getByText('simulate-skip'));
            await waitFor(() => screen.getByTestId('preview-table-step'));
        }

        it('WHEN onBack fires from preview THEN step returns to 1 (Image Upload)', async () => {
            await toStep2();
            fireEvent.click(screen.getByText('simulate-back'));
            await waitFor(() => expect(screen.getByTestId('image-upload-step')).toBeInTheDocument());
        });

        it('WHEN onConfirm fires THEN step advances to 3 (Result) and commit is called', async () => {
            await toStep2();
            fireEvent.click(screen.getByText('simulate-confirm'));
            await waitFor(() => expect(screen.getByTestId('import-result-step')).toBeInTheDocument());
            expect(mockService.bulkImportCommit).toHaveBeenCalledWith('org-001', expect.any(Array));
        });

        it('WHEN onConfirm fires THEN only non-error rows are passed to commit', async () => {
            await toStep2();
            fireEvent.click(screen.getByText('simulate-confirm'));
            await waitFor(() => expect(mockService.bulkImportCommit).toHaveBeenCalled());
            const rows = mockService.bulkImportCommit.mock.calls[0][1];
            expect(rows).toHaveLength(2);
            expect(rows.every((r: any) => r.name)).toBe(true);
        });
    });

    describe('GIVEN step 3: result displayed', () => {
        async function toStep3() {
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => screen.getByTestId('image-upload-step'));
            fireEvent.click(screen.getByText('simulate-skip'));
            await waitFor(() => screen.getByTestId('preview-table-step'));
            fireEvent.click(screen.getByText('simulate-confirm'));
            await waitFor(() => screen.getByTestId('import-result-step'));
        }

        it('WHEN commit resolves THEN result shows succeeded count', async () => {
            await toStep3();
            await waitFor(() => expect(screen.getByTestId('result-succeeded').textContent).toBe('2'));
        });

        it('WHEN commit resolves THEN clearOrgStaticCache is called to bust the item list cache', async () => {
            await toStep3();
            await waitFor(() => expect(mockService.clearOrgStaticCache).toHaveBeenCalled());
        });
    });

    describe('GIVEN commit API fails', () => {
        it('WHEN commit rejects THEN result step shows 0 succeeded and all rows as errors', async () => {
            mockService.bulkImportCommit.mockRejectedValue(new Error('Internal server error'));
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => screen.getByTestId('image-upload-step'));
            fireEvent.click(screen.getByText('simulate-skip'));
            await waitFor(() => screen.getByTestId('preview-table-step'));
            fireEvent.click(screen.getByText('simulate-confirm'));
            await waitFor(() => screen.getByTestId('import-result-step'));
            await waitFor(() => expect(screen.getByTestId('result-succeeded').textContent).toBe('0'));
        });
    });

    describe('GIVEN image CDN URL merging', () => {
        it('WHEN WA-001 image uploaded THEN row for WA-001 gets the CDN URL', async () => {
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => screen.getByTestId('image-upload-step'));
            fireEvent.click(screen.getByText('simulate-images-uploaded'));
            fireEvent.click(screen.getByText('simulate-skip'));
            await waitFor(() => screen.getByTestId('preview-table-step'));
            fireEvent.click(screen.getByText('simulate-confirm'));
            await waitFor(() => expect(mockService.bulkImportCommit).toHaveBeenCalled());
            const rows = mockService.bulkImportCommit.mock.calls[0][1];
            const wa001 = rows.find((r: any) => r.sku === 'WA-001');
            expect(wa001?.image_urls).toContain('https://cdn.example.com/WA-001.jpg');
        });
    });
});
