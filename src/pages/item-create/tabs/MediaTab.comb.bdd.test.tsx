import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));
vi.mock('../../../components/media/MediaUploader', () => ({ default: () => <div data-testid="media-uploader" /> }));

import MediaTab from './MediaTab';

describe('Given MediaTab on Comb primitives', () => {
  it('When rendered / Then the URL input is a Comb TextField and Add is a Comb Button', () => {
    render(<MediaTab image_urls={[]} updateField={vi.fn()} />);
    expect(screen.getByPlaceholderText('Paste image URL...').tagName).toBe('INPUT');
    expect(screen.getByText('Add').closest('[data-comb="button"]')).not.toBeNull();
  });

  it('When a URL is typed and Enter pressed / Then it is added', () => {
    const updateField = vi.fn();
    render(<MediaTab image_urls={[]} updateField={updateField} />);
    const input = screen.getByPlaceholderText('Paste image URL...');
    fireEvent.change(input, { target: { value: 'https://x/a.png' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateField).toHaveBeenCalledWith('image_urls', ['https://x/a.png']);
  });

  it('When Add is clicked with a blank input / Then nothing is added', () => {
    const updateField = vi.fn();
    render(<MediaTab image_urls={[]} updateField={updateField} />);
    fireEvent.click(screen.getByText('Add'));
    expect(updateField).not.toHaveBeenCalled();
  });

  it('When a URL is added / Then the input is cleared', () => {
    render(<MediaTab image_urls={[]} updateField={vi.fn()} />);
    const input = screen.getByPlaceholderText('Paste image URL...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://x/b.png' } });
    fireEvent.click(screen.getByText('Add'));
    expect(input.value).toBe('');
  });
});
