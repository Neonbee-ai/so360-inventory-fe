import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Stub heavy child pages so this spec focuses on MovementsPage tab logic only
vi.mock('./StockAdjustmentsPage', () => ({
  __esModule: true,
  default: () => <div data-testid="adjustments-page">Adjustments Content</div>,
}));

vi.mock('./StockTransfersPage', () => ({
  __esModule: true,
  default: () => <div data-testid="transfers-page">Transfers Content</div>,
}));

import MovementsPage from './MovementsPage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MovementsPage', () => {
  describe('Given the page renders', () => {
    it('When loaded / Then shows Adjustments tab button', () => {
      render(<MovementsPage />);
      expect(screen.getByText('Adjustments')).toBeInTheDocument();
    });

    it('When loaded / Then shows Transfers tab button', () => {
      render(<MovementsPage />);
      expect(screen.getByText('Transfers')).toBeInTheDocument();
    });

    it('When loaded / Then Adjustments tab is active by default', () => {
      render(<MovementsPage />);
      expect(screen.getByTestId('adjustments-page')).toBeInTheDocument();
    });

    it('When loaded / Then Transfers tab content is not visible', () => {
      render(<MovementsPage />);
      expect(screen.queryByTestId('transfers-page')).not.toBeInTheDocument();
    });
  });

  describe('Given tab switching', () => {
    it('When Transfers tab clicked / Then shows transfers content', () => {
      render(<MovementsPage />);
      fireEvent.click(screen.getByText('Transfers'));
      expect(screen.getByTestId('transfers-page')).toBeInTheDocument();
    });

    it('When Transfers tab clicked / Then hides adjustments content', () => {
      render(<MovementsPage />);
      fireEvent.click(screen.getByText('Transfers'));
      expect(screen.queryByTestId('adjustments-page')).not.toBeInTheDocument();
    });

    it('When switching back to Adjustments / Then shows adjustments content', () => {
      render(<MovementsPage />);
      fireEvent.click(screen.getByText('Transfers'));
      fireEvent.click(screen.getByText('Adjustments'));
      expect(screen.getByTestId('adjustments-page')).toBeInTheDocument();
    });

    it('When switching back to Adjustments / Then hides transfers content', () => {
      render(<MovementsPage />);
      fireEvent.click(screen.getByText('Transfers'));
      fireEvent.click(screen.getByText('Adjustments'));
      expect(screen.queryByTestId('transfers-page')).not.toBeInTheDocument();
    });
  });
});
