/**
 * BDD spec — Shared Modal panel never exceeds 90% of viewport height.
 *
 * The shared Modal wrapper is the panel container for every federated modal in
 * this MFE (CreateLeadModal, CreateInvoiceModal, StageTransitionModal,
 * StockTransfersPage, StockAdjustmentsPage, StockLocationsPage create/edit).
 * Fixing the panel here guarantees all of them are capped at max-h-[90vh].
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
    it('When the modal renders / Then its panel container is capped at max-h-[90vh]', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Tall Modal">
          <p>body</p>
        </Modal>,
      );
      const panels = Array.from(document.querySelectorAll('div')).filter((el) =>
        el.className.includes('max-h-[90vh]'),
      );
      expect(panels.length).toBeGreaterThan(0);
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
