/**
 * BDD specs for Vendor-related pages inside the Inventory module.
 *
 * Coverage targets:
 *   - VendorListPage    (pages/vendors/VendorListPage.tsx)
 *   - ContractsPage     (pages/vendors/ContractsPage.tsx)
 *   - VendorDetailPage  (pages/vendors/VendorDetailPage.tsx)
 *
 * Naming convention:
 *   describe : 'Given <Component>'
 *   it       : 'Given <pre> / When <action> / Then <outcome>'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ---------------------------------------------------------------------------
// Module mocks (must be hoisted before component imports)
// ---------------------------------------------------------------------------

const mockGetVendors = vi.fn();
const mockCreateVendor = vi.fn();
const mockDeleteVendor = vi.fn();
const mockGetContracts = vi.fn();
const mockGetVendorDetail = vi.fn();
const mockUpdateVendor = vi.fn();
const mockRateVendor = vi.fn();
const mockGetPOs = vi.fn();
const mockNavigate = vi.fn();
const mockRecordActivity = vi.fn();

vi.mock('../../../services/vendorService', () => ({
  vendorService: {
    getVendors: (...args: any[]) => mockGetVendors(...args),
    createVendor: (...args: any[]) => mockCreateVendor(...args),
    deleteVendor: (...args: any[]) => mockDeleteVendor(...args),
    getContracts: (...args: any[]) => mockGetContracts(...args),
    getVendorById: (...args: any[]) => mockGetVendorDetail(...args),
    getVendorDetail: (...args: any[]) => mockGetVendorDetail(...args),
    updateVendor: (...args: any[]) => mockUpdateVendor(...args),
    rateVendor: (...args: any[]) => mockRateVendor(...args),
  },
}));

vi.mock('../../../services/procurementService', () => ({
  procurementService: {
    getPOs: (...args: any[]) => mockGetPOs(...args),
    createVendorInvoice: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'vendor-123' }),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ isFeatureEnabled: () => true, currentOrg: { id: 'org-1' } }),
  useActivity: () => ({ recordActivity: mockRecordActivity }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useQuota: () => ({ getQuota: () => null }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 100, isLimited: () => false }),
  useEntitlements: () => ({ can: () => true, isLoading: false }),
  ShellContext: { Provider: ({ children }: any) => children },
}));

vi.mock('@so360/design-system', () => ({
  QuotaBar: () => <div data-testid="quota-bar" />,
  QuotaGate: ({ children }: any) => <>{children}</>,
  FeatureGate: ({ state, children }: any) => (state === 'hidden' ? null : <>{children}</>),
  FeatureRoute: ({ children }: any) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Search: () => <span data-testid="icon-search" />,
  Trash2: () => <span data-testid="icon-trash2" />,
  Loader2: () => <span data-testid="icon-loader2" />,
  X: () => <span data-testid="icon-x" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Building2: () => <span data-testid="icon-building2" />,
  Mail: () => <span data-testid="icon-mail" />,
  Phone: () => <span data-testid="icon-phone" />,
  MapPin: () => <span data-testid="icon-mappin" />,
  Edit2: () => <span data-testid="icon-edit2" />,
  Save: () => <span data-testid="icon-save" />,
  Star: () => <span data-testid="icon-star" />,
  FileText: () => <span data-testid="icon-filetext" />,
  DollarSign: () => <span data-testid="icon-dollar" />,
  Package: () => <span data-testid="icon-package" />,
  Calendar: () => <span data-testid="icon-calendar" />,
  ExternalLink: () => <span data-testid="icon-external-link" />,
}));

vi.mock('../../../components/common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <h3>{title}</h3>
        {children}
      </div>
    ) : null,
}));

vi.mock('../../../components/common/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="table-skeleton" />,
}));

vi.mock('../../../components/vendors/CreateInvoiceModal', () => ({
  CreateInvoiceModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="invoice-modal" /> : null,
}));

// ---------------------------------------------------------------------------
// Component imports (after mocks)
// ---------------------------------------------------------------------------

import VendorListPage from '../VendorListPage';
import ContractsPage from '../ContractsPage';
import VendorDetailPage from '../VendorDetailPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_VENDORS = [
  {
    id: 'v-1',
    name: 'Acme Supplies',
    email: 'acme@example.com',
    phone: '+1-555-1000',
    vendor_profiles: [{ classification: 'supplier', is_preferred: true, performance_rating: 4.5 }],
  },
  {
    id: 'v-2',
    name: 'Global Parts Ltd',
    email: 'gpl@example.com',
    phone: '+1-555-2000',
    vendor_profiles: [],
  },
];

const SAMPLE_CONTRACTS = [
  {
    id: 'ct-1',
    status: 'active',
    contract_value: '15000.00',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    vendor: { name: 'Subco Inc' },
  },
];

const SAMPLE_VENDOR_DETAIL = {
  id: 'vendor-123',
  name: 'Precision Parts Co',
  email: 'ppc@example.com',
  phone: '+1-555-9999',
  address: '123 Industrial Ave',
  vendor_profiles: [
    { classification: 'manufacturer', is_preferred: false, performance_rating: 3.8, rating_count: 5, payment_terms: 'Net 60' },
  ],
  purchase_orders: [
    { id: 'po-1', po_number: 'PO-001', status: 'approved', total_amount: 8500, created_at: '2026-03-01' },
  ],
  vendor_invoices: [],
};

// ===========================================================================
// VendorListPage
// ===========================================================================

describe('Given VendorListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given vendors are loading / When rendered / Then a loading indicator appears', () => {
    mockGetVendors.mockReturnValue(new Promise(() => {})); // never resolves

    render(<VendorListPage />);

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('Given vendors are fetched / When rendered / Then each vendor name is shown', async () => {
    mockGetVendors.mockResolvedValueOnce(SAMPLE_VENDORS);

    render(<VendorListPage />);

    await waitFor(() => {
      expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      expect(screen.getByText('Global Parts Ltd')).toBeInTheDocument();
    });
  });

  it('Given vendors are loaded / When user types a search term / Then only matching vendors appear', async () => {
    const user = userEvent.setup();
    mockGetVendors.mockResolvedValueOnce(SAMPLE_VENDORS);

    render(<VendorListPage />);

    await waitFor(() => screen.getByText('Acme Supplies'));
    const searchInput = screen.getByPlaceholderText(/search vendors/i);
    await user.type(searchInput, 'Global');

    expect(screen.queryByText('Acme Supplies')).not.toBeInTheDocument();
    expect(screen.getByText('Global Parts Ltd')).toBeInTheDocument();
  });

  it('Given the API fails / When rendered / Then an error message is displayed', async () => {
    mockGetVendors.mockRejectedValueOnce(new Error('Service unavailable'));

    render(<VendorListPage />);

    await waitFor(() => {
      expect(screen.getByText(/Service unavailable/i)).toBeInTheDocument();
    });
  });

  it('Given Add Vendor button is visible / When clicked / Then the create modal appears', async () => {
    const user = userEvent.setup();
    mockGetVendors.mockResolvedValueOnce([]);

    render(<VendorListPage />);

    await waitFor(() => screen.getByRole('button', { name: /Add Vendor/i }));
    await user.click(screen.getByRole('button', { name: /Add Vendor/i }));

    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });
});

// ===========================================================================
// ContractsPage
// ===========================================================================

describe('Given ContractsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given contracts are loading / When rendered / Then loading text is shown', () => {
    mockGetContracts.mockReturnValue(new Promise(() => {}));

    render(<ContractsPage />);

    expect(screen.getByText(/Loading contracts/i)).toBeInTheDocument();
  });

  it('Given no contracts exist / When loaded / Then an empty state message is shown', async () => {
    mockGetContracts.mockResolvedValueOnce([]);

    render(<ContractsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No active contracts found/i)).toBeInTheDocument();
    });
  });

  it('Given contracts are returned / When rendered / Then contract value and vendor name are displayed', async () => {
    mockGetContracts.mockResolvedValueOnce(SAMPLE_CONTRACTS);

    render(<ContractsPage />);

    await waitFor(() => {
      expect(screen.getByText('Subco Inc')).toBeInTheDocument();
      expect(screen.getByText(/\$15,000/)).toBeInTheDocument();
    });
  });

  it('Given a contract has active status / When rendered / Then the status badge reads "active"', async () => {
    mockGetContracts.mockResolvedValueOnce(SAMPLE_CONTRACTS);

    render(<ContractsPage />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// VendorDetailPage
// ===========================================================================

describe('Given VendorDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given vendor data is loading / When rendered / Then a skeleton loader is shown', () => {
    mockGetVendorDetail.mockReturnValue(new Promise(() => {}));

    render(<VendorDetailPage />);

    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
  });

  it('Given vendor data is fetched / When rendered / Then vendor name, email and phone are shown', async () => {
    mockGetVendorDetail.mockResolvedValueOnce(SAMPLE_VENDOR_DETAIL);

    render(<VendorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Precision Parts Co')).toBeInTheDocument();
      expect(screen.getByText('ppc@example.com')).toBeInTheDocument();
      expect(screen.getByText('+1-555-9999')).toBeInTheDocument();
    });
  });

  it('Given vendor data loads with purchase orders / When rendered / Then the PO number is listed', async () => {
    mockGetVendorDetail.mockResolvedValueOnce(SAMPLE_VENDOR_DETAIL);

    render(<VendorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('PO-001')).toBeInTheDocument();
    });
  });

  it('Given vendor fails to load / When rendered / Then an error message appears', async () => {
    mockGetVendorDetail.mockRejectedValueOnce(new Error('Vendor not found'));

    render(<VendorDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Vendor not found/i)).toBeInTheDocument();
    });
  });
});
