import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetVendors = vi.fn();
const mockCreateVendor = vi.fn();
const mockCreateBank = vi.fn();
vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getVendors: (...a: any[]) => mockGetVendors(...a),
    createVendor: (...a: any[]) => mockCreateVendor(...a),
    deleteVendor: vi.fn(),
    createBankAccount: (...a: any[]) => mockCreateBank(...a),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
const mockCan = vi.hoisted(() => vi.fn((_p: string) => true));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));
vi.mock('@so360/design-system', async () => ({
  ...(await vi.importActual<any>('@so360/design-system')),
  QuotaBar: () => null,
  QuotaGate: ({ children }: any) => <>{children}</>,
  FeatureGate: ({ children }: any) => <>{children}</>,
}));
const mockFlag = vi.hoisted(() => vi.fn((_k: string) => true));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    isFeatureEnabled: mockFlag, currentOrg: { id: 'org-1', name: 'Test Org' },
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
    effectiveFlagsLoaded: true, getFeatureState: () => 'enabled',
  }),
  useBusinessSettings: () => ({ settings: { base_currency: 'AED' } }),
  useQuota: () => ({ getQuota: () => null, isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (i: any[]) => i, isLimited: false }),
}));

import VendorListPage from './VendorListPage';

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

async function openForm() {
  render(<VendorListPage />);
  await waitFor(() => screen.getByText('Add Vendor'));
  fireEvent.click(screen.getByText('Add Vendor'));
  await waitFor(() => screen.getByRole('dialog'));
  fireEvent.change(screen.getByPlaceholderText('Company name'), { target: { value: 'New Vendor' } });
}
const submit = () => fireEvent.click(screen.getByText('Add Vendor', { selector: 'button[type="submit"]' }));
function fillValidBank() {
  fireEvent.click(field('add_bank_details'));
  type('bank_account_holder', 'New Vendor LLC'); type('bank_name', 'Emirates NBD');
  type('bank_account_number', '123456789'); type('bank_confirm_account_number', '123456789');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockImplementation(() => true);
  mockFlag.mockImplementation(() => true);
  mockGetVendors.mockResolvedValue([]);
  mockCreateVendor.mockResolvedValue({ id: 'vendor-new' });
  mockCreateBank.mockResolvedValue({ id: 'acct-1' });
});

describe('VendorListPage — bank details on create', () => {
  describe('Given the vendor bank flag is off', () => {
    it('When the create form opens / Then the bank option is not offered', async () => {
      mockFlag.mockImplementation((k) => k !== 'submodule:inventory:vendor_bank_details');
      await openForm();
      expect(field('add_bank_details')).toBeNull();
    });
  });

  describe('Given the user cannot manage bank accounts', () => {
    it('When the create form opens / Then the bank option is not offered', async () => {
      mockCan.mockImplementation((p) => p !== 'vendor_bank_accounts.manage');
      await openForm();
      expect(field('add_bank_details')).toBeNull();
    });
  });

  describe('Given the bank option is not ticked', () => {
    it('When submitted / Then only the vendor is created', async () => {
      await openForm();
      expect(field('bank_account_holder')).toBeNull();
      submit();
      await waitFor(() => expect(mockCreateVendor).toHaveBeenCalled());
      expect(mockCreateBank).not.toHaveBeenCalled();
    });
  });

  describe('Given the bank option is ticked with invalid details', () => {
    it('When submitted / Then neither vendor nor bank account is created', async () => {
      await openForm();
      fireEvent.click(field('add_bank_details'));
      expect(field('bank_currency').value).toBe('AED');
      type('bank_account_holder', 'New Vendor LLC'); type('bank_name', 'Emirates NBD');
      type('bank_account_number', '12345');
      submit();
      await waitFor(() => expect(screen.getByText(/9.?18 digits/i)).toBeInTheDocument());
      expect(mockCreateVendor).not.toHaveBeenCalled();
      expect(mockCreateBank).not.toHaveBeenCalled();
    });
  });

  describe('Given the bank option is ticked with valid details', () => {
    it('When submitted / Then the vendor is created and the account saved as primary', async () => {
      await openForm();
      fillValidBank();
      submit();
      await waitFor(() => expect(mockCreateBank).toHaveBeenCalledWith('vendor-new', expect.objectContaining({
        account_holder: 'New Vendor LLC', account_number: '123456789', currency: 'AED', is_primary: true,
      })));
    });
    it('When createVendor wraps the id in data / Then that id is used', async () => {
      mockCreateVendor.mockResolvedValue({ data: { id: 'vendor-wrapped' } });
      await openForm();
      fillValidBank();
      submit();
      await waitFor(() => expect(mockCreateBank).toHaveBeenCalledWith('vendor-wrapped', expect.anything()));
    });
    it('When the bank save fails / Then the vendor stays created and a warning explains it', async () => {
      mockCreateBank.mockRejectedValue(new Error('Bank detail encryption is not configured'));
      await openForm();
      fillValidBank();
      submit();
      expect(await screen.findByText(/Vendor created, but the bank account was not saved \(Bank detail encryption is not configured\)/)).toBeInTheDocument();
      expect(mockCreateVendor).toHaveBeenCalled();
    });
  });
});
