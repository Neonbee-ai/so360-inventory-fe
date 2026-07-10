import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Controllable entitlements mock. Defaults mirror the shared stub
// (can: () => true, isLoading: false) and are reset before each test so the
// existing behavioural tests are unaffected; individual tests flip these to
// exercise the deny-by-default and loading paths.
const mockEnt = vi.hoisted(() => ({
  can: (_action: string) => true as boolean,
  isLoading: false as boolean,
}));

vi.mock('@so360/shell-context', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useEntitlements: () => mockEnt };
});

import { useAuth } from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    mockEnt.can = (_action: string) => true;
    mockEnt.isLoading = false;
  });

  describe('Given the hook is rendered', () => {
    it('When invoked / Then returns can function', () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.can).toBe('function');
    });

    it('When invoked / Then returns user from shell context', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.user).toBeDefined();
    });

    it('When invoked / Then returns org_id from shell context', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.org_id).toBe('mock-org-id');
    });

    it('When invoked / Then returns isLoading from entitlements', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Given can function', () => {
    it('When checkPermission returns true / Then can returns true', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.can('items.create')).toBe(true);
    });

    it('When called with any action / Then returns boolean', () => {
      const { result } = renderHook(() => useAuth());
      const allowed = result.current.can('some.action');
      expect(typeof allowed).toBe('boolean');
    });

    it('When permission is absent (deny-by-default) / Then can returns false', () => {
      // Regression guard: previously fell back to granting any authenticated user,
      // producing buttons the backend then rejected with 403.
      mockEnt.can = (_action: string) => false;
      const { result } = renderHook(() => useAuth());
      expect(result.current.can('items.delete')).toBe(false);
    });

    it('When entitlements are still loading / Then can returns true optimistically', () => {
      mockEnt.isLoading = true;
      mockEnt.can = (_action: string) => false; // even if underlying denies, loading wins
      const { result } = renderHook(() => useAuth());
      expect(result.current.can('items.delete')).toBe(true);
    });
  });
});
