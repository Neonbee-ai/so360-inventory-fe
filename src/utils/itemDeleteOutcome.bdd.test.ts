import { describe, it, expect } from 'vitest';
import { describeItemDeleteResult, describeItemDeleteError } from './itemDeleteOutcome';

describe('describeItemDeleteResult', () => {
  it('Given a normal delete response / When described / Then it is a "deleted" success naming the product', () => {
    const o = describeItemDeleteResult({ success: true, archived: false }, 'Widget');
    expect(o).toEqual({ tone: 'success', kind: 'deleted', message: '"Widget" was deleted.' });
  });

  it('Given an archived response with a backend message / When described / Then it is an "archived" notice using that message', () => {
    const o = describeItemDeleteResult({ archived: true, message: 'Archived because of stock history.' }, 'Widget');
    expect(o).toEqual({ tone: 'info', kind: 'archived', message: 'Archived because of stock history.' });
  });

  it('Given an archived response without a message / When described / Then it explains the archive itself', () => {
    const o = describeItemDeleteResult({ archived: true }, 'Widget');
    expect(o.kind).toBe('archived');
    expect(o.message).toContain('"Widget" has stock history, so it was archived instead of deleted');
  });

  it('Given an empty response and no name / When described / Then it is a generic "deleted" success', () => {
    expect(describeItemDeleteResult(undefined).message).toBe('Product was deleted.');
  });
});

describe('describeItemDeleteError', () => {
  it('Given a 400 with a reason / When described / Then it is "blocked-stock" with the backend reason', () => {
    const o = describeItemDeleteError({ status: 400, message: 'Remove the remaining stock first.' });
    expect(o).toEqual({ tone: 'error', kind: 'blocked-stock', message: "Can't delete this product: Remove the remaining stock first." });
  });

  it('Given a 400 without a reason / When described / Then it falls back to the stock explanation', () => {
    expect(describeItemDeleteError({ status: 400 }).message).toBe("Can't delete this product: stock or reservations remain.");
  });

  it('Given a 409 with a reason / When described / Then it is "blocked-in-use" with the backend reason', () => {
    const o = describeItemDeleteError({ status: 409, message: 'Referenced by purchase order lines.' });
    expect(o).toEqual({ tone: 'error', kind: 'blocked-in-use', message: "Can't delete this product: Referenced by purchase order lines." });
  });

  it('Given a 409 without a reason / When described / Then it falls back to the in-use explanation', () => {
    expect(describeItemDeleteError({ status: 409 }).message).toBe("Can't delete this product: it is used by other records.");
  });

  it('Given another error / When described / Then it is "failed" with the error message', () => {
    expect(describeItemDeleteError(new Error('Network down'))).toEqual({ tone: 'error', kind: 'failed', message: 'Network down' });
  });

  it('Given an error without a message / When described / Then it uses the generic fallback', () => {
    expect(describeItemDeleteError({}).message).toBe('Failed to delete item');
  });
});
