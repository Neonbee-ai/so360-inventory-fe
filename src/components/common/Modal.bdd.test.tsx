/**
 * BDD spec — shared Modal component viewport sizing & layout fix.
 *
 * Covers the 2026-06-08 fix:
 *   - max-h-[90vh] → max-h-[88vh]   (was causing header clipping on ≤1280px)
 *   - p-4 → px-4 py-6               (24px top/bottom breathing room)
 *   - header gains flex-shrink-0     (header never compresses under tall content)
 *
 * Naming convention:
 *   describe : 'Given <component/state>'
 *   it       : 'Given <pre> / When <action> / Then <outcome>'
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Modal } from './Modal';

// lucide-react icons are ESM — stub to avoid transform issues
vi.mock('lucide-react', () => ({
  X: ({ size }: { size?: number }) => <svg data-testid="close-icon" width={size} height={size} />,
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Register New Warehouse',
  children: <div data-testid="modal-body-content">Form content</div>,
};

describe('Given the shared Modal component', () => {
  describe('Given isOpen is false', () => {
    it('When Modal renders / Then nothing is mounted in the DOM', () => {
      const { container } = render(<Modal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Given isOpen is true', () => {
    it('When Modal renders / Then the title is visible', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText('Register New Warehouse')).toBeInTheDocument();
    });

    it('When Modal renders / Then children are rendered inside the body', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByTestId('modal-body-content')).toBeInTheDocument();
    });

    it('When the X button is clicked / Then onClose is called', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('close-icon').closest('button')!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('When the backdrop overlay is clicked / Then onClose is called', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      // The backdrop is the absolute inset-0 div (first sibling of the panel)
      const backdrop = document.querySelector('.absolute.inset-0');
      expect(backdrop).toBeTruthy();
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given viewport-safety constraints (2026-06-08 fix)', () => {
    it('When Modal renders / Then outer wrapper has py-6 (24px top+bottom gap)', () => {
      render(<Modal {...defaultProps} />);
      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay?.className).toContain('py-6');
    });

    it('When Modal renders / Then outer wrapper no longer uses p-4 alone', () => {
      render(<Modal {...defaultProps} />);
      const overlay = document.querySelector('.fixed.inset-0');
      // p-4 alone (without py-6) would mean only 16px vertical gap — insufficient
      const classes = overlay?.className ?? '';
      const hasBareP4 = classes.split(' ').includes('p-4');
      expect(hasBareP4).toBe(false);
    });

    it('When Modal renders / Then the panel is capped at max-h-[88vh]', () => {
      render(<Modal {...defaultProps} />);
      const panel = document.querySelector('.rounded-2xl');
      expect(panel?.className).toContain('max-h-[88vh]');
    });

    it('When Modal renders / Then the panel does NOT carry the old max-h-[90vh] cap', () => {
      render(<Modal {...defaultProps} />);
      const panel = document.querySelector('.rounded-2xl');
      expect(panel?.className).not.toContain('max-h-[90vh]');
    });

    it('When Modal renders / Then the header carries flex-shrink-0', () => {
      render(<Modal {...defaultProps} />);
      // Header is the first child of the panel that contains the title
      const header = screen.getByText('Register New Warehouse').closest('div');
      expect(header?.className).toContain('flex-shrink-0');
    });
  });

  describe('Given the modal body', () => {
    it('When Modal renders / Then body has overflow-y-auto for independent scrolling', () => {
      render(<Modal {...defaultProps} />);
      const body = screen.getByTestId('modal-body-content').parentElement;
      expect(body?.className).toContain('overflow-y-auto');
    });

    it('When Modal renders / Then body is flex-1 to fill available height', () => {
      render(<Modal {...defaultProps} />);
      const body = screen.getByTestId('modal-body-content').parentElement;
      expect(body?.className).toContain('flex-1');
    });
  });

  describe('Given size variants', () => {
    it('When size is sm / Then panel carries max-w-sm', () => {
      render(<Modal {...defaultProps} size="sm" />);
      const panel = document.querySelector('.rounded-2xl');
      expect(panel?.className).toContain('max-w-sm');
    });

    it('When size is md (default) / Then panel carries max-w-md', () => {
      render(<Modal {...defaultProps} />);
      const panel = document.querySelector('.rounded-2xl');
      expect(panel?.className).toContain('max-w-md');
    });

    it('When size is lg / Then panel carries max-w-2xl', () => {
      render(<Modal {...defaultProps} size="lg" />);
      const panel = document.querySelector('.rounded-2xl');
      expect(panel?.className).toContain('max-w-2xl');
    });

    it('When size is xl / Then panel carries max-w-4xl', () => {
      render(<Modal {...defaultProps} size="xl" />);
      const panel = document.querySelector('.rounded-2xl');
      expect(panel?.className).toContain('max-w-4xl');
    });
  });

  describe('Given the source markup (static contract assertions)', () => {
    it('When the Modal source is read / Then max-h-[88vh] is present', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const src = readFileSync(resolve(__dirname, 'Modal.tsx'), 'utf8');
      expect(src).toContain('max-h-[88vh]');
    });

    it('When the Modal source is read / Then py-6 is present on the outer wrapper', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const src = readFileSync(resolve(__dirname, 'Modal.tsx'), 'utf8');
      expect(src).toContain('py-6');
    });

    it('When the Modal source is read / Then flex-shrink-0 is present on the header', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const src = readFileSync(resolve(__dirname, 'Modal.tsx'), 'utf8');
      expect(src).toContain('flex-shrink-0');
    });

    it('When the Modal source is read / Then old max-h-[90vh] is not present', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const src = readFileSync(resolve(__dirname, 'Modal.tsx'), 'utf8');
      expect(src).not.toContain('max-h-[90vh]');
    });
  });
});
