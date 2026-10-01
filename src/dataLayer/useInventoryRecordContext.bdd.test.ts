import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Record context hook: row refresh and host notification after a Class B save.

const save = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock('./classBSave', async (orig) => {
  const real = await orig<typeof import('./classBSave')>();
  return { ...real, saveClassBCustomFields: (...a: unknown[]) => save.fn(...a) };
});

import { useInventoryRecordContext } from './useInventoryRecordContext';

const DL = { entity: 'inventory.item' } as any;

beforeEach(() => {
  save.fn.mockReset();
});

// recordId: omitted => 'd1'; null => not loaded (undefined passed to the hook)
function setup(record: Record<string, any> | null, recordId: string | null = 'd1', withCallbacks = true) {
  const onSaved = vi.fn();
  const onChanged = vi.fn();
  const { result } = renderHook(() =>
    useInventoryRecordContext(DL, recordId ?? undefined, record, withCallbacks ? { canEdit: true, onSaved, onChanged } : { canEdit: false }),
  );
  return { ctx: result.current, onSaved, onChanged };
}

describe('Feature: Inventory item record context for Shell renderers', () => {
  describe('Scenario: context shape', () => {
    it('then it exposes the Class B view and version, and an empty id when unloaded', () => {
      // Given an item with a version
      const { ctx } = setup({ id: 'd1', custom_fields: { a: 1 }, custom_fields_version: 2 });
      // Then
      expect(ctx.record).toEqual({ id: 'd1', custom_fields: { a: 1 }, custom_fields_version: 2 });
      expect(ctx.version).toBe(2);
      expect(ctx.canEdit).toBe(true);
      const unloaded = setup(null, null);
      expect(unloaded.ctx.recordId).toBe('');
      expect(unloaded.ctx.record).toBeNull();
    });
  });

  describe('Given the record is not loaded', () => {
    it('then save returns an error without calling the API', async () => {
      const { ctx } = setup(null, null);
      const res = await ctx.onSave({ a: 1 });
      expect(res).toEqual({ ok: false, error: 'Record not loaded' });
      expect(save.fn).not.toHaveBeenCalled();
    });
  });

  describe('Given a save returns a new integer version and updated_at', () => {
    it('then onSaved gets the saved values and refresh, and onChanged is not called', async () => {
      save.fn.mockResolvedValue({ ok: true, record: { custom_fields: { a: 9 }, custom_fields_version: 3, updated_at: 'u3' } });
      const { ctx, onSaved, onChanged } = setup({ id: 'd1', custom_fields_version: 2 });
      // When
      await act(async () => { await ctx.onSave({ a: 9 }); });
      // Then the version falls back to the record version
      expect(save.fn).toHaveBeenCalledWith('d1', { id: 'd1', custom_fields_version: 2 }, { a: 9 }, 2);
      expect(onSaved).toHaveBeenCalledWith({ a: 9 }, { custom_fields_version: 3, updated_at: 'u3' });
      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe('Given a save response without a record', () => {
    it('then onSaved receives the changed keys, an empty refresh, and the host refetches', async () => {
      save.fn.mockResolvedValue({ ok: true });
      const { ctx, onSaved, onChanged } = setup({ id: 'd1', custom_fields_version: 2 });
      await act(async () => { await ctx.onSave({ a: 1 }, 2); });
      expect(onSaved).toHaveBeenCalledWith({ a: 1 }, {});
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given the saved version did not move', () => {
    it('then the host is asked to refetch', async () => {
      save.fn.mockResolvedValue({ ok: true, record: { custom_fields: {}, custom_fields_version: 2, updated_at: 5 } });
      const { ctx, onSaved, onChanged } = setup({ id: 'd1', custom_fields_version: 2 });
      await act(async () => { await ctx.onSave({}); });
      expect(onSaved).toHaveBeenCalledWith({}, { custom_fields_version: 2 });
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given the original record had no integer version', () => {
    it('then no refetch is requested even without a new version', async () => {
      save.fn.mockResolvedValue({ ok: true, record: { custom_fields_version: 'x' } });
      const { ctx, onSaved, onChanged } = setup({ id: 'd1', updated_at: 'u1' });
      await act(async () => { await ctx.onSave({ b: 2 }); });
      expect(save.fn).toHaveBeenCalledWith('d1', { id: 'd1', updated_at: 'u1' }, { b: 2 }, 'u1');
      expect(onSaved).toHaveBeenCalledWith({ b: 2 }, {});
      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe('Given no host callbacks are supplied', () => {
    it('then a successful save that needs refetch does not throw', async () => {
      save.fn.mockResolvedValue({ ok: true, record: {} });
      const { ctx } = setup({ id: 'd1', custom_fields_version: 1 }, 'd1', false);
      await expect(ctx.onSave({ a: 1 })).resolves.toEqual({ ok: true, record: {} });
    });
  });

  describe('Given the save fails', () => {
    it('then the failure is returned and no callbacks fire', async () => {
      save.fn.mockResolvedValue({ ok: false, error: 'Plate must be text' });
      const { ctx, onSaved, onChanged } = setup({ id: 'd1', custom_fields_version: 1 });
      const res = await ctx.onSave({ a: 1 });
      expect(res).toEqual({ ok: false, error: 'Plate must be text' });
      expect(onSaved).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });
  });
});
