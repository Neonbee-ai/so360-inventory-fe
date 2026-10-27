import React from 'react';
import { Alert, Button, Checkbox, IconButton, Select, TextField, FieldGrid, Grid } from '@so360/design-system';
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
                <span className="text-xs text-fg-muted flex items-center gap-1"><Wallet size={12} /> Payment plans</span>
                {!disabled && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => emit([...templates, newPaymentPlanTemplate(templates.length === 0)])}
                        disabled={atMax}
                        title={atMax ? `At most ${MAX_PAYMENT_PLAN_TEMPLATES} payment plans` : undefined}
                    ><Plus size={12} />
                        Add payment plan
                    </Button>
                )}
            </div>

            {templates.length === 0 && (
                <p className="text-xs text-fg-subtle">No payment plans yet.</p>
            )}

            {templates.map((t, ti) => {
                const allPercent = isAllPercent(t.lines);
                const total = percentTotal(t.lines);
                const totalOk = isPercentTotalValid(t.lines);
                const err = templateError(t);
                const n = ti + 1;
                return (
                    <div key={t.id} data-testid={`payment-plan-${ti}`} className="border border-line rounded-lg p-3 space-y-3 bg-surface/40">
                        <div className="flex flex-wrap items-center gap-2">
                            <TextField
                                name={`payment_plan_${n}_name`}
                                aria-label={`Payment plan ${n} name`}
                                className="flex-1 min-w-[10rem]"
                                size="sm"
                                value={t.name}
                                disabled={disabled}
                                placeholder="e.g. 60/40 post-handover"
                                onChange={(e) => patchTemplate(ti, { name: e.target.value })}
                            />
                            <Checkbox
                                name={`payment_plan_${n}_default`}
                                label="Default"
                                aria-label={`Payment plan ${n} default`}
                                checked={t.is_default}
                                disabled={disabled}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefault(ti, e.target.checked)}
                            />
                            {!disabled && (
                                <IconButton
                                    label={`Remove payment plan ${n}`}
                                    icon={<Trash2 size={14} />}
                                    variant="danger"
                                    size="sm"
                                    onClick={() => emit(templates.filter((_, idx) => idx !== ti))}
                                />
                            )}
                        </div>

                        <FieldGrid>
                            <Select
                                name={`payment_plan_${n}_billing`}
                                aria-label={`Payment plan ${n} billing`}
                                size="sm"
                                value={t.billing_mode || ''}
                                disabled={disabled}
                                options={[
                                    { value: '', label: 'Billing: org default' },
                                    ...BILLING_MODES.map((m) => ({ value: m, label: BILLING_MODE_LABEL[m] })),
                                ]}
                                onValueChange={(v: string) => {
                                    patchTemplate(ti, { billing_mode: BILLING_MODES.find((m) => m === v) ?? null });
                                }}
                            />
                            <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Payment plan ${n} payment modes`}>
                                <span className="text-[11px] text-fg-subtle mr-1">{t.allowed_modes ? 'Modes:' : 'Any mode'}</span>
                                {PAYMENT_MODES.map((m) => {
                                    const on = !!t.allowed_modes?.includes(m);
                                    return (
                                        <Button
                                            key={m}
                                            type="button"
                                            variant={on ? 'tonal' : 'ghost'}
                                            size="sm"
                                            aria-pressed={on}
                                            disabled={disabled}
                                            onClick={() => toggleMode(ti, m)}
                                        >
                                            {PAYMENT_MODE_LABEL[m]}
                                        </Button>
                                    );
                                })}
                            </div>
                        </FieldGrid>

                        <div className="space-y-2">
                            {t.lines.map((l, li) => {
                                const field = triggerField(l.trigger);
                                const ln = `Payment plan ${n} instalment ${li + 1}`;
                                return (
                                    <Grid template="2fr 1fr 1fr 2fr 2fr auto" gap="sm" className="items-center" key={li}>
                                        <TextField name={`payment_plan_${n}_line_${li + 1}_label`} aria-label={`${ln} label`} size="sm" value={l.label} disabled={disabled} placeholder="e.g. Down payment"
                                            onChange={(e) => patchLine(ti, li, { ...l, label: e.target.value })} />
                                        <Select name={`payment_plan_${n}_line_${li + 1}_type`} aria-label={`${ln} type`} size="sm" value={l.type} disabled={disabled}
                                            options={[{ value: 'percent', label: '%' }, { value: 'fixed', label: 'Amount' }]}
                                            onValueChange={(v: string) => patchLine(ti, li, { ...l, type: (v === 'fixed' ? 'fixed' : 'percent') as PaymentPlanLineType })} />
                                        <TextField name={`payment_plan_${n}_line_${li + 1}_value`} aria-label={`${ln} value`} type="number" min={0} step="0.01" size="sm"
                                            value={Number.isFinite(l.value) && l.value !== 0 ? l.value : ''} disabled={disabled}
                                            onChange={(e) => {
                                                const v = Number(e.target.value);
                                                patchLine(ti, li, { ...l, value: e.target.value.trim() === '' || !Number.isFinite(v) ? 0 : v });
                                            }} />
                                        <Select name={`payment_plan_${n}_line_${li + 1}_trigger`} aria-label={`${ln} trigger`} size="sm" value={l.trigger} disabled={disabled}
                                            options={INSTALMENT_TRIGGERS.map((trig) => ({ value: trig, label: TRIGGER_LABEL[trig] }))}
                                            onValueChange={(v: string) => {
                                                const trig = INSTALMENT_TRIGGERS.find((x) => x === v) ?? 'booking';
                                                patchLine(ti, li, withTrigger(l, trig));
                                            }} />
                                        {field === 'offset_days' || field === 'offset_months' ? (
                                            <TextField name={`payment_plan_${n}_line_${li + 1}_offset`} aria-label={`${ln} ${field === 'offset_days' ? 'days' : 'months'}`} type="number" min={0} step={1} size="sm"
                                                placeholder={field === 'offset_days' ? 'Days' : 'Months'} value={l.offset ?? ''} disabled={disabled}
                                                onChange={(e) => patchLine(ti, li, { ...l, offset: intOrNull(e.target.value) })} />
                                        ) : field === 'date' ? (
                                            <TextField name={`payment_plan_${n}_line_${li + 1}_date`} aria-label={`${ln} date`} type="date" size="sm" value={(l.date || '').slice(0, 10)} disabled={disabled}
                                                onChange={(e) => patchLine(ti, li, { ...l, date: e.target.value || null })} />
                                        ) : field === 'milestone' ? (
                                            <TextField name={`payment_plan_${n}_line_${li + 1}_milestone`} aria-label={`${ln} milestone`} size="sm" placeholder="e.g. 50% construction" value={l.milestone || ''} disabled={disabled}
                                                onChange={(e) => patchLine(ti, li, { ...l, milestone: e.target.value || null })} />
                                        ) : (
                                            <span />
                                        )}
                                        {!disabled && t.lines.length > 1 ? (
                                            <span className="justify-self-end">
                                                <IconButton label={`Remove ${ln}`} icon={<Trash2 size={14} />} variant="danger" size="sm"
                                                    onClick={() => patchTemplate(ti, { lines: t.lines.filter((_, idx) => idx !== li) })} />
                                            </span>
                                        ) : (
                                            <span />
                                        )}
                                    </Grid>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Add instalment to payment plan ${n}`}
                                    disabled={t.lines.length >= MAX_PAYMENT_PLAN_LINES}
                                    onClick={() => patchTemplate(ti, { lines: [...t.lines, newPaymentPlanLine()] })}
                                ><Plus size={12} />
                                    Add instalment
                                </Button>
                            )}
                            <span
                                data-testid={`payment-plan-${ti}-total`}
                                className={`text-xs font-medium ${allPercent ? (totalOk ? 'text-success' : 'text-danger') : 'text-fg-muted'}`}
                            >
                                {allPercent ? `Total ${total}%` : `Percent lines ${total}% + fixed amounts`}
                            </span>
                        </div>
                        {err && <Alert variant="error">{err}</Alert>}
                    </div>
                );
            })}
        </section>
    );
};

export default PaymentPlanTemplatesEditor;
