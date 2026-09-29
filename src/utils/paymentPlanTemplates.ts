import type {
    InstalmentTrigger,
    PaymentPlanLine,
    PaymentPlanTemplate,
} from '../types/inventory';

/**
 * Client-side mirror of the backend's metadata.payment_plan_templates rules
 * (inventory-be settings/payment-plan-templates.ts) so the editor can flag a
 * bad template before Save instead of surfacing a 400.
 */
export const MAX_PAYMENT_PLAN_TEMPLATES = 10;
export const MAX_PAYMENT_PLAN_LINES = 50;
export const PERCENT_SUM_TOLERANCE = 0.01;
const MAX_OFFSET = 36_500;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Which extra input a trigger needs. */
export type TriggerField = 'offset_days' | 'offset_months' | 'date' | 'milestone' | null;

export const triggerField = (trigger: InstalmentTrigger): TriggerField => {
    switch (trigger) {
        case 'days_after_booking': return 'offset_days';
        case 'months_after_handover': return 'offset_months';
        case 'fixed_date': return 'date';
        case 'milestone': return 'milestone';
        default: return null;
    }
};

/** Switch a line's trigger, clearing the inputs the new trigger does not use. */
export const withTrigger = (line: PaymentPlanLine, trigger: InstalmentTrigger): PaymentPlanLine => {
    const field = triggerField(trigger);
    const keepsOffset = field === 'offset_days' || field === 'offset_months';
    return {
        ...line,
        trigger,
        offset: keepsOffset && triggerField(line.trigger) === field ? line.offset : null,
        date: field === 'date' ? line.date : null,
        milestone: field === 'milestone' ? line.milestone : null,
    };
};

export const newPaymentPlanId = (): string => {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `ppt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const newPaymentPlanLine = (): PaymentPlanLine => ({
    label: '',
    type: 'percent',
    value: 0,
    trigger: 'booking',
    offset: null,
    date: null,
    milestone: null,
});

export const newPaymentPlanTemplate = (isDefault: boolean): PaymentPlanTemplate => ({
    id: newPaymentPlanId(),
    name: '',
    is_default: isDefault,
    billing_mode: null,
    allowed_modes: null,
    lines: [newPaymentPlanLine()],
});

/** True when the template has lines and every one is a percentage. */
export const isAllPercent = (lines: PaymentPlanLine[]): boolean =>
    lines.length > 0 && lines.every((l) => l.type === 'percent');

export const percentTotal = (lines: PaymentPlanLine[]): number =>
    Math.round(lines.filter((l) => l.type === 'percent').reduce((sum, l) => sum + (Number(l.value) || 0), 0) * 100) / 100;

export const isPercentTotalValid = (lines: PaymentPlanLine[]): boolean =>
    Math.abs(percentTotal(lines) - 100) <= PERCENT_SUM_TOLERANCE;

const blank = (v: string | null | undefined) => !v || !v.trim();

/** The first problem with one line, or null. */
export function lineError(line: PaymentPlanLine): string | null {
    if (blank(line.label)) return 'Enter a label';
    if (typeof line.value !== 'number' || !Number.isFinite(line.value) || line.value <= 0) return 'Enter an amount above 0';
    if (line.type === 'percent' && line.value > 100) return 'A percentage cannot exceed 100';
    const field = triggerField(line.trigger);
    if (field === 'offset_days' || field === 'offset_months') {
        const o = line.offset;
        if (typeof o !== 'number' || !Number.isInteger(o) || o < 0 || o > MAX_OFFSET) {
            return field === 'offset_days' ? 'Enter whole days (0 or more)' : 'Enter whole months (0 or more)';
        }
    }
    if (field === 'date' && (blank(line.date) || !ISO_DATE_RE.test(String(line.date).slice(0, 10)))) return 'Pick a date';
    if (field === 'milestone' && blank(line.milestone)) return 'Name the milestone';
    return null;
}

/** The first problem with one template, or null. */
export function templateError(t: PaymentPlanTemplate): string | null {
    if (blank(t.name)) return 'Give the template a name';
    if (!t.lines.length) return 'Add at least one instalment';
    if (t.lines.length > MAX_PAYMENT_PLAN_LINES) return `At most ${MAX_PAYMENT_PLAN_LINES} instalments`;
    if (t.allowed_modes && t.allowed_modes.length === 0) return 'Pick at least one payment mode, or allow all';
    for (let i = 0; i < t.lines.length; i++) {
        const err = lineError(t.lines[i]);
        if (err) return `Instalment ${i + 1}: ${err}`;
    }
    if (isAllPercent(t.lines) && !isPercentTotalValid(t.lines)) {
        return `Percentages add up to ${percentTotal(t.lines)}% — they must total 100%`;
    }
    return null;
}

/** The first problem across the list (named by template), or null. */
export function templatesError(list: PaymentPlanTemplate[] | null | undefined): string | null {
    if (!list || !list.length) return null;
    if (list.length > MAX_PAYMENT_PLAN_TEMPLATES) return `At most ${MAX_PAYMENT_PLAN_TEMPLATES} payment plan templates`;
    if (list.filter((t) => t.is_default).length > 1) return 'Only one payment plan can be the default';
    for (let i = 0; i < list.length; i++) {
        const err = templateError(list[i]);
        if (err) return `Payment plan "${list[i].name.trim() || `#${i + 1}`}": ${err}`;
    }
    return null;
}

/** Trim text fields before saving; an empty list is stored as null. */
export function cleanTemplates(list: PaymentPlanTemplate[] | null | undefined): PaymentPlanTemplate[] | null {
    if (!list || !list.length) return null;
    return list.map((t) => ({
        ...t,
        name: t.name.trim(),
        lines: t.lines.map((l) => ({
            ...l,
            label: l.label.trim(),
            milestone: l.milestone === null ? null : l.milestone.trim(),
        })),
    }));
}
