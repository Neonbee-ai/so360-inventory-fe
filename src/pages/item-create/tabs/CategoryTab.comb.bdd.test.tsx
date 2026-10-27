import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));
vi.mock('../../../components/categories/CategoryPicker', () => ({
  default: ({ value, onChange }: any) => <select data-testid="category-picker" value={value} onChange={e => onChange(e.target.value)}><option value="">-</option><option value="c1">C1</option></select>,
}));

import CategoryTab from './CategoryTab';

const defOf = (o: any = {}) => ({ id: 'd', category_id: 'c1', attribute_key: 'attr', attribute_label: 'Attr', attribute_type: 'text', options: null, unit: null, is_required: false, sort_order: 0, ...o });
const props = (o: any = {}) => ({ category_id: 'c1', categories: [{ id: 'c1', name: 'C1' }], updateField: vi.fn(), onQuickAddCategory: vi.fn(), ...o });

describe('Given CategoryTab on Comb primitives', () => {
  it('When a text attribute renders / Then it is a labelled Comb TextField', () => {
    render(<CategoryTab {...props({ attributeDefs: [defOf({ attribute_label: 'Colour' })] })} />);
    expect(screen.getByLabelText('Colour').tagName).toBe('INPUT');
  });

  it('When a select attribute changes / Then metadata is updated through the Comb Select', () => {
    const updateField = vi.fn();
    render(<CategoryTab {...props({ updateField, attributeDefs: [defOf({ attribute_type: 'select', attribute_key: 'sz', attribute_label: 'Size', options: [{ value: 'l', label: 'Large' }] })] })} />);
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'l' } });
    expect(updateField).toHaveBeenCalledWith('metadata', { sz: 'l' });
  });

  it('When a boolean attribute is ticked / Then metadata gets true via the Comb Checkbox', () => {
    const updateField = vi.fn();
    render(<CategoryTab {...props({ updateField, attributeDefs: [defOf({ attribute_type: 'boolean', attribute_key: 'fragile', attribute_label: 'Fragile' })] })} />);
    fireEvent.click(screen.getByLabelText('Fragile'));
    expect(updateField).toHaveBeenCalledWith('metadata', { fragile: true });
  });

  it('When a multi-select option is ticked / Then it is appended to the array', () => {
    const updateField = vi.fn();
    render(<CategoryTab {...props({ updateField, metadata: { tags: ['a'] }, attributeDefs: [defOf({ attribute_type: 'multi_select', attribute_key: 'tags', attribute_label: 'Tags', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] })] })} />);
    fireEvent.click(screen.getByLabelText('B'));
    expect(updateField).toHaveBeenCalledWith('metadata', { tags: ['a', 'b'] });
  });

  it('When a category error is passed / Then it shows in an error Alert under the testid', () => {
    render(<CategoryTab {...props({ category_id: '', error: 'Category is required' })} />);
    expect(screen.getByTestId('error-category_id')).toHaveTextContent('Category is required');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('When a number is out of range / Then a range Alert appears; in range, none', () => {
    const d = defOf({ attribute_type: 'number', attribute_key: 'w', attribute_label: 'W', min_value: 0, max_value: 10 });
    const { rerender } = render(<CategoryTab {...props({ metadata: { w: 50 }, attributeDefs: [d] })} />);
    expect(screen.getByTestId('error-attr-w')).toHaveTextContent(/must be less than 10/);
    rerender(<CategoryTab {...props({ metadata: { w: 5 }, attributeDefs: [d] })} />);
    expect(screen.queryByTestId('error-attr-w')).toBeNull();
  });

  it('When there are no attribute defs / Then the attributes section is absent', () => {
    render(<CategoryTab {...props()} />);
    expect(screen.queryByText('Category Attributes')).toBeNull();
  });
});
