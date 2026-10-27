import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TabNavigation from './TabNavigation';

const LABELS = ['Basic Info', 'Media', 'Pricing', 'Category', 'Stock', 'Shipping', 'Attributes'];

describe('TabNavigation (Comb Tabs)', () => {
    it('GIVEN the tab bar WHEN rendered THEN all seven tabs show', () => {
        render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
        LABELS.forEach(l => expect(screen.getByText(l)).toBeInTheDocument());
        expect(screen.getAllByRole('tab')).toHaveLength(7);
    });

    it('GIVEN activeTab=pricing WHEN rendered THEN Pricing is the selected tab', () => {
        render(<TabNavigation activeTab="pricing" onTabChange={vi.fn()} />);
        expect(screen.getByText('Pricing').closest('[role="tab"]')).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Media').closest('[role="tab"]')).toHaveAttribute('aria-selected', 'false');
    });

    it.each([['Pricing', 'pricing'], ['Media', 'media'], ['Category', 'category'], ['Stock', 'stock'], ['Shipping', 'shipping'], ['Attributes', 'attributes']])(
        'GIVEN the bar WHEN %s is clicked THEN onTabChange receives %s', (label, id) => {
            const onTabChange = vi.fn();
            render(<TabNavigation activeTab="basic" onTabChange={onTabChange} />);
            fireEvent.click(screen.getByText(label));
            expect(onTabChange).toHaveBeenCalledWith(id);
        });

    it('GIVEN tabErrors on basic and pricing WHEN rendered THEN both are flagged', () => {
        render(<TabNavigation activeTab="stock" onTabChange={vi.fn()} tabErrors={{ basic: true, pricing: true }} />);
        expect(screen.getByTestId('item-tab-navigation')).toHaveAttribute('data-tab-errors', 'basic,pricing');
    });

    it('GIVEN no tabErrors WHEN rendered THEN nothing is flagged', () => {
        render(<TabNavigation activeTab="basic" onTabChange={vi.fn()} />);
        expect(screen.getByTestId('item-tab-navigation')).toHaveAttribute('data-tab-errors', '');
    });
});
