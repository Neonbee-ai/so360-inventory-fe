import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockSearch = vi.fn();
vi.mock('../services/inventoryService', () => ({ inventoryService: { searchHsnSac: (...a: any[]) => mockSearch(...a) } }));
import HsnSacPicker from './HsnSacPicker';

const rows = [
  { code: '9403', kind: 'goods', description: 'Other furniture', is_selectable: true, is_active: true },
  { code: '94', kind: 'goods', description: 'Chapter 94', is_selectable: false, is_active: true },
  { code: '9404', kind: 'goods', description: 'Retired', is_selectable: true, is_active: false },
];

beforeEach(() => { vi.clearAllMocks(); mockSearch.mockResolvedValue({ data: rows, total: 3 }); });

describe('HsnSacPicker', () => {
  it('Given a goods item / When the user types / Then it searches goods only', async () => {
    render(<HsnSacPicker value="" kind="" itemType="product" onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('HSN Code'), { target: { value: 'furn' } });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ q: 'furn', kind: 'goods' })));
  });
  it('Given a service item type and no explicit kind / Then it searches SAC and labels it', async () => {
    render(<HsnSacPicker value="" kind="" itemType="service" onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('SAC Code'), { target: { value: '99' } });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ kind: 'service' })));
  });
  it('Given an explicit service kind on a product / Then the explicit kind wins', async () => {
    render(<HsnSacPicker value="" kind="service" itemType="product" onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('SAC Code'), { target: { value: '9' } });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ kind: 'service' })));
  });
  it('Given results / Then code and description show, chapters and inactive codes are hidden', async () => {
    render(<HsnSacPicker value="" kind="" itemType="product" onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('HSN Code'), { target: { value: '94' } });
    expect(await screen.findByText(/9403 - Other furniture/)).toBeTruthy();
    expect(screen.queryByText(/Chapter 94/)).toBeNull();
    expect(screen.queryByText(/Retired/)).toBeNull();
  });
  it('Given a pick / Then onChange gets the code and the master row', async () => {
    const onChange = vi.fn();
    render(<HsnSacPicker value="" kind="" itemType="product" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('HSN Code'), { target: { value: '94' } });
    fireEvent.click(await screen.findByText(/9403 - Other furniture/));
    expect(onChange).toHaveBeenCalledWith('9403', expect.objectContaining({ code: '9403', kind: 'goods' }));
  });
  it('Given a code / When cleared / Then onChange gets an empty code and no row', () => {
    const onChange = vi.fn();
    render(<HsnSacPicker value="9403" kind="" itemType="product" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear'));
    expect(onChange).toHaveBeenCalledWith('', null);
  });
  it('Given a server error / Then it is shown on the field', () => {
    render(<HsnSacPicker value="12" kind="" itemType="product" onChange={vi.fn()} error="Enter a valid code" />);
    expect(screen.getByText('Enter a valid code')).toBeTruthy();
  });
  it('Given the master is unavailable / Then it falls back to a free-text field with a hint', async () => {
    mockSearch.mockResolvedValue({ data: [], total: 0, unavailable: true });
    const onChange = vi.fn();
    render(<HsnSacPicker value="" kind="" itemType="product" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('HSN Code'), { target: { value: '8' } });
    const field = await screen.findByPlaceholderText('e.g. 8471');
    fireEvent.change(field, { target: { value: '8471' } });
    expect(onChange).toHaveBeenCalledWith('8471', null);
    expect(screen.getByText(/master is unavailable/i)).toBeTruthy();
  });
  it('Given the search call throws / Then it also falls back to free text', async () => {
    mockSearch.mockRejectedValue(new Error('network'));
    render(<HsnSacPicker value="" kind="" itemType="product" onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('HSN Code'), { target: { value: '8' } });
    expect(await screen.findByPlaceholderText('e.g. 8471')).toBeTruthy();
  });
});
