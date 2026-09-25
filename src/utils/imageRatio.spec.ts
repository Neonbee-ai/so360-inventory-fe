import { describe, it, expect } from 'vitest';
import { assessProductImage, ratioLabel } from './imageRatio';

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
