/**
 * BDD spec — RateBoardPage
 *
 * Invariants:
 *   - The date picker defaults to today and drives the board fetch
 *   - Grid shows item, unit, previous price, editable today's price, change %
 *   - Save all sends only rows whose price changed
 *   - Copy yesterday calls copy-previous for the selected date, then reloads
 *   - History opens in a side panel (not a modal) for the chosen row
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { changePct, changedEntries, isRateBoardEnabled, toIsoDate, RATE_BOARD_FLAG } from '../hooks/rateBoard';

const h = vi.hoisted(() => ({
  board: { date: '', entries: [] as any[] },
  getRateBoard: null as any,
  saveRateBoard: null as any,
  copyPreviousRates: null as any,
  getRateHistory: null as any,
}));

vi.mock('../services/inventoryService', () => ({
  inventoryService: {
    getRateBoard: (...a: any[]) => h.getRateBoard(...a),
    saveRateBoard: (...a: any[]) => h.saveRateBoard(...a),
    copyPreviousRates: (...a: any[]) => h.copyPreviousRates(...a),
    getRateHistory: (...a: any[]) => h.getRateHistory(...a),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ permissionsLoaded: true, hasPermission: () => true, isFeatureEnabled: () => true }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import RateBoardPage from './RateBoardPage';

const entries = () => [
  { item_id: 'i-1', variant_id: null, item_name: 'Widget A', sku: 'WA', unit: 'kg', price: 110, previous_price: 100, effective_from: '2026-10-01', change_pct: 10 },
  { item_id: 'i-2', variant_id: 'v-1', item_name: 'Widget B Large', sku: 'WB-L', unit: 'pc', price: 50, previous_price: 50, effective_from: null, change_pct: 0 },
];

beforeEach(() => {
  h.board = { date: '', entries: entries() };
  h.getRateBoard = vi.fn((d: string) => Promise.resolve({ ...h.board, date: d }));
  h.saveRateBoard = vi.fn(() => Promise.resolve({ saved: 1 }));
  h.copyPreviousRates = vi.fn(() => Promise.resolve({ copied: 2 }));
  h.getRateHistory = vi.fn(() => Promise.resolve([
    { effective_date: '2026-09-20', price: 95, set_by: null },
    { effective_date: '2026-10-01', price: 110, set_by: null },
  ]));
});

describe('RateBoardPage', () => {
  describe('Given the page opens', () => {
    it('Then the date picker defaults to today and the board for today is loaded', async () => {
      render(<RateBoardPage />);
      const today = toIsoDate(new Date());
      expect((screen.getByLabelText('Rate date') as HTMLInputElement).value).toBe(today);
      await waitFor(() => expect(h.getRateBoard).toHaveBeenCalledWith(today));
    });

    it('Then each row shows item, unit, previous price, today price and change %', async () => {
      render(<RateBoardPage />);
      await screen.findByText('Widget A');
      expect(screen.getByText('kg')).toBeInTheDocument();
      expect(screen.getByText('100.00')).toBeInTheDocument();
      expect((screen.getByLabelText('Price for Widget A') as HTMLInputElement).value).toBe('110');
      expect(screen.getByTestId('rate-row-i-1')).toHaveTextContent('+10.00%');
    });
  });

  describe('Given a different date is picked', () => {
    it('Then the board for that date is fetched', async () => {
      render(<RateBoardPage />);
      await screen.findByText('Widget A');
      fireEvent.change(screen.getByLabelText('Rate date'), { target: { value: '2026-09-15' } });
      await waitFor(() => expect(h.getRateBoard).toHaveBeenCalledWith('2026-09-15'));
    });
  });

  describe('Given one price is edited', () => {
    it('Then change % recomputes live and Save all sends only that row', async () => {
      render(<RateBoardPage />);
      await screen.findByText('Widget A');
      fireEvent.change(screen.getByLabelText('Price for Widget B Large'), { target: { value: '55' } });
      expect(screen.getByTestId('rate-row-i-2:v-1')).toHaveTextContent('+10.00%');
      fireEvent.click(screen.getByRole('button', { name: /Save all \(1\)/ }));
      await waitFor(() => expect(h.saveRateBoard).toHaveBeenCalledTimes(1));
      const [date, sent] = h.saveRateBoard.mock.calls[0];
      expect(date).toBe(toIsoDate(new Date()));
      expect(sent).toEqual([{ item_id: 'i-2', variant_id: 'v-1', price: 55, unit: 'pc' }]);
      await screen.findByText('Saved 1 price');
    });
  });

  describe('Given nothing was edited', () => {
    it('Then Save all is disabled', async () => {
      render(<RateBoardPage />);
      await screen.findByText('Widget A');
      expect(screen.getByRole('button', { name: /Save all/ })).toBeDisabled();
    });
  });

  describe('Given Copy yesterday is clicked', () => {
    it('Then copy-previous runs for the date and the board reloads', async () => {
      render(<RateBoardPage />);
      await screen.findByText('Widget A');
      const before = h.getRateBoard.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: /Copy yesterday/ }));
      await waitFor(() => expect(h.copyPreviousRates).toHaveBeenCalledWith(toIsoDate(new Date())));
      await waitFor(() => expect(h.getRateBoard.mock.calls.length).toBe(before + 1));
    });
  });

  describe('Given the save fails', () => {
    it('Then the error is shown and the edit is kept', async () => {
      h.saveRateBoard = vi.fn(() => Promise.reject(new Error('Unknown item')));
      render(<RateBoardPage />);
      await screen.findByText('Widget A');
      fireEvent.change(screen.getByLabelText('Price for Widget A'), { target: { value: '120' } });
      fireEvent.click(screen.getByRole('button', { name: /Save all/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Unknown item');
      expect((screen.getByLabelText('Price for Widget A') as HTMLInputElement).value).toBe('120');
    });
  });

  describe('Given the history button of a variant row is clicked', () => {
    it('Then a side panel lists its history newest first, keyed by the variant id', async () => {
      render(<RateBoardPage />);
      await screen.findByText('Widget A');
      fireEvent.click(screen.getByLabelText('History for Widget B Large'));
      const panel = await screen.findByRole('complementary', { name: 'Price history' });
      await waitFor(() => expect(panel).toHaveTextContent('2026-10-01'));
      expect(h.getRateHistory.mock.calls[0][0]).toBe('v-1');
      const dates = Array.from(panel.querySelectorAll('li span:first-child')).map((n) => n.textContent);
      expect(dates).toEqual(['2026-10-01', '2026-09-20']);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Close history'));
      expect(screen.queryByRole('complementary', { name: 'Price history' })).not.toBeInTheDocument();
    });
  });
});

describe('rate board helpers', () => {
  it('Given the flag is on in the shell / Then isRateBoardEnabled is true, and false otherwise', () => {
    expect(isRateBoardEnabled({ isFeatureEnabled: (k: string) => k === RATE_BOARD_FLAG })).toBe(true);
    expect(isRateBoardEnabled({ isFeatureEnabled: () => false })).toBe(false);
    expect(isRateBoardEnabled(null)).toBe(false);
  });

  it('Given a zero or missing base / Then changePct is null; otherwise rounded to 2 decimals', () => {
    expect(changePct(0, 10)).toBeNull();
    expect(changePct(null, 10)).toBeNull();
    expect(changePct(3, 4)).toBe(33.33);
  });

  it('Given blank, negative or unchanged drafts / Then changedEntries skips them', () => {
    const rows = entries() as any;
    expect(changedEntries(rows, { 'i-1': '', 'i-2:v-1': '50' })).toEqual([]);
    expect(changedEntries(rows, { 'i-1': '-1' })).toEqual([]);
    expect(changedEntries(rows, { 'i-1': '0' })).toEqual([{ item_id: 'i-1', variant_id: null, price: 0, unit: 'kg' }]);
  });
});
