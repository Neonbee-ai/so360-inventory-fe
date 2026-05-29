/**
 * BDD specs for Inventory Procurement components.
 *
 * Coverage targets:
 *   - CreateInvoiceModal   (components/vendors/CreateInvoiceModal.tsx)
 *   - LifecycleStatusPanel (components/lifecycle/LifecycleStatusPanel.tsx)
 *   - ProductTypePicker    (components/attributes/ProductTypePicker.tsx)
 *   - CreateLeadModal      (components/leads/CreateLeadModal.tsx)
 *
 * Naming convention:
 *   describe  : 'Given <Component>'
 *   it/test   : 'Given <pre> / When <action> / Then <outcome>'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="icon-loader2" />,
  Upload: () => <span data-testid="icon-upload" />,
  X: () => <span data-testid="icon-x" />,
  FileText: () => <span data-testid="icon-filetext" />,
  Shield: () => <span data-testid="icon-shield" />,
  CheckCircle2: () => <span data-testid="icon-check-circle2" />,
  XCircle: () => <span data-testid="icon-xcircle" />,
  ArrowRight: () => <span data-testid="icon-arrow-right" />,
  AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  Archive: () => <span data-testid="icon-archive" />,
  Play: () => <span data-testid="icon-play" />,
  RotateCcw: () => <span data-testid="icon-rotate-ccw" />,
  Send: () => <span data-testid="icon-send" />,
  Clock: () => <span data-testid="icon-clock" />,
  Cpu: () => <span data-testid="icon-cpu" />,
  Shirt: () => <span data-testid="icon-shirt" />,
  Armchair: () => <span data-testid="icon-armchair" />,
  Monitor: () => <span data-testid="icon-monitor" />,
  Tv: () => <span data-testid="icon-tv" />,
  Smartphone: () => <span data-testid="icon-smartphone" />,
  UtensilsCrossed: () => <span data-testid="icon-utensils" />,
  Car: () => <span data-testid="icon-car" />,
  Hammer: () => <span data-testid="icon-hammer" />,
  Paperclip: () => <span data-testid="icon-paperclip" />,
  Package: () => <span data-testid="icon-package" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
}));

vi.mock('../../components/common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <h3>{title}</h3>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

// ---------------------------------------------------------------------------
// CreateInvoiceModal mocks
// ---------------------------------------------------------------------------

const mockCreateVendorInvoice = vi.fn();
const mockUploadDocument = vi.fn();
const mockGetOrgId = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    createVendorInvoice: (...args: any[]) => mockCreateVendorInvoice(...args),
  },
}));

vi.mock('../../services/mediaService', () => ({
  mediaService: {
    uploadDocument: (...args: any[]) => mockUploadDocument(...args),
  },
}));

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getOrgId: () => mockGetOrgId(),
    getLifecycleGates: vi.fn(),
    transitionLifecycle: vi.fn(),
  },
}));

vi.mock('../../services/productTypeService', () => ({
  productTypeService: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../services/crmService', () => ({
  crmService: {
    getSettings: vi.fn(),
    createLead: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import components under test (after mocks are set up)
// ---------------------------------------------------------------------------

import { CreateInvoiceModal } from '../../components/vendors/CreateInvoiceModal';
import LifecycleStatusPanel from '../../components/lifecycle/LifecycleStatusPanel';
import ProductTypePicker from '../../components/attributes/ProductTypePicker';
import { CreateLeadModal } from '../../components/leads/CreateLeadModal';

// ---------------------------------------------------------------------------
// Helper — sample PO list
// ---------------------------------------------------------------------------

const SAMPLE_POS = [
  { id: 'po-1', po_number: 'PO-2026-001', status: 'approved', total_amount: 5000 },
  { id: 'po-2', po_number: 'PO-2026-002', status: 'draft', total_amount: 1200 },
];

// ===========================================================================
// CreateInvoiceModal
// ===========================================================================

describe('Given CreateInvoiceModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    vendorId: 'vendor-abc',
    vendorPOs: SAMPLE_POS,
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given the modal is open / When rendered / Then it shows the Create Vendor Invoice title and required fields', () => {
    render(<CreateInvoiceModal {...defaultProps} />);

    expect(screen.getByText('Create Vendor Invoice')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/INV-2026-001/i)).toBeInTheDocument();
    expect(screen.getByText(/Invoice Number/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Amount/i)).toBeInTheDocument();
    expect(screen.getByText(/Attach Document/i)).toBeInTheDocument();
  });

  it('Given the modal is closed / When isOpen is false / Then nothing is rendered', () => {
    render(<CreateInvoiceModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('Given the form is filled / When submitted successfully / Then onSuccess is called and the form resets', async () => {
    const user = userEvent.setup();
    mockCreateVendorInvoice.mockResolvedValueOnce({ id: 'inv-1' });

    render(<CreateInvoiceModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText(/INV-2026-001/i), 'INV-TEST-001');
    await user.type(screen.getByPlaceholderText('0.00'), '2500');

    await user.click(screen.getByRole('button', { name: /Create Invoice/i }));

    await waitFor(() => {
      expect(mockCreateVendorInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          vendor_id: 'vendor-abc',
          invoice_number: 'INV-TEST-001',
          total_amount: 2500,
        }),
      );
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('Given the API fails / When submitted / Then an error message is displayed', async () => {
    const user = userEvent.setup();
    mockCreateVendorInvoice.mockRejectedValueOnce(new Error('Network error'));

    render(<CreateInvoiceModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText(/INV-2026-001/i), 'INV-FAIL');
    await user.type(screen.getByPlaceholderText('0.00'), '100');

    await user.click(screen.getByRole('button', { name: /Create Invoice/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it('Given vendor POs exist / When rendered / Then PO options appear in the select', () => {
    render(<CreateInvoiceModal {...defaultProps} />);

    expect(screen.getByText('PO-2026-001 — $5,000 (approved)')).toBeInTheDocument();
    expect(screen.getByText('PO-2026-002 — $1,200 (draft)')).toBeInTheDocument();
  });
});

// ===========================================================================
// LifecycleStatusPanel
// ===========================================================================

describe('Given LifecycleStatusPanel', () => {
  let inventoryService: any;

  beforeEach(async () => {
    ({ inventoryService } = await import('../../services/inventoryService') as any);
    vi.clearAllMocks();
    inventoryService.getLifecycleGates.mockResolvedValue({ gates: [] });
    inventoryService.transitionLifecycle.mockResolvedValue({ product_status: 'pending_review' });
  });

  it('Given item is in draft status / When rendered / Then Draft badge and Submit for Review button are shown', async () => {
    render(
      <LifecycleStatusPanel itemId="item-1" productStatus="draft" />,
    );

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Submit for Review/i })).toBeInTheDocument();
  });

  it('Given item is in active status / When rendered / Then Archive button is visible and Submit for Review is absent', async () => {
    inventoryService.getLifecycleGates.mockResolvedValue({
      gates: [{ name: 'Price set', passed: true }],
    });

    render(
      <LifecycleStatusPanel itemId="item-1" productStatus="active" />,
    );

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Archive/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit for Review/i })).not.toBeInTheDocument();
  });

  it('Given item is in draft / When Submit for Review is clicked / Then lifecycle transition is called', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <LifecycleStatusPanel
        itemId="item-1"
        productStatus="draft"
        onStatusChange={onStatusChange}
      />,
    );

    await waitFor(() => screen.getByRole('button', { name: /Submit for Review/i }));
    await user.click(screen.getByRole('button', { name: /Submit for Review/i }));

    await waitFor(() => {
      expect(inventoryService.transitionLifecycle).toHaveBeenCalledWith('item-1', 'submit_for_review');
      expect(onStatusChange).toHaveBeenCalledWith('pending_review');
    });
  });

  it('Given a transition fails / When triggered / Then an error message appears', async () => {
    const user = userEvent.setup();
    inventoryService.transitionLifecycle.mockRejectedValueOnce(new Error('Transition not allowed'));

    render(
      <LifecycleStatusPanel itemId="item-1" productStatus="draft" />,
    );

    await waitFor(() => screen.getByRole('button', { name: /Submit for Review/i }));
    await user.click(screen.getByRole('button', { name: /Submit for Review/i }));

    await waitFor(() => {
      expect(screen.getByText('Transition not allowed')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// ProductTypePicker
// ===========================================================================

describe('Given ProductTypePicker', () => {
  let productTypeService: any;

  beforeEach(async () => {
    ({ productTypeService } = await import('../../services/productTypeService') as any);
    vi.clearAllMocks();
  });

  it('Given product types are loading / When rendered / Then a loading indicator is shown', () => {
    productTypeService.getAll.mockReturnValue(new Promise(() => {})); // never resolves

    render(<ProductTypePicker value="" onChange={vi.fn()} />);

    expect(screen.getByText(/Loading product types/i)).toBeInTheDocument();
  });

  it('Given no product types exist / When loaded / Then a no-types message is shown', async () => {
    productTypeService.getAll.mockResolvedValueOnce([]);

    render(<ProductTypePicker value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(/No product types available/i),
      ).toBeInTheDocument();
    });
  });

  it('Given product types are available / When rendered / Then each type card is displayed with a None option', async () => {
    productTypeService.getAll.mockResolvedValueOnce([
      { id: 'pt-1', name: 'Electronics', code: 'ELEC', description: 'Electronic goods', icon: 'Cpu', is_system: false },
      { id: 'pt-2', name: 'Apparel', code: 'APRL', description: 'Clothing items', icon: 'Shirt', is_system: true },
    ]);

    render(<ProductTypePicker value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Apparel')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /None/i })).toBeInTheDocument();
    });
  });

  it('Given product types are loaded / When a type is clicked / Then onChange is called with its id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    productTypeService.getAll.mockResolvedValueOnce([
      { id: 'pt-1', name: 'Electronics', code: 'ELEC', description: 'Electronic goods', icon: 'Cpu', is_system: false },
    ]);

    render(<ProductTypePicker value="" onChange={onChange} />);

    await waitFor(() => screen.getByText('Electronics'));
    await user.click(screen.getByText('Electronics'));

    expect(onChange).toHaveBeenCalledWith('pt-1');
  });

  it('Given a type is already selected / When rendered / Then that card has the selected visual ring', async () => {
    productTypeService.getAll.mockResolvedValueOnce([
      { id: 'pt-99', name: 'Raw Materials', code: 'RAW', description: 'Input materials', icon: null, is_system: false },
    ]);

    render(<ProductTypePicker value="pt-99" onChange={vi.fn()} />);

    await waitFor(() => screen.getByText('Raw Materials'));

    const btn = screen.getByRole('button', { name: /Raw Materials/i });
    expect(btn.className).toContain('ring-1');
  });
});

// ===========================================================================
// CreateLeadModal
// ===========================================================================

describe('Given CreateLeadModal', () => {
  let crmService: any;

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    existingLeads: ['Acme Corp', 'Global Traders'],
  };

  beforeEach(async () => {
    ({ crmService } = await import('../../services/crmService') as any);
    vi.clearAllMocks();
    crmService.getSettings.mockResolvedValue({ lead_custom_fields: [] });
    crmService.createLead.mockResolvedValue({ id: 'lead-1' });
  });

  it('Given the modal is open / When rendered / Then required form fields are visible', async () => {
    render(<CreateLeadModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Create New Lead')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/Acme Corp/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact Email/i)).toBeInTheDocument();
  });

  it('Given company name matches an existing lead / When typed / Then a duplicate warning appears', async () => {
    const user = userEvent.setup();
    render(<CreateLeadModal {...defaultProps} />);

    await waitFor(() => screen.getByPlaceholderText(/Acme Corp/i));
    await user.type(screen.getByPlaceholderText(/Acme Corp/i), 'Acme Corp');

    expect(
      screen.getByText(/Potential duplicate detected/i),
    ).toBeInTheDocument();
  });

  it('Given the form is filled correctly / When submitted / Then onSuccess and onClose are called', async () => {
    const user = userEvent.setup();
    render(<CreateLeadModal {...defaultProps} />);

    await waitFor(() => screen.getByPlaceholderText(/Acme Corp/i));
    await user.type(screen.getByPlaceholderText(/Acme Corp/i), 'New Prospect Ltd');
    await user.type(screen.getAllByRole('textbox')[1], 'John Smith');
    await user.type(screen.getAllByRole('textbox')[2], 'john@prospect.com');
    await user.click(screen.getByRole('button', { name: /Create Lead/i }));

    await waitFor(() => {
      expect(crmService.createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: 'New Prospect Ltd',
          contact_name: 'John Smith',
          contact_email: 'john@prospect.com',
        }),
      );
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('Given createLead fails / When submitted / Then an error is shown and form stays open', async () => {
    const user = userEvent.setup();
    crmService.createLead.mockRejectedValueOnce(new Error('Server error'));

    render(<CreateLeadModal {...defaultProps} />);

    await waitFor(() => screen.getByPlaceholderText(/Acme Corp/i));
    await user.type(screen.getByPlaceholderText(/Acme Corp/i), 'Error Co');
    await user.type(screen.getAllByRole('textbox')[1], 'Jane');
    await user.type(screen.getAllByRole('textbox')[2], 'jane@error.com');
    await user.click(screen.getByRole('button', { name: /Create Lead/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to create lead/i)).toBeInTheDocument();
    });
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it('Given custom fields are returned by settings API / When modal opens / Then custom fields section is rendered', async () => {
    crmService.getSettings.mockResolvedValueOnce({
      lead_custom_fields: [
        { id: 'cf-1', label: 'Budget Range', type: 'text', required: false },
      ],
    });

    render(<CreateLeadModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Additional Details')).toBeInTheDocument();
      expect(screen.getByText('Budget Range')).toBeInTheDocument();
    });
  });
});
