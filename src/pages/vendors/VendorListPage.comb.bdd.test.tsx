import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetVendors = vi.fn();
const mockCreateVendor = vi.fn();
const mockDeleteVendor = vi.fn();
const mockNavigate = vi.fn();
const mockCan = vi.hoisted(() => vi.fn((_a: string) => true));
const mockShell = vi.fn();

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getVendors: (...a: any[]) => mockGetVendors(...a),
    createVendor: (...a: any[]) => mockCreateVendor(...a),
    deleteVendor: (...a: any[]) => mockDeleteVendor(...a),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: (...a: any[]) => mockShell(...a),
  useQuota: () => ({ getQuota: () => null }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, isLimited: () => false }),
}));

import VendorListPage from './VendorListPage';

const shellState = (o: any = {}) => ({
  currentOrg: { id: 'org-1' },
  permissionsLoaded: true,
  hasPermission: () => true,
  effectiveFlagsLoaded: true,
  getFeatureState: () => 'enabled',
  ...o,
});
const vendor = (o: any = {}) => ({
  id: 'v1', name: 'Acme Supplies', email: 'a@x.com', phone: '+971 1',
  vendor_profiles: [{ classification: 'supplier', is_preferred: true, performance_rating: 4 }],
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockImplementation(() => true);
  mockShell.mockReturnValue(shellState());
  mockGetVendors.mockResolvedValue([]);
  mockCreateVendor.mockResolvedValue({ id: 'new' });
  mockDeleteVendor.mockResolvedValue({});
});

describe('VendorListPage (Comb)', () => {
  it('Given the page / When rendered / Then list template shows title and Add Vendor primary action', async () => {
    const { container } = render(<VendorListPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Vendors & Subcontractors' })).toBeInTheDocument();
    expect(container.querySelector('[data-template="list"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="primary"]')).toHaveTextContent('Add Vendor');
  });

  it('Given a pending request / When loading / Then loading status is announced', () => {
    mockGetVendors.mockReturnValue(new Promise(() => {}));
    render(<VendorListPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading vendor ecosystem...');
  });

  it('Given no vendors / When loaded / Then the empty state is shown', async () => {
    render(<VendorListPage />);
    expect(await screen.findByTestId('empty-state')).toHaveTextContent('No vendors found');
  });

  it('Given vendors / When loaded / Then rows show name, email and preferred badge', async () => {
    mockGetVendors.mockResolvedValue([vendor()]);
    render(<VendorListPage />);
    const table = await screen.findByTestId('vendors-table');
    expect(table).toHaveTextContent('Acme Supplies');
    expect(table).toHaveTextContent('a@x.com');
    expect(table).toHaveTextContent('Preferred');
  });

  it('Given a vendor row / When View Profile is clicked / Then it navigates to the detail route', async () => {
    mockGetVendors.mockResolvedValue([vendor()]);
    render(<VendorListPage />);
    fireEvent.click(await screen.findByText('View Profile →'));
    expect(mockNavigate).toHaveBeenCalledWith('/vendors/v1');
  });

  it('Given the create drawer / When the form is submitted / Then createVendor is called with the entered name', async () => {
    render(<VendorListPage />);
    fireEvent.click(await screen.findByText('Add Vendor'));
    const dialog = await screen.findByRole('dialog', { name: 'Add New Vendor' });
    expect(dialog).toHaveTextContent('Cancel');
    fireEvent.change(screen.getByPlaceholderText('Company name'), { target: { value: 'New Vendor' } });
    fireEvent.click(screen.getByText('Add Vendor', { selector: 'button[type="submit"]' }));
    await waitFor(() => expect(mockCreateVendor).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Vendor' })));
  });

  it('Given a vendor / When Delete Vendor is confirmed / Then deleteVendor is called', async () => {
    mockGetVendors.mockResolvedValue([vendor()]);
    render(<VendorListPage />);
    fireEvent.click(await screen.findByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Delete Vendor'));
    fireEvent.click(await screen.findByText('Delete'));
    await waitFor(() => expect(mockDeleteVendor).toHaveBeenCalledWith('v1'));
  });

  it('Given suppliers.create is denied / When rendered / Then Add Vendor and row actions are hidden', async () => {
    mockCan.mockImplementation((a: string) => a !== 'suppliers.create');
    mockShell.mockReturnValue(shellState({ hasPermission: () => false }));
    mockGetVendors.mockResolvedValue([vendor()]);
    render(<VendorListPage />);
    await screen.findByTestId('vendors-table');
    expect(screen.queryByText('Add Vendor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
  });

  it('Given the feature flag is not enabled / When rendered / Then row delete is not offered', async () => {
    mockShell.mockReturnValue(shellState({ getFeatureState: () => 'hidden' }));
    mockGetVendors.mockResolvedValue([vendor()]);
    render(<VendorListPage />);
    await screen.findByTestId('vendors-table');
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
  });
});
