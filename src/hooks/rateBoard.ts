import type { RateBoardEntry, RateBoardEntryInput } from '../services/inventoryService';

/** Feature flag that turns on the date-effective Rate Board. */
export const RATE_BOARD_FLAG = 'submodule:inventory:rate_board';

export const isRateBoardEnabled = (shell: any): boolean =>
    shell?.isFeatureEnabled?.(RATE_BOARD_FLAG) === true;

/** Local calendar date as YYYY-MM-DD. */
export const toIsoDate = (d: Date): string => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
};

/** Stable row key: the variant when there is one, else the item. */
export const rowKey = (e: Pick<RateBoardEntry, 'item_id' | 'variant_id'>): string =>
    e.variant_id ? `${e.item_id}:${e.variant_id}` : e.item_id;

/** Percent change rounded to 2 decimals; null when there is no usable base. */
export const changePct = (previous: number | null, current: number | null): number | null => {
    if (previous == null || current == null || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 10000) / 100;
};

/**
 * Rows whose draft price differs from the loaded price. Blank or invalid
 * drafts are skipped so a stray clear never zeroes a price.
 */
export const changedEntries = (
    entries: RateBoardEntry[],
    drafts: Record<string, string>,
): RateBoardEntryInput[] => {
    const out: RateBoardEntryInput[] = [];
    for (const e of entries) {
        const raw = drafts[rowKey(e)];
        if (raw == null || raw.trim() === '') continue;
        const price = Number(raw);
        if (!Number.isFinite(price) || price < 0) continue;
        if (e.price != null && price === Number(e.price)) continue;
        out.push({
            item_id: e.item_id,
            variant_id: e.variant_id ?? null,
            price,
            ...(e.unit ? { unit: e.unit } : {}),
        });
    }
    return out;
};

// ==================== Daily rates tab helpers ====================

/** Server cap on entries per rate-board save (MAX_RATE_BOARD_ENTRIES). */
export const RATE_SAVE_CHUNK = 2000;
/** A change larger than this (either way) is flagged on the review screen. */
export const JUMP_WARN_PCT = 15;

export type ShiftMode = 'pct' | 'amount';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Shifts a price by a percentage or a fixed amount; never below zero. */
export const shiftPrice = (price: number, mode: ShiftMode, by: number): number =>
    Math.max(0, round2(mode === 'pct' ? price * (1 + by / 100) : price + by));

/** The price a row shows now: a valid draft, else the loaded price. */
export const currentPrice = (e: RateBoardEntry, drafts: Record<string, string>): number | null => {
    const raw = drafts[rowKey(e)];
    if (raw != null && raw.trim() !== '') {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) return n;
    }
    return e.price != null ? Number(e.price) : null;
};

/**
 * Drafts after shifting every row whose item is in `itemIds` (all rows when
 * null). Rows with no price yet are left alone.
 */
export const applyShift = (
    entries: RateBoardEntry[],
    drafts: Record<string, string>,
    itemIds: Set<string> | null,
    mode: ShiftMode,
    by: number,
): Record<string, string> => {
    const next = { ...drafts };
    if (!Number.isFinite(by) || by === 0) return next;
    for (const e of entries) {
        if (itemIds && !itemIds.has(e.item_id)) continue;
        const base = currentPrice(e, drafts);
        if (base == null) continue;
        next[rowKey(e)] = String(shiftPrice(base, mode, by));
    }
    return next;
};

export const RATES_CSV_HEADER = ['item_id', 'sku', 'name', 'unit', 'price'] as const;

const csvCell = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of the board as shown (drafts applied). item_id is the row key (item:variant for variants). */
export const toRatesCsv = (entries: RateBoardEntry[], drafts: Record<string, string>): string => {
    const lines = [RATES_CSV_HEADER.join(',')];
    for (const e of entries) {
        const p = currentPrice(e, drafts);
        lines.push([rowKey(e), e.sku ?? '', e.item_name, e.unit ?? '', p == null ? '' : p].map(csvCell).join(','));
    }
    return lines.join('\n') + '\n';
};

