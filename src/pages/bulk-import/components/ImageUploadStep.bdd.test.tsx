import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ImageUploadStep from './ImageUploadStep';

function makeRow(sku: string, status: 'valid' | 'error' | 'warning' = 'valid') {
    return { row_index: 1, status, errors: [], warnings: [], data: { sku, image_urls: [] } };
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

    describe('GIVEN a file matching a valid SKU is added', () => {
        it('WHEN file selected THEN the file appears in the list with MATCHED badge', async () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile('WA-001.jpg')] } });
            await waitFor(() => expect(screen.getByText('WA-001.jpg')).toBeInTheDocument());
            expect(screen.getByText('MATCHED')).toBeInTheDocument();
        });
    });

    describe('GIVEN a file with a name not matching any SKU is added', () => {
        it('WHEN file selected THEN the file appears with NO MATCH badge', async () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile('unknown-item.jpg')] } });
            await waitFor(() => expect(screen.getByText('unknown-item.jpg')).toBeInTheDocument());
            expect(screen.getByText('NO MATCH')).toBeInTheDocument();
        });
    });

    describe('GIVEN a file matching an error row SKU is added', () => {
        it('WHEN file selected THEN it shows NO MATCH (error rows are excluded from valid SKU set)', async () => {
            render(<ImageUploadStep parsedRows={rows} onImagesUploaded={onImagesUploaded} onUpload={onUpload} onSkip={onSkip} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile('DUPE-001.jpg')] } });
            await waitFor(() => expect(screen.getByText('DUPE-001.jpg')).toBeInTheDocument());
            expect(screen.getByText('NO MATCH')).toBeInTheDocument();
        });
    });

    describe('GIVEN files are selected and Upload Images is clicked', () => {
        it('WHEN upload completes THEN onImagesUploaded is called with uploaded list', async () => {
            const uploaded = [{ filename: 'WA-001.jpg', sku: 'wa-001', cdn_url: 'https://cdn.neonbee.app/WA-001.jpg' }];
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
});
