import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TabNavigation from './TabNavigation';

describe('TabNavigation', () => {
  describe('Given the tab bar is rendered', () => {
    it('When rendered / Then shows the Basic Info tab label', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(screen.getByText('Basic Info')).toBeInTheDocument();
    });

    it('When rendered / Then shows the Pricing tab label', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(screen.getByText('Pricing')).toBeInTheDocument();
    });

    it('When rendered / Then shows the Media tab label', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(screen.getByText('Media')).toBeInTheDocument();
    });

    it('When rendered / Then shows the Category tab label', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('When rendered / Then shows the Stock tab label', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(screen.getByText('Stock')).toBeInTheDocument();
    });

    it('When rendered / Then shows the Shipping tab label', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(screen.getByText('Shipping')).toBeInTheDocument();
    });

    it('When rendered / Then shows the Attributes tab label', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(screen.getByText('Attributes')).toBeInTheDocument();
    });

    it('When rendered / Then shows exactly 7 tab buttons', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(screen.getAllByRole('button')).toHaveLength(7);
    });
  });

  describe('Given the user clicks a tab', () => {
    it('When Pricing tab is clicked / Then calls onTabChange with "pricing"', () => {
      const onTabChange = vi.fn();
      render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
      fireEvent.click(screen.getByText('Pricing'));
      expect(onTabChange).toHaveBeenCalledWith('pricing');
    });

    it('When Media tab is clicked / Then calls onTabChange with "media"', () => {
      const onTabChange = vi.fn();
      render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
      fireEvent.click(screen.getByText('Media'));
      expect(onTabChange).toHaveBeenCalledWith('media');
    });

    it('When Category tab is clicked / Then calls onTabChange with "category"', () => {
      const onTabChange = vi.fn();
      render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
      fireEvent.click(screen.getByText('Category'));
      expect(onTabChange).toHaveBeenCalledWith('category');
    });

    it('When Shipping tab is clicked / Then calls onTabChange with "shipping"', () => {
      const onTabChange = vi.fn();
      render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
      fireEvent.click(screen.getByText('Shipping'));
      expect(onTabChange).toHaveBeenCalledWith('shipping');
    });

    it('When Attributes tab is clicked / Then calls onTabChange with "attributes"', () => {
      const onTabChange = vi.fn();
      render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
      fireEvent.click(screen.getByText('Attributes'));
      expect(onTabChange).toHaveBeenCalledWith('attributes');
    });

    it('When the already-active tab is clicked / Then still calls onTabChange', () => {
      const onTabChange = vi.fn();
      render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
      fireEvent.click(screen.getByText('Basic Info'));
      expect(onTabChange).toHaveBeenCalledWith('basic');
    });
  });

  describe('Given the active tab styling', () => {
    it('When activeTab is "pricing" / Then the Pricing button carries the active text-blue-400 class', () => {
      render(<TabNavigation activeTab="pricing" onTabChange={vi.fn()} />);
      const pricingBtn = screen.getByText('Pricing').closest('button');
      expect(pricingBtn?.className).toContain('text-blue-400');
    });

    it('When activeTab is "media" / Then the Media button carries the active text-blue-400 class', () => {
      render(<TabNavigation activeTab="media" onTabChange={vi.fn()} />);
      const mediaBtn = screen.getByText('Media').closest('button');
      expect(mediaBtn?.className).toContain('text-blue-400');
    });

    it('When activeTab is "basic" / Then inactive tabs do not carry text-blue-400', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      const pricingBtn = screen.getByText('Pricing').closest('button');
      expect(pricingBtn?.className).not.toContain('text-blue-400');
    });
  });

  describe('Given tab error indicators', () => {
    it('When tabErrors has basic:true / Then the Basic Info button has a bg-rose-500 error dot', () => {
      render(<TabNavigation activeTab="pricing" onTabChange={vi.fn()} tabErrors={{ basic: true }} />);
      const basicBtn = screen.getByText('Basic Info').closest('button');
      expect(basicBtn?.querySelector('.bg-rose-500')).toBeInTheDocument();
    });

    it('When tabErrors has pricing:true / Then the Pricing button has an error dot', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} tabErrors={{ pricing: true }} />);
      const pricingBtn = screen.getByText('Pricing').closest('button');
      expect(pricingBtn?.querySelector('.bg-rose-500')).toBeInTheDocument();
    });

    it('When tabErrors has no errors / Then no error dots are shown', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} tabErrors={{}} />);
      expect(document.querySelectorAll('.bg-rose-500')).toHaveLength(0);
    });

    it('When tabErrors prop is omitted / Then no error dots are shown', () => {
      render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
      expect(document.querySelectorAll('.bg-rose-500')).toHaveLength(0);
    });
  });
});
