import React from 'react';
export interface CalendarRange {
    start: string | null;
    end: string | null;
}
export interface CalendarProps {
    /** Selected ISO date 'YYYY-MM-DD'. Controlled when provided (null = none). */
    value?: string | null;
    defaultValue?: string | null;
    onChange?: (iso: string) => void;
    min?: string;
    max?: string;
    isDateDisabled?: (date: Date) => boolean;
    /** 0 = Sunday, 1 = Monday (default). */
    weekStartsOn?: 0 | 1;
    locale?: string;
    /** Visible month (any day inside it). Controlled when provided. */
    month?: Date;
    onMonthChange?: (month: Date) => void;
    /** Highlights a range (start/end ISO). Used by DateRangePicker. */
    range?: CalendarRange;
    onDayHover?: (iso: string | null) => void;
    showPrev?: boolean;
    showNext?: boolean;
    /** Override "today" (tests / SSR). */
    today?: Date;
    name?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Accessible month grid with roving-tabindex keyboard navigation. */
export declare const Calendar: React.FC<CalendarProps>;
