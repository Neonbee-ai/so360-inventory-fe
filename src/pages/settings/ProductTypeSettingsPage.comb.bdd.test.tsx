import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockUseShellBridgePT = vi.fn();
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: (...args: any[]) => mockUseShellBridgePT(...args),
}));

const mockGetAll = vi.fn();
const mockGetOne = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockAddAttribute = vi.fn();
const mockDeleteAttribute = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/productTypeService', () => ({
  productTypeService: {
    getAll: (...args: any[]) => mockGetAll(...args),
    getOne: (...args: any[]) => mockGetOne(...args),
    create: (...args: any[]) => mockCreate(...args),
    delete: (...args: any[]) => mockDelete(...args),
    addAttribute: (...args: any[]) => mockAddAttribute(...args),
    updateAttribute: vi.fn().mockResolvedValue({}),
    deleteAttribute: (...args: any[]) => mockDeleteAttribute(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('./components/AttributeEditor', () => ({
  default: ({ onSave, onCancel }: any) => (
    <div data-testid="attribute-editor">
      <button onClick={() => onSave({ field_name: 'color', label: 'Color', field_type: 'text' })}>Save Attribute</button>
      <button onClick={onCancel}>Cancel Attribute</button>
    </div>
  ),
}));

import ProductTypeSettingsPage from './ProductTypeSettingsPage';

const makeProductType = (overrides: any = {}) => ({
  id: 'pt-1',
  name: 'Electronics',
  code: 'electronics',
  description: 'Electronic devices',
  is_system: false,
  attributes: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAll.mockResolvedValue([makeProductType()]);
  mockGetOne.mockResolvedValue(makeProductType());
  mockCreate.mockResolvedValue({ id: 'pt-new' });
  mockDelete.mockResolvedValue({});
  mockAddAttribute.mockResolvedValue({});
  mockDeleteAttribute.mockResolvedValue({});
  mockUseShellBridgePT.mockReturnValue({
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
  });
});

describe('Given the Comb ProductTypeSettingsPage', () => {
  it('Given types load / When rendered / Then the settings template shows title, description and list', async () => {
    const { container } = render(<ProductTypeSettingsPage />);
    await waitFor(() => expect(screen.getByText('Product Types')).toBeInTheDocument());
    expect(container.querySelector('[data-template="settings"]')).not.toBeNull();
    expect(screen.getByText('Manage product type templates and their attribute schemas')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
  });

  it('Given the API is pending / When rendered / Then a busy skeleton shows and no title', () => {
    mockGetAll.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ProductTypeSettingsPage />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('Product Types')).toBeNull();
  });

  it('Given no type selected / When rendered / Then the empty state prompts selection', async () => {
    render(<ProductTypeSettingsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(screen.getByText('Select a Product Type')).toBeInTheDocument();
  });

  it('Given the trail / When back is clicked / Then navigates to inventory settings', async () => {
    render(<ProductTypeSettingsPage />);
    await waitFor(() => expect(screen.getByText('Product Types')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Back to Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/inventory/settings');
  });

  it('Given New is clicked / When Cancel is pressed / Then the create form closes', async () => {
    render(<ProductTypeSettingsPage />);
    await waitFor(() => expect(screen.getByText('New')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New'));
    expect(screen.getByPlaceholderText('Name *')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('Name *')).toBeNull();
  });

  it('Given a name is typed / When the form is open / Then Create is disabled until name and code exist', async () => {
    render(<ProductTypeSettingsPage />);
    await waitFor(() => expect(screen.getByText('New')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New'));
    expect(screen.getByText('Create').closest('button')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Name *'), { target: { value: 'Clothing' } });
    expect(screen.getByDisplayValue('clothing')).toBeInTheDocument();
    expect(screen.getByText('Create').closest('button')).not.toBeDisabled();
  });

  it('Given a type is clicked / When detail loads / Then the detail card and no-attributes text show', async () => {
    render(<ProductTypeSettingsPage />);
    await waitFor(() => expect(screen.getByText('Electronics')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Electronics'));
    await waitFor(() => expect(screen.getByText('No attributes defined')).toBeInTheDocument());
    expect(screen.getByText('Add Attribute')).toBeInTheDocument();
  });

  it('Given the create flag is disabled / When rendered / Then New is gated off', async () => {
    mockUseShellBridgePT.mockReturnValue({ effectiveFlagsLoaded: true, getFeatureState: () => 'hidden' });
    render(<ProductTypeSettingsPage />);
    await waitFor(() => expect(screen.getByText('Product Types')).toBeInTheDocument());
    expect(screen.queryByText('New')).toBeNull();
  });
});
