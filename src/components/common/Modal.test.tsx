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
