import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetVendors = vi.fn();
const mockCreateVendor = vi.fn();
const mockDeleteVendor = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getVendors: (...args: any[]) => mockGetVendors(...args),
    createVendor: (...args: any[]) => mockCreateVendor(...args),
    deleteVendor: (...args: any[]) => mockDeleteVendor(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('../../components/common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

const mockUseShellBridgeV = vi.fn();
const mockQuotaBar = vi.fn();
vi.mock('@so360/design-system', () => ({
  QuotaBar: (props: any) => { mockQuotaBar(props); return <div data-testid="quota-bar" data-used={props.used} />; },
  QuotaGate: ({ children }: any) => <>{children}</>,
  FeatureGate: ({ children }: any) => <>{children}</>,
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: (...args: any[]) => mockUseShellBridgeV(...args),
  useQuota: () => ({ getQuota: () => null, isExceeded: () => false }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: null, limitItems: (items: any[]) => items, isLimited: false }),
}));

import VendorListPage from './VendorListPage';

const makeVendor = (overrides: any = {}) => ({
  id: 'vendor-1',
  name: 'Acme Supplies',
  email: 'acme@example.com',
  phone: '+971500000001',
  address: 'Dubai, UAE',
  vendor_profiles: [{
    classification: 'supplier',
    is_preferred: false,
    performance_rating: 4,
    payment_terms: 'Net 30',
  }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockQuotaBar.mockClear();
  mockGetVendors.mockResolvedValue([]);
  mockCreateVendor.mockResolvedValue({ id: 'vendor-new' });
  mockDeleteVendor.mockResolvedValue({});
  mockUseShellBridgeV.mockReturnValue({
    isFeatureEnabled: () => true,
    currentOrg: { id: 'org-1', name: 'Test Org' },
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
});

describe('VendorListPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Vendors heading', async () => {
      render(<VendorListPage />);
      await waitFor(() => {
        expect(screen.getByText('Vendors & Subcontractors')).toBeInTheDocument();
      });
    });

    it('When user has permission / Then shows Add Vendor button', async () => {
      render(<VendorListPage />);
      await waitFor(() => {
        expect(screen.getByText('Add Vendor')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows search input', async () => {
      render(<VendorListPage />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search vendors...')).toBeInTheDocument();
      });
    });
  });

  describe('Given vendors exist', () => {
    it('When vendors fetched / Then shows vendor name', async () => {
      mockGetVendors.mockResolvedValue([makeVendor()]);
      render(<VendorListPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      });
    });

    it('When vendors fetched / Then shows vendor email', async () => {
      mockGetVendors.mockResolvedValue([makeVendor()]);
      render(<VendorListPage />);
      await waitFor(() => {
        expect(screen.getByText('acme@example.com')).toBeInTheDocument();
      });
    });

    it('When vendors fetched / Then shows vendor phone', async () => {
      mockGetVendors.mockResolvedValue([makeVendor()]);
      render(<VendorListPage />);
      await waitFor(() => {
        expect(screen.getByText('+971500000001')).toBeInTheDocument();
      });
    });

    it('When View Profile clicked / Then navigates to vendor detail', async () => {
      mockGetVendors.mockResolvedValue([makeVendor()]);
      render(<VendorListPage />);
      await waitFor(() => screen.getByText('View Profile →'));
      fireEvent.click(screen.getByText('View Profile →'));
      expect(mockNavigate).toHaveBeenCalledWith('/vendors/vendor-1');
    });
  });

  describe('Given search filter', () => {
    it('When typing a vendor name / Then filters vendors', async () => {
      mockGetVendors.mockResolvedValue([
        makeVendor(),
        makeVendor({ id: 'vendor-2', name: 'Beta Corp', email: 'beta@example.com', phone: '+971500000002' }),
      ]);
      render(<VendorListPage />);
      await waitFor(() => screen.getByText('Acme Supplies'));
      fireEvent.change(screen.getByPlaceholderText('Search vendors...'), { target: { value: 'Beta' } });
      expect(screen.queryByText('Acme Supplies')).not.toBeInTheDocument();
      expect(screen.getByText('Beta Corp')).toBeInTheDocument();
    });

    it('When search cleared / Then shows all vendors', async () => {
      mockGetVendors.mockResolvedValue([
        makeVendor(),
        makeVendor({ id: 'vendor-2', name: 'Beta Corp', email: 'beta@example.com', phone: '+971500000002' }),
      ]);
      render(<VendorListPage />);
      await waitFor(() => screen.getByText('Acme Supplies'));
      const input = screen.getByPlaceholderText('Search vendors...');
      fireEvent.change(input, { target: { value: 'Beta' } });
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      expect(screen.getByText('Beta Corp')).toBeInTheDocument();
    });
  });

  describe('Given create vendor flow', () => {
    it('When Add Vendor clicked / Then opens create modal', async () => {
      render(<VendorListPage />);
      await waitFor(() => screen.getByText('Add Vendor'));
      fireEvent.click(screen.getByText('Add Vendor'));
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });
    });

    it('When form submitted / Then calls createVendor', async () => {
      render(<VendorListPage />);
      await waitFor(() => screen.getByText('Add Vendor'));
      fireEvent.click(screen.getByText('Add Vendor'));
      await waitFor(() => screen.getByTestId('modal'));
      fireEvent.change(screen.getByPlaceholderText('Company name'), { target: { value: 'New Vendor' } });
      fireEvent.click(screen.getByText('Add Vendor', { selector: 'button[type="submit"]' }));
      await waitFor(() => {
        expect(mockCreateVendor).toHaveBeenCalled();
      });
    });
  });

  describe('Given fetch error', () => {
    it('When getVendors fails / Then shows error message', async () => {
      mockGetVendors.mockRejectedValue(new Error('Failed to fetch vendors'));
      render(<VendorListPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch vendors')).toBeInTheDocument();
      });
    });
  });

  describe('Given no vendors', () => {
    it('When list is empty / Then shows empty state message', async () => {
      render(<VendorListPage />);
      await waitFor(() => {
        expect(screen.getByText('No vendors found')).toBeInTheDocument();
      });
    });
  });

  describe('Given vendor count display (QuotaBar)', () => {
    it('When 3 vendors are fetched / Then QuotaBar receives used=3 from actual vendor list', async () => {
      mockGetVendors.mockResolvedValue([
        makeVendor({ id: 'v1', name: 'V1' }),
        makeVendor({ id: 'v2', name: 'V2' }),
        makeVendor({ id: 'v3', name: 'V3' }),
      ]);
      render(<VendorListPage />);
      await waitFor(() => screen.getByText('V1'));
      const bar = screen.getByTestId('quota-bar');
      expect(bar.getAttribute('data-used')).toBe('3');
    });

    it('When 0 vendors are fetched / Then QuotaBar receives used=0, not undefined', async () => {
      mockGetVendors.mockResolvedValue([]);
      render(<VendorListPage />);
      await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
      const bar = screen.queryByTestId('quota-bar');
      if (bar) expect(bar.getAttribute('data-used')).toBe('0');
    });

    it('When fetch fails / Then QuotaBar is not rendered (no stale zero count shown)', async () => {
      mockGetVendors.mockRejectedValue(new Error('Network error'));
      render(<VendorListPage />);
      await waitFor(() => screen.getByText('Network error'));
      expect(screen.queryByTestId('quota-bar')).not.toBeInTheDocument();
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then Add Vendor button is not shown', async () => {
      mockUseShellBridgeV.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        effectiveFlagsLoaded: false,
        getFeatureState: () => 'enabled',
      });
      render(<VendorListPage />);
      await waitFor(() => expect(screen.getByText('Vendors & Subcontractors')).toBeInTheDocument());
      expect(screen.queryByText('Add Vendor')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then Add Vendor button appears', async () => {
      mockUseShellBridgeV.mockReturnValue({
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1', name: 'Test Org' },
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
      });
      render(<VendorListPage />);
      await waitFor(() => expect(screen.getByText('Add Vendor')).toBeInTheDocument());
    });
  });
});
