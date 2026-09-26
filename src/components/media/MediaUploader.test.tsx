import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('browser-image-compression', () => ({
  default: vi.fn().mockImplementation((file) => Promise.resolve(file)),
}));

vi.mock('../../utils/imageDimensions', () => ({
  measureImageFile: vi.fn().mockResolvedValue(null),
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

import imageCompression from 'browser-image-compression';
import MediaUploader from './MediaUploader';
import { mediaService } from '../../services/mediaService';
import { measureImageFile } from '../../utils/imageDimensions';

const mockUploadFile = mediaService.uploadFile as ReturnType<typeof vi.fn>;
const mockCompress = imageCompression as unknown as ReturnType<typeof vi.fn>;
const mockMeasure = measureImageFile as unknown as ReturnType<typeof vi.fn>;

const MB = 1024 * 1024;
const fileOfSize = (name: string, type: string, bytes: number) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { configurable: true, value: bytes });
  return f;
};
const selectFiles = (files: File[]) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
};

beforeEach(() => {
  mockUploadFile.mockReset();
  mockUploadFile.mockResolvedValue({ url: 'http://example.com/img.jpg' });
  mockCompress.mockReset();
  mockCompress.mockImplementation((file: File) => Promise.resolve(file));
  mockMeasure.mockReset();
  mockMeasure.mockResolvedValue(null);
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

    it('When rendered / Then the hint says WebP is accepted, up to 10 MB, originals kept', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      expect(screen.getByText(/WebP — up to 10 MB each, originals kept/i)).toBeInTheDocument();
    });

    it('When rendered / Then the file picker accepts WebP', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.accept).toContain('image/webp');
    });
  });

  describe('Given photo guidance for the storefront', () => {
    it('When images exist / Then shows the recommended size and shape', () => {
      render(<MediaUploader imageUrls={['http://example.com/a.jpg']} onImagesChange={vi.fn()} />);
      expect(screen.getByText(/square photos \(1:1\), at least 1200×1200px/i)).toBeInTheDocument();
    });

    it('When there are no images yet / Then the guidance is not shown', () => {
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      expect(screen.queryByText(/square photos \(1:1\)/i)).not.toBeInTheDocument();
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

  describe('Given a master photo within 10 MB and 4096 px', () => {
    it('When it is uploaded / Then the original bytes go up untouched (no re-encode)', async () => {
      mockMeasure.mockResolvedValue({ width: 3000, height: 3000 });
      const file = fileOfSize('master.jpg', 'image/jpeg', 6 * MB);
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      selectFiles([file]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
      expect(mockCompress).not.toHaveBeenCalled();
      expect(mockUploadFile.mock.calls[0][0]).toBe(file);
    });

    it('When it is a WebP / Then it is accepted and uploaded as-is', async () => {
      const file = fileOfSize('photo.webp', 'image/webp', 2 * MB);
      const onImagesChange = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={onImagesChange} />);
      selectFiles([file]);
      await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith(['http://example.com/img.jpg']));
      expect(mockUploadFile.mock.calls[0][0]).toBe(file);
    });

    it('When the upload succeeds / Then onImageMeasured reports the url and natural size', async () => {
      mockMeasure.mockResolvedValue({ width: 1600, height: 1200 });
      const onImageMeasured = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} onImageMeasured={onImageMeasured} />);
      selectFiles([fileOfSize('a.jpg', 'image/jpeg', MB)]);
      await waitFor(() =>
        expect(onImageMeasured).toHaveBeenCalledWith('http://example.com/img.jpg', 1600, 1200),
      );
    });

    it('When the size cannot be read (SVG) / Then it still uploads and nothing is reported', async () => {
      const onImageMeasured = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} onImageMeasured={onImageMeasured} />);
      selectFiles([fileOfSize('logo.svg', 'image/svg+xml', 20 * 1024)]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
      expect(mockCompress).not.toHaveBeenCalled();
      expect(onImageMeasured).not.toHaveBeenCalled();
    });
  });

  describe('Given a master photo larger than 4096 px', () => {
    it('When it is uploaded / Then it is downscaled to 2400 px at quality 0.92, keeping its format', async () => {
      mockMeasure
        .mockResolvedValueOnce({ width: 6000, height: 4000 })
        .mockResolvedValueOnce({ width: 2400, height: 1600 });
      mockCompress.mockResolvedValue(new File(['y'], 'blob', { type: 'image/png' }));
      const onImageMeasured = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} onImageMeasured={onImageMeasured} />);
      selectFiles([fileOfSize('huge.png', 'image/png', 8 * MB)]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));

      expect(mockCompress).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          maxWidthOrHeight: 2400,
          initialQuality: 0.92,
          alwaysKeepResolution: true,
          fileType: 'image/png',
        }),
      );
      const uploaded = mockUploadFile.mock.calls[0][0] as File;
      expect(uploaded.name).toBe('huge.png');
      expect(uploaded.type).toBe('image/png');
      expect(onImageMeasured).toHaveBeenCalledWith('http://example.com/img.jpg', 2400, 1600);
    });
  });

  describe('Given a file over 10 MB', () => {
    it('When it is uploaded / Then it is downscaled before upload', async () => {
      mockCompress.mockResolvedValue(new File(['y'], 'blob', { type: 'image/jpeg' }));
      render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
      selectFiles([fileOfSize('big.jpeg', 'image/jpeg', 14 * MB)]);
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
      expect(mockCompress).toHaveBeenCalledTimes(1);
      expect((mockUploadFile.mock.calls[0][0] as File).name).toBe('big.jpg');
    });

    it('When it is still over 10 MB after downscaling / Then it is rejected with the 10 MB message', async () => {
      // Real bytes: the uploader re-wraps the compressor's Blob in a new File,
      // which takes its size from the content, not a faked .size property.
      mockCompress.mockResolvedValue(new Blob([new Uint8Array(12 * MB)], { type: 'image/jpeg' }));
      const onImagesChange = vi.fn();
      render(<MediaUploader imageUrls={[]} onImagesChange={onImagesChange} />);
      selectFiles([fileOfSize('big.jpg', 'image/jpeg', 14 * MB)]);
      await waitFor(() => expect(screen.getByTestId('thumb-error')).toHaveTextContent('Too large (max 10 MB)'));
      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(onImagesChange).not.toHaveBeenCalled();
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
