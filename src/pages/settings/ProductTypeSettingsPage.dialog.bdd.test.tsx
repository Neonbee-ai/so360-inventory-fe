import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, getFeatureState: () => 'enabled' }),
}));
const mockCreate = vi.fn();
vi.mock('../../services/productTypeService', () => ({
  productTypeService: {
    getAll: vi.fn().mockResolvedValue([]),
    getOne: vi.fn(),
    create: (...a: any[]) => mockCreate(...a),
    delete: vi.fn(),
    addAttribute: vi.fn(),
    updateAttribute: vi.fn(),
    deleteAttribute: vi.fn(),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import ProductTypeSettingsPage from './ProductTypeSettingsPage';

beforeEach(() => { vi.clearAllMocks(); mockCreate.mockResolvedValue({ id: 'pt-new' }); });

describe('Given the Product Types page create flow', () => {
  it('When New is clicked / Then a dialog with a form opens, not an inline card', async () => {
    render(<ProductTypeSettingsPage />);
    fireEvent.click(await screen.findByText('New'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('form#product-type-create-form')).not.toBeNull();
  });

  it('When the name is typed / Then the code is derived and Create submits the form', async () => {
    render(<ProductTypeSettingsPage />);
    fireEvent.click(await screen.findByText('New'));
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Home Goods' } });
    expect(screen.getByLabelText(/^Code/)).toHaveValue('home_goods');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: 'Home Goods', code: 'home_goods', description: undefined }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('When Cancel is pressed / Then the dialog closes without creating', async () => {
    render(<ProductTypeSettingsPage />);
    fireEvent.click(await screen.findByText('New'));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
