import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const searchEligible = vi.fn();
vi.mock('../services/vendorCollabService', () => ({ vendorCollabService: { searchEligible: (...a: any[]) => searchEligible(...a) } }));

import { useEligibleVendors } from './useEligibleVendors';

const v = (id: string, decision: string) => ({ vendor_id: id, vendor_name: id, decision, reason_codes: [] });
beforeEach(() => vi.clearAllMocks());

describe('useEligibleVendors (Pulse 84fdc5b8)', () => {
  it('Given eligible, conditional and ineligible vendors, Then only the first two are pickable', async () => {
    searchEligible.mockResolvedValue([v('a', 'eligible'), v('b', 'conditional'), v('c', 'ineligible')]);
    const { result } = renderHook(() => useEligibleVendors({ action: 'rfq.invite', item_id: 'i1' }));
    await waitFor(() => expect(result.current.pickable.map((x) => x.vendor_id)).toEqual(['a', 'b']));
    expect(result.current.blocked.map((x) => x.vendor_id)).toEqual(['c']);
  });
  it('Given the search fails, Then callers are told to fall back', async () => {
    searchEligible.mockRejectedValue(new Error('no'));
    const { result } = renderHook(() => useEligibleVendors({ action: 'po.create' }));
    await waitFor(() => expect(result.current.unavailable).toBe(true));
  });
  it('Given the picker is closed, Then nothing is fetched', () => {
    renderHook(() => useEligibleVendors({ action: 'po.create' }, false));
    expect(searchEligible).not.toHaveBeenCalled();
  });
});
