import React from 'react';
import { type TimeFormat } from './TimePicker';
export interface DateTimePickerProps {
    /** Local ISO 'YYYY-MM-DDTHH:mm' ('' = empty). Controlled when provided. */
    value?: string;
    defaultValue?: string;
    onChange?: (dateTime: string) => void;
    /** Time applied when a date is chosen before a time (default '09:00'). */
    defaultTime?: string;
    minDate?: string;
    maxDate?: string;
    format?: TimeFormat;
    step?: number;
    label: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    today?: Date;
    'data-testid'?: string;
}
/** DatePicker + TimePicker combined into one 'YYYY-MM-DDTHH:mm' value. */
export declare const DateTimePicker: React.FC<DateTimePickerProps>;
