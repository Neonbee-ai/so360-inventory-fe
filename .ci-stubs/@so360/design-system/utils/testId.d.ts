/**
 * Test contract (UI kit): every kit component derives a stable data-testid
 * from its props so E2E drivers never depend on copy or CSS.
 *
 *   testId('field', 'Customer Name')  -> 'field-customer_name'
 *   testId('confirm', 'delete')       -> 'confirm-delete'
 *
 * An explicit `data-testid` passed by the caller always wins — see
 * resolveTestId.
 */
export declare function slugify(value: string): string;
export declare function testId(kind: string, name?: string | null): string;
export declare function resolveTestId(explicit: string | undefined, kind: string, name?: string | null): string;
