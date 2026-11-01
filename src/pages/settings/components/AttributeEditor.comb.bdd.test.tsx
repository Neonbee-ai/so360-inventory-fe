import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AttributeEditor from './AttributeEditor';

describe('Given the Comb AttributeEditor', () => {
  it('Given a new attribute / When rendered / Then label and field name inputs and Add Attribute show', () => {
    render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByPlaceholderText('e.g. Screen Size')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. screen_size')).toBeInTheDocument();
    expect(screen.getByText('Add Attribute')).toBeInTheDocument();
  });

  it('Given initial data / When rendered / Then values prefill and the primary reads Update', () => {
    render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} initialData={{ field_name: 'color', label: 'Color', field_type: 'text' }} />);
    expect(screen.getByDisplayValue('Color')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
  });

  it('Given empty fields / When rendered / Then primary is disabled', () => {
    render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Add Attribute').closest('button')).toBeDisabled();
  });

  it('Given a label is typed / When creating / Then field name auto-derives', () => {
    render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Screen Size'), { target: { value: 'Screen Size' } });
    expect(screen.getByDisplayValue('screen_size')).toBeInTheDocument();
  });

  it('Given Cancel is clicked / Then onCancel fires', () => {
    const onCancel = vi.fn();
    render(<AttributeEditor onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('Given a label / When Add Attribute is clicked / Then onSave receives the data', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AttributeEditor onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Screen Size'), { target: { value: 'Color' } });
    fireEvent.click(screen.getByText('Add Attribute'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ label: 'Color', field_name: 'color', field_type: 'text' })));
  });

  it('Given type Dropdown / When an option is added / Then it renders as a chip', () => {
    render(<AttributeEditor onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'select' } });
    fireEvent.change(screen.getByPlaceholderText('Add option...'), { target: { value: 'Red' } });
    fireEvent.click(screen.getByLabelText('Add option'));
    expect(screen.getByText('Red')).toBeInTheDocument();
  });
});
