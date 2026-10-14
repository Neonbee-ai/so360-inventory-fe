/** Pure native-Date helpers shared by the date/time inputs (no external deps). ISO = 'YYYY-MM-DD' local. */
export declare function toISO(d: Date): string;
export declare function parseISO(s: string | null | undefined): Date | null;
/** 'DD/MM/YYYY' -> ISO, or null when not a real calendar date. */
export declare function parseDisplay(s: string): string | null;
export declare function isoToDisplay(iso: string): string;
/** Digits-only input -> DD/MM/YYYY mask. */
export declare function maskDate(raw: string): string;
export declare function startOfMonth(d: Date): Date;
export declare function addDays(d: Date, n: number): Date;
export declare function addMonths(d: Date, n: number): Date;
export declare function sameMonth(a: Date, b: Date): boolean;
export declare function formatLong(d: Date, locale?: string): string;
export declare function formatShort(iso: string, locale?: string): string;
/** True when ISO is outside [min, max] (either bound optional). */
export declare function outOfRange(iso: string, min?: string, max?: string): boolean;
