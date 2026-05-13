import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('browser-image-compression', () => ({
  default: vi.fn().mockImplementation((file) => Promise.resolve(file)),
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

const mockUploadFile = mediaService.uploadFile as ReturnType<typeof vi.fn>;

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
});
