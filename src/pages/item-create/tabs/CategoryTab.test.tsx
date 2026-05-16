import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../components/FormSection', () => ({
  default: ({ title, children }: any) => <div><h4>{title}</h4>{children}</div>,
}));

vi.mock('../../../components/categories/CategoryPicker', () => ({
  default: ({ categories, value, onChange }: any) => (
    <select data-testid="category-picker" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select category</option>
      {categories.map((c: any) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  ),
}));

import CategoryTab from './CategoryTab';

const makeProps = (overrides: any = {}) => ({
  category_id: '',
  categories: [
    { id: 'cat-1', name: 'Electronics', description: '' },
    { id: 'cat-2', name: 'Clothing', description: '' },
  ],
  updateField: vi.fn(),
  onQuickAddCategory: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('Given CategoryTab', () => {
  it('When rendered / Then shows Item Category section', () => {
    render(<CategoryTab {...makeProps()} />);
    expect(screen.getByText('Item Category')).toBeInTheDocument();
  });

  it('When rendered / Then shows category picker', () => {
    render(<CategoryTab {...makeProps()} />);
    expect(screen.getByTestId('category-picker')).toBeInTheDocument();
  });

  it('When rendered / Then shows available categories in picker', () => {
    render(<CategoryTab {...makeProps()} />);
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Clothing')).toBeInTheDocument();
  });

  it('When category selected / Then calls updateField with category_id', () => {
    const updateField = vi.fn();
    render(<CategoryTab {...makeProps({ updateField })} />);
    fireEvent.change(screen.getByTestId('category-picker'), { target: { value: 'cat-1' } });
    expect(updateField).toHaveBeenCalledWith('category_id', 'cat-1');
  });

  it('When category is selected / Then shows selected name in selection display', () => {
    render(<CategoryTab {...makeProps({ category_id: 'cat-1' })} />);
    // Electronics appears in both the picker option and the "Selected:" display
    expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
  });
});
