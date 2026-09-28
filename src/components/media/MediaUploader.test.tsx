import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Auto-fit is unit-tested in utils/imageFit.spec.ts — here we only check the
// uploader hands every file to it and uploads what it returns.
const mockFit = vi.hoisted(() => vi.fn());
vi.mock('../../utils/imageFit', async importOriginal => ({
  ...(await importOriginal<typeof import('../../utils/imageFit')>()),
  fitImageFile: (...args: any[]) => mockFit(...args),
}));

vi.mock('../../services/mediaService', () => ({
  mediaService: {
    uploadFile: vi.fn().mockResolvedValue({ url: 'http://example.com/img.jpg' }),
  },
}));

vi.mock('./ImageThumbnail', () => ({
  default: ({ url, onRemove, isLoading, error }: any) => (
    <div data-testid="thumbnail">
      {url && <img src={url} alt="thumb" />}
      {isLoading && <span>Uploading...</span>}
      {error && <span data-testid="thumb-error">{error}</span>}
      <button onClick={onRemove}>Remove</button>
    </div>
  ),
}));

import MediaUploader from './MediaUploader';
import { mediaService } from '../../services/mediaService';
import { IMAGE_FIT_SLOTS, type ImageFitResult } from '../../utils/imageFit';

const mockUploadFile = mediaService.uploadFile as ReturnType<typeof vi.fn>;

const MB = 1024 * 1024;
const fileOfSize = (name: string, type: string, bytes: number) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { configurable: true, value: bytes });
  return f;
};
const asIs = (file: File, width?: number, height?: number): ImageFitResult => ({
  file, changed: false, originalName: file.name, originalBytes: file.size, finalBytes: file.size,
  width, height, resized: false, overCap: false,
});
const selectFiles = (files: File[]) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
};

beforeEach(() => {
  mockUploadFile.mockReset();
  mockUploadFile.mockResolvedValue({ url: 'http://example.com/img.jpg' });
  mockFit.mockReset();
  mockFit.mockImplementation(async (file: File) => asIs(file));
});

