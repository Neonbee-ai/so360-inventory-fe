import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Per-test overrides for what the stubbed CSV / image steps emit.
const fixtures = vi.hoisted(() => ({ csvRows: null as any[] | null, uploaded: null as any[] | null }));

vi.mock('./components/CsvUploadStep', () => ({
    default: ({ onParsed }: { onParsed: (r: any) => void }) => (
        <div data-testid="csv-upload-step">
            <button onClick={() => onParsed({ total: 3, valid: 2, invalid: 1, rows: fixtures.csvRows ?? [
                { row_index: 1, status: 'valid',   errors: [], warnings: [], data: { name: 'Widget A', name_key: 'widget a', image_urls: [] } },
                { row_index: 2, status: 'valid',   errors: [], warnings: [], data: { name: 'Widget B', name_key: 'widget b', image_urls: [] } },
                { row_index: 3, status: 'error',   errors: ['name required'], warnings: [], data: {} },
            ] })}>simulate-csv-parsed</button>
        </div>
    ),
}));

vi.mock('./components/ImageUploadStep', () => ({
    default: ({ onImagesUploaded, onSkip }: { onImagesUploaded: (u: any[]) => void; onSkip: () => void }) => (
        <div data-testid="image-upload-step">
            <button onClick={() => onImagesUploaded(fixtures.uploaded ?? [
                { filename: 'Widget A.jpg', name_key: 'widget a', cdn_url: 'https://cdn.example.com/Widget-A.jpg' },
            ])}>simulate-images-uploaded</button>
            <button onClick={onSkip}>simulate-skip</button>
        </div>
    ),
}));

vi.mock('./components/PreviewTableStep', () => ({
    default: ({ rows, onConfirm, onBack }: { rows: any[]; onConfirm: (r: any[]) => void; onBack: () => void }) => (
        <div data-testid="preview-table-step">
            {rows.map((r, i) => (
                <span key={i} data-testid={`row-${i}`} data-image-status={r.image_status ?? ''} data-image={r.data.image_urls?.[0] ?? ''} data-warnings={r.warnings?.length ?? 0} />
            ))}
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

    describe('GIVEN image mapping is safe and deterministic', () => {
        const row = (i: number, name: string, status = 'valid') =>
            ({ row_index: i, status, errors: [], warnings: [], data: { name, name_key: name.toLowerCase(), image_urls: [] } });

        async function previewAfterUpload(csvRows: any[], uploaded: any[]) {
            fixtures.csvRows = csvRows;
            fixtures.uploaded = uploaded;
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => screen.getByTestId('image-upload-step'));
            fireEvent.click(screen.getByText('simulate-images-uploaded'));
            fireEvent.click(screen.getByText('simulate-skip'));
            await waitFor(() => screen.getByTestId('preview-table-step'));
        }

        afterEach(() => { fixtures.csvRows = null; fixtures.uploaded = null; });

        it('WHEN the image name matches one product THEN the row is mapped', async () => {
            await previewAfterUpload([row(1, 'Sofa')], [{ filename: 'sofa.jpg', name_key: 'sofa', cdn_url: 'https://cdn/sofa.jpg' }]);
            expect(screen.getByTestId('row-0').dataset.imageStatus).toBe('mapped');
            expect(screen.getByTestId('row-0').dataset.image).toBe('https://cdn/sofa.jpg');
        });

        it('WHEN no image has the product name THEN the row is flagged not_found', async () => {
            await previewAfterUpload([row(1, 'Sofa')], [{ filename: 'chair.jpg', name_key: 'chair', cdn_url: 'https://cdn/chair.jpg' }]);
            expect(screen.getByTestId('row-0').dataset.imageStatus).toBe('not_found');
            expect(screen.getByTestId('row-0').dataset.image).toBe('');
        });

        it('WHEN two products share the name THEN neither gets the image (ambiguous)', async () => {
            await previewAfterUpload([row(1, 'Sofa'), row(2, 'Sofa')], [{ filename: 'Sofa.jpg', name_key: 'sofa', cdn_url: 'https://cdn/sofa.jpg' }]);
            for (const id of ['row-0', 'row-1']) {
                expect(screen.getByTestId(id).dataset.imageStatus).toBe('ambiguous');
                expect(screen.getByTestId(id).dataset.image).toBe('');
            }
        });

        it('WHEN two images share the name THEN the row gets none and a warning (duplicate_image)', async () => {
            await previewAfterUpload([row(1, 'Sofa')], [
                { filename: 'Sofa.jpg', name_key: 'sofa', cdn_url: 'https://cdn/a.jpg' },
                { filename: 'Sofa.png', name_key: 'sofa', cdn_url: 'https://cdn/b.png' },
            ]);
            expect(screen.getByTestId('row-0').dataset.imageStatus).toBe('duplicate_image');
            expect(screen.getByTestId('row-0').dataset.image).toBe('');
            expect(screen.getByTestId('row-0').dataset.warnings).toBe('1');
        });

        it('WHEN a row is an error THEN it is left untouched', async () => {
            await previewAfterUpload([row(1, 'Sofa', 'error')], [{ filename: 'Sofa.jpg', name_key: 'sofa', cdn_url: 'https://cdn/sofa.jpg' }]);
            expect(screen.getByTestId('row-0').dataset.imageStatus).toBe('');
        });

        it('WHEN the upload response has no name_key THEN the filename is used', async () => {
            await previewAfterUpload([row(1, 'Namur Sofa')], [{ filename: ' namur  SOFA.webp', cdn_url: 'https://cdn/n.webp' }]);
            expect(screen.getByTestId('row-0').dataset.imageStatus).toBe('mapped');
        });
    });

    describe('GIVEN image CDN URL merging by product name', () => {
        it('WHEN the Widget A image is uploaded THEN the Widget A row gets the CDN URL', async () => {
            renderPage();
            fireEvent.click(screen.getByText('simulate-csv-parsed'));
            await waitFor(() => screen.getByTestId('image-upload-step'));
            fireEvent.click(screen.getByText('simulate-images-uploaded'));
            fireEvent.click(screen.getByText('simulate-skip'));
            await waitFor(() => screen.getByTestId('preview-table-step'));
            fireEvent.click(screen.getByText('simulate-confirm'));
            await waitFor(() => expect(mockService.bulkImportCommit).toHaveBeenCalled());
            const rows = mockService.bulkImportCommit.mock.calls[0][1];
            const widgetA = rows.find((r: any) => r.name === 'Widget A');
            expect(widgetA?.image_urls).toContain('https://cdn.example.com/Widget-A.jpg');
        });
    });
});
