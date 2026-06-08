import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { Modal } from './Modal';

describe('Modal', () => {
  describe('Given isOpen is false', () => {
    it('When rendered / Then renders nothing', () => {
      const { container } = render(
        <Modal isOpen={false} onClose={vi.fn()} title="Test">Content</Modal>
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Given isOpen is true', () => {
    it('When rendered / Then shows title', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="My Modal">Content</Modal>);
      expect(screen.getByText('My Modal')).toBeInTheDocument();
    });

    it('When rendered / Then shows children', () => {
      render(<Modal isOpen={true} onClose={vi.fn()} title="T"><p>Body text</p></Modal>);
      expect(screen.getByText('Body text')).toBeInTheDocument();
    });

    it('When close button clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<Modal isOpen={true} onClose={onClose} title="T">C</Modal>);
      const closeBtn = screen.getByRole('button');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('Given Modal backdrop and size variants', () => {
  it('When backdrop is clicked / Then calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} title="Backdrop Test">Content</Modal>
    );
    // The backdrop is the absolute inset-0 div (first child of the outer fixed div)
    const backdrop = container.querySelector('.absolute.inset-0') as HTMLElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('When size is sm / Then dialog container has max-w-sm class', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Small" size="sm">body</Modal>
    );
    const dialog = container.querySelector('.max-w-sm');
    expect(dialog).not.toBeNull();
  });

  it('When size is xl / Then dialog container has max-w-4xl class', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="XL" size="xl">body</Modal>
    );
    const dialog = container.querySelector('.max-w-4xl');
    expect(dialog).not.toBeNull();
  });

  it('When size is not provided / Then defaults to md (max-w-md)', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Default">body</Modal>
    );
    expect(container.querySelector('.max-w-md')).not.toBeNull();
  });

  it('When rendered with isOpen true / Then close button is present', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="Buttons">content</Modal>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

// Regression: overlay must paint above the shell NavBar (.glass-nav, z-500),
// otherwise the global header clips the modal top. Overlay carries z-[600].
describe('Modal — overlay stacks above the shell NavBar', () => {
  it('When open / Then an overlay carries z-[600]', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="Z">C</Modal>);
    const overlays = Array.from(document.querySelectorAll('div')).filter(
      (el) => el.className.includes('fixed') && el.className.includes('inset-0'),
    );
    expect(overlays.some((el) => el.className.includes('z-[600]'))).toBe(true);
  });
});
