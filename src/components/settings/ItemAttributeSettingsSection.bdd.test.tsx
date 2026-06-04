/**
 * BDD Spec — ItemAttributeSettingsSection
 *
 * Covers: render with empty definitions, render existing definitions table,
 * open create form, validation on missing key/label, save new attribute,
 * open edit form, delete attribute, canManage=false hides controls.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// ── inline stubs ─────────────────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  Trash2: () => <span data-testid="icon-trash" />,
  X: () => <span data-testid="icon-x" />,
  Check: () => <span data-testid="icon-check" />,
}));

const mockInventoryService = {
  getAttributeDefinitions: vi.fn(),
  createAttributeDefinition: vi.fn(),
  updateAttributeDefinition: vi.fn(),
  deleteAttributeDefinition: vi.fn(),
};

vi.mock('../../services/inventoryService', () => ({
  inventoryService: mockInventoryService,
}));

// ── lazy import after mocks ───────────────────────────────────────────────────
let ItemAttributeSettingsSection: React.FC<any>;

beforeEach(async () => {
  vi.resetAllMocks();
  // reset module cache so fresh import picks up mocks
  const mod = await import('./ItemAttributeSettingsSection');
  ItemAttributeSettingsSection = (mod.default ?? mod) as React.FC<any>;
});

const mockCategories = [
  { id: 'cat-1', name: 'Electronics', parent_id: null },
  { id: 'cat-2', name: 'Furniture', parent_id: null },
];

const mockDefs = [
  {
    id: 'def-1',
    attribute_key: 'material',
    attribute_label: 'Material',
    attribute_type: 'text',
    category_id: 'cat-1',
    is_required: false,
    sort_order: 0,
    unit: null,
    options: null,
  },
  {
    id: 'def-2',
    attribute_key: 'color',
    attribute_label: 'Color',
    attribute_type: 'select',
    category_id: null,
    is_required: true,
    sort_order: 1,
    unit: null,
    options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }],
  },
];

describe('Given ItemAttributeSettingsSection', () => {
  describe('Given loading state / When component mounts / Then loading indicator is shown', () => {
    test('Given getAttributeDefinitions is slow / When rendered / Then loading text appears', async () => {
      let resolve: (v: any) => void;
      mockInventoryService.getAttributeDefinitions.mockReturnValue(new Promise(r => { resolve = r; }));
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      resolve!(mockDefs);
    });
  });

  describe('Given empty definitions / When loaded / Then empty state is shown', () => {
    test('Given no attributes defined / When rendered / Then empty message appears', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => expect(screen.getByText(/no attribute definitions yet/i)).toBeInTheDocument());
    });

    test('Given canManage true / When empty state / Then Add Attribute button is visible', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => expect(screen.getByText(/add attribute/i)).toBeInTheDocument());
    });
  });

  describe('Given existing definitions / When loaded / Then table is rendered', () => {
    test('Given two attribute defs / When rendered / Then labels appear in table', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue(mockDefs);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => {
        expect(screen.getByText('Material')).toBeInTheDocument();
        expect(screen.getByText('Color')).toBeInTheDocument();
      });
    });

    test('Given attribute with is_required=true / When rendered / Then Yes badge appears', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue(mockDefs);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => expect(screen.getByText('Yes')).toBeInTheDocument());
    });

    test('Given attribute with category_id / When rendered / Then category name is shown', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue(mockDefs);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => expect(screen.getByText('Electronics')).toBeInTheDocument());
    });
  });

  describe('Given canManage false / When rendered / Then manage controls are hidden', () => {
    test('Given canManage=false / When rendered / Then Add Attribute button is absent', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage={false} />);
      await waitFor(() => expect(screen.queryByText(/add attribute/i)).toBeNull());
    });
  });

  describe('Given Add Attribute / When button clicked / Then form appears', () => {
    test('Given empty list / When Add Attribute clicked / Then form is shown', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText(/add attribute/i));
      fireEvent.click(screen.getByText(/add attribute/i));
      expect(screen.getByText('New Attribute')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. Material/)).toBeInTheDocument();
    });
  });

  describe('Given form / When submitted with missing fields / Then validation error shown', () => {
    test('Given empty label / When Save clicked / Then "Label is required" error appears', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText(/add attribute/i));
      fireEvent.click(screen.getByText(/add attribute/i));
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(screen.getByText(/label is required/i)).toBeInTheDocument());
      expect(mockInventoryService.createAttributeDefinition).not.toHaveBeenCalled();
    });

    test('Given label filled but key cleared / When Save clicked / Then "Attribute key is required" error appears', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText(/add attribute/i));
      fireEvent.click(screen.getByText(/add attribute/i));
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Material/), { target: { value: 'Weight' } });
      // Clear the auto-generated key
      fireEvent.change(screen.getByPlaceholderText('e.g. material'), { target: { value: '' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(screen.getByText(/attribute key is required/i)).toBeInTheDocument());
      expect(mockInventoryService.createAttributeDefinition).not.toHaveBeenCalled();
    });

    test('Given key with invalid characters / When Save clicked / Then format error appears', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText(/add attribute/i));
      fireEvent.click(screen.getByText(/add attribute/i));
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Material/), { target: { value: 'Weight' } });
      // Bypass the keystroke filter by setting value directly via fireEvent
      const keyInput = screen.getByPlaceholderText('e.g. material') as HTMLInputElement;
      Object.defineProperty(keyInput, 'value', { writable: true, value: 'Invalid Key!' });
      fireEvent.change(keyInput, { target: { value: 'Invalid Key!' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(screen.getByText(/lowercase letters, numbers, and underscores/i)).toBeInTheDocument());
      expect(mockInventoryService.createAttributeDefinition).not.toHaveBeenCalled();
    });
  });

  describe('Given valid form / When saved / Then createAttributeDefinition is called', () => {
    test('Given filled label and key / When Save clicked / Then service is called', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValueOnce([]).mockResolvedValue([]);
      mockInventoryService.createAttributeDefinition.mockResolvedValue({ id: 'def-new' });
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText(/add attribute/i));
      fireEvent.click(screen.getByText(/add attribute/i));
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Material/), { target: { value: 'Weight' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. material'), { target: { value: 'weight' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(mockInventoryService.createAttributeDefinition).toHaveBeenCalledWith(
        expect.objectContaining({ attribute_label: 'Weight' })
      ));
    });
  });

  describe('Given edit / When pencil clicked / Then edit form pre-fills', () => {
    test('Given existing def / When edit clicked / Then form label shows Edit Attribute', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue(mockDefs);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText('Material'));
      const editBtns = screen.getAllByTitle('Edit');
      fireEvent.click(editBtns[0]);
      expect(screen.getByText('Edit Attribute')).toBeInTheDocument();
    });
  });

  describe('Given delete / When trash clicked and confirmed / Then deleteAttributeDefinition called', () => {
    test('Given existing def / When delete confirmed / Then service is called', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue(mockDefs);
      mockInventoryService.deleteAttributeDefinition.mockResolvedValue(undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText('Material'));
      const trashBtns = screen.getAllByTitle('Delete');
      fireEvent.click(trashBtns[0]);
      await waitFor(() => expect(mockInventoryService.deleteAttributeDefinition).toHaveBeenCalledWith('def-1'));
    });
  });

  describe('Given the type selector / When the create form is open / Then the full field-type catalog is offered', () => {
    test('Given Add Attribute clicked / When the type dropdown renders / Then currency, date, radio, textarea and file options are present', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText(/add attribute/i));
      fireEvent.click(screen.getByText(/add attribute/i));
      expect(screen.getByRole('option', { name: 'Currency' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Date' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Radio' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Text Area' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'File Upload' })).toBeInTheDocument();
    });
  });

  describe('Given a radio attribute / When type is radio / Then the options editor is shown', () => {
    test('Given Add Attribute clicked and type set to radio / When rendered / Then the Options textarea appears', async () => {
      mockInventoryService.getAttributeDefinitions.mockResolvedValue([]);
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => screen.getByText(/add attribute/i));
      fireEvent.click(screen.getByText(/add attribute/i));
      const typeSelect = screen.getByRole('option', { name: 'Radio' }).closest('select') as HTMLSelectElement;
      fireEvent.change(typeSelect, { target: { value: 'radio' } });
      expect(screen.getByText(/options \(one per line/i)).toBeInTheDocument();
    });
  });

  describe('Given error from service / When getAttributeDefinitions fails / Then error is shown', () => {
    test('Given service throws / When rendered / Then error message appears', async () => {
      mockInventoryService.getAttributeDefinitions.mockRejectedValue(new Error('Network error'));
      render(<ItemAttributeSettingsSection categories={mockCategories} canManage />);
      await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
    });
  });
});
