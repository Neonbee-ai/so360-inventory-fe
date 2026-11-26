import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Vendor360Page used to be the only static page import in App (it dragged the vendor,
// procurement and vendor-portal services into the initial closure). It is now code-split.
vi.mock('./pages/vendors/Vendor360Page', () => ({ default: () => <div data-testid="vendor-360">Vendor360</div> }));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentOrg: { id: 'org-1' },
    accessToken: 'token-123',
    currentTenant: { id: 'tenant-1' },
    user: { id: 'user-1' },
    // Entitlement surface the route-level PermissionGuard reads. These specs
    // exercise routing/feature-gating, not RBAC, so default to unrestricted.
    permissionsLoaded: true,
    hasPermission: () => true,
    hasAnyPermission: (...codes: string[]) => codes.length > 0,
  }),
}));

vi.mock('./services/inventoryService', () => ({
  inventoryService: {
    setOrgId: vi.fn(),
    setAccessToken: vi.fn(),
    setTenantId: vi.fn(),
  },
}));

vi.mock('./services/procurementService', () => ({
  procurementService: {},
}));

vi.mock('./services/vendorService', () => ({
  vendorService: {
    setUserId: vi.fn(),
  },
}));

vi.mock('./services/mediaService', () => ({
  mediaService: {
    setAccessToken: vi.fn(),
    setTenantId: vi.fn(),
    setOrgId: vi.fn(),
  },
}));

import App from './App';

describe('Given App with a lazily loaded Vendor 360 route', () => {
  it('When first rendered / Then Vendor360Page is not in the first commit', () => {
    render(<MemoryRouter initialEntries={['/vendors/v1/360']}><App /></MemoryRouter>);
    expect(screen.queryByTestId('vendor-360')).toBeNull();
  });

  it('When the chunk resolves / Then Vendor360Page renders behind the Suspense boundary', async () => {
    render(<MemoryRouter initialEntries={['/vendors/v1/360']}><App /></MemoryRouter>);
    expect(await screen.findByTestId('vendor-360')).toBeInTheDocument();
  });
});
