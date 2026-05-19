import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TabNavigation from './TabNavigation';

describe('Given TabNavigation', () => {
  it('When rendered / Then shows all tab labels', () => {
    render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Attributes')).toBeInTheDocument();
  });

  it('When tab clicked / Then calls onTabChange with tab id', () => {
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText('Pricing'));
    expect(onTabChange).toHaveBeenCalledWith('pricing');
  });

  it('When activeTab is pricing / Then pricing button has active styling', () => {
    render(<TabNavigation activeTab="pricing" onTabChange={vi.fn()} />);
    const pricingBtn = screen.getByText('Pricing').closest('button');
    expect(pricingBtn?.className).toContain('text-blue-400');
  });

  it('When tabErrors has error on basic / Then basic tab has error indicator', () => {
    render(<TabNavigation activeTab="pricing" onTabChange={vi.fn()} tabErrors={{ basic: true }} />);
    const basicBtn = screen.getByText('Basic Info').closest('button');
    // Error indicator dot should be present
    expect(basicBtn?.querySelector('.bg-rose-500')).toBeInTheDocument();
  });
});

describe('Given TabNavigation interaction hardening', () => {
  it('When each tab is clicked / Then calls onTabChange with the correct tab id', () => {
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
    const tabsToCheck: Array<[string, string]> = [
      ['Media', 'media'],
      ['Category', 'category'],
      ['Shipping', 'shipping'],
      ['Attributes', 'attributes'],
    ];
    for (const [label, id] of tabsToCheck) {
      fireEvent.click(screen.getByText(label));
      expect(onTabChange).toHaveBeenCalledWith(id);
    }
  });

  it('When no tabErrors provided / Then no error indicators are present', () => {
    const { container } = render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
    expect(container.querySelectorAll('.bg-rose-500').length).toBe(0);
  });

  it('When multiple tabs have errors / Then each shows an error dot', () => {
    render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} tabErrors={{ pricing: true, shipping: true }} />);
    const pricingBtn = screen.getByText('Pricing').closest('button');
    const shippingBtn = screen.getByText('Shipping').closest('button');
    expect(pricingBtn?.querySelector('.bg-rose-500')).toBeInTheDocument();
    expect(shippingBtn?.querySelector('.bg-rose-500')).toBeInTheDocument();
  });

  it('When inactive tab is rendered / Then it does not have active border class', () => {
    render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
    const pricingBtn = screen.getByText('Pricing').closest('button');
    expect(pricingBtn?.className).not.toContain('border-blue-500');
  });
});
