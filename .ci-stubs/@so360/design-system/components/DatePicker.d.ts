import React from 'react';
import { type DateInputProps } from './DateInput';
export interface DatePickerProps extends Omit<DateInputProps, 'trailing'> {
    weekStartsOn?: 0 | 1;
    isDateDisabled?: (date: Date) => boolean;
    /** Override "today" (tests / SSR). */
    today?: Date;
}
/** Typed date input with a calendar popover. Value is an ISO date 'YYYY-MM-DD'. */
export declare const DatePicker: React.FC<DatePickerProps>;
