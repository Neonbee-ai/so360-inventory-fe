/**
 * Maps the inventory DELETE /items/:id response (or error) to the notice the
 * user sees. The backend either deletes the product, archives it when it has
 * stock movement history ({ archived: true }), or blocks with 400 (stock or
 * reservations remain) / 409 (purchase order lines or other references).
 */
export type ItemDeleteOutcome = {
    tone: 'success' | 'info' | 'error';
    kind: 'deleted' | 'archived' | 'blocked-stock' | 'blocked-in-use' | 'failed';
    message: string;
};

export function describeItemDeleteResult(result: any, itemName?: string): ItemDeleteOutcome {
    const name = itemName ? `"${itemName}"` : 'Product';
    if (result && result.archived === true) {
        return {
            tone: 'info',
            kind: 'archived',
            message:
                (typeof result.message === 'string' && result.message) ||
                `${name} has stock history, so it was archived instead of deleted. It is hidden from active lists and its audit trail is kept.`,
        };
    }
    return { tone: 'success', kind: 'deleted', message: `${name} was deleted.` };
}

export function describeItemDeleteError(err: any): ItemDeleteOutcome {
    const status = err?.status;
    const reason = typeof err?.message === 'string' && err.message ? err.message : '';
    if (status === 400) {
        return {
            tone: 'error',
            kind: 'blocked-stock',
            message: `Can't delete this product: ${reason || 'stock or reservations remain.'}`,
        };
    }
    if (status === 409) {
        return {
            tone: 'error',
            kind: 'blocked-in-use',
            message: `Can't delete this product: ${reason || 'it is used by other records.'}`,
        };
    }
    return { tone: 'error', kind: 'failed', message: reason || 'Failed to delete item' };
}
