import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseShellBridge = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => mockUseShellBridge(),
}));

import {
  usePropertyUnits,
  isPropertyUnitsEnabled,
  PROPERTY_UNITS_FLAG,
  PROPERTY_UNIT_LABELS,
  DEFAULT_LABELS,
} from './usePropertyUnits';

beforeEach(() => {
  mockUseShellBridge.mockReset();
});

describe('usePropertyUnits', () => {
  describe('Given the property_units flag is enabled', () => {
    describe('When the hook runs', () => {
      it('Then it reports enabled with real-estate labels', () => {
        const isFeatureEnabled = vi.fn((k: string) => k === PROPERTY_UNITS_FLAG);
        mockUseShellBridge.mockReturnValue({ isFeatureEnabled });
        const { result } = renderHook(() => usePropertyUnits());
        expect(result.current.enabled).toBe(true);
        expect(result.current.labels).toEqual(PROPERTY_UNIT_LABELS);
        expect(result.current.labels.categories).toBe('Projects');
        expect(result.current.labels.item).toBe('Unit');
        expect(isFeatureEnabled).toHaveBeenCalledWith('submodule:inventory:property_units');
      });
    });
  });

  describe('Given the flag is disabled', () => {
    describe('When the hook runs', () => {
      it('Then it keeps the default vocabulary', () => {
        mockUseShellBridge.mockReturnValue({ isFeatureEnabled: () => false });
        const { result } = renderHook(() => usePropertyUnits());
        expect(result.current.enabled).toBe(false);
        expect(result.current.labels).toEqual(DEFAULT_LABELS);
        expect(result.current.labels.category).toBe('Category');
      });
    });
  });

  describe('Given the shell bridge has no isFeatureEnabled', () => {
    describe('When the hook runs', () => {
      it('Then it treats the feature as off', () => {
        mockUseShellBridge.mockReturnValue({});
        const { result } = renderHook(() => usePropertyUnits());
        expect(result.current.enabled).toBe(false);
      });
    });
  });
});

describe('isPropertyUnitsEnabled', () => {
  describe('Given a null shell', () => {
    it('Then it returns false', () => {
      expect(isPropertyUnitsEnabled(null)).toBe(false);
    });
  });

  describe('Given isFeatureEnabled returns a truthy non-boolean', () => {
    it('Then it returns false because only true counts', () => {
      expect(isPropertyUnitsEnabled({ isFeatureEnabled: () => 'yes' })).toBe(false);
    });
  });

  describe('Given isFeatureEnabled throws', () => {
    it('Then it returns false', () => {
      expect(isPropertyUnitsEnabled({ isFeatureEnabled: () => { throw new Error('x'); } })).toBe(false);
    });
  });
});
