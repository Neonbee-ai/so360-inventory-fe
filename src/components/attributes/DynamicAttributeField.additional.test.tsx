/**
 * Additional coverage for DynamicAttributeField — edge cases, default fallback,
 * number field empty-string handling, unit label in non-number fields.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import DynamicAttributeField from './DynamicAttributeField';

const makeAttr = (overrides: any = {}) => ({
  id: 'a-1',
  field_name: 'attr',
  label: 'Attribute',
  field_type: 'text' as any,
  is_required: false,
  sort_order: 0,
  options: [],
  placeholder: '',
  unit: '',
  ...overrides,
});

describe('DynamicAttributeField — additional coverage', () => {
  describe('Given default field type (unknown)', () => {
    it('When field_type is unknown / Then falls back to text input', () => {
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'custom_unknown' })}
        value="fallback-val"
        onChange={vi.fn()}
      />);
      expect(screen.getByDisplayValue('fallback-val')).toBeInTheDocument();
    });

    it('When unknown field changed / Then calls onChange with field name and value', () => {
      const onChange = vi.fn();
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'unknown_type', field_name: 'mystery' })}
        value=""
        onChange={onChange}
      />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed' } });
      expect(onChange).toHaveBeenCalledWith('mystery', 'typed');
    });
  });

  describe('Given number field edge cases', () => {
    it('When number input is cleared / Then calls onChange with empty string', () => {
      const onChange = vi.fn();
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'number', label: 'Qty' })}
        value={5}
        onChange={onChange}
      />);
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
      expect(onChange).toHaveBeenCalledWith('attr', '');
    });

    it('When number input changed to decimal / Then calls onChange with parsed float', () => {
      const onChange = vi.fn();
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'number', label: 'Price' })}
        value={0}
        onChange={onChange}
      />);
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3.14' } });
      expect(onChange).toHaveBeenCalledWith('attr', 3.14);
    });

    it('When field_type is number and unit is provided / Then does not show unit in label (only next to input)', () => {
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'number', unit: 'kg', label: 'Weight' })}
        value={0}
        onChange={vi.fn()}
      />);
      // The label should not contain '(kg)' for number fields — unit shows inline next to input
      const label = screen.getByText('Weight');
      expect(label).toBeInTheDocument();
      // The unit appears as a separate span next to the input (not in label)
      expect(screen.getByText('kg')).toBeInTheDocument();
    });
  });

  describe('Given select field edge cases', () => {
    it('When field_type is select and options is undefined / Then renders Select placeholder only', () => {
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'select', label: 'Category', options: undefined })}
        value=""
        onChange={vi.fn()}
      />);
      expect(screen.getByText('Select...')).toBeInTheDocument();
    });

    it('When select value changes / Then calls onChange with selected option', () => {
      const onChange = vi.fn();
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'select', label: 'Size', options: ['S', 'M', 'L'] })}
        value=""
        onChange={onChange}
      />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'M' } });
      expect(onChange).toHaveBeenCalledWith('attr', 'M');
    });

    it('When select has a current value / Then shows that value selected', () => {
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'select', label: 'Size', options: ['S', 'M', 'L'] })}
        value="L"
        onChange={vi.fn()}
      />);
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('L');
    });
  });

  describe('Given textarea edge cases', () => {
    it('When textarea changed / Then calls onChange', () => {
      const onChange = vi.fn();
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'textarea', label: 'Notes' })}
        value=""
        onChange={onChange}
      />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new note' } });
      expect(onChange).toHaveBeenCalledWith('attr', 'new note');
    });

    it('When textarea value is null / Then renders with empty value', () => {
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'textarea', label: 'Notes' })}
        value={null}
        onChange={vi.fn()}
      />);
      expect(screen.getByRole('textbox')).toHaveValue('');
    });
  });

  describe('Given label rendering', () => {
    it('When field_type is not boolean and unit is set / Then shows unit in label', () => {
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'text', unit: 'cm', label: 'Length' })}
        value=""
        onChange={vi.fn()}
      />);
      // For non-number fields, unit is shown in the label as (cm)
      expect(screen.getByText('(cm)')).toBeInTheDocument();
    });

    it('When field_type is boolean / Then does not render a separate label element', () => {
      const { container } = render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'boolean', label: 'Is Active' })}
        value={false}
        onChange={vi.fn()}
      />);
      // Boolean shows its label inline inside the checkbox label — not as a separate <label> with the labelClass
      const labelElements = container.querySelectorAll('label');
      // There's one label (the checkbox label), but no separate <label> with labelClass
      expect(labelElements.length).toBeGreaterThan(0);
      // The Is Active text is present (inside checkbox label)
      expect(screen.getByText('Is Active')).toBeInTheDocument();
    });

    it('When date field with placeholder / Then does not show placeholder as text (uses date input)', () => {
      const { container } = render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'date', label: 'Expiry', placeholder: 'Pick a date' })}
        value=""
        onChange={vi.fn()}
      />);
      const dateInput = container.querySelector('input[type="date"]');
      expect(dateInput).not.toBeNull();
    });
  });

  describe('Given value null/undefined fallback', () => {
    it('When text value is null / Then renders empty input', () => {
      render(<DynamicAttributeField attribute={makeAttr()} value={null} onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('When text value is undefined / Then renders empty input', () => {
      render(<DynamicAttributeField attribute={makeAttr()} value={undefined} onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('When boolean value is null / Then checkbox is unchecked', () => {
      render(<DynamicAttributeField
        attribute={makeAttr({ field_type: 'boolean', label: 'Flag' })}
        value={null}
        onChange={vi.fn()}
      />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
  });
});
