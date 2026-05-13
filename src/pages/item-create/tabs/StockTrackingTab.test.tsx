import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

import StockTrackingTab from './StockTrackingTab';

const makeProps = (overrides: any = {}) => ({
  min_stock_threshold: '10',
  reorder_level: '20',
  is_batch_tracked: false,
  is_serial_tracked: false,
  is_active: true,
  updateField: vi.fn(),
  default_warehouse_id: '',
  warehouses: [{ id: 'wh-1', name: 'Main Warehouse' }],
  is_online_visible: false,
  ...overrides,
});

describe('StockTrackingTab', () => {
  describe('Given tab renders', () => {
    it('When rendered / Then shows Stock Thresholds section', () => {
      render(<StockTrackingTab {...makeProps()} />);
      expect(screen.getByText('Stock Thresholds')).toBeInTheDocument();
    });

    it('When rendered / Then shows min stock threshold input', () => {
      render(<StockTrackingTab {...makeProps()} />);
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('When rendered / Then shows reorder level input', () => {
      render(<StockTrackingTab {...makeProps()} />);
      expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    });

    it('When rendered / Then shows tracking options', () => {
      render(<StockTrackingTab {...makeProps()} />);
      expect(screen.getByText('Batch Tracked')).toBeInTheDocument();
    });

    it('When rendered / Then shows warehouse dropdown', () => {
      render(<StockTrackingTab {...makeProps()} />);
      expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    });
  });

  describe('Given user interaction', () => {
    it('When min_stock_threshold changes / Then calls updateField', () => {
      const updateField = vi.fn();
      render(<StockTrackingTab {...makeProps({ updateField })} />);
      const input = screen.getByDisplayValue('10');
      fireEvent.change(input, { target: { value: '15' } });
      expect(updateField).toHaveBeenCalledWith('min_stock_threshold', '15');
    });
  });
});
