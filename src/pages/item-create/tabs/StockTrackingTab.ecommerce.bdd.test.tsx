import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StockTrackingTab from './StockTrackingTab';

const flagOn = { value: true };
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ isFeatureEnabled: () => flagOn.value }),
}));

const base = {
    min_stock_threshold: '', reorder_level: '', is_batch_tracked: false,
    is_serial_tracked: false, is_active: true,
};

describe('StockTrackingTab ecommerce toggles', () => {
    it('given the flag is off, when rendered, then the toggles are hidden', () => {
        flagOn.value = false;
        render(<StockTrackingTab {...base} updateField={vi.fn()} />);
        expect(screen.queryByLabelText(/Show Stock/i)).toBeNull();
        flagOn.value = true;
    });

    it('given no ecommerce settings, when rendered, then both toggles default to on', () => {
        render(<StockTrackingTab {...base} updateField={vi.fn()} />);
        expect((screen.getByLabelText(/Available on Ecommerce/i) as HTMLInputElement).checked).toBe(true);
        expect((screen.getByLabelText(/Show Stock/i) as HTMLInputElement).checked).toBe(true);
    });

    it('given Show Stock on, when unchecked, then updateField gets show_stock=false', () => {
        const updateField = vi.fn();
        render(<StockTrackingTab {...base} updateField={updateField} />);
        fireEvent.click(screen.getByLabelText(/Show Stock/i));
        expect(updateField).toHaveBeenCalledWith('show_stock', false);
    });

    it('given available on, when unchecked, then updateField gets available_on_ecommerce=false', () => {
        const updateField = vi.fn();
        render(<StockTrackingTab {...base} updateField={updateField} />);
        fireEvent.click(screen.getByLabelText(/Available on Ecommerce/i));
        expect(updateField).toHaveBeenCalledWith('available_on_ecommerce', false);
    });
});
