import React from 'react';
export const useShell = () => ({
  isModuleEnabled: () => false,
  isFeatureHidden: () => false,
  isFeatureEnabled: () => true,
});
export const useBusinessSettings = () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } });
export const useNotify = () => ({ emitNotification: async () => {} });
export const useActivity = () => ({ recordActivity: async () => {} });
export const useShellBridge = () => ({
  isFeatureEnabled: () => true,
  isFeatureHidden: () => false,
  getFeatureState: () => 'enabled',
});
export const usePeople = () => ({ people: [] });
export const useEntitlements = () => ({ can: () => true, isLoading: false });
export const useQuota = () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} });
export const useSandboxLimit = () => ({ isSandboxMode: false, sandboxEntryLimit: 5, limitItems: (items: any[]) => items, isLimited: () => false });
export const ShellContext = React.createContext<any>({ user: { id: 'mock-user-id', email: 'test@test.com' }, currentOrg: { id: 'mock-org-id' } });
