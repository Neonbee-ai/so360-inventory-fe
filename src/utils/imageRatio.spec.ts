import { describe, it, expect } from 'vitest';
import {
  assessProductImage,
  ratioLabel,
  assessImageForSlot,
  productImageNeedsAttention,
  CATEGORY_IMAGE_SLOT,
  CATEGORY_BANNER_SLOT,
} from './imageRatio';

describe('ratioLabel', () => {
  describe('Given a photo close to a common shape', () => {
    it('When 1200×1200 / Then reads 1:1', () => {
      expect(ratioLabel(1200, 1200)).toBe('1:1');
    });

    it('When 1080×1920 / Then reads 9:16', () => {
      expect(ratioLabel(1080, 1920)).toBe('9:16');
    });

    it('When 1500×2000 / Then reads 3:4', () => {
      expect(ratioLabel(1500, 2000)).toBe('3:4');
    });

    it('When 1203×1200 (within 3%) / Then still reads 1:1', () => {
      expect(ratioLabel(1203, 1200)).toBe('1:1');
    });
  });

  describe('Given a photo matching no common shape', () => {
    it('When wide 2500×1000 / Then reads as N:1', () => {
      expect(ratioLabel(2500, 1000)).toBe('2.50:1');
    });

    it('When tall 1000×2500 / Then reads as 1:N', () => {
      expect(ratioLabel(1000, 2500)).toBe('1:2.50');
    });
  });
});

describe('assessProductImage', () => {
  describe('Given a large square photo', () => {
    it('When assessed / Then it is ok with no issues, and reports size and ratio', () => {
      expect(assessProductImage(1200, 1200)).toEqual({ size: '1200×1200', ratio: '1:1', ok: true, issues: [] });
    });
  });

  describe('Given a large portrait 3:4 photo (fashion frames)', () => {
    it('When assessed / Then it is ok', () => {
      expect(assessProductImage(1500, 2000).ok).toBe(true);
    });
  });

  describe('Given a phone-camera 9:16 photo', () => {
    it('When assessed / Then it is flagged as very tall', () => {
      const a = assessProductImage(1080, 1920);
      expect(a.ok).toBe(false);
      expect(a.issues).toHaveLength(1);
      expect(a.issues[0]).toMatch(/Very tall/);
    });
  });

  describe('Given a wide banner-shaped photo', () => {
    it('When assessed / Then it is flagged as very wide', () => {
      expect(assessProductImage(1920, 1080).issues[0]).toMatch(/Very wide/);
    });
  });

  describe('Given a small photo', () => {
    it('When the shortest side is under 800px / Then it is flagged as low resolution', () => {
      const a = assessProductImage(600, 600);
      expect(a.ok).toBe(false);
      expect(a.issues[0]).toMatch(/Low resolution/);
    });

    it('When exactly 800px / Then it is not flagged', () => {
      expect(assessProductImage(800, 800).ok).toBe(true);
    });
  });

  describe('Given a small and very tall photo', () => {
    it('When assessed / Then both issues are reported', () => {
      expect(assessProductImage(400, 900).issues).toHaveLength(2);
    });
  });
});

describe('productImageNeedsAttention', () => {
  describe('Given the same thresholds the API uses for image_needs_attention', () => {
    it('When a 1200×1200 photo / Then it does not need attention', () => {
      expect(productImageNeedsAttention(1200, 1200)).toBe(false);
    });

    it('When a 600×600 or a 1080×1920 photo / Then it needs attention', () => {
      expect(productImageNeedsAttention(600, 600)).toBe(true);
      expect(productImageNeedsAttention(1080, 1920)).toBe(true);
    });
  });
});

describe('assessImageForSlot', () => {
  describe('Given the square category image slot (1:1, 1600×1600)', () => {
    it('When a 1600×1600 image / Then it is ok', () => {
      expect(assessImageForSlot(1600, 1600, CATEGORY_IMAGE_SLOT)).toEqual({
        size: '1600×1600', ratio: '1:1', ok: true, issues: [],
      });
    });

    it('When the old 1200×400 banner-shaped image / Then it is flagged as the wrong shape', () => {
      const a = assessImageForSlot(1200, 400, CATEGORY_IMAGE_SLOT);
      expect(a.ok).toBe(false);
      expect(a.issues.some(i => /this slot is 1:1/.test(i))).toBe(true);
    });

    it('When a 500×500 image / Then it is flagged as low resolution only', () => {
      const a = assessImageForSlot(500, 500, CATEGORY_IMAGE_SLOT);
      expect(a.issues).toHaveLength(1);
      expect(a.issues[0]).toMatch(/Low resolution/);
    });
  });

  describe('Given the category banner slot (16:5, 2400×750)', () => {
    it('When a 2400×750 image / Then it is ok', () => {
      expect(assessImageForSlot(2400, 750, CATEGORY_BANNER_SLOT).ok).toBe(true);
    });

    it('When a square image / Then it is flagged with the 16:5 target in the message', () => {
      const a = assessImageForSlot(1600, 1600, CATEGORY_BANNER_SLOT);
      expect(a.ok).toBe(false);
      expect(a.issues.join(' ')).toMatch(/16:5 \(2400×750\)/);
    });

    it('When a 3:1 image (within 15% of 16:5) / Then the shape is accepted', () => {
      expect(assessImageForSlot(2400, 800, CATEGORY_BANNER_SLOT).ok).toBe(true);
    });
  });
});
