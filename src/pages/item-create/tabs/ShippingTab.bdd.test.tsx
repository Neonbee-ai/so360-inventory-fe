import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

import ShippingTab from './ShippingTab';

const makeProps = (overrides: any = {}) => ({
  weight: '1.5',
  weight_unit: 'kg',
  dimensions_length: '10',
  dimensions_width: '5',
  dimensions_height: '3',
  dimensions_unit: 'cm',
  updateField: vi.fn(),
  ...overrides,
});

describe('ShippingTab', () => {
  describe('Given the tab is rendered with default shipping data', () => {
    it('When the tab renders / Then shows the Weight section heading', () => {
      render(<ShippingTab {...makeProps()} />);
      expect(screen.getAllByText('Weight').length).toBeGreaterThan(0);
    });

    it('When the tab renders / Then shows the Dimensions section heading', () => {
      render(<ShippingTab {...makeProps()} />);
      expect(screen.getByText('Dimensions (L x W x H)')).toBeInTheDocument();
    });

    it('When the tab renders / Then the weight input shows the current weight value', () => {
      render(<ShippingTab {...makeProps({ weight: '2.75' })} />);
      expect(screen.getByDisplayValue('2.75')).toBeInTheDocument();
    });

    it('When the tab renders / Then the length input shows the current length value', () => {
      render(<ShippingTab {...makeProps({ dimensions_length: '30' })} />);
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    it('When the tab renders / Then the width input shows the current width value', () => {
      render(<ShippingTab {...makeProps({ dimensions_width: '20' })} />);
      expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    });

    it('When the tab renders / Then the height input shows the current height value', () => {
      render(<ShippingTab {...makeProps({ dimensions_height: '15' })} />);
      expect(screen.getByDisplayValue('15')).toBeInTheDocument();
    });
  });

  describe('Given the weight unit selector', () => {
    it('When weight_unit is "kg" / Then the kg option is selected', () => {
      render(<ShippingTab {...makeProps({ weight_unit: 'kg' })} />);
      const select = screen.getAllByRole('combobox')[0];
      expect((select as HTMLSelectElement).value).toBe('kg');
    });

    it('When weight_unit is "lb" / Then the lb option is selected', () => {
      render(<ShippingTab {...makeProps({ weight_unit: 'lb' })} />);
      const select = screen.getAllByRole('combobox')[0];
      expect((select as HTMLSelectElement).value).toBe('lb');
    });

    it('When the weight unit dropdown is changed to "g" / Then calls updateField with weight_unit and "g"', () => {
      const updateField = vi.fn();
      render(<ShippingTab {...makeProps({ updateField })} />);
      const weightUnitSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(weightUnitSelect, { target: { value: 'g' } });
      expect(updateField).toHaveBeenCalledWith('weight_unit', 'g');
    });
  });

  describe('Given the user updates the weight', () => {
    it('When the weight input is changed / Then calls updateField with "weight" and the new value', () => {
      const updateField = vi.fn();
      render(<ShippingTab {...makeProps({ updateField })} />);
      fireEvent.change(screen.getByDisplayValue('1.5'), { target: { value: '3.2' } });
      expect(updateField).toHaveBeenCalledWith('weight', '3.2');
    });
  });

  describe('Given the user updates the dimensions', () => {
    it('When the length input is changed / Then calls updateField with "dimensions_length"', () => {
      const updateField = vi.fn();
      render(<ShippingTab {...makeProps({ updateField })} />);
      fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '25' } });
      expect(updateField).toHaveBeenCalledWith('dimensions_length', '25');
    });

    it('When the width input is changed / Then calls updateField with "dimensions_width"', () => {
      const updateField = vi.fn();
      render(<ShippingTab {...makeProps({ updateField })} />);
      fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '12' } });
      expect(updateField).toHaveBeenCalledWith('dimensions_width', '12');
    });

    it('When the height input is changed / Then calls updateField with "dimensions_height"', () => {
      const updateField = vi.fn();
      render(<ShippingTab {...makeProps({ updateField })} />);
      fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '8' } });
      expect(updateField).toHaveBeenCalledWith('dimensions_height', '8');
    });
  });

  describe('Given the dimensions unit selector', () => {
    it('When dimensions_unit is "cm" / Then the cm option is selected in the unit dropdown', () => {
      render(<ShippingTab {...makeProps({ dimensions_unit: 'cm' })} />);
      const dimUnitSelect = screen.getAllByRole('combobox')[1];
      expect((dimUnitSelect as HTMLSelectElement).value).toBe('cm');
    });

    it('When the dimensions unit dropdown is changed to "in" / Then calls updateField with "dimensions_unit" and "in"', () => {
      const updateField = vi.fn();
      render(<ShippingTab {...makeProps({ updateField })} />);
      const dimUnitSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(dimUnitSelect, { target: { value: 'in' } });
      expect(updateField).toHaveBeenCalledWith('dimensions_unit', 'in');
    });
  });

  describe('Given all fields are empty (new item)', () => {
    it('When all values are empty strings / Then tab renders without crashing', () => {
      expect(() => render(<ShippingTab {...makeProps({ weight: '', dimensions_length: '', dimensions_width: '', dimensions_height: '' })} />)).not.toThrow();
    });
  });
});
