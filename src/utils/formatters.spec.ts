import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInventoryFormatters, useInventoryCurrencySymbol } from './formatters';

// @so360/shell-context and @so360/formatters are stubbed by vitest.config.ts aliases
// shell-context stub: useBusinessSettings returns { settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }
// formatters stub: useFormatters returns { formatCurrency, formatDate, formatNumber, formatPercent }

describe('useInventoryFormatters', () => {
  describe('Given the hook is rendered', () => {
    it('When invoked / Then returns formatCurrency function', () => {
      const { result } = renderHook(() => useInventoryFormatters());
      expect(typeof result.current.formatCurrency).toBe('function');
    });

    it('When invoked / Then returns formatDate function', () => {
      const { result } = renderHook(() => useInventoryFormatters());
      expect(typeof result.current.formatDate).toBe('function');
    });

    it('When invoked / Then returns formatNumber function', () => {
      const { result } = renderHook(() => useInventoryFormatters());
      expect(typeof result.current.formatNumber).toBe('function');
    });

    it('When invoked / Then returns formatPercent function', () => {
      const { result } = renderHook(() => useInventoryFormatters());
      expect(typeof result.current.formatPercent).toBe('function');
    });

    it('When formatCurrency called / Then formats value', () => {
      const { result } = renderHook(() => useInventoryFormatters());
      expect(result.current.formatCurrency(100)).toBe('$100');
    });

    it('When formatNumber called / Then returns string', () => {
      const { result } = renderHook(() => useInventoryFormatters());
      expect(result.current.formatNumber(42)).toBe('42');
    });
  });
});

describe('useInventoryCurrencySymbol', () => {
  describe('Given the hook is rendered with USD settings', () => {
    it('When invoked / Then returns currency symbol string', () => {
      const { result } = renderHook(() => useInventoryCurrencySymbol());
      expect(typeof result.current).toBe('string');
      expect(result.current.length).toBeGreaterThan(0);
    });

    it('When USD base currency / Then returns dollar symbol', () => {
      const { result } = renderHook(() => useInventoryCurrencySymbol());
      // Intl.NumberFormat for USD returns '$'
      expect(result.current).toBe('$');
    });
  });
});
