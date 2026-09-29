/**
 * Payment-plan template rules (metadata.payment_plan_templates) — client mirror of inventory-be.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MAX_PAYMENT_PLAN_LINES,
  MAX_PAYMENT_PLAN_TEMPLATES,
  cleanTemplates,
  isAllPercent,
  isPercentTotalValid,
  lineError,
  newPaymentPlanId,
  newPaymentPlanLine,
  newPaymentPlanTemplate,
  percentTotal,
  templateError,
  templatesError,
  triggerField,
  withTrigger,
} from './paymentPlanTemplates';
import type { PaymentPlanLine, PaymentPlanTemplate } from '../types/inventory';

const line = (over: Partial<PaymentPlanLine> = {}): PaymentPlanLine => ({
  label: 'Down', type: 'percent', value: 100, trigger: 'booking', offset: null, date: null, milestone: null, ...over,
});
const tpl = (over: Partial<PaymentPlanTemplate> = {}): PaymentPlanTemplate => ({
  id: 't1', name: 'Plan', is_default: false, billing_mode: null, allowed_modes: null, lines: [line()], ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe('Given each instalment trigger', () => {
  it('Then the extra input it needs is named', () => {
    expect(triggerField('days_after_booking')).toBe('offset_days');
    expect(triggerField('months_after_handover')).toBe('offset_months');
    expect(triggerField('fixed_date')).toBe('date');
    expect(triggerField('milestone')).toBe('milestone');
    expect(triggerField('booking')).toBeNull();
    expect(triggerField('handover')).toBeNull();
  });
});

describe('Given a line switches trigger', () => {
  it('When moving to a trigger of the same offset kind Then the offset is kept', () => {
    expect(withTrigger(line({ trigger: 'days_after_booking', offset: 30 }), 'days_after_booking').offset).toBe(30);
  });
  it('When moving between days and months Then the offset is cleared', () => {
    expect(withTrigger(line({ trigger: 'days_after_booking', offset: 30 }), 'months_after_handover').offset).toBeNull();
  });
  it('When moving to a date or milestone Then only that field survives', () => {
    const l = line({ trigger: 'milestone', milestone: 'Slab', date: '2027-01-01', offset: 3 });
    expect(withTrigger(l, 'milestone')).toMatchObject({ milestone: 'Slab', date: null, offset: null });
    expect(withTrigger(line({ date: '2027-01-01' }), 'fixed_date')).toMatchObject({ trigger: 'fixed_date', date: '2027-01-01', milestone: null });
    expect(withTrigger(l, 'booking')).toMatchObject({ trigger: 'booking', milestone: null, date: null, offset: null });
  });
});

describe('Given new ids, lines and templates are made', () => {
  it('When crypto.randomUUID exists Then it is used', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
    expect(newPaymentPlanId()).toBe('uuid-1');
  });
  it('When crypto is missing Then a ppt- id is generated', () => {
    vi.stubGlobal('crypto', undefined);
    expect(newPaymentPlanId()).toMatch(/^ppt-/);
  });
  it('Then a new template has one blank percent line and the given default flag', () => {
    expect(newPaymentPlanLine()).toEqual({ label: '', type: 'percent', value: 0, trigger: 'booking', offset: null, date: null, milestone: null });
    const t = newPaymentPlanTemplate(true);
    expect(t).toMatchObject({ name: '', is_default: true, billing_mode: null, allowed_modes: null });
    expect(t.lines).toHaveLength(1);
    expect(newPaymentPlanTemplate(false).is_default).toBe(false);
  });
});

describe('Given percent totals', () => {
  it('Then all-percent needs lines and only percent types', () => {
    expect(isAllPercent([])).toBe(false);
    expect(isAllPercent([line(), line({ type: 'fixed' })])).toBe(false);
    expect(isAllPercent([line()])).toBe(true);
  });
  it('Then the total ignores fixed lines, rounds to 2dp and tolerates 0.01', () => {
    expect(percentTotal([line({ value: 33.333 }), line({ value: 33.333 }), line({ value: 33.334 }), line({ type: 'fixed', value: 5000 })])).toBe(100);
    expect(percentTotal([line({ value: NaN })])).toBe(0);
    expect(isPercentTotalValid([line({ value: 99.99 })])).toBe(true);
    expect(isPercentTotalValid([line({ value: 99.9 })])).toBe(false);
  });
});

describe('Given a line is validated', () => {
  it.each([
    [line({ label: ' ' }), 'Enter a label'],
    [line({ value: 0 }), 'Enter an amount above 0'],
    [line({ value: Infinity }), 'Enter an amount above 0'],
    [line({ value: '5' as unknown as number }), 'Enter an amount above 0'],
    [line({ value: 101 }), 'A percentage cannot exceed 100'],
    [line({ trigger: 'days_after_booking', offset: null }), 'Enter whole days (0 or more)'],
    [line({ trigger: 'days_after_booking', offset: 1.5 }), 'Enter whole days (0 or more)'],
    [line({ trigger: 'months_after_handover', offset: -1 }), 'Enter whole months (0 or more)'],
    [line({ trigger: 'months_after_handover', offset: 40000 }), 'Enter whole months (0 or more)'],
    [line({ trigger: 'fixed_date', date: null }), 'Pick a date'],
    [line({ trigger: 'fixed_date', date: '01/02/2027' }), 'Pick a date'],
    [line({ trigger: 'milestone', milestone: ' ' }), 'Name the milestone'],
  ])('When it is invalid Then the first problem is returned (%#)', (l, msg) => {
    expect(lineError(l)).toBe(msg);
  });
  it('When it is valid Then there is no error', () => {
    expect(lineError(line({ type: 'fixed', value: 250000 }))).toBeNull();
    expect(lineError(line({ trigger: 'days_after_booking', offset: 0 }))).toBeNull();
    expect(lineError(line({ trigger: 'fixed_date', date: '2027-01-01T00:00:00Z' }))).toBeNull();
    expect(lineError(line({ trigger: 'milestone', milestone: 'Slab' }))).toBeNull();
  });
});

describe('Given a template is validated', () => {
  it.each([
    [tpl({ name: '' }), 'Give the template a name'],
    [tpl({ lines: [] }), 'Add at least one instalment'],
    [tpl({ lines: Array.from({ length: MAX_PAYMENT_PLAN_LINES + 1 }, () => line({ value: 1 })) }), `At most ${MAX_PAYMENT_PLAN_LINES} instalments`],
    [tpl({ allowed_modes: [] }), 'Pick at least one payment mode, or allow all'],
    [tpl({ lines: [line(), line({ label: '' })] }), 'Instalment 2: Enter a label'],
    [tpl({ lines: [line({ value: 60 }), line({ value: 30 })] }), 'Percentages add up to 90% — they must total 100%'],
  ])('When it is invalid Then the problem is named (%#)', (t, msg) => {
    expect(templateError(t)).toBe(msg);
  });
  it('When percent and fixed lines mix Then the total is not enforced', () => {
    expect(templateError(tpl({ lines: [line({ value: 10 }), line({ type: 'fixed', value: 1000 })] }))).toBeNull();
  });
});

describe('Given a list of templates is validated', () => {
  it('Then empty lists are fine', () => {
    expect(templatesError(null)).toBeNull();
    expect(templatesError([])).toBeNull();
  });
  it('Then more than the max is refused', () => {
    const list = Array.from({ length: MAX_PAYMENT_PLAN_TEMPLATES + 1 }, (_, i) => tpl({ id: `t${i}` }));
    expect(templatesError(list)).toBe(`At most ${MAX_PAYMENT_PLAN_TEMPLATES} payment plan templates`);
  });
  it('Then two defaults are refused', () => {
    expect(templatesError([tpl({ is_default: true }), tpl({ id: 't2', is_default: true })])).toBe('Only one payment plan can be the default');
  });
  it('Then a bad template is named, or numbered when unnamed', () => {
    expect(templatesError([tpl({ name: 'Easy', lines: [] })])).toBe('Payment plan "Easy": Add at least one instalment');
    expect(templatesError([tpl(), tpl({ id: 't2', name: ' ' })])).toBe('Payment plan "#2": Give the template a name');
  });
  it('Then a valid list has no error', () => {
    expect(templatesError([tpl({ is_default: true })])).toBeNull();
  });
});

describe('Given templates are cleaned before save', () => {
  it('Then an empty list becomes null', () => {
    expect(cleanTemplates(undefined)).toBeNull();
    expect(cleanTemplates([])).toBeNull();
  });
  it('Then names, labels and milestones are trimmed', () => {
    const out = cleanTemplates([tpl({ name: ' A ', lines: [line({ label: ' L ', milestone: ' M ' }), line({ milestone: null })] })]);
    expect(out![0].name).toBe('A');
    expect(out![0].lines[0]).toMatchObject({ label: 'L', milestone: 'M' });
    expect(out![0].lines[1].milestone).toBeNull();
  });
});
