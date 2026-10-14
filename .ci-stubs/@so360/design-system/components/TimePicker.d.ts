import React from 'react';
import { type FormFieldSize } from './FormField';
export type TimeFormat = '12h' | '24h';
export interface TimePickerProps {
    /** 24h 'HH:mm' ('' = empty). Controlled when provided. */
    value?: string;
    defaultValue?: string;
    onChange?: (time: string) => void;
    format?: TimeFormat;
    /** Minutes between list options (default 15). */
    step?: number;
    /** Earliest / latest selectable 'HH:mm'. */
    minTime?: string;
    maxTime?: string;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    size?: FormFieldSize;
    'aria-label'?: string;
    'data-testid'?: string;
}
export declare function formatTime(hhmm: string, format: TimeFormat): string;
/** Parses '9:30 pm', '14:05', '930', '9am' to 24h 'HH:mm', or null. */
export declare function parseTime(input: string): string | null;
/** hh:mm entry with a step-based listbox popover; 12h or 24h display. */
export declare const TimePicker: React.FC<TimePickerProps>;
