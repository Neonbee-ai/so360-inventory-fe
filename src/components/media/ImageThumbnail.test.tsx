import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ImageThumbnail from './ImageThumbnail';

describe('Given ImageThumbnail', () => {
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

describe('Given ImageThumbnail display variants', () => {
  it('When isLoading is false and url is provided / Then renders the image element', () => {
    render(<ImageThumbnail url="http://example.com/ok.jpg" isLoading={false} onRemove={vi.fn()} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('When error is set / Then does not render an img element', () => {
    render(<ImageThumbnail url="" error="bad file" onRemove={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('When isLoading is true and error is provided / Then shows loading state (isLoading takes priority)', () => {
    render(<ImageThumbnail url="" isLoading={true} error="Upload failed" onRemove={vi.fn()} />);
    // isLoading renders spinner, not img or Failed text
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('When url is empty string with no error/loading / Then renders img element with empty src', () => {
    render(<ImageThumbnail url="" onRemove={vi.fn()} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('When remove is called multiple times / Then onRemove is called each time', () => {
    const onRemove = vi.fn();
    render(<ImageThumbnail url="http://example.com/multi.jpg" onRemove={onRemove} />);
    const removeBtn = screen.getByRole('button');
    fireEvent.click(removeBtn);
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(2);
  });
});
