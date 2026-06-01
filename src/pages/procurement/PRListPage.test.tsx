import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

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
      <button onClick={() => onSelect({ item_id: 'item-1', name: 'Widget', price: 100 })}>
        Select Item
      </button>
    </div>
  ),
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
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
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
        expect(screen.getByPlaceholderText('Explain why these items are needed...')).toBeInTheDocument();
      });
    });

    it('When form submitted / Then calls createPR', async () => {
      render(<PRListPage />);
      await waitFor(() => screen.getByText('New Requisition'));
      fireEvent.click(screen.getByText('New Requisition'));
      await waitFor(() => screen.getByPlaceholderText('Explain why these items are needed...'));
      fireEvent.change(screen.getByPlaceholderText('Explain why these items are needed...'), { target: { value: 'Need pens' } });
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      await waitFor(() => {
        expect(mockCreatePR).toHaveBeenCalled();
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
