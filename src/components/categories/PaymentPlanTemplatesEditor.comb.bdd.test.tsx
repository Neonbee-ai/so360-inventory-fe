import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PaymentPlanTemplatesEditor } from './PaymentPlanTemplatesEditor';
import type { PaymentPlanTemplate } from '../../types/inventory';

const spy = vi.fn();
const Harness: React.FC<{ initial?: PaymentPlanTemplate[] | null; disabled?: boolean }> = ({ initial = null, disabled }) => {
  const [value, setValue] = useState<PaymentPlanTemplate[] | null>(initial);
  return <PaymentPlanTemplatesEditor value={value} disabled={disabled} onChange={n => { spy(n); setValue(n); }} />;
};
const tpl = (over: Partial<PaymentPlanTemplate> = {}): PaymentPlanTemplate => ({
  id: 't1', name: '60/40', is_default: true, billing_mode: null, allowed_modes: null,
  lines: [{ label: 'Down', type: 'percent', value: 100, trigger: 'booking', offset: null, date: null, milestone: null }], ...over,
});

beforeEach(() => spy.mockReset());

describe('PaymentPlanTemplatesEditor (Comb)', () => {
  it('Given no plans, When rendered, Then the empty hint and Add payment plan button show', () => {
    render(<Harness />);
    expect(screen.getByText('No payment plans yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add payment plan/ })).toBeTruthy();
  });

  it('Given no plans, When Add payment plan is clicked, Then one default plan is emitted', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Add payment plan/ }));
    const next = spy.mock.calls[0][0] as PaymentPlanTemplate[];
    expect(next).toHaveLength(1);
    expect(next[0].is_default).toBe(true);
    expect(screen.getByTestId('payment-plan-0')).toBeTruthy();
  });

  it('Given a valid plan, When rendered, Then the total reads 100% and no error alert shows', () => {
    render(<Harness initial={[tpl()]} />);
    expect(screen.getByTestId('payment-plan-0-total').textContent).toBe('Total 100%');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Given ten plans, When rendered, Then Add payment plan is disabled', () => {
    const ten = Array.from({ length: 10 }, (_, i) => tpl({ id: `t${i}`, is_default: i === 0 }));
    render(<Harness initial={ten} />);
    expect((screen.getByRole('button', { name: /Add payment plan/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
