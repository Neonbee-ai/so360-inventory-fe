import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./imageDimensions', () => ({
  measureImageFile: vi.fn(),
}));

import { measureImageFile } from './imageDimensions';
import {
  fitImageFile,
  describeFit,
  describeFitChange,
  fileNameForType,
  formatBytes,
  slotSpecLabel,
  IMAGE_FIT_SLOTS,
  QUALITY_FLOOR,
} from './imageFit';

const mockMeasure = measureImageFile as unknown as ReturnType<typeof vi.fn>;

const KB = 1024;
const MB = 1024 * 1024;
const PRODUCT = IMAGE_FIT_SLOTS.product;

const fileOfSize = (name: string, type: string, bytes: number) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { configurable: true, value: bytes });
  return f;
};

interface EncodeCall { width: number; height: number; type: string; quality?: number }
type Encoder = (c: EncodeCall) => { bytes: number; type: string };

let encodeCalls: EncodeCall[];
let encoder: Encoder;
/** Alpha channel returned by getImageData (the transparency probe). */
let alphaPixels: number[];

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

const decodeAs = (width: number, height: number) => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close: vi.fn() })));
};

beforeEach(() => {
  mockMeasure.mockReset();
  mockMeasure.mockResolvedValue(null);
  encodeCalls = [];
  alphaPixels = [255, 255];
  // Default encoder: WebP supported, ~0.1 byte per pixel.
  encoder = c => ({ bytes: Math.round(c.width * c.height * 0.1), type: c.type });

  HTMLCanvasElement.prototype.getContext = vi.fn(function getContext() {
    return {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: Uint8ClampedArray.from(alphaPixels.flatMap(a => [0, 0, 0, a])),
      })),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    };
  }) as any;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function toBlob(
    this: HTMLCanvasElement,
    cb: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    const call = { width: this.width, height: this.height, type: type ?? 'image/png', quality };
    encodeCalls.push(call);
    const out = encoder(call);
    cb(new Blob([new Uint8Array(out.bytes)], { type: out.type }));
  }) as any;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
  vi.unstubAllGlobals();
});

