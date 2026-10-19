import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetSettings = vi.fn();
const mockCreateUom = vi.fn();
const mockGetOrgDefaultLogic = vi.fn();
const mockUpdateOrgDefaultLogic = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getSettings: (...a: any[]) => mockGetSettings(...a),
    createUom: (...a: any[]) => mockCreateUom(...a),
    deleteUom: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    getOrgDefaultLogic: (...a: any[]) => mockGetOrgDefaultLogic(...a),
    updateOrgDefaultLogic: (...a: any[]) => mockUpdateOrgDefaultLogic(...a),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
const mockCan = vi.hoisted(() => vi.fn((_a: string) => true));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));
vi.mock('../components/categories/CategoryTreeView', () => ({ default: () => <div data-testid="category-tree" /> }));
vi.mock('../components/settings/ItemAttributeSettingsSection', () => ({ default: () => <div data-testid="item-attribute-settings" /> }));

import SettingsPage from './SettingsPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockImplementation(() => true);
  mockGetSettings.mockResolvedValue({ uoms: [{ id: 'u1', name: 'Kilogram', abbreviation: 'kg' }], categories: [] });
  mockCreateUom.mockResolvedValue({ id: 'u2' });
  mockGetOrgDefaultLogic.mockResolvedValue({ allow_negative_stock: false, auto_approve_transfers: false });
  mockUpdateOrgDefaultLogic.mockResolvedValue({});
});

describe('Given the Comb SettingsPage', () => {
  it('Given settings load / When rendered / Then the settings template shows title and cards', async () => {
    const { container } = render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Inventory Settings')).toBeInTheDocument());
    expect(container.querySelector('[data-template="settings"]')).not.toBeNull();
    expect(screen.getByText('Item Categories')).toBeInTheDocument();
    expect(screen.getByText('Product Types')).toBeInTheDocument();
    expect(screen.getByText('Default Logic')).toBeInTheDocument();
  });

  it('Given the API is pending / When rendered / Then a busy skeleton shows', () => {
    mockGetSettings.mockReturnValue(new Promise(() => {}));
    const { container } = render(<SettingsPage />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('Inventory Settings')).toBeNull();
  });

  it('Given no UoMs / When rendered / Then only the Add Unit action shows', async () => {
    mockGetSettings.mockResolvedValue({ uoms: [], categories: [] });
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Add Unit')).toBeInTheDocument());
    expect(screen.queryByText(/\(kg\)/)).toBeNull();
  });

  it('Given the load fails / When rendered / Then an alert shows the error', async () => {
    mockGetSettings.mockRejectedValue(new Error('Boom'));
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Boom'));
  });

  it('Given Add Unit / When name and abbr are saved / Then createUom is called', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Add Unit')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Unit'));
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Liter' } });
    fireEvent.change(screen.getByPlaceholderText('Abbr'), { target: { value: 'L' } });
    fireEvent.click(screen.getByText('Add'));
    await waitFor(() => expect(mockCreateUom).toHaveBeenCalledWith('Liter', 'L'));
  });

  it('Given a toggle / When switched / Then updateOrgDefaultLogic is called', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByLabelText('Auto-approve Transfers')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Auto-approve Transfers'));
    await waitFor(() => expect(mockUpdateOrgDefaultLogic).toHaveBeenCalledWith({ auto_approve_transfers: true }));
  });

  it('Given Manage Product Types / When clicked / Then navigates to product types', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Manage Product Types')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Manage Product Types'));
    expect(mockNavigate).toHaveBeenCalledWith('/inventory/settings/product-types');
  });

  it('Given items.update is denied / When rendered / Then the UoM remove control is gated off', async () => {
    mockCan.mockImplementation((a: string) => a !== 'items.update');
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Kilogram (kg)')).toBeInTheDocument());
    expect(screen.queryByLabelText('Remove Kilogram')).toBeNull();
  });
});
