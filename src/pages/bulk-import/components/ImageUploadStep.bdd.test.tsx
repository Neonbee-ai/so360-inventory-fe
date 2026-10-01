import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockFit = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/imageFit', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../utils/imageFit')>()),
  fitImageFile: (...args: any[]) => mockFit(...args),
}));

import ImageUploadStep from './ImageUploadStep';
import { IMAGE_FIT_SLOTS } from '../../../utils/imageFit';

const MB = 1024 * 1024;
const asIs = (file: File) => ({
    file, changed: false, originalName: file.name, originalBytes: file.size, finalBytes: file.size,
    resized: false, overCap: false,
});
const sizedFile = (name: string, bytes: number, type = 'image/jpeg') => {
    const f = new File(['img'], name, { type });
    Object.defineProperty(f, 'size', { configurable: true, value: bytes });
    return f;
};

function makeRow(name: string, status: 'valid' | 'error' | 'warning' = 'valid') {
    return { row_index: 1, status, errors: [], warnings: [], data: { name, image_urls: [] } };
}

function makeFile(name: string) {
    return new File(['img'], name, { type: 'image/jpeg' });
}

describe('ImageUploadStep', () => {
    let onImagesUploaded: ReturnType<typeof vi.fn>;
    let onUpload: ReturnType<typeof vi.fn>;
    let onSkip: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onImagesUploaded = vi.fn();
        onSkip = vi.fn();
        onUpload = vi.fn().mockResolvedValue({ uploaded: [], failed: [] });
        mockFit.mockReset();
        mockFit.mockImplementation(async (file: File) => asIs(file));
    });

    const rows = [makeRow('WA-001'), makeRow('WA-002'), makeRow('DUPE-001', 'error')];

    describe('GIVEN the step is rendered', () => {
        it('WHEN rendered THEN the drop zone instruction is visible', () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            expect(screen.getByText('Drop images here')).toBeInTheDocument();
        });

        it('WHEN rendered THEN the "Skip images" link is visible', () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            expect(screen.getByText(/Skip images/)).toBeInTheDocument();
        });
    });

    describe('GIVEN a file named after a valid product is added', () => {
        it('WHEN file selected THEN the file appears in the list with MATCHED badge', async () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile('WA-001.jpg')] } });
            await waitFor(() => expect(screen.getByText('WA-001.jpg')).toBeInTheDocument());
            expect(screen.getByText('MATCHED')).toBeInTheDocument();
        });
    });

    describe('GIVEN a file with a name not matching any product is added', () => {
        it('WHEN file selected THEN the file appears with NO MATCH badge', async () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile('unknown-item.jpg')] } });
            await waitFor(() => expect(screen.getByText('unknown-item.jpg')).toBeInTheDocument());
            expect(screen.getByText('NO MATCH')).toBeInTheDocument();
        });
    });

    describe('GIVEN a file named after an error row is added', () => {
        it('WHEN file selected THEN it shows NO MATCH (error rows are excluded from the product set)', async () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile('DUPE-001.jpg')] } });
            await waitFor(() => expect(screen.getByText('DUPE-001.jpg')).toBeInTheDocument());
            expect(screen.getByText('NO MATCH')).toBeInTheDocument();
        });
    });

    describe('GIVEN every CSV row has an error', () => {
        it('WHEN rendered THEN a banner explains no image can match until the CSV is fixed', () => {
            const bad = [makeRow('Namur Sofa', 'error'), makeRow('Oak Table', 'error')];
            render(<ImageUploadStep parsedRows={bad} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            expect(screen.getByRole('alert')).toHaveTextContent('None of the 2 CSV rows can be imported (2 with errors)');
        });

        it('WHEN at least one row is importable THEN no banner is shown', () => {
            render(<ImageUploadStep parsedRows={[makeRow('Namur Sofa'), makeRow('Oak Table', 'error')]} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('GIVEN product names are matched loosely', () => {
        const pick = async (names: string[], parsedRows: any[]) => {
            render(<ImageUploadStep parsedRows={parsedRows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: names.map(makeFile) } });
            await waitFor(() => expect(screen.getAllByText(names[0]).length).toBeGreaterThan(0));
        };

        it('WHEN the filename differs only by case and spacing THEN it is MATCHED', async () => {
            await pick(['NAMUR sofa.JPG'], [makeRow('Namur Sofa')]);
            expect(screen.getByText('MATCHED')).toBeInTheDocument();
        });

        it('WHEN the filename is only part of a product name THEN it is NO MATCH (no partial matching)', async () => {
            await pick(['Namur.jpg'], [makeRow('Namur Sofa')]);
            expect(screen.getByText('NO MATCH')).toBeInTheDocument();
        });

        it('WHEN two products share the name THEN the image is AMBIGUOUS', async () => {
            await pick(['Namur Sofa.jpg'], [makeRow('Namur Sofa'), makeRow('namur sofa')]);
            expect(screen.getByText('AMBIGUOUS')).toBeInTheDocument();
            expect(screen.queryByText('MATCHED')).not.toBeInTheDocument();
        });

        it('WHEN two images resolve to the same product name THEN both are DUPLICATE IMAGE', async () => {
            await pick(['Namur Sofa.jpg', 'namur sofa.png'], [makeRow('Namur Sofa')]);
            expect(screen.getAllByText('DUPLICATE IMAGE')).toHaveLength(2);
        });

        it('WHEN Chair.jpg, Chair_2.jpg and Chair_3.jpg are added THEN all are MATCHED and positioned Primary / Image 2 / Image 3', async () => {
            await pick(['Chair.jpg', 'Chair_2.jpg', 'Chair_3.jpg'], [makeRow('Chair')]);
            expect(screen.getAllByText('MATCHED')).toHaveLength(3);
            expect(screen.getAllByTestId('image-position').map(e => e.textContent)).toEqual(['Primary', 'Image 2', 'Image 3']);
        });

        it('WHEN only Chair_2.jpg is added THEN it is MISSING PRIMARY', async () => {
            await pick(['Chair_2.jpg'], [makeRow('Chair')]);
            expect(screen.getByText('MISSING PRIMARY')).toBeInTheDocument();
        });

        it('WHEN rendered THEN the "How to Upload Product Images" guide shows the single and multiple examples', () => {
            render(<ImageUploadStep parsedRows={[makeRow('Chair')]} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const guide = screen.getByTestId('image-naming-guide');
            expect(guide).toHaveTextContent('How to Upload Product Images');
            expect(guide).toHaveTextContent('Chair.jpg');
            expect(guide).toHaveTextContent('Chair_2.jpg');
            expect(guide).toHaveTextContent('Chair_3.jpg');
            expect(guide).toHaveTextContent('primary');
        });

        it('WHEN the CSV row carries a backend name_key THEN it is used for matching', async () => {
            const row = { row_index: 1, status: 'valid', errors: [], warnings: [], data: { name: 'Namur Sofa', name_key: 'namur sofa', image_urls: [] } };
            await pick(['Namur Sofa.jpg'], [row]);
            expect(screen.getByText('MATCHED')).toBeInTheDocument();
        });
    });

    describe('GIVEN files are selected and Upload Images is clicked', () => {
        it('WHEN upload completes THEN onImagesUploaded is called with uploaded list', async () => {
            const uploaded = [{ filename: 'WA-001.jpg', name_key: 'wa-001', cdn_url: 'https://cdn.neonbee.app/WA-001.jpg' }];
            onUpload.mockResolvedValue({ uploaded, failed: [] });
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile('WA-001.jpg')] } });
            await waitFor(() => screen.getByText('Upload 1 image'));
            fireEvent.click(screen.getByText('Upload 1 image'));
            await waitFor(() => expect(onImagesUploaded).toHaveBeenCalledWith(uploaded));
        });
    });

    describe('GIVEN no files have been selected', () => {
        it('WHEN rendered THEN Upload Images button is disabled', () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const btn = screen.getByText('Upload Images').closest('button') as HTMLButtonElement;
            expect(btn).toBeDisabled();
        });
    });

    describe('GIVEN the user clicks Skip images', () => {
        it('WHEN clicked THEN onSkip is called', () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            fireEvent.click(screen.getByText(/Skip images/));
            expect(onSkip).toHaveBeenCalled();
        });
    });

    describe('GIVEN the photo guidance', () => {
        it('WHEN rendered THEN the product spec chip 1:1 · 2000×2000 · ≤1 MB is visible with an ⓘ that opens on tap', () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            expect(screen.getByTestId('image-spec-chip')).toHaveTextContent('1:1 · 2000×2000 · ≤1 MB');
            fireEvent.click(screen.getByRole('button', { name: /about this image size/i }));
            expect(screen.getByRole('tooltip')).toBeVisible();
            expect(screen.getByRole('tooltip')).toHaveTextContent('Accepted: JPG, PNG, WebP');
        });
    });

    describe('GIVEN an oversize photo matching a product name', () => {
        it('WHEN uploaded THEN it is auto-fitted first, the fitted file is sent, and the row shows the size result', async () => {
            const fitted = new File([new Uint8Array(640 * 1024)], 'WA-001.webp', { type: 'image/webp' });
            mockFit.mockImplementation(async (file: File) => ({
                file: fitted, changed: true, originalName: file.name, originalBytes: 6.1 * MB, finalBytes: fitted.size,
                width: 2000, height: 2000, resized: true, overCap: false,
            }));
            // The API echoes the name it received (the fitted one).
            onUpload.mockResolvedValue({
                uploaded: [{ filename: 'WA-001.webp', name_key: 'wa-001', cdn_url: 'https://cdn.neonbee.app/WA-001.webp' }],
                failed: [],
            });
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const original = sizedFile('WA-001.jpg', 6.1 * MB);
            fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [original] } });
            fireEvent.click(await screen.findByText('Upload 1 image'));

            await waitFor(() => expect(onImagesUploaded).toHaveBeenCalled());
            expect(mockFit).toHaveBeenCalledWith(original, IMAGE_FIT_SLOTS.product);
            expect(onUpload).toHaveBeenCalledWith([fitted]);
            // Mapped back to the merchant's file name.
            expect(onImagesUploaded).toHaveBeenCalledWith([
                { filename: 'WA-001.jpg', name_key: 'wa-001', cdn_url: 'https://cdn.neonbee.app/WA-001.webp' },
            ]);
            expect(screen.getByTestId('bulk-fit-note')).toHaveTextContent('6.1 MB → 640 KB (resized to 2000×2000)');
        });
    });

    describe('GIVEN a photo already within the cap', () => {
        it('WHEN uploaded THEN the original file is sent and the row says uploaded as-is', async () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const original = sizedFile('WA-002.png', 300 * 1024, 'image/png');
            fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [original] } });
            fireEvent.click(await screen.findByText('Upload 1 image'));
            await waitFor(() => expect(onUpload).toHaveBeenCalledWith([original]));
            expect(await screen.findByTestId('bulk-fit-note')).toHaveTextContent('300 KB — uploaded as-is');
        });
    });

    describe('GIVEN a photo that cannot be brought under the 5 MB bulk limit', () => {
        it('WHEN uploaded THEN it is not sent and its row shows the reason', async () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
                target: { files: [sizedFile('WA-001.jpg', 8 * MB)] },
            });
            fireEvent.click(await screen.findByText('Upload 1 image'));
            expect(await screen.findByText('Too large (max 5 MB)')).toBeInTheDocument();
            expect(onUpload).not.toHaveBeenCalled();
        });
    });
});
