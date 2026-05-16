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

describe('Given ShippingTab', () => {
  it('When rendered / Then shows Weight section', () => {
    render(<ShippingTab {...makeProps()} />);
    expect(screen.getAllByText('Weight').length).toBeGreaterThan(0);
  });

  it('When rendered / Then shows Dimensions section', () => {
    render(<ShippingTab {...makeProps()} />);
    expect(screen.getByText('Dimensions (L x W x H)')).toBeInTheDocument();
  });

  it('When rendered / Then shows weight input with value', () => {
    render(<ShippingTab {...makeProps()} />);
    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
  });

  it('When rendered / Then shows length input', () => {
    render(<ShippingTab {...makeProps()} />);
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });

  it('When weight changes / Then calls updateField', () => {
    const updateField = vi.fn();
    render(<ShippingTab {...makeProps({ updateField })} />);
    fireEvent.change(screen.getByDisplayValue('1.5'), { target: { value: '2.0' } });
    expect(updateField).toHaveBeenCalledWith('weight', '2.0');
  });
});
