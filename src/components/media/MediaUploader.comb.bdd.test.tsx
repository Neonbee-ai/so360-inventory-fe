import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../../utils/imageFit', async importOriginal => ({
  ...(await importOriginal<typeof import('../../utils/imageFit')>()),
  fitImageFile: async (file: File) => ({ file, changed: false, originalName: file.name, originalBytes: 1, finalBytes: 1, resized: false, overCap: false }),
}));
vi.mock('../../services/mediaService', () => ({ mediaService: { uploadFile: vi.fn() } }));
vi.mock('./ImageThumbnail', () => ({
  default: ({ url, error }: any) => <div data-testid="thumbnail">{url}{error && <span data-testid="thumb-error">{error}</span>}</div>,
}));

import MediaUploader from './MediaUploader';

describe('Given MediaUploader on Comb primitives', () => {
  it('When rendered empty / Then the drop zone shows and no limit Alert or thumbnails appear', () => {
    render(<MediaUploader imageUrls={[]} onImagesChange={vi.fn()} />);
    expect(screen.getByText(/Drag and drop images/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('thumbnail')).toBeNull();
  });

  it('When the limit is reached / Then a warning Alert is shown', () => {
    render(<MediaUploader imageUrls={['a', 'b']} onImagesChange={vi.fn()} maxFiles={2} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Maximum 2 images reached');
    expect(alert.getAttribute('data-variant')).toBe('warning');
  });

  it('When under the limit / Then no limit Alert is shown', () => {
    render(<MediaUploader imageUrls={['a']} onImagesChange={vi.fn()} maxFiles={2} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('When a non-image file is chosen / Then an Invalid type error appears and nothing is uploaded', async () => {
    const onImagesChange = vi.fn();
    render(<MediaUploader imageUrls={[]} onImagesChange={onImagesChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(screen.getByTestId('thumb-error')).toHaveTextContent('Invalid type'));
    expect(onImagesChange).not.toHaveBeenCalled();
  });
});
