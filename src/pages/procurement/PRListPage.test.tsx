import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockUseShellBridgePR = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: (...args: any[]) => mockUseShellBridgePR(...args),
}));

const mockGetPRs = vi.fn();
const mockCreatePR = vi.fn();
const mockDeletePR = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPRs: (...args: any[]) => mockGetPRs(...args),
    createPR: (...args: any[]) => mockCreatePR(...args),
    deletePR: (...args: any[]) => mockDeletePR(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../components/ItemSearchSelector', () => ({
  __esModule: true,
  default: ({ onSelect }: any) => (
    <div data-testid="item-search">
      <button onClick={() => onSelect({ id: 'item-1', name: 'Widget', sku: 'W-001', price: 100 })}>
        Select Item
      </button>
    </div>
  ),
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string, _opts?: any) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
  useInventoryCurrencySymbol: () => '$',
}));

import PRListPage from './PRListPage';

const makePR = (overrides: any = {}) => ({
  id: 'pr-1',
  status: 'draft',
  description: 'Office supplies',
  required_date: '2025-06-01',
  created_at: '2025-01-10T00:00:00Z',
  requester: { full_name: 'John Doe' },
  pr_lines: [{ id: 'pl-1', description: 'Paper', quantity: 5, estimated_unit_price: 20 }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPRs.mockResolvedValue([]);
  mockCreatePR.mockResolvedValue({ id: 'pr-new' });
  mockDeletePR.mockResolvedValue({});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(toast, 'success').mockReturnValue('toast-id');
  vi.spyOn(toast, 'error').mockReturnValue('toast-id');
  vi.spyOn(toast, 'warning').mockReturnValue('toast-id');
  vi.spyOn(toast, 'info').mockReturnValue('toast-id');
  mockUseShellBridgePR.mockReturnValue({
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PRListPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Purchase Requisitions heading', async () => {
      render(<PRListPage />);
      await waitFor(() => {
        expect(screen.getByText('Purchase Requisitions')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows New Requisition button', async () => {
      render(<PRListPage />);
      await waitFor(() => {
        expect(screen.getByText('New Requisition')).toBeInTheDocument();
      });
    });
  });

  describe('Given PRs loaded', () => {
    it('When PRs exist / Then shows PR status', async () => {
      mockGetPRs.mockResolvedValue([makePR()]);
      render(<PRListPage />);
      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });

    it('When PRs exist / Then shows requester name', async () => {
      mockGetPRs.mockResolvedValue([makePR()]);
      render(<PRListPage />);
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('When View Details button clicked / Then navigates to PR detail', async () => {
      mockGetPRs.mockResolvedValue([makePR()]);
      render(<PRListPage />);
      await waitFor(() => screen.getByText('View Details →'));
      fireEvent.click(screen.getByText('View Details →'));
      expect(mockNavigate).toHaveBeenCalledWith('/procurement/pr/pr-1');
    });
  });

  describe('Given no PRs', () => {
    it('When list empty / Then shows no PRs message', async () => {
      render(<PRListPage />);
      await waitFor(() => {
        expect(screen.getByText('No purchase requisitions found.')).toBeInTheDocument();
      });
    });
  });

  describe('Given create PR flow', () => {
    it('When New Requisition clicked / Then shows PR form', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => {
        expect(screen.getByText('Create New Requisition')).toBeInTheDocument();
      });
    });

    it('When form open / Then shows description field', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('What is being requested...')).toBeInTheDocument();
      });
    });

    it('When form submitted with item selected / Then calls createPR with correct payload', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByPlaceholderText('What is being requested...'));
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
      fireEvent.change(screen.getByPlaceholderText('What is being requested...'), { target: { value: 'Need pens' } });
      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Select Item'));
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      await waitFor(() => {
        expect(mockCreatePR).toHaveBeenCalledWith(expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ item_id: 'item-1', quantity: 1 }),
          ]),
        }));
      });
    });
  });

  describe('Given PR deletion', () => {
    it('When delete clicked on draft PR / Then calls deletePR after confirm', async () => {
      mockGetPRs.mockResolvedValue([makePR({ status: 'draft' })]);
      render(<PRListPage />);
      await waitFor(() => screen.getByText('Delete'));
      fireEvent.click(screen.getByText('Delete'));
      await waitFor(() => {
        expect(mockDeletePR).toHaveBeenCalledWith('pr-1');
      });
    });

    it('When approved PR has no delete button / Then Delete is not shown', async () => {
      mockGetPRs.mockResolvedValue([makePR({ status: 'approved' })]);
      render(<PRListPage />);
      await waitFor(() => screen.getByText('approved'));
      // Approved PRs have no Delete button — only draft/rejected do
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });

  describe('Given PR creation validation guards (bug fix: 400 on submit)', () => {
    it('When no items added / Then blocks submit with alert and does not call createPR', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      expect(toast.warning).toHaveBeenCalledWith('Please add at least one item before submitting.');
      expect(mockCreatePR).not.toHaveBeenCalled();
    });

    it('When item row added but no product selected / Then blocks with unselected-product alert', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
      fireEvent.click(screen.getByText('+ Add Item'));
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      expect(toast.warning).toHaveBeenCalledWith('Please select a product for all item rows before submitting.');
      expect(mockCreatePR).not.toHaveBeenCalled();
    });

    it('When item selected but quantity set to 0 / Then blocks with quantity alert', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Select Item'));
      const qtyInput = screen.getByPlaceholderText('Qty');
      fireEvent.change(qtyInput, { target: { value: '0' } });
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      expect(toast.warning).toHaveBeenCalledWith('All items must have a quantity greater than 0.');
      expect(mockCreatePR).not.toHaveBeenCalled();
    });

    it('When createPR rejects / Then shows actual backend error message (not generic)', async () => {
      mockCreatePR.mockRejectedValue(new Error('Item ID is required'));
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Select Item'));
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Item ID is required');
      });
      expect(toast.error).not.toHaveBeenCalledWith('Failed to create PR');
    });

    it('When item selected / Then item_id is the resolved UUID not an empty string', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Select Item'));
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      await waitFor(() => expect(mockCreatePR).toHaveBeenCalled());
      const payload = mockCreatePR.mock.calls[0][0];
      expect(payload.items[0].item_id).toBe('item-1');
      expect(payload.items[0].item_id).not.toBe('');
    });

    it('When non-Error thrown by createPR / Then falls back to generic message', async () => {
      mockCreatePR.mockRejectedValue('unexpected string error');
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Select Item'));
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create PR');
      });
    });
  });

  describe('Given required-date validation (stale-closure bug fix)', () => {
    it('When submitted without required_date / Then blocks with date alert and does not call createPR', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Select Item'));
      // Do NOT fill in the date — formData.required_date stays ''
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      expect(toast.warning).toHaveBeenCalledWith('Required Date is mandatory. Please select a date before submitting.');
      expect(mockCreatePR).not.toHaveBeenCalled();
    });

    it('When description changed after date filled / Then date is preserved (no stale closure)', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      // Fill date first
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
      // Then change description — would overwrite date if closure is stale
      const textarea = screen.getByPlaceholderText('What is being requested...');
      fireEvent.change(textarea, { target: { value: 'Test justification' } });
      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Select Item'));
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      await waitFor(() => expect(mockCreatePR).toHaveBeenCalled());
      const payload = mockCreatePR.mock.calls[0][0];
      expect(payload.required_date).toBe('2025-12-31');
      expect(payload.description).toBe('Test justification');
    });

    it('When date filled after description / Then description is preserved (reverse order)', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      // Fill description first
      const textarea = screen.getByPlaceholderText('What is being requested...');
      fireEvent.change(textarea, { target: { value: 'Office supplies' } });
      // Then fill date
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (dateInput) fireEvent.change(dateInput, { target: { value: '2025-06-15' } });
      fireEvent.click(screen.getByText('+ Add Item'));
      fireEvent.click(screen.getByText('Select Item'));
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      await waitFor(() => expect(mockCreatePR).toHaveBeenCalled());
      const payload = mockCreatePR.mock.calls[0][0];
      expect(payload.description).toBe('Office supplies');
      expect(payload.required_date).toBe('2025-06-15');
    });
  });

  describe('Given modal positioning — header overlap fix', () => {
    it('When New Requisition modal opens / Then overlay has pt-24 class for header clearance', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const overlay = document.querySelector('.fixed.inset-0') as HTMLElement;
      expect(overlay).not.toBeNull();
      expect(overlay.className).toContain('pt-24');
    });

    it('When modal open / Then overlay uses items-center for centering within safe zone', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const overlay = document.querySelector('.fixed.inset-0') as HTMLElement;
      expect(overlay.className).toContain('items-center');
    });

    it('When modal open / Then overlay does NOT have bare p-4 (replaced by split padding)', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const overlay = document.querySelector('.fixed.inset-0') as HTMLElement;
      // p-4 produces exactly "p-4" as a class token — pt-20 replaces the uniform shorthand
      const classes = overlay.className.split(/\s+/);
      expect(classes).not.toContain('p-4');
    });

    it('When modal open / Then dialog height is bounded to the safe zone (never overlaps header) with internal scroll', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      // Bounded to calc(100vh - top/bottom offset) so a tall dialog can never exceed the
      // padded safe zone and intrude into the header; 90vh (larger than the safe zone) is gone.
      const dialog = document.querySelector('.max-h-\\[calc\\(100vh-7\\.5rem\\)\\]') as HTMLElement;
      expect(dialog).not.toBeNull();
      expect(document.querySelector('.max-h-\\[90vh\\]')).toBeNull();
    });

    it('When modal open / Then overlay stacks above shell NavBar (z-[600] > z-[500])', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      const overlay = document.querySelector('.fixed.inset-0') as HTMLElement;
      expect(overlay.className).toContain('z-[600]');
    });

    it('When Cancel clicked / Then overlay is removed from DOM', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByText('Create New Requisition'));
      fireEvent.click(screen.getByText('Cancel'));
      await waitFor(() => {
        expect(document.querySelector('.fixed.inset-0')).toBeNull();
      });
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then New Requisition button is not shown', async () => {
      mockUseShellBridgePR.mockReturnValue({
        effectiveFlagsLoaded: false,
        getFeatureState: () => 'enabled',
      });
      render(<PRListPage />);
      await waitFor(() => expect(screen.getByText('Purchase Requisitions')).toBeInTheDocument());
      expect(screen.queryByText('New Requisition')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then New Requisition button appears', async () => {
      mockUseShellBridgePR.mockReturnValue({
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
      });
      render(<PRListPage />);
      await waitFor(() => expect(screen.getByText('New Requisition')).toBeInTheDocument());
    });
  });
});
