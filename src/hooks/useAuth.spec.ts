import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from './useAuth';

// @so360/shell-context is stubbed via vitest.config.ts alias:
// useEntitlements: () => ({ can: () => true, isLoading: false })
// ShellContext: React.createContext({ user: { id: 'mock-user-id', email: 'test@test.com' }, currentOrg: { id: 'mock-org-id' } })

describe('useAuth', () => {
  describe('Given the hook is rendered', () => {
    it('When invoked / Then returns can function', () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.can).toBe('function');
    });

    it('When invoked / Then returns user from shell context', () => {
      const { result } = renderHook(() => useAuth());
      // The mock shell context has user.id = 'mock-user-id'
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
      // Mock returns can: () => true (not loading, has permission)
      const { result } = renderHook(() => useAuth());
      expect(result.current.can('inventory:items:create')).toBe(true);
    });

    it('When called with any action / Then returns boolean', () => {
      const { result } = renderHook(() => useAuth());
      const allowed = result.current.can('some:action');
      expect(typeof allowed).toBe('boolean');
    });
  });
});
