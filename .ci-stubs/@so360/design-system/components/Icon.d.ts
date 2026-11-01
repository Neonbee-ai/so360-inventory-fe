import React from 'react';
/** Any Lucide icon (or a custom SVG component with the same props shape). */
export type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
}>;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type IconTone = 'current' | 'fg' | 'muted' | 'subtle' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
/** Pixel scale — pair with text: xs/sm → caption, md → body, lg → headings, xl/2xl → empty states & hero. */
export declare const ICON_SIZES: Record<IconSize, number>;
/** Stroke tapers as size grows so optical weight stays even across the scale. */
export declare const ICON_STROKES: Record<IconSize, number>;
export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
    /** The icon component, e.g. `import { Search } from 'lucide-react'` → `icon={Search}`. */
    icon: IconComponent;
    size?: IconSize;
    tone?: IconTone;
    /** Override the size-based default stroke. */
    strokeWidth?: number;
    /**
     * Accessible name. Set it only when the icon carries meaning on its own
     * (e.g. a status glyph with no text). Omit for decorative icons — they are aria-hidden.
     */
    label?: string;
}
export declare const Icon: React.FC<IconProps>;
