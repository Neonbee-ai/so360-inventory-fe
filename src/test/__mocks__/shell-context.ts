import React from 'react';
export const useShell = () => ({
  isModuleEnabled: () => false,
  isFeatureHidden: () => false,
  isFeatureEnabled: () => true,
  currentOrg: { id: 'mock-org-id', name: 'Test Org' },
  printDocument: async () => {},
  getDocumentTemplate: async () => ({}),
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
export const QUOTA_EXCEEDED_EVENT = '__so360_quota_exceeded';
export const buildQuotaExceededDetail = (error: any): unknown => {
  const data = error?.response?.data ?? {};
  return data?.resolution ?? data;
};
