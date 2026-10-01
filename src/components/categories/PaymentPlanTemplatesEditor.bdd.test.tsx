/**
 * PaymentPlanTemplatesEditor — structured project payment plans (metadata.payment_plan_templates).
 */
import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PaymentPlanTemplatesEditor, TRIGGER_LABEL, BILLING_MODE_LABEL, PAYMENT_MODE_LABEL } from './PaymentPlanTemplatesEditor';
import type { PaymentPlanLine, PaymentPlanTemplate } from '../../types/inventory';

const onChangeSpy = vi.fn();

const Harness: React.FC<{ initial?: PaymentPlanTemplate[] | null; disabled?: boolean }> = ({ initial = null, disabled }) => {
  const [value, setValue] = useState<PaymentPlanTemplate[] | null>(initial);
  return <PaymentPlanTemplatesEditor value={value} disabled={disabled} onChange={(n) => { onChangeSpy(n); setValue(n); }} />;
};

const line = (over: Partial<PaymentPlanLine> = {}): PaymentPlanLine => ({
  label: 'Down', type: 'percent', value: 100, trigger: 'booking', offset: null, date: null, milestone: null, ...over,
});
const tpl = (over: Partial<PaymentPlanTemplate> = {}): PaymentPlanTemplate => ({
  id: 't1', name: '60/40', is_default: true, billing_mode: null, allowed_modes: null, lines: [line()], ...over,
});
const last = () => onChangeSpy.mock.calls[onChangeSpy.mock.calls.length - 1][0] as PaymentPlanTemplate[] | null;
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => onChangeSpy.mockReset());

describe('Given the label maps', () => {
  it('Then every trigger, billing mode and payment mode has a label', () => {
    expect(Object.values(TRIGGER_LABEL)).toHaveLength(6);
    expect(Object.values(BILLING_MODE_LABEL)).toHaveLength(3);
    expect(Object.values(PAYMENT_MODE_LABEL)).toHaveLength(7);
  });
});

describe('Given no payment plans', () => {
  it('Then an empty hint shows', () => {
    render(<Harness />);
    expect(screen.getByText('No payment plans yet.')).toBeTruthy();
  });

  describe('When two plans are added', () => {
    it('Then only the first is the default', () => {
      render(<Harness />);
      fireEvent.click(screen.getByRole('button', { name: /Add payment plan/ }));
      fireEvent.click(screen.getByRole('button', { name: /Add payment plan/ }));
      const list = last()!;
      expect(list).toHaveLength(2);
      expect(list.map((t) => t.is_default)).toEqual([true, false]);
      expect(screen.getByTestId('payment-plan-1')).toBeTruthy();
    });
  });
});

