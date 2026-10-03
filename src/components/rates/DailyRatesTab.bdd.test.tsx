/**
 * BDD spec — DailyRatesTab (the "Daily rates" tab of the Items page)
 *
 * Invariants:
 *   - The date picker defaults to today and drives the board fetch
 *   - Grid shows item, unit, previous price, editable price, change %
 *   - Saving always goes through an inline review screen (no modal) and sends only changed rows
 *   - A category shift (% or Rs) changes only that category's rows
 *   - CSV upload reports bad rows and puts valid rows into the review
 *   - Copy yesterday calls copy-previous for the selected date, then reloads
 *   - History opens the item's Price history tab
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { changePct, changedEntries, isRateBoardEnabled, toIsoDate, RATE_BOARD_FLAG } from '../../hooks/rateBoard';

const h = vi.hoisted(() => ({
  board: { date: '', entries: [] as any[] },
  getRateBoard: null as any,
  saveRateBoard: null as any,
  copyPreviousRates: null as any,
  getItems: null as any,
  getSettings: null as any,
  navigate: null as any,
  canEdit: true,
}));

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getRateBoard: (...a: any[]) => h.getRateBoard(...a),
    saveRateBoard: (...a: any[]) => h.saveRateBoard(...a),
    copyPreviousRates: (...a: any[]) => h.copyPreviousRates(...a),
    getItems: (...a: any[]) => h.getItems(...a),
    getSettings: (...a: any[]) => h.getSettings(...a),
  },
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({ permissionsLoaded: true, hasPermission: () => h.canEdit, isFeatureEnabled: () => true }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
}));

import DailyRatesTab from './DailyRatesTab';

const entries = () => [
  { item_id: 'i-1', variant_id: null, item_name: 'Widget A', sku: 'WA', unit: 'kg', price: 110, previous_price: 100, effective_from: '2026-10-01', change_pct: 10 },
  { item_id: 'i-2', variant_id: 'v-1', item_name: 'Widget B Large', sku: 'WB-L', unit: 'pc', price: 50, previous_price: 50, effective_from: null, change_pct: 0 },
];

beforeEach(() => {
  h.canEdit = true;
  h.board = { date: '', entries: entries() };
  h.getRateBoard = vi.fn((d: string) => Promise.resolve({ ...h.board, date: d }));
  h.saveRateBoard = vi.fn(() => Promise.resolve({ saved: 1 }));
  h.copyPreviousRates = vi.fn(() => Promise.resolve({ copied: 2 }));
  h.getItems = vi.fn(() => Promise.resolve({ data: [{ id: 'i-2' }], pagination: {} }));
  h.getSettings = vi.fn(() => Promise.resolve({ categories: [{ id: 'cat-1', name: 'Group One' }] }));
  h.navigate = vi.fn();
});

const ready = async () => {
  render(<DailyRatesTab />);
  await screen.findByText('Widget A');
};

describe('DailyRatesTab', () => {
  describe('Given the tab opens', () => {
    it('When it mounts Then the date picker defaults to today and the board for today is loaded', async () => {
      render(<DailyRatesTab />);
      const today = toIsoDate(new Date());
      expect((screen.getByLabelText('Rate date') as HTMLInputElement).value).toBe(today);
      await waitFor(() => expect(h.getRateBoard).toHaveBeenCalledWith(today));
    });

    it('When rows load Then each row shows item, unit, previous price, price and change %', async () => {
      await ready();
      expect(screen.getByText('kg')).toBeInTheDocument();
      expect(screen.getByText('100.00')).toBeInTheDocument();
      expect((screen.getByLabelText('Price for Widget A') as HTMLInputElement).value).toBe('110');
      expect(screen.getByTestId('rate-row-i-1')).toHaveTextContent('+10.00%');
    });
  });

  describe('Given a different date is picked', () => {
    it('When the date changes Then the board for that date is fetched', async () => {
      await ready();
      fireEvent.change(screen.getByLabelText('Rate date'), { target: { value: '2026-09-15' } });
      await waitFor(() => expect(h.getRateBoard).toHaveBeenCalledWith('2026-09-15'));
    });
  });

  describe('Given one price is edited', () => {
    it('When Review then Save is clicked Then only that row is sent and no modal is used', async () => {
      await ready();
      fireEvent.change(screen.getByLabelText('Price for Widget B Large'), { target: { value: '55' } });
      expect(screen.getByTestId('rate-row-i-2:v-1')).toHaveTextContent('+10.00%');
      fireEvent.click(screen.getByRole('button', { name: /Review \(1\)/ }));
      const review = screen.getByRole('region', { name: 'Review prices' });
      expect(review).toHaveTextContent('1 item will change');
      expect(screen.getByTestId('review-counts')).toHaveTextContent('Up 1 · Down 0');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(h.saveRateBoard).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /Save 1 price/ }));
      await waitFor(() => expect(h.saveRateBoard).toHaveBeenCalledTimes(1));
      const [date, sent] = h.saveRateBoard.mock.calls[0];
      expect(date).toBe(toIsoDate(new Date()));
      expect(sent).toEqual([{ item_id: 'i-2', variant_id: 'v-1', price: 55, unit: 'pc' }]);
      await screen.findByText('Saved 1 price');
    });

    it('When the review is scheduled for a later date Then the save uses that date', async () => {
      await ready();
      fireEvent.change(screen.getByLabelText('Price for Widget A'), { target: { value: '200' } });
      fireEvent.click(screen.getByRole('button', { name: /Review/ }));
      expect(screen.getByTestId('review-jump')).toHaveTextContent('Widget A +81.82%');
      expect(screen.getByTestId('review-jump')).toHaveTextContent('check');
      fireEvent.click(screen.getByLabelText('Schedule'));
      expect(screen.getByRole('button', { name: /Save 1 price/ })).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Schedule date'), { target: { value: '2099-01-02' } });
      fireEvent.click(screen.getByRole('button', { name: /Save 1 price/ }));
      await waitFor(() => expect(h.saveRateBoard).toHaveBeenCalledWith('2099-01-02', expect.any(Array)));
    });

    it('When Back is clicked on the review Then the grid returns with the edit kept', async () => {
      await ready();
      fireEvent.change(screen.getByLabelText('Price for Widget A'), { target: { value: '120' } });
      fireEvent.click(screen.getByRole('button', { name: /Review/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect((screen.getByLabelText('Price for Widget A') as HTMLInputElement).value).toBe('120');
    });
  });

  describe('Given nothing was edited', () => {
    it('When the tab is shown Then Review is disabled', async () => {
      await ready();
      expect(screen.getByRole('button', { name: /Review/ })).toBeDisabled();
    });
  });

  describe('Given the user cannot edit items', () => {
    it('When the tab is shown Then prices are read-only and edit actions are hidden', async () => {
      h.canEdit = false;
      await ready();
      expect(screen.getByLabelText('Price for Widget A')).toBeDisabled();
      expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Shift prices' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Download CSV/ })).toBeEnabled();
    });
  });

  describe('Given a category shift of +10%', () => {
    it('When applied Then only rows of that category change', async () => {
      await ready();
      await screen.findByRole('option', { name: 'Group One' });
      fireEvent.change(screen.getByLabelText('Shift category'), { target: { value: 'cat-1' } });
      fireEvent.change(screen.getByLabelText('Shift amount'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply to list' }));
      await waitFor(() => expect((screen.getByLabelText('Price for Widget B Large') as HTMLInputElement).value).toBe('55'));
      expect(h.getItems).toHaveBeenCalledWith({ categoryId: 'cat-1', limit: 1000 });
      expect((screen.getByLabelText('Price for Widget A') as HTMLInputElement).value).toBe('110');
    });

    it('When the shift is in Rs for all items Then every row moves by that amount', async () => {
      await ready();
      fireEvent.change(screen.getByLabelText('Shift unit'), { target: { value: 'amount' } });
      fireEvent.change(screen.getByLabelText('Shift amount'), { target: { value: '-5' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply to list' }));
      await waitFor(() => expect((screen.getByLabelText('Price for Widget A') as HTMLInputElement).value).toBe('105'));
      expect((screen.getByLabelText('Price for Widget B Large') as HTMLInputElement).value).toBe('45');
      expect(h.getItems).not.toHaveBeenCalled();
    });
  });

  describe('Given a rates CSV is uploaded', () => {
    const upload = (text: string) => {
      const file = new File([text], 'rates.csv', { type: 'text/csv' });
      (file as any).text = () => Promise.resolve(text);
      fireEvent.change(screen.getByLabelText('Rates CSV file'), { target: { files: [file] } });
    };

    it('When every row is valid Then the review screen opens with those changes', async () => {
      await ready();
      upload('sku,price\nWA,121\nWB-L,50\n');
      const review = await screen.findByRole('region', { name: 'Review prices' });
      expect(review).toHaveTextContent('1 item will change');
      expect(review).toHaveTextContent('from CSV rates.csv');
      expect(screen.getByTestId('review-counts')).toHaveTextContent('Unchanged 1');
    });

    it('When some rows are bad Then errors are listed and valid rows stay as edits', async () => {
      await ready();
      upload('item_id,price\ni-1,abc\nnope,5\ni-2:v-1,60\n');
      const errs = await screen.findByRole('alert', { name: 'CSV errors' });
      expect(errs).toHaveTextContent('Line 2: Invalid price "abc" for WA');
      expect(errs).toHaveTextContent('Line 3: Unknown item nope');
      expect((screen.getByLabelText('Price for Widget B Large') as HTMLInputElement).value).toBe('60');
      expect(screen.queryByRole('region', { name: 'Review prices' })).not.toBeInTheDocument();
    });
  });

  describe('Given Copy yesterday is clicked', () => {
    it('When it runs Then copy-previous runs for the date and the board reloads', async () => {
      await ready();
      const before = h.getRateBoard.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: /Copy yesterday/ }));
      await waitFor(() => expect(h.copyPreviousRates).toHaveBeenCalledWith(toIsoDate(new Date())));
      await waitFor(() => expect(h.getRateBoard.mock.calls.length).toBe(before + 1));
    });
  });

  describe('Given the save fails', () => {
    it('When saving Then the error is shown on the review and the edit is kept', async () => {
      h.saveRateBoard = vi.fn(() => Promise.reject(new Error('Unknown item')));
      await ready();
      fireEvent.change(screen.getByLabelText('Price for Widget A'), { target: { value: '120' } });
      fireEvent.click(screen.getByRole('button', { name: /Review/ }));
      fireEvent.click(screen.getByRole('button', { name: /Save 1 price/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Unknown item');
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect((screen.getByLabelText('Price for Widget A') as HTMLInputElement).value).toBe('120');
    });
  });

  describe('Given the history button of a variant row is clicked', () => {
    it('When clicked Then the parent item opens on its Price history tab for that variant', async () => {
      await ready();
      fireEvent.click(screen.getByLabelText('History for Widget B Large'));
      expect(h.navigate).toHaveBeenCalledWith('/inventory/items/i-2?tab=price-history&variant=v-1');
      fireEvent.click(screen.getByLabelText('History for Widget A'));
      expect(h.navigate).toHaveBeenLastCalledWith('/inventory/items/i-1?tab=price-history');
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
