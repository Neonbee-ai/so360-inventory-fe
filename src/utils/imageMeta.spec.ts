import { describe, it, expect } from 'vitest';
import { upsertImageMeta, imageMetaForUrls } from './imageMeta';

const A = 'https://cdn.test/a.jpg';
const B = 'https://cdn.test/b.jpg';

describe('upsertImageMeta', () => {
  describe('Given no entry for the url yet', () => {
    it('When a size is recorded / Then it is appended', () => {
      expect(upsertImageMeta([], A, 1600, 1200)).toEqual([{ url: A, width: 1600, height: 1200 }]);
    });
  });

  describe('Given an entry for the url already exists', () => {
    it('When a new size is recorded / Then it replaces the old one', () => {
      expect(upsertImageMeta([{ url: A, width: 10, height: 10 }], A, 20, 30)).toEqual([{ url: A, width: 20, height: 30 }]);
    });

    it('When the same size is recorded / Then the same array is returned (no change)', () => {
      const meta = [{ url: A, width: 20, height: 30 }];
      expect(upsertImageMeta(meta, A, 20, 30)).toBe(meta);
    });
  });

  describe('Given an unusable measurement', () => {
    it('When width or height is 0 / Then nothing is recorded', () => {
      const meta: any[] = [];
      expect(upsertImageMeta(meta, A, 0, 30)).toBe(meta);
    });
  });
});

describe('imageMetaForUrls', () => {
  describe('Given meta for current and removed photos', () => {
    it('When filtered / Then only current photos remain, in image_urls order', () => {
      const meta = [{ url: A, width: 1, height: 1 }, { url: 'gone', width: 2, height: 2 }, { url: B, width: 3, height: 3 }];
      expect(imageMetaForUrls(meta, [B, A]).map(m => m.url)).toEqual([B, A]);
    });

    it('When meta is missing (older item) / Then an empty list is returned', () => {
      expect(imageMetaForUrls(undefined, [A])).toEqual([]);
    });
  });
});