describe('Given ten plans already', () => {
  it('Then Add payment plan is disabled', () => {
    const ten = Array.from({ length: 10 }, (_, i) => tpl({ id: `t${i}`, is_default: i === 0 }));
    render(<Harness initial={ten} />);
    const add = screen.getByRole('button', { name: /Add payment plan/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.title).toBe('At most 10 payment plans');
  });
});

describe('Given one valid plan', () => {
  it('Then the total is 100% in green and no error shows', () => {
    render(<Harness initial={[tpl()]} />);
    const total = screen.getByTestId('payment-plan-0-total');
    expect(total.textContent).toBe('Total 100%');
    expect(total.className).toContain('emerald');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByLabelText('Remove Payment plan 1 instalment 1')).toBeNull();
  });

  describe('When the name, billing and default change', () => {
    it('Then each edit is emitted', () => {
      render(<Harness initial={[tpl()]} />);
      change('Payment plan 1 name', 'Easy');
      expect(last()![0].name).toBe('Easy');
      change('Payment plan 1 billing', 'invoice_per_instalment');
      expect(last()![0].billing_mode).toBe('invoice_per_instalment');
      change('Payment plan 1 billing', '');
      expect(last()![0].billing_mode).toBeNull();
      fireEvent.click(screen.getByLabelText('Payment plan 1 default'));
      expect(last()![0].is_default).toBe(false);
    });
  });

  describe('When payment modes are toggled', () => {
    it('Then picks are kept in catalogue order and none means any mode', () => {
      render(<Harness initial={[tpl()]} />);
      const group = screen.getByRole('group', { name: 'Payment plan 1 payment modes' });
      expect(within(group).getByText('Any mode')).toBeTruthy();
      fireEvent.click(within(group).getByRole('button', { name: 'Mortgage' }));
      fireEvent.click(within(group).getByRole('button', { name: 'Cash' }));
      expect(last()![0].allowed_modes).toEqual(['cash', 'mortgage']);
      expect(within(group).getByRole('button', { name: 'Cash' }).getAttribute('aria-pressed')).toBe('true');
      expect(within(group).getByText('Modes:')).toBeTruthy();
      fireEvent.click(within(group).getByRole('button', { name: 'Cash' }));
      fireEvent.click(within(group).getByRole('button', { name: 'Mortgage' }));
      expect(last()![0].allowed_modes).toBeNull();
    });
  });

  describe('When the plan is removed', () => {
    it('Then the list becomes null', () => {
      render(<Harness initial={[tpl()]} />);
      fireEvent.click(screen.getByLabelText('Remove payment plan 1'));
      expect(last()).toBeNull();
    });
  });
});

describe('Given two plans', () => {
  it('When the second is made default Then the first is unset', () => {
    render(<Harness initial={[tpl(), tpl({ id: 't2', name: 'B', is_default: false })]} />);
    fireEvent.click(screen.getByLabelText('Payment plan 2 default'));
    expect(last()!.map((t) => t.is_default)).toEqual([false, true]);
  });
  it('When the second is unchecked Then the others keep their flag', () => {
    render(<Harness initial={[tpl({ is_default: false }), tpl({ id: 't2', name: 'B', is_default: true })]} />);
    fireEvent.click(screen.getByLabelText('Payment plan 2 default'));
    expect(last()!.map((t) => t.is_default)).toEqual([false, false]);
  });
});

