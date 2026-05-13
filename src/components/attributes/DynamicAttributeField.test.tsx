import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import DynamicAttributeField from './DynamicAttributeField';

const makeAttr = (overrides: any = {}) => ({
  id: 'a-1',
  field_name: 'color',
  label: 'Color',
  field_type: 'text' as any,
  is_required: false,
  sort_order: 0,
  options: [],
  placeholder: '',
  unit: '',
  ...overrides,
});

describe('DynamicAttributeField', () => {
  describe('Given text field', () => {
    it('When field_type is text / Then renders text input', () => {
      render(<DynamicAttributeField attribute={makeAttr()} value="red" onChange={vi.fn()} />);
      expect(screen.getByDisplayValue('red')).toBeInTheDocument();
    });

    it('When text changes / Then calls onChange with field name and value', () => {
      const onChange = vi.fn();
      render(<DynamicAttributeField attribute={makeAttr()} value="" onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'blue' } });
      expect(onChange).toHaveBeenCalledWith('color', 'blue');
    });

    it('When label shown / Then shows attribute label', () => {
      render(<DynamicAttributeField attribute={makeAttr({ label: 'Color' })} value="" onChange={vi.fn()} />);
      expect(screen.getByText('Color')).toBeInTheDocument();
    });

    it('When is_required is true / Then shows required indicator', () => {
      render(<DynamicAttributeField attribute={makeAttr({ is_required: true })} value="" onChange={vi.fn()} />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Given number field', () => {
    it('When field_type is number / Then renders number input', () => {
      render(<DynamicAttributeField attribute={makeAttr({ field_type: 'number', label: 'Weight' })} value={5} onChange={vi.fn()} />);
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    });

    it('When unit provided / Then shows unit text', () => {
      render(<DynamicAttributeField attribute={makeAttr({ field_type: 'number', unit: 'kg', label: 'Weight' })} value={0} onChange={vi.fn()} />);
      expect(screen.getByText('kg')).toBeInTheDocument();
    });
  });

  describe('Given select field', () => {
    it('When field_type is select / Then renders select dropdown with options', () => {
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'select', label: 'Size', options: ['S', 'M', 'L'] })}
        value=""
        onChange={vi.fn()}
      />);
      expect(screen.getByText('S')).toBeInTheDocument();
      expect(screen.getByText('M')).toBeInTheDocument();
      expect(screen.getByText('L')).toBeInTheDocument();
    });
  });

  describe('Given boolean field', () => {
    it('When field_type is boolean / Then renders checkbox', () => {
      render(<DynamicAttributeField attribute={makeAttr({ field_type: 'boolean', label: 'Active' })} value={false} onChange={vi.fn()} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('When checked / Then calls onChange with true', () => {
      const onChange = vi.fn();
      render(<DynamicAttributeField attribute={makeAttr({ field_type: 'boolean', label: 'Active' })} value={false} onChange={onChange} />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(onChange).toHaveBeenCalledWith('color', true);
    });
  });

  describe('Given textarea field', () => {
    it('When field_type is textarea / Then renders textarea', () => {
      render(<DynamicAttributeField attribute={makeAttr({ field_type: 'textarea', label: 'Notes' })} value="hello" onChange={vi.fn()} />);
      expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
    });
  });

  describe('Given date field', () => {
    it('When field_type is date / Then renders date input', () => {
      const { container } = render(<DynamicAttributeField attribute={makeAttr({ field_type: 'date', label: 'Expiry' })} value="2024-01-01" onChange={vi.fn()} />);
      expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
    });
  });
});
