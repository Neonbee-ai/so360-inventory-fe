/**
 * BDD spec — Item detail "Price history" tab (daily rates history)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ getRateHistory: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({
  inventoryService: { getRateHistory: (...a: any[]) => h.getRateHistory(...a) },
}));

import PriceHistoryPanel from './PriceHistoryPanel';

describe('Given an item with daily rates', () => {
  beforeEach(() => {
    h.getRateHistory.mockReset();
    h.getRateHistory.mockResolvedValue([
      { effective_date: '2026-10-01', price: 100, set_by: 'user-1' },
      { effective_date: '2026-10-02', price: 110, set_by: null },
    ]);
  });

  it('When the tab opens Then 90 days of history are listed newest first with the change', async () => {
    render(<PriceHistoryPanel itemId="item-1" />);
    await screen.findByTestId('price-history-2026-10-02');
    const [itemId, from, to] = h.getRateHistory.mock.calls[0];
    expect(itemId).toBe('item-1');
    expect((Date.parse(to) - Date.parse(from)) / 86400000).toBeCloseTo(90, 0);
    const rows = screen.getAllByTestId(/^price-history-/);
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(['price-history-2026-10-02', 'price-history-2026-10-01']);
    expect(rows[0].textContent).toContain('+10.00%');
    expect(rows[1].textContent).toContain('user-1');
  });

  it('When a variant was asked for Then its history is loaded', async () => {
    render(<PriceHistoryPanel itemId="item-1" variantId="var-9" />);
    await waitFor(() => expect(h.getRateHistory).toHaveBeenCalled());
    expect(h.getRateHistory.mock.calls[0][0]).toBe('var-9');
  });

  it('When the 1 year range is chosen Then the history is reloaded for 365 days', async () => {
    render(<PriceHistoryPanel itemId="item-1" />);
    await screen.findByTestId('price-history-2026-10-02');
    fireEvent.click(screen.getByRole('button', { name: '1 year' }));
    await waitFor(() => expect(h.getRateHistory).toHaveBeenCalledTimes(2));
    const [, from, to] = h.getRateHistory.mock.calls[1];
    expect((Date.parse(to) - Date.parse(from)) / 86400000).toBeCloseTo(365, 0);
  });
});

describe('Given the history cannot be loaded or is empty', () => {
  it('When loading fails Then an error is shown', async () => {
    h.getRateHistory.mockReset();
    h.getRateHistory.mockRejectedValue(new Error('boom'));
    render(<PriceHistoryPanel itemId="item-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });

  it('When there are no rates Then an empty message is shown', async () => {
    h.getRateHistory.mockReset();
    h.getRateHistory.mockResolvedValue([]);
    render(<PriceHistoryPanel itemId="item-1" />);
    expect(await screen.findByText('No daily rates in this period')).toBeInTheDocument();
  });
});