describe('Given instalment lines are edited', () => {
  it('When a line is added and the split is 60/30 Then the total is red with an error', () => {
    render(<Harness initial={[tpl({ lines: [line({ value: 60 })] })]} />);
    fireEvent.click(screen.getByLabelText('Add instalment to payment plan 1'));
    change('Payment plan 1 instalment 2 label', 'Handover');
    change('Payment plan 1 instalment 2 value', '30');
    const total = screen.getByTestId('payment-plan-0-total');
    expect(total.textContent).toBe('Total 90%');
    expect(total.className).toContain('rose');
    expect(screen.getByRole('alert').textContent).toBe('Percentages add up to 90% — they must total 100%');
  });

  it('When a value is cleared or not a number Then it is stored as 0 and shown blank', () => {
    render(<Harness initial={[tpl()]} />);
    change('Payment plan 1 instalment 1 value', '');
    expect(last()![0].lines[0].value).toBe(0);
    expect((screen.getByLabelText('Payment plan 1 instalment 1 value') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('alert').textContent).toBe('Instalment 1: Enter an amount above 0');
  });

  it('When a line becomes a fixed amount Then the total notes fixed amounts', () => {
    render(<Harness initial={[tpl({ lines: [line({ value: 10 }), line()] })]} />);
    change('Payment plan 1 instalment 2 type', 'fixed');
    expect(last()![0].lines[1].type).toBe('fixed');
    expect(screen.getByTestId('payment-plan-0-total').textContent).toBe('Percent lines 10% + fixed amounts');
    change('Payment plan 1 instalment 2 type', 'percent');
    expect(last()![0].lines[1].type).toBe('percent');
  });

  it('When a line is removed Then the rest remain', () => {
    render(<Harness initial={[tpl({ lines: [line({ label: 'A', value: 50 }), line({ label: 'B', value: 50 })] })]} />);
    fireEvent.click(screen.getByLabelText('Remove Payment plan 1 instalment 1'));
    expect(last()![0].lines.map((l) => l.label)).toEqual(['B']);
  });
});

describe('Given each trigger needs its own input', () => {
  it('When days after booking is picked Then a whole-days input shows', () => {
    render(<Harness initial={[tpl()]} />);
    change('Payment plan 1 instalment 1 trigger', 'days_after_booking');
    expect(screen.getByRole('alert').textContent).toBe('Instalment 1: Enter whole days (0 or more)');
    change('Payment plan 1 instalment 1 days', '30');
    expect(last()![0].lines[0].offset).toBe(30);
    change('Payment plan 1 instalment 1 days', '1.5');
    expect(last()![0].lines[0].offset).toBeNull();
    change('Payment plan 1 instalment 1 days', '');
    expect(last()![0].lines[0].offset).toBeNull();
  });

  it('When months after handover is picked Then a months input shows', () => {
    render(<Harness initial={[tpl()]} />);
    change('Payment plan 1 instalment 1 trigger', 'months_after_handover');
    change('Payment plan 1 instalment 1 months', '6');
    expect(last()![0].lines[0]).toMatchObject({ trigger: 'months_after_handover', offset: 6 });
  });

  it('When a fixed date is picked Then a date input shows and clearing it stores null', () => {
    render(<Harness initial={[tpl()]} />);
    change('Payment plan 1 instalment 1 trigger', 'fixed_date');
    change('Payment plan 1 instalment 1 date', '2027-03-01');
    expect(last()![0].lines[0].date).toBe('2027-03-01');
    change('Payment plan 1 instalment 1 date', '');
    expect(last()![0].lines[0].date).toBeNull();
  });

  it('When a milestone is picked Then a milestone input shows and clearing it stores null', () => {
    render(<Harness initial={[tpl()]} />);
    change('Payment plan 1 instalment 1 trigger', 'milestone');
    change('Payment plan 1 instalment 1 milestone', 'Slab');
    expect(last()![0].lines[0].milestone).toBe('Slab');
    change('Payment plan 1 instalment 1 milestone', '');
    expect(last()![0].lines[0].milestone).toBeNull();
  });

  it('When an unknown trigger value arrives Then booking is used', () => {
    render(<Harness initial={[tpl({ lines: [line({ trigger: 'milestone', milestone: 'X' })] })]} />);
    const select = screen.getByLabelText('Payment plan 1 instalment 1 trigger') as HTMLSelectElement;
    const opt = document.createElement('option');
    opt.value = 'bogus';
    select.appendChild(opt);
    fireEvent.change(select, { target: { value: 'bogus' } });
    expect(last()![0].lines[0]).toMatchObject({ trigger: 'booking', milestone: null });
  });
});

describe('Given fifty instalments', () => {
  it('Then Add instalment is disabled', () => {
    const lines = Array.from({ length: 50 }, () => line({ value: 2 }));
    render(<Harness initial={[tpl({ lines })]} />);
    expect((screen.getByLabelText('Add instalment to payment plan 1') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Given the editor is disabled', () => {
  it('Then add/remove controls are hidden and inputs are disabled', () => {
    render(<Harness disabled initial={[tpl({ lines: [line({ value: 50 }), line({ value: 50 })] })]} />);
    expect(screen.queryByRole('button', { name: /Add payment plan/ })).toBeNull();
    expect(screen.queryByLabelText('Remove payment plan 1')).toBeNull();
    expect(screen.queryByLabelText('Add instalment to payment plan 1')).toBeNull();
    expect(screen.queryByLabelText('Remove Payment plan 1 instalment 1')).toBeNull();
    expect((screen.getByLabelText('Payment plan 1 name') as HTMLInputElement).disabled).toBe(true);
  });
});
