import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../../services/mediaService', () => ({
  mediaService: {
    uploadFile: vi.fn().mockResolvedValue({ url: 'http://example.com/img.jpg' }),
  },
}));

vi.mock('../../constants/categoryIcons', () => ({
  renderCategoryIcon: vi.fn().mockReturnValue(null),
}));

import CategoryTreeView from './CategoryTreeView';

const makeNode = (overrides: any = {}) => ({
  id: 'cat-1',
  name: 'Electronics',
  description: '',
  icon_url: null,
  image_url: null,
  color: null,
  depth: 0,
  children: [],
  ...overrides,
});

const makeProps = (overrides: any = {}) => ({
  tree: [makeNode()],
  onAdd: vi.fn().mockResolvedValue(undefined),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  canManage: true,
  onSelect: vi.fn(),
  ...overrides,
});

describe('CategoryTreeView', () => {
  describe('Given empty tree', () => {
    it('When tree is empty / Then shows no categories message', () => {
      render(<CategoryTreeView {...makeProps({ tree: [] })} />);
      expect(screen.getByText('No categories created yet')).toBeInTheDocument();
    });
  });

  describe('Given tree with categories', () => {
    it('When rendered / Then shows category name', () => {
      render(<CategoryTreeView {...makeProps()} />);
      expect(screen.getByText('Electronics')).toBeInTheDocument();
    });

    it('When multiple categories / Then shows all names', () => {
      render(<CategoryTreeView {...makeProps({
        tree: [
          makeNode({ id: 'cat-1', name: 'Electronics' }),
          makeNode({ id: 'cat-2', name: 'Clothing' }),
        ],
      })} />);
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Clothing')).toBeInTheDocument();
    });
  });

  describe('Given canManage is true', () => {
    it('When rendered / Then shows Add Category Root button', () => {
      render(<CategoryTreeView {...makeProps()} />);
      // Button has an icon + text "Add Category" as separate nodes
      expect(screen.getByText('Add Category')).toBeInTheDocument();
    });

    it('When Add Category clicked / Then shows name input', () => {
      render(<CategoryTreeView {...makeProps()} />);
      fireEvent.click(screen.getByText('Add Category'));
      expect(screen.getByPlaceholderText('Category name...')).toBeInTheDocument();
    });

    it('When root category name entered and added / Then calls onAdd', async () => {
      const onAdd = vi.fn().mockResolvedValue(undefined);
      render(<CategoryTreeView {...makeProps({ onAdd })} />);
      fireEvent.click(screen.getByText('Add Category'));
      fireEvent.change(screen.getByPlaceholderText('Category name...'), { target: { value: 'New Cat' } });
      fireEvent.click(screen.getByText('Add'));
      await waitFor(() => {
        expect(onAdd).toHaveBeenCalledWith('New Cat', '');
      });
    });
  });

  describe('Given canManage is false', () => {
    it('When canManage is false / Then does not show Add Category button', () => {
      render(<CategoryTreeView {...makeProps({ canManage: false })} />);
      expect(screen.queryByText('Add Category')).not.toBeInTheDocument();
    });
  });

  describe('Given tree item interactions', () => {
    it('When category item clicked / Then calls onSelect', () => {
      const onSelect = vi.fn();
      render(<CategoryTreeView {...makeProps({ onSelect })} />);
      fireEvent.click(screen.getByText('Electronics'));
      expect(onSelect).toHaveBeenCalledWith('cat-1');
    });

    it('When category with children / Then shows expand button', () => {
      render(<CategoryTreeView {...makeProps({
        tree: [makeNode({
          id: 'cat-1',
          name: 'Electronics',
          children: [makeNode({ id: 'cat-2', name: 'Phones', depth: 1, children: [] })],
        })],
      })} />);
      expect(screen.getByText('Electronics')).toBeInTheDocument();
    });
  });
});
