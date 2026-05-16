import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

vi.mock('../../../components/media/MediaUploader', () => ({
  default: ({ imageUrls, onImagesChange }: any) => (
    <div data-testid="media-uploader">
      <span>Images: {imageUrls.length}</span>
      <button onClick={() => onImagesChange([])}>clear</button>
    </div>
  ),
}));

import MediaTab from './MediaTab';

const makeProps = (overrides: any = {}) => ({
  image_urls: [],
  updateField: vi.fn(),
  ...overrides,
});

describe('MediaTab', () => {
  describe('Given the tab is rendered with no existing images', () => {
    it('When the tab renders / Then shows the "Upload Images" section heading', () => {
      render(<MediaTab {...makeProps()} />);
      expect(screen.getByText('Upload Images')).toBeInTheDocument();
    });

    it('When the tab renders / Then the MediaUploader component is present', () => {
      render(<MediaTab {...makeProps()} />);
      expect(screen.getByTestId('media-uploader')).toBeInTheDocument();
    });

    it('When the tab renders / Then the URL paste input field is present', () => {
      render(<MediaTab {...makeProps()} />);
      expect(screen.getByPlaceholderText('Paste image URL...')).toBeInTheDocument();
    });

    it('When the tab renders / Then the "Add" button is present', () => {
      render(<MediaTab {...makeProps()} />);
      expect(screen.getByText('Add')).toBeInTheDocument();
    });
  });

  describe('Given the MediaUploader reflects current image count', () => {
    it('When image_urls is empty / Then uploader shows "Images: 0"', () => {
      render(<MediaTab {...makeProps({ image_urls: [] })} />);
      expect(screen.getByText('Images: 0')).toBeInTheDocument();
    });

    it('When image_urls has two entries / Then uploader shows "Images: 2"', () => {
      render(<MediaTab {...makeProps({ image_urls: ['http://a.com/1.jpg', 'http://b.com/2.jpg'] })} />);
      expect(screen.getByText('Images: 2')).toBeInTheDocument();
    });
  });

  describe('Given the user pastes a new URL and clicks Add', () => {
    it('When a valid URL is entered and Add is clicked / Then calls updateField with image_urls containing the new URL', () => {
      const updateField = vi.fn();
      render(<MediaTab {...makeProps({ updateField })} />);
      fireEvent.change(screen.getByPlaceholderText('Paste image URL...'), {
        target: { value: 'https://example.com/product.jpg' },
      });
      fireEvent.click(screen.getByText('Add'));
      expect(updateField).toHaveBeenCalledWith('image_urls', ['https://example.com/product.jpg']);
    });

    it('When a URL is added / Then the URL input is cleared after the call', () => {
      const updateField = vi.fn();
      render(<MediaTab {...makeProps({ updateField })} />);
      const input = screen.getByPlaceholderText('Paste image URL...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'https://example.com/img.jpg' } });
      fireEvent.click(screen.getByText('Add'));
      expect(input.value).toBe('');
    });

    it('When a URL is added to an existing list / Then calls updateField with all URLs including the new one', () => {
      const updateField = vi.fn();
      render(<MediaTab {...makeProps({ image_urls: ['https://existing.com/img.jpg'], updateField })} />);
      fireEvent.change(screen.getByPlaceholderText('Paste image URL...'), {
        target: { value: 'https://new.com/img2.jpg' },
      });
      fireEvent.click(screen.getByText('Add'));
      expect(updateField).toHaveBeenCalledWith('image_urls', [
        'https://existing.com/img.jpg',
        'https://new.com/img2.jpg',
      ]);
    });
  });

  describe('Given the user tries to add a duplicate URL', () => {
    it('When a URL already in the list is entered / Then does not call updateField', () => {
      const updateField = vi.fn();
      render(<MediaTab {...makeProps({ image_urls: ['https://example.com/img.jpg'], updateField })} />);
      fireEvent.change(screen.getByPlaceholderText('Paste image URL...'), {
        target: { value: 'https://example.com/img.jpg' },
      });
      fireEvent.click(screen.getByText('Add'));
      expect(updateField).not.toHaveBeenCalled();
    });
  });

  describe('Given the user submits via keyboard', () => {
    it('When Enter is pressed in the URL input / Then calls updateField with the new URL', () => {
      const updateField = vi.fn();
      render(<MediaTab {...makeProps({ updateField })} />);
      const input = screen.getByPlaceholderText('Paste image URL...');
      fireEvent.change(input, { target: { value: 'https://keyboard.com/img.jpg' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(updateField).toHaveBeenCalledWith('image_urls', ['https://keyboard.com/img.jpg']);
    });
  });

  describe('Given the MediaUploader fires an image change', () => {
    it('When MediaUploader clears images / Then calls updateField with an empty array', () => {
      const updateField = vi.fn();
      render(<MediaTab {...makeProps({ image_urls: ['http://a.com/x.jpg'], updateField })} />);
      fireEvent.click(screen.getByText('clear'));
      expect(updateField).toHaveBeenCalledWith('image_urls', []);
    });
  });
});
