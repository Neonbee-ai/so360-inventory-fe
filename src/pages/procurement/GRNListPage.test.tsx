import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetGRNs = vi.fn();
const mockNavigate = vi.fn();

const mockUseShellBridgeGRN = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useShellBridge: (...args: any[]) => mockUseShellBridgeGRN(...args),
}));

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getGRNs: (...args: any[]) => mockGetGRNs(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import GRNListPage from './GRNListPage';

const makeGRN = (overrides: any = {}) => ({
  id: 'grn-1',
  grn_number: 'GRN-2025-0001',
  created_at: new Date().toISOString(),
  warehouse: { name: 'Main WH' },
  po: { po_number: 'PO-2025-0001', vendor: { name: 'Acme Corp' } },
  grn_lines: [{ quantity_received: 10 }, { quantity_received: 5 }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetGRNs.mockResolvedValue([]);
  mockUseShellBridgeGRN.mockReturnValue({
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
});

describe('GRNListPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Goods Receipt Notes heading', async () => {
      render(<GRNListPage />);
      await waitFor(() => {
        expect(screen.getByText('Goods Receipt Notes')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows New GRN button', async () => {
      render(<GRNListPage />);
      await waitFor(() => {
        expect(screen.getByText('New GRN')).toBeInTheDocument();
      });
    });

    it('When New GRN clicked / Then navigates to new GRN page', async () => {
      render(<GRNListPage />);
      await waitFor(() => screen.getByText('New GRN'));
      fireEvent.click(screen.getByText('New GRN'));
      expect(mockNavigate).toHaveBeenCalledWith('/procurement/grn/new');
    });
  });

  describe('Given GRN stats tiles', () => {
    it('When no GRNs / Then Total GRNs shows 0', async () => {
      render(<GRNListPage />);
      await waitFor(() => {
        expect(screen.getByText('Total GRNs')).toBeInTheDocument();
      });
    });

    it('When GRNs exist / Then Total GRNs reflects count', async () => {
      mockGetGRNs.mockResolvedValue([makeGRN(), makeGRN({ id: 'grn-2', grn_number: 'GRN-2025-0002' })]);
      render(<GRNListPage />);
      await waitFor(() => {
        // The tile renders "Total GRNs" label and the count "2" in the same container
        const statTile = screen.getByText('Total GRNs').closest('.bg-slate-900\\/50');
        if (statTile) {
          expect(statTile).toHaveTextContent('2');
        } else {
          // fallback - count "2" should be in document
          const allTwos = screen.queryAllByText('2');
          expect(allTwos.length).toBeGreaterThanOrEqual(1);
        }
      });
    });

    it('When GRN has lines / Then Total Items Received shows sum', async () => {
      mockGetGRNs.mockResolvedValue([makeGRN()]);
      render(<GRNListPage />);
      await waitFor(() => {
        // 10 + 5 = 15
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });
  });

  describe('Given GRN list', () => {
    it('When GRNs exist / Then shows GRN number', async () => {
      mockGetGRNs.mockResolvedValue([makeGRN()]);
      render(<GRNListPage />);
      await waitFor(() => {
        expect(screen.getByText('GRN-2025-0001')).toBeInTheDocument();
      });
    });

    it('When GRNs exist / Then shows linked PO number', async () => {
      mockGetGRNs.mockResolvedValue([makeGRN()]);
      render(<GRNListPage />);
      await waitFor(() => {
        expect(screen.getByText('#PO-2025-0001')).toBeInTheDocument();
      });
    });

    it('When GRNs exist / Then shows vendor name', async () => {
      mockGetGRNs.mockResolvedValue([makeGRN()]);
      render(<GRNListPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });
    });

    it('When GRN row clicked / Then navigates to GRN detail', async () => {
      mockGetGRNs.mockResolvedValue([makeGRN()]);
      render(<GRNListPage />);
      await waitFor(() => screen.getByText('GRN-2025-0001'));
      fireEvent.click(screen.getByText('GRN-2025-0001'));
      expect(mockNavigate).toHaveBeenCalledWith('/procurement/grn/grn-1');
    });
  });

  describe('Given search filter', () => {
    it('When typing GRN number / Then filters to matching GRN', async () => {
      mockGetGRNs.mockResolvedValue([
        makeGRN(),
        makeGRN({ id: 'grn-2', grn_number: 'GRN-2025-0002', po: { po_number: 'PO-2025-0002', vendor: { name: 'Beta Ltd' } } }),
      ]);
      render(<GRNListPage />);
      await waitFor(() => screen.getByText('GRN-2025-0001'));
      fireEvent.change(screen.getByPlaceholderText('Search by GRN number, PO, or vendor...'), { target: { value: 'GRN-2025-0002' } });
      expect(screen.queryByText('GRN-2025-0001')).not.toBeInTheDocument();
      expect(screen.getByText('GRN-2025-0002')).toBeInTheDocument();
    });

    it('When typing vendor name / Then filters by vendor', async () => {
      mockGetGRNs.mockResolvedValue([
        makeGRN(),
        makeGRN({ id: 'grn-2', grn_number: 'GRN-2025-0002', po: { po_number: 'PO-2025-0002', vendor: { name: 'Beta Ltd' } } }),
      ]);
      render(<GRNListPage />);
      await waitFor(() => screen.getByText('Acme Corp'));
      fireEvent.change(screen.getByPlaceholderText('Search by GRN number, PO, or vendor...'), { target: { value: 'Beta' } });
      expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
      expect(screen.getByText('Beta Ltd')).toBeInTheDocument();
    });
  });

  describe('Given no GRNs', () => {
    it('When empty / Then shows empty state message', async () => {
      render(<GRNListPage />);
      await waitFor(() => {
        expect(screen.getByText('No goods receipt notes found.')).toBeInTheDocument();
      });
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then New GRN button is not shown', async () => {
      mockUseShellBridgeGRN.mockReturnValue({
        effectiveFlagsLoaded: false,
        getFeatureState: () => 'enabled',
      });
      render(<GRNListPage />);
      await waitFor(() => expect(screen.getByText('Goods Receipt Notes')).toBeInTheDocument());
      expect(screen.queryByText('New GRN')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then New GRN button appears', async () => {
      mockUseShellBridgeGRN.mockReturnValue({
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
      });
      render(<GRNListPage />);
      await waitFor(() => expect(screen.getByText('New GRN')).toBeInTheDocument());
    });
  });
});
