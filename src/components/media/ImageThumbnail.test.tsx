import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ImageThumbnail from './ImageThumbnail';

describe('ImageThumbnail', () => {
  it('When url provided / Then renders img with that src', () => {
    render(<ImageThumbnail url="http://example.com/photo.jpg" onRemove={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'http://example.com/photo.jpg');
  });

  it('When isLoading is true / Then does not show img', () => {
    render(<ImageThumbnail url="" isLoading={true} onRemove={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('When error is set / Then shows Failed text', () => {
    render(<ImageThumbnail url="" error="Upload failed" onRemove={vi.fn()} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('When remove button clicked / Then calls onRemove', () => {
    const onRemove = vi.fn();
    render(<ImageThumbnail url="http://example.com/img.jpg" onRemove={onRemove} />);
    const removeBtn = screen.getByRole('button');
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalled();
  });
});
