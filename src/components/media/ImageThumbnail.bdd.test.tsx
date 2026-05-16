import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ImageThumbnail from './ImageThumbnail';

describe('ImageThumbnail', () => {
  describe('Given a successfully uploaded image', () => {
    it('When a url is provided / Then renders an img element with that src', () => {
      render(<ImageThumbnail url="http://example.com/photo.jpg" onRemove={vi.fn()} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'http://example.com/photo.jpg');
    });

    it('When a url is provided / Then renders the remove button', () => {
      render(<ImageThumbnail url="http://example.com/photo.jpg" onRemove={vi.fn()} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('When the img fails to load / Then the image falls back gracefully (no crash)', () => {
      expect(() => {
        render(<ImageThumbnail url="http://broken.link/img.jpg" onRemove={vi.fn()} />);
      }).not.toThrow();
    });
  });

  describe('Given the image is still uploading', () => {
    it('When isLoading is true / Then does not show an img element', () => {
      render(<ImageThumbnail url="" isLoading={true} onRemove={vi.fn()} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('When isLoading is true / Then does not show the Failed text', () => {
      render(<ImageThumbnail url="" isLoading={true} onRemove={vi.fn()} />);
      expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    });
  });

  describe('Given the upload has failed', () => {
    it('When error string is set / Then shows "Failed" text', () => {
      render(<ImageThumbnail url="" error="Upload failed" onRemove={vi.fn()} />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('When error string is set / Then does not show an img element', () => {
      render(<ImageThumbnail url="" error="Network error" onRemove={vi.fn()} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('When error is set / Then the remove button is still accessible', () => {
      render(<ImageThumbnail url="" error="Upload failed" onRemove={vi.fn()} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Given the user wants to remove an image', () => {
    it('When the remove button is clicked / Then calls the onRemove callback', () => {
      const onRemove = vi.fn();
      render(<ImageThumbnail url="http://example.com/img.jpg" onRemove={onRemove} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('When the remove button is clicked multiple times / Then calls onRemove each time', () => {
      const onRemove = vi.fn();
      render(<ImageThumbnail url="http://example.com/img.jpg" onRemove={onRemove} />);
      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByRole('button'));
      expect(onRemove).toHaveBeenCalledTimes(2);
    });
  });

  describe('Given default state (no loading, no error, valid url)', () => {
    it('When rendered / Then shows exactly one img and one button', () => {
      render(<ImageThumbnail url="http://cdn.example.com/product.jpg" onRemove={vi.fn()} />);
      expect(screen.getAllByRole('img')).toHaveLength(1);
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });
  });
});
