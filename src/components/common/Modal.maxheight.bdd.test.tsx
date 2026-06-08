/**
 * BDD spec — Shared Modal panel is capped at 88vh with 24px vertical gap.
 *
 * Updated 2026-06-08: max-h reduced from 90vh → 88vh to prevent header
 * clipping on ≤1280px desktops. The outer wrapper now uses py-6 (24px) for
 * guaranteed breathing room above and below the panel.
 *
 * Naming convention:
 *   describe : 'Given <Component>'
 *   it       : 'Given <pre> / When <action> / Then <outcome>'
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

import { Modal } from './Modal';

describe('Given the shared Modal', () => {
  describe('Given isOpen is true', () => {
    it('When the modal renders / Then its panel container is capped at max-h-[88vh]', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Tall Modal">
          <p>body</p>
        </Modal>,
      );
      const panels = Array.from(document.querySelectorAll('div')).filter((el) =>
        el.className.includes('max-h-[88vh]'),
      );
      expect(panels.length).toBeGreaterThan(0);
    });

    it('When the modal renders / Then no panel uses the old max-h-[90vh] cap', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Tall Modal">
          <p>body</p>
        </Modal>,
      );
      const stale = Array.from(document.querySelectorAll('div')).filter((el) =>
        el.className.includes('max-h-[90vh]'),
      );
      expect(stale.length).toBe(0);
    });

    it('When the modal renders / Then no panel uses the old max-h-[85vh] cap', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Tall Modal">
          <p>body</p>
        </Modal>,
      );
      const stale = Array.from(document.querySelectorAll('div')).filter((el) =>
        el.className.includes('max-h-[85vh]'),
      );
      expect(stale.length).toBe(0);
    });
  });
});
