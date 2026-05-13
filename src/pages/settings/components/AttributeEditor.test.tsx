import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import AttributeEditor from './AttributeEditor';

describe('AttributeEditor', () => {
  describe('Given initial render', () => {
    it('When rendered / Then shows Label input', () => {
      render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByPlaceholderText('e.g. Screen Size')).toBeInTheDocument();
    });

    it('When rendered / Then shows Field Name input', () => {
      render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByPlaceholderText('e.g. screen_size')).toBeInTheDocument();
    });

    it('When rendered with initialData / Then pre-fills the form', () => {
      render(<AttributeEditor
        onSave={vi.fn()}
        onCancel={vi.fn()}
        initialData={{ field_name: 'color', label: 'Color', field_type: 'text' }}
      />);
      expect(screen.getByDisplayValue('Color')).toBeInTheDocument();
      expect(screen.getByDisplayValue('color')).toBeInTheDocument();
    });
  });

  describe('Given label auto-generates field name', () => {
    it('When label typed / Then auto-generates field_name', () => {
      render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Screen Size'), { target: { value: 'Screen Size' } });
      expect(screen.getByDisplayValue('screen_size')).toBeInTheDocument();
    });
  });

  describe('Given cancel', () => {
    it('When Cancel clicked / Then calls onCancel', () => {
      const onCancel = vi.fn();
      render(<AttributeEditor onSave={vi.fn()} onCancel={onCancel} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Given save', () => {
    it('When label and fieldName entered and Save clicked / Then calls onSave', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(<AttributeEditor onSave={onSave} onCancel={vi.fn()} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Screen Size'), { target: { value: 'Color' } });
      fireEvent.click(screen.getByText('Add Attribute'));
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
          label: 'Color',
          field_name: 'color',
          field_type: 'text',
        }));
      });
    });

    it('When label is empty / Then Add Attribute button is disabled', () => {
      render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByText('Add Attribute').closest('button')).toBeDisabled();
    });
  });

  describe('Given select field type with options', () => {
    it('When dropdown selected as field type / Then shows options input', () => {
      render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'select' } });
      expect(screen.getByPlaceholderText('Add option...')).toBeInTheDocument();
    });

    it('When option added / Then shows option in list', () => {
      render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'select' } });
      const optionInput = screen.getByPlaceholderText('Add option...');
      fireEvent.change(optionInput, { target: { value: 'Red' } });
      // Press Enter to add option
      fireEvent.keyDown(optionInput, { key: 'Enter' });
      expect(screen.getByText('Red')).toBeInTheDocument();
    });
  });
});
