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
