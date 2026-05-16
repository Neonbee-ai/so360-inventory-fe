import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderCategoryIcon, PRESET_ICONS, PRESET_ICON_PREFIX, isPresetUrl, getPresetId } from './categoryIcons';
import { render } from '@testing-library/react';

describe('Given categoryIcons', () => {
  describe('Given PRESET_ICONS', () => {
    it('When accessed / Then has multiple preset icons defined', () => {
      expect(PRESET_ICONS.length).toBeGreaterThan(0);
    });

    it('When accessed / Then each icon has id, label, group, icon, and defaultColor', () => {
      const icon = PRESET_ICONS[0];
      expect(icon.id).toBeTruthy();
      expect(icon.label).toBeTruthy();
      expect(icon.group).toBeTruthy();
      expect(typeof icon.icon).toBe('function');
      expect(icon.defaultColor).toMatch(/^#/);
    });
  });

  describe('Given isPresetUrl', () => {
    it('When preset URL provided / Then returns true', () => {
      expect(isPresetUrl('preset:package')).toBe(true);
    });

    it('When non-preset URL provided / Then returns false', () => {
      expect(isPresetUrl('http://example.com/img.jpg')).toBe(false);
    });

    it('When null provided / Then returns false', () => {
      expect(isPresetUrl(null)).toBe(false);
    });

    it('When undefined provided / Then returns false', () => {
      expect(isPresetUrl(undefined)).toBe(false);
    });
  });

  describe('Given getPresetId', () => {
    it('When preset URL provided / Then returns the icon id', () => {
      expect(getPresetId('preset:package')).toBe('package');
    });
  });

  describe('Given renderCategoryIcon', () => {
    it('When no iconUrl, imageUrl / Then renders first letter of name', () => {
      const result = renderCategoryIcon({ name: 'Electronics', size: 28 });
      const { container } = render(<>{result}</>);
      expect(container.textContent).toBe('E');
    });

    it('When imageUrl provided / Then renders img element', () => {
      const result = renderCategoryIcon({ name: 'Test', imageUrl: 'http://example.com/img.jpg', size: 28 });
      const { container } = render(<>{result}</>);
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.src).toContain('example.com/img.jpg');
    });

    it('When iconUrl is a regular URL / Then renders img element', () => {
      const result = renderCategoryIcon({ name: 'Test', iconUrl: 'http://example.com/icon.png', size: 28 });
      const { container } = render(<>{result}</>);
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
    });

    it('When preset iconUrl provided / Then renders preset icon container', () => {
      const result = renderCategoryIcon({ name: 'Test', iconUrl: 'preset:package', size: 28 });
      const { container } = render(<>{result}</>);
      expect(container.firstChild).toBeTruthy();
    });

    it('When custom color provided / Then applies bg color to container', () => {
      const result = renderCategoryIcon({ name: 'Test', color: '#FF0000', size: 28 });
      const { container } = render(<>{result}</>);
      const div = container.querySelector('div');
      expect(div?.style.background).toBe('rgb(255, 0, 0)');
    });
  });
});
