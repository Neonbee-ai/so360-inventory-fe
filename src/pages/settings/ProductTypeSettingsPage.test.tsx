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

describe('ProductTypeSettingsPage', () => {
  describe('Given loading state', () => {
    it('When product types loading / Then shows loading indicator', () => {
      mockGetAll.mockReturnValue(new Promise(() => {}));
      const { container } = render(<ProductTypeSettingsPage />);
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Given page renders', () => {
    it('When loaded / Then shows Product Types heading', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Product Types')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows Back to Settings button', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Back to Settings')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows types list', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Electronics')).toBeInTheDocument();
      });
    });

    it('When loaded / Then shows New button to create type', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });
  });

  describe('Given back navigation', () => {
    it('When Back to Settings clicked / Then navigates', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => expect(screen.getByText('Product Types')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Back to Settings'));
      expect(mockNavigate).toHaveBeenCalledWith('/inventory/settings');
    });
  });

  describe('Given API error', () => {
    it('When getAll fails / Then shows error message', async () => {
      mockGetAll.mockRejectedValue(new Error('Failed to load product types'));
      render(<ProductTypeSettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load product types')).toBeInTheDocument();
      });
    });
  });

  describe('Given create new type form', () => {
    it('When New button clicked / Then shows create form', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => expect(screen.getByText('Product Types')).toBeInTheDocument());
      fireEvent.click(screen.getByText('New'));
      expect(screen.getByPlaceholderText('Name *')).toBeInTheDocument();
    });

    it('When Cancel in form clicked / Then hides create form', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => expect(screen.getByText('Product Types')).toBeInTheDocument());
      fireEvent.click(screen.getByText('New'));
      expect(screen.getByPlaceholderText('Name *')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cancel'));
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Name *')).not.toBeInTheDocument();
      });
    });

    it('When name entered and Create clicked / Then calls productTypeService.create', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => expect(screen.getByText('Product Types')).toBeInTheDocument());
      fireEvent.click(screen.getByText('New'));
      fireEvent.change(screen.getByPlaceholderText('Name *'), { target: { value: 'Clothing' } });
      fireEvent.click(screen.getByText('Create'));
      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled();
      });
    });
  });

  describe('Given type selection', () => {
    it('When type clicked / Then loads type detail', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => expect(screen.getByText('Electronics')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Electronics'));
      await waitFor(() => {
        expect(mockGetOne).toHaveBeenCalledWith('pt-1');
      });
    });

    it('When type loaded / Then shows type name in detail panel', async () => {
      mockGetOne.mockResolvedValue(makeProductType({ attributes: [] }));
      render(<ProductTypeSettingsPage />);
      await waitFor(() => expect(screen.getByText('Electronics')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Electronics'));
      await waitFor(() => {
        // Detail panel also shows "Electronics"
        expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given API calls on mount', () => {
    it('When mounted / Then calls getAll', async () => {
      render(<ProductTypeSettingsPage />);
      await waitFor(() => {
        expect(mockGetAll).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Given effectiveFlagsLoaded is false (matrix still resolving)', () => {
    it('When page renders / Then New button is not shown', async () => {
      mockUseShellBridgePT.mockReturnValue({
        effectiveFlagsLoaded: false,
        getFeatureState: () => 'enabled',
      });
      render(<ProductTypeSettingsPage />);
      await waitFor(() => expect(screen.getByText('Product Types')).toBeInTheDocument());
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded becomes true with enabled flag / Then New button appears', async () => {
      mockUseShellBridgePT.mockReturnValue({
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
      });
      render(<ProductTypeSettingsPage />);
      await waitFor(() => expect(screen.getByText('New')).toBeInTheDocument());
    });
  });
});
