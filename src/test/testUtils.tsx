import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// ============================================================================
// Shared mock factories for Inventory FE tests
// ============================================================================

// Standard react-router-dom mock
export const mockNavigate = vi.fn();
export const mockUseParams = vi.fn(() => ({ id: 'test-id' }));
export const mockSearchParams = new URLSearchParams();
export const mockSetSearchParams = vi.fn();

// Standard shell context mock
export const mockShellContext = {
  user: { id: 'user-1', full_name: 'Test User', email: 'test@test.com', avatar_url: null },
  tenantId: 'tenant-1',
  orgId: 'org-1',
  accessToken: 'test-token',
  currentTenant: { id: 'tenant-1' },
  currentOrg: { id: 'org-1' },
  isFeatureEnabled: vi.fn().mockReturnValue(true),
  isFeatureHidden: vi.fn().mockReturnValue(false),
  isModuleEnabled: vi.fn().mockReturnValue(true),
};

export function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
  );
}

export function buildMockService<T extends object>(): jest.Mocked<T> {
  return new Proxy({} as any, {
    get: (_t, prop) => vi.fn(),
  });
}
