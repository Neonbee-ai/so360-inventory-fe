import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

// Controllable shell context mock. Defaults mirror an authorized, fully-loaded
// shell (permissionsLoaded: true, hasPermission: () => true) and are reset
// before each test so the existing behavioural tests are unaffected;
// individual tests flip these to exercise the deny-by-default and loading paths.
const mockShell = vi.hoisted(() => ({
  user: { id: 'mock-user-id', email: 'test@test.com' },
  currentOrg: { id: 'mock-org-id' },
  permissionsLoaded: true as boolean,
  hasPermission: (_action: string) => true as boolean,
}));

vi.mock('@so360/shell-context', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, ShellContext: React.createContext<any>(mockShell) };
});

import { useAuth } from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    mockShell.permissionsLoaded = true;
    mockShell.hasPermission = (_action: string) => true;
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

    it('When invoked / Then returns isLoading from shell permissions state', () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Given can function', () => {
    it('When shell.hasPermission returns true / Then can returns true', () => {
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
      mockShell.hasPermission = (_action: string) => false;
      const { result } = renderHook(() => useAuth());
      expect(result.current.can('items.delete')).toBe(false);
    });

    it('When shell permissions are still loading / Then can returns true optimistically', () => {
      mockShell.permissionsLoaded = false;
      mockShell.hasPermission = (_action: string) => false; // even if underlying denies, loading wins
      const { result } = renderHook(() => useAuth());
      expect(result.current.can('items.delete')).toBe(true);
    });

    it('When shell.hasPermission is granted for the real RBAC code / Then can("warehouses.create") returns true', () => {
      mockShell.hasPermission = (action: string) => action === 'warehouses.create';
      const { result } = renderHook(() => useAuth());
      expect(result.current.can('warehouses.create')).toBe(true);
    });
  });
});
