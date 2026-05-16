import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  renderCategoryIcon,
  PRESET_ICONS,
  PRESET_ICON_PREFIX,
  PRESET_ICON_MAP,
  isPresetUrl,
  getPresetId,
} from './categoryIcons';

describe('categoryIcons', () => {
  describe('Given the PRESET_ICONS catalog', () => {
    it('When the catalog is imported / Then it contains multiple preset icons', () => {
      expect(PRESET_ICONS.length).toBeGreaterThan(0);
    });

    it('When inspecting any icon definition / Then it has id, label, group, icon, and defaultColor', () => {
      PRESET_ICONS.forEach(icon => {
        expect(icon.id).toBeTruthy();
        expect(icon.label).toBeTruthy();
        expect(icon.group).toBeTruthy();
        expect(typeof icon.icon).toBe('function');
        expect(icon.defaultColor).toMatch(/^#[0-9A-Fa-f]{3,6}$/);
      });
    });

    it('When checking icon groups / Then General, Food, Tech, Fashion, Home, Sports groups exist', () => {
      const groups = new Set(PRESET_ICONS.map(i => i.group));
      expect(groups.has('General')).toBe(true);
      expect(groups.has('Food')).toBe(true);
      expect(groups.has('Tech')).toBe(true);
      expect(groups.has('Fashion')).toBe(true);
      expect(groups.has('Home')).toBe(true);
      expect(groups.has('Sports')).toBe(true);
    });

    it('When the PRESET_ICON_PREFIX is used / Then it equals "preset:"', () => {
      expect(PRESET_ICON_PREFIX).toBe('preset:');
    });
  });

  describe('Given the PRESET_ICON_MAP lookup', () => {
    it('When looking up "package" / Then returns the Package icon definition', () => {
      const icon = PRESET_ICON_MAP['package'];
      expect(icon).toBeDefined();
      expect(icon.label).toBe('Package');
    });

    it('When looking up every PRESET_ICON id / Then all ids are found in the map', () => {
      PRESET_ICONS.forEach(preset => {
        expect(PRESET_ICON_MAP[preset.id]).toBeDefined();
      });
    });
  });

  describe('Given isPresetUrl utility', () => {
    it('When a "preset:" prefixed string is passed / Then returns true', () => {
      expect(isPresetUrl('preset:package')).toBe(true);
    });

    it('When an http URL is passed / Then returns false', () => {
      expect(isPresetUrl('http://example.com/img.jpg')).toBe(false);
    });

    it('When an empty string is passed / Then returns false', () => {
      expect(isPresetUrl('')).toBe(false);
    });

    it('When null is passed / Then returns false', () => {
      expect(isPresetUrl(null)).toBe(false);
    });

    it('When undefined is passed / Then returns false', () => {
      expect(isPresetUrl(undefined)).toBe(false);
    });

    it('When a plain icon name without prefix is passed / Then returns false', () => {
      expect(isPresetUrl('package')).toBe(false);
    });
  });

  describe('Given getPresetId utility', () => {
    it('When a preset URL is passed / Then returns the icon id after the prefix', () => {
      expect(getPresetId('preset:package')).toBe('package');
    });

    it('When a multi-segment preset URL is passed / Then returns everything after the prefix', () => {
      expect(getPresetId('preset:some-icon-name')).toBe('some-icon-name');
    });
  });

  describe('Given renderCategoryIcon with no media', () => {
    it('When no iconUrl and no imageUrl are provided / Then renders the first letter of the name', () => {
      const result = renderCategoryIcon({ name: 'Electronics', size: 28 });
      const { container } = render(<>{result}</>);
      expect(container.textContent).toBe('E');
    });

    it('When a name starting with lowercase is provided / Then renders that first character', () => {
      const result = renderCategoryIcon({ name: 'beverages', size: 28 });
      const { container } = render(<>{result}</>);
      expect(container.textContent).toBe('b');
    });
  });

  describe('Given renderCategoryIcon with an imageUrl', () => {
    it('When imageUrl is a valid URL / Then renders an img element', () => {
      const result = renderCategoryIcon({ name: 'Test', imageUrl: 'http://cdn.example.com/cat.jpg', size: 32 });
      const { container } = render(<>{result}</>);
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.src).toContain('cdn.example.com/cat.jpg');
    });
  });

  describe('Given renderCategoryIcon with a regular iconUrl', () => {
    it('When iconUrl is an http URL / Then renders an img element', () => {
      const result = renderCategoryIcon({ name: 'Test', iconUrl: 'http://example.com/icon.png', size: 28 });
      const { container } = render(<>{result}</>);
      expect(container.querySelector('img')).toBeTruthy();
    });
  });

  describe('Given renderCategoryIcon with a preset iconUrl', () => {
    it('When iconUrl is "preset:package" / Then renders a non-empty container', () => {
      const result = renderCategoryIcon({ name: 'Test', iconUrl: 'preset:package', size: 28 });
      const { container } = render(<>{result}</>);
      expect(container.firstChild).toBeTruthy();
    });

    it('When iconUrl is any known preset id / Then renders without throwing', () => {
      PRESET_ICONS.forEach(preset => {
        expect(() => {
          const result = renderCategoryIcon({ name: 'X', iconUrl: `preset:${preset.id}`, size: 24 });
          render(<>{result}</>);
        }).not.toThrow();
      });
    });
  });

  describe('Given renderCategoryIcon with a custom color', () => {
    it('When color "#FF0000" is passed without iconUrl / Then the background of the container is red', () => {
      const result = renderCategoryIcon({ name: 'Test', color: '#FF0000', size: 28 });
      const { container } = render(<>{result}</>);
      const div = container.querySelector('div');
      expect(div?.style.background).toBe('rgb(255, 0, 0)');
    });

    it('When color "#3B82F6" is passed / Then the background reflects that blue', () => {
      const result = renderCategoryIcon({ name: 'Tech', color: '#3B82F6', size: 28 });
      const { container } = render(<>{result}</>);
      const div = container.querySelector('div');
      expect(div?.style.background).toBeTruthy();
    });
  });
});