describe('MediaUploader', () => {
  describe('Given initial state', () => {
    it('When rendered / Then shows drop zone', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      expect(screen.getByText(/Drag and drop images/i)).toBeInTheDocument();
    });

    it('When rendered / Then shows file format hint', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      expect(screen.getByText(/PNG, JPG, SVG/i)).toBeInTheDocument();
    });

    it('When rendered / Then the hint says WebP is accepted and large photos are shrunk automatically', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      expect(screen.getByText(/WebP — large photos are shrunk automatically/i)).toBeInTheDocument();
    });

    it('When rendered / Then the file picker accepts WebP', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.accept).toContain('image/webp');
    });
  });

  describe('Given photo guidance for the storefront', () => {
    it('When rendered / Then the spec chip shows 1:1 · 2000×2000 · ≤1 MB, even before any upload', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      expect(screen.getByTestId('image-spec-chip')).toHaveTextContent('1:1 · 2000×2000 · ≤1 MB');
    });

    it('When the ⓘ is tapped / Then the explanation opens without opening the file picker', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const pick = vi.spyOn(input, 'click');
      fireEvent.click(screen.getByRole('button', { name: /about this image size/i }));
      expect(screen.getByRole('tooltip')).toBeVisible();
      expect(pick).not.toHaveBeenCalled();
    });

    it('When images exist / Then the old "Best results … 1200×1200px" text is gone', () => {
      render(<MediaUploader imageUrls={['http://example.com/a.jpg']} onImagesChange={vi.fn()} />);
      expect(screen.queryByText(/1200×1200px/i)).not.toBeInTheDocument();
    });
  });

  describe('Given existing images', () => {
    it('When imageUrls provided / Then shows thumbnails', () => {
      render(<MediaUploader imageUrls={['http://example.com/a.jpg', 'http://example.com/b.jpg']} onImagesChange={vi.fn()} />);
      expect(screen.getAllByTestId('thumbnail').length).toBe(2);
    });

    it('When remove clicked / Then calls onImagesChange without that URL', () => {
      const onImagesChange = vi.fn();
      render(<MediaUploader imageUrls={['http://example.com/a.jpg']} onImagesChange={onImagesChange} />);
      fireEvent.click(screen.getByText('Remove'));
      expect(onImagesChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Given max files reached', () => {
    it('When maxFiles is 2 and 2 images already exist / Then no more thumbnails are shown', () => {
      render(<MediaUploader imageUrls={['http://a.com/1.jpg', 'http://a.com/2.jpg']} onImagesChange={vi.fn()} maxFiles={2} />);
      expect(screen.getAllByTestId('thumbnail').length).toBe(2);
    });

    it('When maxFiles reached / Then shows max images message', () => {
      render(<MediaUploader imageUrls={['http://a.com/1.jpg', 'http://a.com/2.jpg']} onImagesChange={vi.fn()} maxFiles={2} />);
      expect(screen.getByText(/Maximum 2 images reached/i)).toBeInTheDocument();
    });
  });

  describe('Given drag events', () => {
    it('When drag over drop zone / Then shows drop files here text', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      const dropZone = screen.getByText(/Drag and drop images/i).closest('div')!;
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
      expect(screen.getByText('Drop files here')).toBeInTheDocument();
    });

    it('When drag leave / Then shows default text again', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      const dropZone = screen.getByText(/Drag and drop images/i).closest('div')!;
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
      fireEvent.dragLeave(dropZone);
      expect(screen.getByText(/Drag and drop images here/i)).toBeInTheDocument();
    });
  });

  describe('Given file upload via input', () => {
    it('When valid image file selected / Then calls onImagesChange with uploaded URL', async () => {
      const onImagesChange = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={onImagesChange} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => {
        expect(onImagesChange).toHaveBeenCalledWith(['http://example.com/img.jpg']);
      });
    });

    it('When invalid file type selected / Then does not call onImagesChange', async () => {
      const onImagesChange = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={onImagesChange} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => {
        expect(screen.getAllByTestId('thumbnail').length).toBeGreaterThan(0);
      });
      expect(onImagesChange).not.toHaveBeenCalled();
    });
  });

  describe('Given any photo is uploaded', () => {
    it('When selected / Then it is auto-fitted to the product slot before upload', async () => {
      const file = fileOfSize('photo.jpg', 'image/jpeg', 2 * MB);
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      selectFiles([file]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
      expect(mockFit).toHaveBeenCalledWith(file, IMAGE_FIT_SLOTS.product);
    });

    it('When the photo is within the cap / Then the original bytes go up and the merchant is told', async () => {
      const file = fileOfSize('small.webp', 'image/webp', 400 * 1024);
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      selectFiles([file]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
      expect(mockUploadFile.mock.calls[0][0]).toBe(file);
      expect(await screen.findByTestId('image-fit-notes')).toHaveTextContent('small.webp: 400 KB — uploaded as-is');
    });
  });

  describe('Given an oversize photo', () => {
    it('When auto-fit shrinks it / Then the fitted file is uploaded, its size is reported and the note says what happened', async () => {
      const fitted = new File([new Uint8Array(640 * 1024)], 'photo.webp', { type: 'image/webp' });
      mockFit.mockResolvedValue({
        file: fitted, changed: true, originalName: 'photo.jpg', originalBytes: 6.1 * MB, finalBytes: fitted.size,
        width: 2000, height: 2000, resized: true, overCap: false,
      });
      const onImageMeasured = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} onImageMeasured={onImageMeasured} />);
      selectFiles([fileOfSize('photo.jpg', 'image/jpeg', 6.1 * MB)]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));

      const uploaded = mockUploadFile.mock.calls[0][0] as File;
      expect(uploaded).toBe(fitted);
      expect(uploaded.name).toBe('photo.webp');
      expect(onImageMeasured).toHaveBeenCalledWith('http://example.com/img.jpg', 2000, 2000);
      expect(await screen.findByTestId('image-fit-notes'))
        .toHaveTextContent('photo.jpg: 6.1 MB → 640 KB (resized to 2000×2000)');
    });

    it('When it cannot be fitted and is still over 10 MB / Then it is rejected with the 10 MB message', async () => {
      const onImagesChange = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={onImagesChange} />);
      selectFiles([fileOfSize('big.jpg', 'image/jpeg', 14 * MB)]);
      await waitFor(() => expect(screen.getByTestId('thumb-error')).toHaveTextContent('Too large (max 10 MB)'));
      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(onImagesChange).not.toHaveBeenCalled();
    });

    it('When auto-fit throws / Then the original is uploaded if it is under 10 MB', async () => {
      mockFit.mockRejectedValue(new Error('canvas blew up'));
      const file = fileOfSize('odd.jpg', 'image/jpeg', 3 * MB);
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      selectFiles([file]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
      expect(mockUploadFile.mock.calls[0][0]).toBe(file);
    });
  });

  describe('Given an SVG', () => {
    it('When uploaded / Then it still uploads and no size is reported', async () => {
      const onImageMeasured = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} onImageMeasured={onImageMeasured} />);
      selectFiles([fileOfSize('logo.svg', 'image/svg+xml', 20 * 1024)]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
      expect(onImageMeasured).not.toHaveBeenCalled();
    });
  });

  describe('Given several files dropped at once', () => {
    it('When both upload / Then the final list keeps both urls', async () => {
      mockUploadFile
        .mockResolvedValueOnce({ url: 'http://example.com/1.jpg' })
        .mockResolvedValueOnce({ url: 'http://example.com/2.jpg' });
      const onImagesChange = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={onImagesChange} />);
      selectFiles([fileOfSize('1.jpg', 'image/jpeg', MB), fileOfSize('2.jpg', 'image/jpeg', MB)]);
      await waitFor(() =>
        expect(onImagesChange).toHaveBeenLastCalledWith(['http://example.com/1.jpg', 'http://example.com/2.jpg']),
      );
    });
  });
});
