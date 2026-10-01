import React from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import {
    BILLING_MODES,
    INSTALMENT_TRIGGERS,
    PAYMENT_MODES,
    type BillingMode,
    type InstalmentTrigger,
    type PaymentMode,
    type PaymentPlanLine,
    type PaymentPlanLineType,
    type PaymentPlanTemplate,
} from '../../types/inventory';
import {
    MAX_PAYMENT_PLAN_LINES,
    MAX_PAYMENT_PLAN_TEMPLATES,
    isAllPercent,
    isPercentTotalValid,
    newPaymentPlanLine,
    newPaymentPlanTemplate,
    percentTotal,
    templateError,
    triggerField,
    withTrigger,
} from '../../utils/paymentPlanTemplates';

const inputCls =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50';

export const TRIGGER_LABEL: Record<InstalmentTrigger, string> = {
    booking: 'On booking',
    fixed_date: 'On a date',
    days_after_booking: 'Days after booking',
    milestone: 'On milestone',
    handover: 'On handover',
    months_after_handover: 'Months after handover',
};

export const BILLING_MODE_LABEL: Record<BillingMode, string> = {
    full_invoice: 'One invoice for the full price',
    invoice_per_instalment: 'Invoice each instalment',
    schedule_only: 'Schedule only (no invoices)',
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
    cash: 'Cash',
    cheque: 'Cheque',
    pdc: 'PDC',
    bank_transfer: 'Bank transfer',
    mortgage: 'Mortgage',
    card: 'Card',
    escrow: 'Escrow',
};

interface PaymentPlanTemplatesEditorProps {
    value: PaymentPlanTemplate[] | null | undefined;
    onChange: (next: PaymentPlanTemplate[] | null) => void;
    disabled?: boolean;
}

/** Whole number from an input's text, or null when blank / not an integer. */
const intOrNull = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
};

/**
 * Structured payment-plan templates for a project (metadata.payment_plan_templates).
 * Controlled — every edit goes straight to `onChange`; an empty list is sent as null.
 */
