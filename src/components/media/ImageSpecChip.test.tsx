import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ImageSpecChip from './ImageSpecChip';
import { IMAGE_FIT_SLOTS } from '../../utils/imageFit';

const infoButton = () => screen.getByRole('button', { name: /about this image size/i });
const popover = () => screen.getByRole('tooltip', { hidden: true });

describe('ImageSpecChip', () => {
  describe('Given the product slot', () => {
    it('When rendered / Then the chip always shows ratio, stored size and cap', () => {
      render(<ImageSpecChip slot={IMAGE_FIT_SLOTS.product} />);
      expect(screen.getByTestId('image-spec-chip')).toHaveTextContent('1:1 · 2000×2000 · ≤1 MB');
    });

    it('When rendered / Then the explanation is hidden and the ⓘ button is described by it', () => {
      render(<ImageSpecChip slot={IMAGE_FIT_SLOTS.product} />);
      expect(popover()).not.toBeVisible();
      expect(infoButton()).toHaveAttribute('aria-expanded', 'false');
      expect(infoButton().getAttribute('aria-describedby')).toBe(popover().id);
    });
  });

  describe('Given the ⓘ button', () => {
    it('When clicked (tap) / Then the explanation opens with where it shows, crop and auto-shrink notes and accepted types', () => {
      render(<ImageSpecChip slot={IMAGE_FIT_SLOTS.categoryBanner} acceptedTypes="PNG, JPG, WebP, SVG" />);
      fireEvent.click(infoButton());
      expect(popover()).toBeVisible();
      expect(infoButton()).toHaveAttribute('aria-expanded', 'true');
      expect(popover()).toHaveTextContent(/top of the category page/i);
      expect(popover()).toHaveTextContent(/cropped top and bottom/i);
      expect(popover()).toHaveTextContent(/shrunk automatically to ≤800 KB with no visible quality loss/i);
      expect(popover()).toHaveTextContent('Accepted: PNG, JPG, WebP, SVG');
    });

    it('When clicked twice / Then the explanation closes again', () => {
      render(<ImageSpecChip slot={IMAGE_FIT_SLOTS.product} />);
      fireEvent.click(infoButton());
      fireEvent.click(infoButton());
      expect(popover()).not.toBeVisible();
    });

    it('When open and Escape is pressed / Then it closes', () => {
      render(<ImageSpecChip slot={IMAGE_FIT_SLOTS.product} />);
      fireEvent.click(infoButton());
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(popover()).not.toBeVisible();
    });

    it('When open and the user taps outside / Then it closes', () => {
      render(<div><span data-testid="outside">x</span><ImageSpecChip slot={IMAGE_FIT_SLOTS.product} /></div>);
      fireEvent.click(infoButton());
      fireEvent.touchStart(screen.getByTestId('outside'));
      expect(popover()).not.toBeVisible();
    });

    it('When it sits inside a clickable drop zone / Then clicking it does not trigger the zone', () => {
      let zoneClicks = 0;
      render(<div onClick={() => { zoneClicks += 1; }}><ImageSpecChip slot={IMAGE_FIT_SLOTS.product} /></div>);
      fireEvent.click(infoButton());
      expect(zoneClicks).toBe(0);
    });

    it('When focused by keyboard / Then it is a real button', () => {
      render(<ImageSpecChip slot={IMAGE_FIT_SLOTS.product} />);
      infoButton().focus();
      expect(infoButton()).toHaveFocus();
    });
  });
});
