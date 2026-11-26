/** Pulse f5a7a8b8 - stock overview snapshot paging. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
vi.mock('../services/inventoryService', () => ({
  inventoryService: { getStockOverview: (...a: any[]) => mockGet(...a), getGLInventoryValuation: vi.fn() },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({}) }));

import { loadStockSnapshot, SNAPSHOT_LIMIT } from './StockOverviewPage';

const rows = (n: number, start = 0) => Array.from({ length: n }, (_, i) => ({ id: `r${start + i}` }));

describe('Feature: stock overview snapshot paging (f5a7a8b8)', () => {
  beforeEach(() => mockGet.mockReset());

  it('Given a BE that ignores paging and returns a bare array, When loading, Then it is used as the full set with one call', async () => {
    mockGet.mockResolvedValueOnce(rows(1500));
    const res = await loadStockSnapshot();
    expect(res).toHaveLength(1500);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('Given a paged BE with total 1200, When loading, Then it requests offset 0 then 1000 and stops at the total', async () => {
    mockGet
      .mockResolvedValueOnce({ data: rows(SNAPSHOT_LIMIT), total: 1200 })
      .mockResolvedValueOnce({ data: rows(200, 1000), total: 1200 });
    const res = await loadStockSnapshot();
    expect(res).toHaveLength(1200);
    expect(mockGet).toHaveBeenNthCalledWith(1, { limit: SNAPSHOT_LIMIT, offset: 0, include_total: true });
    expect(mockGet).toHaveBeenNthCalledWith(2, { limit: SNAPSHOT_LIMIT, offset: SNAPSHOT_LIMIT, include_total: true });
  });

  it('Given an empty page before the total is reached, When loading, Then it stops instead of looping', async () => {
    mockGet.mockResolvedValueOnce({ data: [], total: 50 });
    expect(await loadStockSnapshot()).toEqual([]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
