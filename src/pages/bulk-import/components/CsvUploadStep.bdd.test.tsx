import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CsvUploadStep from './CsvUploadStep';

function makeFile(name = 'items.csv', type = 'text/csv', content = 'name,sku\nWidget A,WA-001') {
    return new File([content], name, { type });
}

describe('CsvUploadStep', () => {
    let onParsed: ReturnType<typeof vi.fn>;
    let onParse: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onParsed = vi.fn();
        onParse = vi.fn().mockResolvedValue({ total: 2, valid: 2, invalid: 0, rows: [] });
    });

    describe('GIVEN the step is rendered', () => {
        it('WHEN rendered THEN the drop zone is visible', () => {
            render(<CsvUploadStep onParsed={onParsed} onParse={onParse} />);
            expect(screen.getByText('Drop your CSV here')).toBeInTheDocument();
        });

        it('WHEN rendered THEN the required columns reference is shown', () => {
            render(<CsvUploadStep onParsed={onParsed} onParse={onParse} />);
            expect(screen.getByText('Required CSV columns')).toBeInTheDocument();
        });

        it('WHEN rendered THEN the template download link is present', () => {
            render(<CsvUploadStep onParsed={onParsed} onParse={onParse} />);
            expect(screen.getByText('Download CSV template')).toBeInTheDocument();
        });
    });

    describe('GIVEN a valid CSV file is selected', () => {
        it('WHEN file selected THEN onParse is called with the file', async () => {
            render(<CsvUploadStep onParsed={onParsed} onParse={onParse} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            const file = makeFile();
            fireEvent.change(input, { target: { files: [file] } });
            await waitFor(() => expect(onParse).toHaveBeenCalledWith(file));
        });

        it('WHEN parse succeeds THEN onParsed is called with the result', async () => {
            const result = { total: 2, valid: 2, invalid: 0, rows: [] };
            onParse.mockResolvedValue(result);
            render(<CsvUploadStep onParsed={onParsed} onParse={onParse} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });
            await waitFor(() => expect(onParsed).toHaveBeenCalledWith(result));
        });
    });

    describe('GIVEN a non-CSV file is selected', () => {
        it('WHEN file selected THEN onParse is NOT called', async () => {
            render(<CsvUploadStep onParsed={onParsed} onParse={onParse} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            const file = makeFile('photo.jpg', 'image/jpeg');
            fireEvent.change(input, { target: { files: [file] } });
            await waitFor(() => expect(screen.getByText(/Please upload a .csv file/i)).toBeInTheDocument());
            expect(onParse).not.toHaveBeenCalled();
        });
    });

    describe('GIVEN the parse API fails', () => {
        it('WHEN parse rejects THEN an error message is shown', async () => {
            onParse.mockRejectedValue(new Error('Server error: malformed CSV'));
            render(<CsvUploadStep onParsed={onParsed} onParse={onParse} />);
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(input, { target: { files: [makeFile()] } });
            await waitFor(() => expect(screen.getByText('Server error: malformed CSV')).toBeInTheDocument());
            expect(onParsed).not.toHaveBeenCalled();
        });
    });

    describe('GIVEN a file is dropped on the drop zone', () => {
        it('WHEN a CSV file is dropped THEN onParse is called', async () => {
            render(<CsvUploadStep onParsed={onParsed} onParse={onParse} />);
            const dropZone = screen.getByText('Drop your CSV here').closest('div')!;
            const file = makeFile();
            fireEvent.drop(dropZone, {
                dataTransfer: { files: [file] },
            });
            await waitFor(() => expect(onParse).toHaveBeenCalledWith(file));
        });
    });
});
