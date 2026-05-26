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

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ isFeatureEnabled: () => true, currentOrg: { id: 'org-1', name: 'Test Org' } }),
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
  mockGetVendors.mockResolvedValue([]);
  mockCreateVendor.mockResolvedValue({ id: 'vendor-new' });
  mockDeleteVendor.mockResolvedValue({});
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
});
