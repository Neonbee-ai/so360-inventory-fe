import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetLifecycleGates = vi.fn();
const mockTransitionLifecycle = vi.fn();

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getLifecycleGates: (...args: any[]) => mockGetLifecycleGates(...args),
    transitionLifecycle: (...args: any[]) => mockTransitionLifecycle(...args),
  },
}));

import LifecycleStatusPanel from './LifecycleStatusPanel';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLifecycleGates.mockResolvedValue({ gates: [] });
  mockTransitionLifecycle.mockResolvedValue({ product_status: 'pending_review' });
});

describe('LifecycleStatusPanel', () => {
  describe('Given draft status', () => {
    it('When status is draft / Then shows Draft badge', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="draft" />);
      await waitFor(() => {
        expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
      });
    });

    it('When status is draft / Then shows Submit for Review button', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="draft" />);
      await waitFor(() => {
        expect(screen.getByText('Submit for Review')).toBeInTheDocument();
      });
    });

    it('When status is draft / Then shows Product Lifecycle heading', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="draft" />);
      expect(screen.getByText('Product Lifecycle')).toBeInTheDocument();
    });
  });

  describe('Given active status', () => {
    it('When status is active / Then shows Active badge', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="active" />);
      await waitFor(() => {
        expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
      });
    });

    it('When status is active / Then shows Archive button', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="active" />);
      await waitFor(() => {
        expect(screen.getByText('Archive')).toBeInTheDocument();
      });
    });
  });

  describe('Given pending_review status', () => {
    it('When status is pending_review / Then shows Pending Review badge', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="pending_review" />);
      await waitFor(() => {
        expect(screen.getAllByText('Pending Review').length).toBeGreaterThan(0);
      });
    });

    it('When status is pending_review / Then shows Activate and Return to Draft buttons', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="pending_review" />);
      await waitFor(() => {
        expect(screen.getByText('Activate')).toBeInTheDocument();
        expect(screen.getByText('Return to Draft')).toBeInTheDocument();
      });
    });
  });

  describe('Given archived status', () => {
    it('When status is archived / Then shows Archived badge', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="archived" />);
      await waitFor(() => {
        expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
      });
    });

    it('When status is archived / Then shows Reactivate button', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="archived" />);
      await waitFor(() => {
        expect(screen.getByText('Reactivate')).toBeInTheDocument();
      });
    });
  });

  describe('Given transition action', () => {
    it('When Submit for Review clicked / Then calls transitionLifecycle', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="draft" />);
      await waitFor(() => expect(screen.getByText('Submit for Review')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Submit for Review'));
      await waitFor(() => {
        expect(mockTransitionLifecycle).toHaveBeenCalledWith('item-1', 'submit_for_review');
      });
    });

    it('When transition succeeds / Then calls onStatusChange callback', async () => {
      const onStatusChange = vi.fn();
      mockTransitionLifecycle.mockResolvedValue({ product_status: 'pending_review' });
      render(<LifecycleStatusPanel itemId="item-1" productStatus="draft" onStatusChange={onStatusChange} />);
      await waitFor(() => expect(screen.getByText('Submit for Review')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Submit for Review'));
      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('pending_review');
      });
    });

    it('When transition fails / Then shows error message', async () => {
      mockTransitionLifecycle.mockRejectedValue(new Error('Transition not allowed'));
      render(<LifecycleStatusPanel itemId="item-1" productStatus="draft" />);
      await waitFor(() => expect(screen.getByText('Submit for Review')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Submit for Review'));
      await waitFor(() => {
        expect(screen.getByText('Transition not allowed')).toBeInTheDocument();
      });
    });
  });

  describe('Given gates loading', () => {
    it('When component mounts / Then calls getLifecycleGates', async () => {
      render(<LifecycleStatusPanel itemId="item-1" productStatus="draft" />);
      await waitFor(() => {
        expect(mockGetLifecycleGates).toHaveBeenCalledWith('item-1');
      });
    });

    it('When gates loaded with data / Then shows gate information', async () => {
      mockGetLifecycleGates.mockResolvedValue({
        gates: [
          { name: 'Has SKU', passed: true, detail: 'SKU is set' },
          { name: 'Has Price', passed: false, detail: 'Price missing' },
        ],
      });
      render(<LifecycleStatusPanel itemId="item-1" productStatus="draft" />);
      await waitFor(() => {
        expect(screen.getByText('Has SKU')).toBeInTheDocument();
        expect(screen.getByText('Has Price')).toBeInTheDocument();
      });
    });
  });
});
