/**
 * Comb BDD — ItemAttributeSettingsSection renders through Comb primitives
 * (Button, IconButton, TextField, Select, Textarea, Checkbox, Alert, EmptyState, Card).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  getAttributeDefinitions: vi.fn(),
  createAttributeDefinition: vi.fn(),
  updateAttributeDefinition: vi.fn(),
  deleteAttributeDefinition: vi.fn(),
}));
vi.mock('../../services/inventoryService', () => ({ inventoryService: svc }));

import ItemAttributeSettingsSection from './ItemAttributeSettingsSection';

const cats = [{ id: 'cat-1', name: 'Electronics', parent_id: null }] as any;
const def = { id: 'd1', attribute_key: 'material', attribute_label: 'Material', attribute_type: 'text', category_id: null, is_required: true, sort_order: 0, unit: null, options: null };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Given ItemAttributeSettingsSection on Comb primitives', () => {
  test('Given definitions exist / When rendered / Then the Add button and icon buttons are Comb buttons', async () => {
    svc.getAttributeDefinitions.mockResolvedValue([def]);
    render(<ItemAttributeSettingsSection categories={cats} canManage />);
    await waitFor(() => screen.getByText('Material'));
    expect(screen.getByText(/add attribute/i).closest('[data-comb="button"]')).not.toBeNull();
    expect(screen.getByTitle('Edit').getAttribute('data-comb')).toBe('icon-button');
    expect(screen.getByTitle('Delete').getAttribute('data-comb')).toBe('icon-button');
  });

  test('Given Add clicked / When the form opens / Then Comb fields are labelled and Save/Cancel are Comb buttons', async () => {
    svc.getAttributeDefinitions.mockResolvedValue([]);
    render(<ItemAttributeSettingsSection categories={cats} canManage />);
    await waitFor(() => screen.getByText(/add attribute/i));
    fireEvent.click(screen.getByText(/add attribute/i));
    expect(screen.getByLabelText(/^Label/)).toBeInTheDocument();
    expect(screen.getByLabelText('Type').tagName).toBe('SELECT');
    expect(screen.getByLabelText(/Description \/ Notes/).tagName).toBe('TEXTAREA');
    expect(screen.getByText('Save').closest('[data-comb="button"]')).not.toBeNull();
    expect(screen.getByText('Cancel').closest('[data-comb="button"]')).not.toBeNull();
  });

  test('Given the form is open / When the Required checkbox is toggled and saved / Then is_required is sent', async () => {
    svc.getAttributeDefinitions.mockResolvedValue([]);
    svc.createAttributeDefinition.mockResolvedValue({ id: 'n' });
    render(<ItemAttributeSettingsSection categories={cats} canManage />);
    await waitFor(() => screen.getByText(/add attribute/i));
    fireEvent.click(screen.getByText(/add attribute/i));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Material/), { target: { value: 'Weight' } });
    fireEvent.click(screen.getByLabelText('Required field'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(svc.createAttributeDefinition).toHaveBeenCalledWith(expect.objectContaining({ is_required: true, attribute_key: 'weight' })));
  });

  test('Given no definitions / When loaded / Then the Comb EmptyState is shown', async () => {
    svc.getAttributeDefinitions.mockResolvedValue([]);
    render(<ItemAttributeSettingsSection categories={cats} canManage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toHaveTextContent(/no attribute definitions yet/i));
  });

  test('Given a failed save / When the service rejects / Then an error Alert is shown', async () => {
    svc.getAttributeDefinitions.mockResolvedValue([]);
    svc.createAttributeDefinition.mockRejectedValue(new Error('Duplicate key'));
    render(<ItemAttributeSettingsSection categories={cats} canManage />);
    await waitFor(() => screen.getByText(/add attribute/i));
    fireEvent.click(screen.getByText(/add attribute/i));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Material/), { target: { value: 'Weight' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Duplicate key'));
  });

  test('Given canManage is false / When rendered with definitions / Then Add and row actions are hidden', async () => {
    svc.getAttributeDefinitions.mockResolvedValue([def]);
    render(<ItemAttributeSettingsSection categories={cats} canManage={false} />);
    await waitFor(() => screen.getByText('Material'));
    expect(screen.queryByText(/add attribute/i)).toBeNull();
    expect(screen.queryByTitle('Edit')).toBeNull();
    expect(screen.queryByTitle('Delete')).toBeNull();
  });
});