describe('fitImageFile', () => {
  describe('Given a product photo already within 1 MB and 2000 px', () => {
    it('When fitted / Then the original bytes are returned untouched and nothing is encoded', async () => {
      mockMeasure.mockResolvedValue({ width: 1500, height: 1500 });
      decodeAs(1500, 1500);
      const file = fileOfSize('photo.jpg', 'image/jpeg', 600 * KB);

      const r = await fitImageFile(file, PRODUCT);

      expect(r.file).toBe(file);
      expect(r.changed).toBe(false);
      expect(r.width).toBe(1500);
      expect(encodeCalls).toHaveLength(0);
      expect(describeFit(r)).toBe('photo.jpg: 600 KB — uploaded as-is');
    });
  });

  describe('Given an SVG', () => {
    it('When fitted / Then it is never measured, decoded or re-encoded', async () => {
      const file = fileOfSize('logo.svg', 'image/svg+xml', 5 * MB);

      const r = await fitImageFile(file, PRODUCT);

      expect(r.file).toBe(file);
      expect(r.changed).toBe(false);
      expect(mockMeasure).not.toHaveBeenCalled();
      expect(encodeCalls).toHaveLength(0);
    });
  });

  describe('Given an oversize 4000×3000 JPEG of 6 MB', () => {
    it('When fitted / Then it is resized so the longest edge is 2000 (aspect kept, no crop), WebP q 0.90, under 1 MB', async () => {
      mockMeasure.mockResolvedValue({ width: 4000, height: 3000 });
      decodeAs(4000, 3000);
      const file = fileOfSize('photo.jpg', 'image/jpeg', 6 * MB);

      const r = await fitImageFile(file, PRODUCT);

      expect(encodeCalls).toEqual([{ width: 2000, height: 1500, type: 'image/webp', quality: 0.9 }]);
      expect(r.changed).toBe(true);
      expect(r.resized).toBe(true);
      expect(r.width).toBe(2000);
      expect(r.height).toBe(1500);
      expect(r.file.size).toBeLessThanOrEqual(PRODUCT.maxBytes);
      expect(r.overCap).toBe(false);
      expect(describeFit(r)).toMatch(/^photo\.jpg: 6\.0 MB → \d+ KB \(resized to 2000×1500\)$/);
    });

    it('When fitted / Then the result is a real File named after the original with a .webp extension', async () => {
      mockMeasure.mockResolvedValue({ width: 4000, height: 3000 });
      decodeAs(4000, 3000);

      const r = await fitImageFile(fileOfSize('my.photo.final.jpeg', 'image/jpeg', 6 * MB), PRODUCT);

      expect(r.file).toBeInstanceOf(File);
      expect(r.file.name).toBe('my.photo.final.webp');
      expect(r.file.type).toBe('image/webp');
      expect(r.file.name).not.toBe('blob');
    });
  });

  describe('Given a small photo that is over the cap', () => {
    it('When fitted / Then it is never upscaled', async () => {
      mockMeasure.mockResolvedValue({ width: 1200, height: 900 });
      decodeAs(1200, 900);
      const r = await fitImageFile(fileOfSize('small.png', 'image/png', 3 * MB), PRODUCT);
      expect(encodeCalls[0]).toMatchObject({ width: 1200, height: 900 });
      expect(r.resized).toBe(false);
    });
  });

  describe('Given a photo that stays over 1 MB at 2000 px', () => {
    it('When fitted / Then quality steps 0.90 → 0.88 → 0.86 → 0.85, then dimensions shrink by 10% at 0.85', async () => {
      mockMeasure.mockResolvedValue({ width: 4000, height: 4000 });
      decodeAs(4000, 4000);
      // Over the cap until the edge is ≤ 1500 px.
      encoder = c => ({ bytes: c.width > 1500 ? 2 * MB : 900 * KB, type: c.type });

      const r = await fitImageFile(fileOfSize('big.jpg', 'image/jpeg', 9 * MB), PRODUCT);

      expect(encodeCalls.map(c => [c.width, c.quality])).toEqual([
        [2000, 0.9],
        [2000, 0.88],
        [2000, 0.86],
        [2000, 0.85],
        [1800, 0.85],
        [1620, 0.85],
        [1458, 0.85],
      ]);
      expect(r.width).toBe(1458);
      expect(r.file.size).toBeLessThanOrEqual(PRODUCT.maxBytes);
      expect(r.overCap).toBe(false);
    });

    it('When it never fits / Then quality never drops below 0.85 and dimensions stop at the 1200 px product minimum', async () => {
      mockMeasure.mockResolvedValue({ width: 4000, height: 4000 });
      decodeAs(4000, 4000);
      encoder = c => ({ bytes: 2 * MB, type: c.type });

      const r = await fitImageFile(fileOfSize('noisy.jpg', 'image/jpeg', 9 * MB), PRODUCT);

      expect(Math.min(...encodeCalls.map(c => c.quality ?? 1))).toBe(QUALITY_FLOOR);
      expect(encodeCalls[encodeCalls.length - 1].width).toBe(1200);
      expect(r.width).toBe(1200);
      expect(r.overCap).toBe(true);
    });
  });

  describe('Given a browser without a WebP encoder (Safari: toBlob returns PNG)', () => {
    it('When an opaque photo is fitted / Then it falls back to JPEG at the same quality', async () => {
      mockMeasure.mockResolvedValue({ width: 4000, height: 3000 });
      decodeAs(4000, 3000);
      alphaPixels = [255, 255, 255];
      encoder = c => ({ bytes: 400 * KB, type: c.type === 'image/webp' ? 'image/png' : c.type });

      const r = await fitImageFile(fileOfSize('photo.jpg', 'image/jpeg', 6 * MB), PRODUCT);

      expect(encodeCalls.map(c => [c.type, c.quality])).toEqual([
        ['image/webp', 0.9],
        ['image/jpeg', 0.9],
      ]);
      expect(r.file.type).toBe('image/jpeg');
      expect(r.file.name).toBe('photo.jpg');
    });

    it('When a transparent PNG is fitted / Then it stays PNG (alpha kept) and is only resized', async () => {
      mockMeasure.mockResolvedValue({ width: 3000, height: 3000 });
      decodeAs(3000, 3000);
      alphaPixels = [255, 0, 128];
      encoder = c => ({ bytes: 800 * KB, type: c.type === 'image/webp' ? 'image/png' : c.type });

      const r = await fitImageFile(fileOfSize('logo.png', 'image/png', 4 * MB), PRODUCT);

      expect(encodeCalls[1]).toEqual({ width: 2000, height: 2000, type: 'image/png', quality: undefined });
      expect(encodeCalls.some(c => c.type === 'image/jpeg')).toBe(false);
      expect(r.file.type).toBe('image/png');
      expect(r.file.name).toBe('logo.png');
      expect(r.width).toBe(2000);
    });
  });

  describe('Given a category banner slot', () => {
    it('When a 4800×1500 banner is fitted / Then the longest edge becomes 2400 and the 800 KB cap applies', async () => {
      mockMeasure.mockResolvedValue({ width: 4800, height: 1500 });
      decodeAs(4800, 1500);
      encoder = c => ({ bytes: c.quality! > 0.86 ? 900 * KB : 700 * KB, type: c.type });

      const r = await fitImageFile(fileOfSize('hero.jpg', 'image/jpeg', 3 * MB), IMAGE_FIT_SLOTS.categoryBanner);

      expect(encodeCalls[0]).toMatchObject({ width: 2400, height: 750 });
      expect(r.file.size).toBeLessThanOrEqual(800 * KB);
    });
  });

  describe('Given the image cannot be decoded in this browser', () => {
    it('When an over-cap file is fitted / Then the original is returned and flagged over the cap', async () => {
      vi.stubGlobal('createImageBitmap', undefined);
      const file = fileOfSize('odd.jpg', 'image/jpeg', 3 * MB);
      const r = await fitImageFile(file, PRODUCT);
      expect(r.file).toBe(file);
      expect(r.changed).toBe(false);
      expect(r.overCap).toBe(true);
    });
  });
});