export const PaymentPlanTemplatesEditor: React.FC<PaymentPlanTemplatesEditorProps> = ({ value, onChange, disabled }) => {
    const templates = value || [];
    const emit = (next: PaymentPlanTemplate[]) => onChange(next.length ? next : null);
    const patchTemplate = (i: number, patch: Partial<PaymentPlanTemplate>) =>
        emit(templates.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
    const patchLine = (ti: number, li: number, next: PaymentPlanLine) =>
        patchTemplate(ti, { lines: templates[ti].lines.map((l, idx) => (idx === li ? next : l)) });

    const setDefault = (i: number, on: boolean) =>
        emit(templates.map((t, idx) => ({ ...t, is_default: idx === i ? on : on ? false : t.is_default })));

    const toggleMode = (i: number, mode: PaymentMode) => {
        const current = templates[i].allowed_modes || [];
        const next = current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode];
        // Nothing picked means "any mode".
        patchTemplate(i, { allowed_modes: next.length ? PAYMENT_MODES.filter((m) => next.includes(m)) : null });
    };

    const atMax = templates.length >= MAX_PAYMENT_PLAN_TEMPLATES;

    return (
        <section className="space-y-3" aria-label="Payment plan templates">
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1"><Wallet size={12} /> Payment plans</span>
                {!disabled && (
                    <button
                        type="button"
                        onClick={() => emit([...templates, newPaymentPlanTemplate(templates.length === 0)])}
                        disabled={atMax}
                        title={atMax ? `At most ${MAX_PAYMENT_PLAN_TEMPLATES} payment plans` : undefined}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={12} /> Add payment plan
                    </button>
                )}
            </div>

            {templates.length === 0 && (
                <p className="text-xs text-slate-500">No payment plans yet.</p>
            )}

            {templates.map((t, ti) => {
                const allPercent = isAllPercent(t.lines);
                const total = percentTotal(t.lines);
                const totalOk = isPercentTotalValid(t.lines);
                const err = templateError(t);
                const n = ti + 1;
                return (
                    <div key={t.id} data-testid={`payment-plan-${ti}`} className="border border-slate-800 rounded-lg p-3 space-y-3 bg-slate-900/40">
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                aria-label={`Payment plan ${n} name`}
                                className={`${inputCls} flex-1 min-w-[10rem]`}
                                value={t.name}
                                disabled={disabled}
                                placeholder="e.g. 60/40 post-handover"
                                onChange={(e) => patchTemplate(ti, { name: e.target.value })}
                            />
                            <label className="flex items-center gap-1 text-xs text-slate-300">
                                <input
                                    type="checkbox"
                                    aria-label={`Payment plan ${n} default`}
                                    checked={t.is_default}
                                    disabled={disabled}
                                    onChange={(e) => setDefault(ti, e.target.checked)}
                                />
                                Default
                            </label>
                            {!disabled && (
                                <button
                                    type="button"
                                    aria-label={`Remove payment plan ${n}`}
                                    onClick={() => emit(templates.filter((_, idx) => idx !== ti))}
                                    className="p-1 text-slate-500 hover:text-rose-400"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <select
                                aria-label={`Payment plan ${n} billing`}
                                className={inputCls}
                                value={t.billing_mode || ''}
                                disabled={disabled}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    patchTemplate(ti, { billing_mode: BILLING_MODES.find((m) => m === v) ?? null });
                                }}
                            >
                                <option value="">Billing: org default</option>
                                {BILLING_MODES.map((m) => (
                                    <option key={m} value={m}>{BILLING_MODE_LABEL[m]}</option>
                                ))}
                            </select>
                            <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Payment plan ${n} payment modes`}>
                                <span className="text-[11px] text-slate-500 mr-1">{t.allowed_modes ? 'Modes:' : 'Any mode'}</span>
                                {PAYMENT_MODES.map((m) => {
                                    const on = !!t.allowed_modes?.includes(m);
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            aria-pressed={on}
                                            disabled={disabled}
                                            onClick={() => toggleMode(ti, m)}
                                            className={`px-2 py-0.5 rounded-full text-[11px] border disabled:opacity-50 ${on ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                        >
                                            {PAYMENT_MODE_LABEL[m]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {t.lines.map((l, li) => {
                                const field = triggerField(l.trigger);
                                const ln = `Payment plan ${n} instalment ${li + 1}`;
                                return (
                                    <div key={li} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_2fr_2fr_auto] gap-2 items-center">
                                        <input aria-label={`${ln} label`} className={inputCls} value={l.label} disabled={disabled} placeholder="e.g. Down payment"
                                            onChange={(e) => patchLine(ti, li, { ...l, label: e.target.value })} />
                                        <select aria-label={`${ln} type`} className={inputCls} value={l.type} disabled={disabled}
                                            onChange={(e) => patchLine(ti, li, { ...l, type: (e.target.value === 'fixed' ? 'fixed' : 'percent') as PaymentPlanLineType })}>
                                            <option value="percent">%</option>
                                            <option value="fixed">Amount</option>
                                        </select>
                                        <input aria-label={`${ln} value`} type="number" min={0} step="0.01" className={inputCls}
                                            value={Number.isFinite(l.value) && l.value !== 0 ? l.value : ''} disabled={disabled}
                                            onChange={(e) => {
                                                const v = Number(e.target.value);
                                                patchLine(ti, li, { ...l, value: e.target.value.trim() === '' || !Number.isFinite(v) ? 0 : v });
                                            }} />
                                        <select aria-label={`${ln} trigger`} className={inputCls} value={l.trigger} disabled={disabled}
                                            onChange={(e) => {
                                                const trig = INSTALMENT_TRIGGERS.find((x) => x === e.target.value) ?? 'booking';
                                                patchLine(ti, li, withTrigger(l, trig));
                                            }}>
                                            {INSTALMENT_TRIGGERS.map((trig) => (
                                                <option key={trig} value={trig}>{TRIGGER_LABEL[trig]}</option>
                                            ))}
                                        </select>
                                        {field === 'offset_days' || field === 'offset_months' ? (
                                            <input aria-label={`${ln} ${field === 'offset_days' ? 'days' : 'months'}`} type="number" min={0} step={1} className={inputCls}
                                                placeholder={field === 'offset_days' ? 'Days' : 'Months'} value={l.offset ?? ''} disabled={disabled}
                                                onChange={(e) => patchLine(ti, li, { ...l, offset: intOrNull(e.target.value) })} />
                                        ) : field === 'date' ? (
                                            <input aria-label={`${ln} date`} type="date" className={inputCls} value={(l.date || '').slice(0, 10)} disabled={disabled}
                                                onChange={(e) => patchLine(ti, li, { ...l, date: e.target.value || null })} />
                                        ) : field === 'milestone' ? (
                                            <input aria-label={`${ln} milestone`} className={inputCls} placeholder="e.g. 50% construction" value={l.milestone || ''} disabled={disabled}
                                                onChange={(e) => patchLine(ti, li, { ...l, milestone: e.target.value || null })} />
                                        ) : (
                                            <span />
                                        )}
                                        {!disabled && t.lines.length > 1 ? (
                                            <button type="button" aria-label={`Remove ${ln}`} className="p-1 text-slate-500 hover:text-rose-400 justify-self-end"
                                                onClick={() => patchTemplate(ti, { lines: t.lines.filter((_, idx) => idx !== li) })}>
                                                <Trash2 size={14} />
                                            </button>
                                        ) : (
                                            <span />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            {!disabled && (
                                <button
                                    type="button"
                                    aria-label={`Add instalment to payment plan ${n}`}
                                    disabled={t.lines.length >= MAX_PAYMENT_PLAN_LINES}
                                    onClick={() => patchTemplate(ti, { lines: [...t.lines, newPaymentPlanLine()] })}
                                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                                >
                                    <Plus size={12} /> Add instalment
                                </button>
                            )}
                            <span
                                data-testid={`payment-plan-${ti}-total`}
                                className={`text-xs font-medium ${allPercent ? (totalOk ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-400'}`}
                            >
                                {allPercent ? `Total ${total}%` : `Percent lines ${total}% + fixed amounts`}
                            </span>
                        </div>
                        {err && <p role="alert" className="text-[11px] text-rose-400">{err}</p>}
                    </div>
                );
            })}
        </section>
    );
};

export default PaymentPlanTemplatesEditor;
