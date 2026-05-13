import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  });
});