describe('image fit helpers', () => {
  describe('Given the slot table', () => {
    it('When labelled / Then each slot reads ratio · size · cap', () => {
      expect(slotSpecLabel(IMAGE_FIT_SLOTS.product)).toBe('1:1 · 2000×2000 · ≤1 MB');
      expect(slotSpecLabel(IMAGE_FIT_SLOTS.categoryBanner)).toBe('16:5 · 2400×750 · ≤800 KB');
      expect(slotSpecLabel(IMAGE_FIT_SLOTS.categoryImage)).toBe('1:1 · 1600×1600 · ≤600 KB');
      expect(slotSpecLabel(IMAGE_FIT_SLOTS.categoryIcon)).toBe('1:1 · 800×800 · ≤300 KB');
    });
  });

  describe('Given byte counts and types', () => {
    it('When formatted / Then KB below 1 MB and one decimal MB above', () => {
      expect(formatBytes(640 * KB)).toBe('640 KB');
      expect(formatBytes(6.1 * MB)).toBe('6.1 MB');
    });

    it('When a file is renamed for a type / Then the extension matches the type', () => {
      expect(fileNameForType('a.jpeg', 'image/webp')).toBe('a.webp');
      expect(fileNameForType('a.png', 'image/jpeg')).toBe('a.jpg');
      expect(fileNameForType('noext', 'image/png')).toBe('noext.png');
    });

    it('When a fit result is described without the name / Then it reads before → after (how)', () => {
      expect(describeFitChange({
        file: new File(['x'], 'p.webp'), changed: true, originalName: 'p.jpg',
        originalBytes: 6.1 * MB, finalBytes: 640 * KB, width: 2000, height: 2000, resized: true, overCap: false,
      })).toBe('6.1 MB → 640 KB (resized to 2000×2000)');
    });
  });
});
