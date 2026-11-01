import React from 'react';
import { type FormFieldSize } from './FormField';
export interface DateRange {
    /** ISO 'YYYY-MM-DD' or '' when unset. */
    start: string;
    end: string;
}
export interface DateRangePreset {
    label: string;
    getRange: (today: Date) => DateRange;
}
/** Built-in presets: Today, Last 7 days, This month, Last quarter. */
export declare const defaultDateRangePresets: DateRangePreset[];
export interface DateRangePickerProps {
    value?: DateRange;
    defaultValue?: DateRange;
    onChange?: (range: DateRange) => void;
    /** Pass false to hide presets, or a custom list. */
    presets?: DateRangePreset[] | false;
    min?: string;
    max?: string;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    size?: FormFieldSize;
    weekStartsOn?: 0 | 1;
    /** Override "today" (tests / SSR). */
    today?: Date;
    'data-testid'?: string;
}
/** Two-month range picker with presets. Click start then end; Esc closes. */
export declare const DateRangePicker: React.FC<DateRangePickerProps>;
