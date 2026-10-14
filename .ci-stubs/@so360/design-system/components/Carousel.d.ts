import React from 'react';
export interface CarouselSlide {
    id: string;
    content: React.ReactNode;
    /** Accessible name of the slide; defaults to "n of total". */
    label?: string;
}
export interface CarouselProps {
    slides: CarouselSlide[];
    /** Uncontrolled starting slide. */
    defaultIndex?: number;
    /** Controlled slide index. */
    index?: number;
    onIndexChange?: (index: number) => void;
    autoPlay?: boolean;
    /** Autoplay interval in ms. */
    interval?: number;
    /** Wrap from last to first and vice versa. */
    loop?: boolean;
    showDots?: boolean;
    showArrows?: boolean;
    /** Accessible name of the carousel region. */
    label?: string;
    className?: string;
    'data-testid'?: string;
}
/**
 * Slide carousel: prev/next arrows, dots, ArrowLeft/ArrowRight/Home/End, and
 * autoplay that pauses on hover/focus and via an explicit pause button (WCAG 2.2.2).
 */
export declare const Carousel: React.FC<CarouselProps>;
