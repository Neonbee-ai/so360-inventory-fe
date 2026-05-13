import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import CategoryIconLibrary from './CategoryIconLibrary';

describe('CategoryIconLibrary', () => {
  describe('Given initial render', () => {
    it('When rendered / Then shows Preset Icons toggle button', () => {
      render(<CategoryIconLibrary onSelect={vi.fn()} />);
      expect(screen.getByText('Preset Icons')).toBeInTheDocument();
    });

    it('When rendered / Then icon grid is collapsed by default', () => {
      render(<CategoryIconLibrary onSelect={vi.fn()} />);
      expect(screen.queryByText('Or upload a custom image ↑')).not.toBeInTheDocument();
    });
  });

  describe('Given toggle open', () => {
    it('When Preset Icons button clicked / Then expands the icon grid', () => {
      render(<CategoryIconLibrary onSelect={vi.fn()} />);
      fireEvent.click(screen.getByText('Preset Icons'));
      expect(screen.getByText('Or upload a custom image ↑')).toBeInTheDocument();
    });

    it('When expanded and clicked again / Then collapses the icon grid', () => {
      render(<CategoryIconLibrary onSelect={vi.fn()} />);
      fireEvent.click(screen.getByText('Preset Icons'));
      expect(screen.getByText('Or upload a custom image ↑')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Preset Icons'));
      expect(screen.queryByText('Or upload a custom image ↑')).not.toBeInTheDocument();
    });
  });

  describe('Given icon selection', () => {
    it('When an icon button clicked / Then calls onSelect with preset URL', () => {
      const onSelect = vi.fn();
      render(<CategoryIconLibrary onSelect={onSelect} />);
      fireEvent.click(screen.getByText('Preset Icons'));
      // Get all icon buttons (excluding the toggle button)
      const buttons = screen.getAllByRole('button');
      // click the second button (first icon)
      fireEvent.click(buttons[1]);
      expect(onSelect).toHaveBeenCalledWith(expect.stringContaining('preset:'));
    });
  });

  describe('Given currentUrl is a preset', () => {
    it('When currentUrl matches a preset icon / Then that icon shows active state', () => {
      const { container } = render(
        <CategoryIconLibrary currentUrl="preset:package" onSelect={vi.fn()} />
      );
      fireEvent.click(screen.getByText('Preset Icons'));
      // The active icon button should have ring-1 class (active styling)
      const activeBtn = container.querySelector('.ring-1');
      expect(activeBtn).toBeTruthy();
    });
  });
});
