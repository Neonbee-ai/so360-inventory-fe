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
  it('When rendered / Then shows Upload Images section', () => {
    render(<MediaTab {...makeProps()} />);
    expect(screen.getByText('Upload Images')).toBeInTheDocument();
  });

  it('When rendered / Then shows MediaUploader component', () => {
    render(<MediaTab {...makeProps()} />);
    expect(screen.getByTestId('media-uploader')).toBeInTheDocument();
  });

  it('When rendered / Then shows URL paste section', () => {
    render(<MediaTab {...makeProps()} />);
    expect(screen.getByPlaceholderText('Paste image URL...')).toBeInTheDocument();
  });

  it('When URL entered and Add clicked / Then calls updateField with new URLs', () => {
    const updateField = vi.fn();
    render(<MediaTab {...makeProps({ updateField })} />);
    fireEvent.change(screen.getByPlaceholderText('Paste image URL...'), {
      target: { value: 'https://example.com/img.jpg' },
    });
    fireEvent.click(screen.getByText('Add'));
    expect(updateField).toHaveBeenCalledWith('image_urls', ['https://example.com/img.jpg']);
  });

  it('When duplicate URL entered / Then does not call updateField', () => {
    const updateField = vi.fn();
    render(<MediaTab {...makeProps({ image_urls: ['https://example.com/img.jpg'], updateField })} />);
    fireEvent.change(screen.getByPlaceholderText('Paste image URL...'), {
      target: { value: 'https://example.com/img.jpg' },
    });
    fireEvent.click(screen.getByText('Add'));
    expect(updateField).not.toHaveBeenCalled();
  });
});
