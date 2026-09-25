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

  describe('Given a loaded image, to show its size and shape', () => {
    const loadWith = (img: HTMLElement, width: number, height: number) => {
      Object.defineProperty(img, 'naturalWidth', { configurable: true, value: width });
      Object.defineProperty(img, 'naturalHeight', { configurable: true, value: height });
      fireEvent.load(img);
    };

    it('When a large square photo loads / Then the badge shows its size and 1:1 without a warning', () => {
      render(<ImageThumbnail url="http://cdn.example.com/square.jpg" onRemove={vi.fn()} />);
      loadWith(screen.getByRole('img'), 1200, 1200);
      const badge = screen.getByTestId('image-size-badge');
      expect(badge).toHaveTextContent('1200×1200 · 1:1');
      expect(badge).not.toHaveTextContent('⚠');
      expect(badge).toHaveAttribute('title', 'Good fit for store product cards');
    });

    it('When a 9:16 phone photo loads / Then the badge warns and explains why in its tooltip', () => {
      render(<ImageThumbnail url="http://cdn.example.com/tall.jpg" onRemove={vi.fn()} />);
      loadWith(screen.getByRole('img'), 1080, 1920);
      const badge = screen.getByTestId('image-size-badge');
      expect(badge).toHaveTextContent('⚠ 1080×1920 · 9:16');
      expect(badge.getAttribute('title')).toMatch(/Very tall/);
    });

    it('When the image has not loaded yet / Then no badge is shown', () => {
      render(<ImageThumbnail url="http://cdn.example.com/pending.jpg" onRemove={vi.fn()} />);
      expect(screen.queryByTestId('image-size-badge')).not.toBeInTheDocument();
    });

    it('When the broken-image placeholder loads / Then it is not graded', () => {
      render(<ImageThumbnail url="http://broken.link/img.jpg" onRemove={vi.fn()} />);
      const img = screen.getByRole('img') as HTMLImageElement;
      img.src = 'data:image/svg+xml,<svg/>';
      loadWith(img, 96, 96);
      expect(screen.queryByTestId('image-size-badge')).not.toBeInTheDocument();
    });

    it('When an SVG reports no intrinsic size / Then no badge is shown', () => {
      render(<ImageThumbnail url="http://cdn.example.com/logo.svg" onRemove={vi.fn()} />);
      loadWith(screen.getByRole('img'), 0, 0);
      expect(screen.queryByTestId('image-size-badge')).not.toBeInTheDocument();
    });

    it('When a photo loads / Then the whole photo is shown (contain), not cropped', () => {
      render(<ImageThumbnail url="http://cdn.example.com/tall.jpg" onRemove={vi.fn()} />);
      expect(screen.getByRole('img').className).toContain('object-contain');
    });
  });
});