/** Minimal RFC 4180 parser: quoted cells, doubled quotes, CRLF or LF. */
export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    const src = text.replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (quoted) {
            if (ch === '"') {
                if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
            } else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
};

export interface CsvRowError { line: number; message: string }

/**
 * Validates an uploaded rates CSV row by row against the board. Rows match by
 * item_id (row key) first, else by SKU. Unknown items, blank and negative or
 * non-numeric prices are reported; valid rows come back as drafts.
 */
export const parseRatesCsv = (
    text: string,
    entries: RateBoardEntry[],
): { drafts: Record<string, string>; errors: CsvRowError[]; rows: number } => {
    const rows = parseCsv(text);
    const errors: CsvRowError[] = [];
    const drafts: Record<string, string> = {};
    if (rows.length === 0) return { drafts, errors: [{ line: 1, message: 'File is empty' }], rows: 0 };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const iPrice = col('price');
    const iId = col('item_id');
    const iSku = col('sku');
    if (iPrice < 0 || (iId < 0 && iSku < 0)) {
        return { drafts, errors: [{ line: 1, message: 'Header must include price and item_id or sku' }], rows: 0 };
    }
    const byKey = new Map(entries.map((e) => [rowKey(e), e]));
    const bySku = new Map<string, RateBoardEntry>();
    for (const e of entries) if (e.sku) bySku.set(e.sku.trim().toLowerCase(), e);
    for (let r = 1; r < rows.length; r++) {
        const line = r + 1;
        const cells = rows[r];
        const id = iId >= 0 ? (cells[iId] ?? '').trim() : '';
        const sku = iSku >= 0 ? (cells[iSku] ?? '').trim() : '';
        const entry = (id && byKey.get(id)) || (sku && bySku.get(sku.toLowerCase())) || null;
        if (!entry) { errors.push({ line, message: `Unknown item ${sku || id || '(no id or SKU)'}` }); continue; }
        const raw = (cells[iPrice] ?? '').trim();
        if (raw === '') { errors.push({ line, message: `Blank price for ${entry.sku || entry.item_name}` }); continue; }
        const n = Number(raw);
        if (!Number.isFinite(n)) { errors.push({ line, message: `Invalid price "${raw}" for ${entry.sku || entry.item_name}` }); continue; }
        if (n < 0) { errors.push({ line, message: `Negative price for ${entry.sku || entry.item_name}` }); continue; }
        drafts[rowKey(entry)] = String(n);
    }
    return { drafts, errors, rows: rows.length - 1 };
};

export interface ReviewSummary {
    change: number;
    up: number;
    down: number;
    unchanged: number;
    largest: { name: string; pct: number } | null;
}

/** Counts for the review-before-save screen. */
export const reviewSummary = (entries: RateBoardEntry[], drafts: Record<string, string>): ReviewSummary => {
    const pending = changedEntries(entries, drafts);
    const changed = new Set(pending.map((p) => rowKey({ item_id: p.item_id, variant_id: p.variant_id ?? null })));
    let up = 0;
    let down = 0;
    let unchanged = 0;
    let largest: ReviewSummary['largest'] = null;
    for (const e of entries) {
        const key = rowKey(e);
        if (!changed.has(key)) {
            if (drafts[key] != null && drafts[key].trim() !== '') unchanged++;
            continue;
        }
        const next = Number(drafts[key]);
        const prev = e.price != null ? Number(e.price) : null;
        if (prev == null || next > prev) up++; else down++;
        const pct = changePct(prev, next);
        if (pct != null && (!largest || Math.abs(pct) > Math.abs(largest.pct))) largest = { name: e.item_name, pct };
    }
    return { change: pending.length, up, down, unchanged, largest };
};

export const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};
