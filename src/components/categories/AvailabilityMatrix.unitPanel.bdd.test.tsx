/**
 * AvailabilityMatrix — project card (RFP §4) and unit panel (RFP §5, plan G3) BDD specs.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const mockGetAvailability = vi.fn();
const mockSetOverride = vi.fn();
vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getCategoryAvailability: (...a: any[]) => mockGetAvailability(...a),
    setUnitStatusOverride: (...a: any[]) => mockSetOverride(...a),
  },
}));

import { AvailabilityMatrix } from './AvailabilityMatrix';

const baseUnit = { floor: 1, stack: '01', status: 'available' };

const richUnit = {
  ...baseUnit,
  item_id: 'u1',
  unit_number: '101',
  property_type: 'Apartment',
  bedrooms: 2,
  bathrooms: 3,
  area_sqft: 1200,
  built_up_area: 1100,
  plot_area: 1500,
  view: 'Sea',
  original_price: 1_000_000,
  discount: 50_000,
  final_price: 950_000,
  currency: 'AED',
};

beforeEach(() => {
  mockNavigate.mockReset();
  mockGetAvailability.mockReset();
  mockSetOverride.mockReset();
});

const openPanel = async (label: string) => {
  fireEvent.click(await screen.findByRole('button', { name: label }));
  return screen.getByTestId('unit-panel');
};

describe('Given the backend returns whole-project totals', () => {
  describe('When the matrix loads', () => {
    it('Then the card uses the totals over the tower sums and shows non-zero manual buckets and % sold', async () => {
      mockGetAvailability.mockResolvedValue({
        totals: { total: 10, available: 4, on_hold: 1, sold: 3, blocked: 2, cancelled: 0, unavailable: 0 },
        towers: [{ category_id: 't1', name: 'A', total: 1, available: 1, on_hold: 0, sold: 0 }],
        units: [{ ...baseUnit, item_id: 'a', category_id: 't1', unit_number: '101' }],
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      const card = await screen.findByTestId('availability-summary');
      expect(card.textContent).toContain('Total 10');
      expect(card.textContent).toContain('Reserved 1');
      expect(card.textContent).toContain('Blocked 2');
      expect(card.textContent).not.toContain('Cancelled');
      expect(card.textContent).not.toContain('Unavailable');
      expect(screen.getByTestId('percent-sold').textContent).toBe('30% Sold');
    });
  });
});

describe('Given units whose status is a manual override', () => {
  describe('When the grid renders', () => {
    it('Then each manual status has its own chip label, short code and legend entry', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [],
        units: [
          { ...baseUnit, item_id: 'b', unit_number: '101', status: 'blocked' },
          { ...baseUnit, item_id: 'c', unit_number: '102', stack: '02', status: 'cancelled' },
          { ...baseUnit, item_id: 'd', unit_number: '103', stack: '03', status: 'unavailable' },
        ],
      });
      render(<AvailabilityMatrix categoryId="t9" />);
      const blocked = await screen.findByRole('button', { name: 'Unit 101 Blocked' });
      expect(blocked.className).toContain('slate');
      expect(screen.getByRole('button', { name: 'Unit 102 Cancelled' }).className).toContain('orange');
      expect(screen.getByRole('button', { name: 'Unit 103 Unavailable' }).className).toContain('zinc');
      const card = screen.getByTestId('availability-summary');
      expect(card.textContent).toContain('Blocked 1');
      expect(card.textContent).toContain('Cancelled 1');
      expect(card.textContent).toContain('Unavailable 1');
      expect(screen.getByTestId('percent-sold').textContent).toBe('0% Sold');
    });
  });
});

describe('Given a unit with the RFP §5 fields', () => {
  beforeEach(() => {
    mockGetAvailability.mockResolvedValue({ towers: [], units: [richUnit] });
  });

  describe('When the user opens it', () => {
    it('Then its fields and prices in the unit currency show', async () => {
      render(<AvailabilityMatrix categoryId="t9" />);
      const panel = await openPanel('Unit 101 Available');
      const text = panel.textContent || '';
      expect(text).toContain('Apartment');
      expect(text).toContain('Bathrooms3');
      expect(text).toContain('Area (sq ft)1200');
      expect(text).toContain('Built-up area1100');
      expect(text).toContain('Plot area1500');
      expect(text).toContain('Sea');
      expect(text).toMatch(/Original priceAED\s1,000,000/);
      expect(text).toMatch(/DiscountAED\s50,000/);
      expect(text).toMatch(/Final priceAED\s950,000/);
      expect(screen.getByRole('button', { name: 'Unit 101 Available' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('Then a read-only viewer sees no manual status form', async () => {
      render(<AvailabilityMatrix categoryId="t9" />);
      await openPanel('Unit 101 Available');
      expect(screen.queryByTestId('unit-override-form')).toBeNull();
      expect(screen.queryByTestId('unit-deal-ref')).toBeNull();
    });

    it('Then Close hides the panel', async () => {
      render(<AvailabilityMatrix categoryId="t9" />);
      await openPanel('Unit 101 Available');
      fireEvent.click(screen.getByRole('button', { name: 'Close unit' }));
      expect(screen.queryByTestId('unit-panel')).toBeNull();
    });
  });
});

describe('Given a unit without its own currency or final price', () => {
  describe('When the user opens it', () => {
    it('Then the list price shows in the org currency and blank fields are omitted', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [],
        units: [{ ...baseUnit, item_id: 'x', unit_number: '201', price: 10, currency: null, view: '' }],
      });
      render(<AvailabilityMatrix categoryId="t9" />);
      const panel = await openPanel('Unit 201 Available');
      expect(panel.textContent).toContain('Final price$10.00');
      expect(panel.textContent).not.toContain('View');
      expect(panel.textContent).not.toContain('Original price');
    });
  });
});

describe('Given a unit linked to a reservation', () => {
  describe('When the reservation is active', () => {
    it('Then the reference and reserved date show read-only', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [],
        units: [{
          ...baseUnit, item_id: 'r', unit_number: '301', status: 'on_hold',
          deal_ref: { reference_type: 'deal', reference_id: 'D-9', reservation_status: 'active', reserved_at: '2026-09-01T10:00:00Z', sold_at: null },
        }],
      });
      render(<AvailabilityMatrix categoryId="t9" />);
      await openPanel('Unit 301 On hold');
      const ref = screen.getByTestId('unit-deal-ref');
      expect(ref.textContent).toContain('Reservation');
      expect(ref.textContent).toContain('deal · D-9');
      expect(ref.textContent).toContain(new Date('2026-09-01T10:00:00Z').toLocaleDateString());
      expect(ref.textContent).not.toContain('Sold on');
      expect(ref.textContent).toContain('Buyer and agent are on the linked record.');
    });
  });

  describe('When the sale is committed with an unparseable date', () => {
    it('Then it reads as a sale record and the raw date is kept', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [],
        units: [{
          ...baseUnit, item_id: 's', unit_number: '302', status: 'sold',
          deal_ref: { reference_type: 'sales_order', reference_id: 'SO-1', reservation_status: 'committed', reserved_at: null, sold_at: 'soon' },
        }],
      });
      render(<AvailabilityMatrix categoryId="t9" />);
      await openPanel('Unit 302 Sold');
      const ref = screen.getByTestId('unit-deal-ref');
      expect(ref.textContent).toContain('Sale record');
      expect(ref.textContent).toContain('Sold onsoon');
      expect(ref.textContent).not.toContain('Reserved on');
    });
  });
});

describe('Given a manager and an available unit', () => {
  describe('When they block it with a reason and save', () => {
    it('Then the override is sent, availability reloads and the panel shows the new status', async () => {
      mockGetAvailability
        .mockResolvedValueOnce({ towers: [], units: [{ ...baseUnit, item_id: 'u1', unit_number: '101' }] })
        .mockResolvedValueOnce({
          towers: [],
          units: [{ ...baseUnit, item_id: 'u1', unit_number: '101', status: 'blocked', status_override: 'blocked', status_override_reason: 'Snag' }],
        });
      mockSetOverride.mockResolvedValue({ item_id: 'u1', status_override: 'blocked' });
      render(<AvailabilityMatrix categoryId="t9" canManage />);
      await openPanel('Unit 101 Available');
      const save = screen.getByRole('button', { name: 'Save status' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      expect(screen.queryByLabelText('Reason')).toBeNull();

      fireEvent.change(screen.getByLabelText('Manual status'), { target: { value: 'blocked' } });
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Snag' } });
      expect(save.disabled).toBe(false);
      fireEvent.click(save);

      await waitFor(() => expect(mockSetOverride).toHaveBeenCalledWith('u1', 'blocked', 'Snag'));
      expect(await screen.findByTestId('unit-override-reason')).toBeTruthy();
      expect(screen.getByTestId('unit-override-reason').textContent).toBe('Reason: Snag');
      expect(mockGetAvailability).toHaveBeenCalledTimes(2);
      expect((screen.getByLabelText('Manual status') as HTMLSelectElement).value).toBe('blocked');
    });
  });
});

describe('Given a manager and a blocked unit', () => {
  const blocked = { ...baseUnit, item_id: 'u2', unit_number: '102', status: 'blocked', status_override: 'blocked', status_override_reason: 'Snag' };

  describe('When they change only the reason', () => {
    it('Then Save becomes available', async () => {
      mockGetAvailability.mockResolvedValue({ towers: [], units: [blocked] });
      render(<AvailabilityMatrix categoryId="t9" canManage />);
      await openPanel('Unit 102 Blocked');
      const save = screen.getByRole('button', { name: 'Save status' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Snag fixed later' } });
      expect(save.disabled).toBe(false);
    });
  });

  describe('When they clear the override', () => {
    it('Then null is sent', async () => {
      mockGetAvailability.mockResolvedValue({ towers: [], units: [blocked] });
      mockSetOverride.mockResolvedValue({});
      render(<AvailabilityMatrix categoryId="t9" canManage />);
      await openPanel('Unit 102 Blocked');
      fireEvent.change(screen.getByLabelText('Manual status'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
      await waitFor(() => expect(mockSetOverride).toHaveBeenCalledWith('u2', null, 'Snag'));
    });
  });

  describe('When the save fails with a message', () => {
    it('Then the message shows in the panel and nothing reloads', async () => {
      mockGetAvailability.mockResolvedValue({ towers: [], units: [blocked] });
      mockSetOverride.mockRejectedValue(new Error('Unit is reserved'));
      render(<AvailabilityMatrix categoryId="t9" canManage />);
      await openPanel('Unit 102 Blocked');
      fireEvent.change(screen.getByLabelText('Manual status'), { target: { value: 'cancelled' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
      expect(await screen.findByText('Unit is reserved')).toBeTruthy();
      expect(mockGetAvailability).toHaveBeenCalledTimes(1);
      expect((screen.getByRole('button', { name: 'Save status' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('When the save fails without a message', () => {
    it('Then a generic error shows', async () => {
      mockGetAvailability.mockResolvedValue({ towers: [], units: [blocked] });
      mockSetOverride.mockRejectedValue({});
      render(<AvailabilityMatrix categoryId="t9" canManage />);
      await openPanel('Unit 102 Blocked');
      fireEvent.change(screen.getByLabelText('Manual status'), { target: { value: 'unavailable' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
      expect(await screen.findByText('Failed to update status')).toBeTruthy();
    });
  });

  describe('When the save is in flight', () => {
    it('Then the button reads Saving…', async () => {
      mockGetAvailability.mockResolvedValue({ towers: [], units: [blocked] });
      mockSetOverride.mockReturnValue(new Promise(() => {}));
      render(<AvailabilityMatrix categoryId="t9" canManage />);
      await openPanel('Unit 102 Blocked');
      fireEvent.change(screen.getByLabelText('Manual status'), { target: { value: 'unavailable' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
      expect(await screen.findByRole('button', { name: 'Saving…' })).toBeTruthy();
    });
  });
});

describe('Given an open unit panel', () => {
  describe('When the user switches to a tower that does not contain the unit', () => {
    it('Then the panel closes', async () => {
      mockGetAvailability.mockResolvedValue({
        towers: [
          { category_id: 't1', name: 'A', total: 1, available: 1, on_hold: 0, sold: 0 },
          { category_id: 't2', name: 'B', total: 1, available: 1, on_hold: 0, sold: 0 },
        ],
        units: [
          { ...baseUnit, item_id: 'a', category_id: 't1', unit_number: '101' },
          { ...baseUnit, item_id: 'b', category_id: 't2', unit_number: '201' },
        ],
      });
      render(<AvailabilityMatrix categoryId="p1" />);
      await openPanel('Unit 101 Available');
      fireEvent.click(screen.getAllByRole('tab')[1]);
      await waitFor(() => expect(screen.queryByTestId('unit-panel')).toBeNull());
    });
  });
});
