/**
 * Preview strategy — pure functions that decide how to render a document
 * in the PreviewDrawer without touching any React state.
 *
 * Strategy priority (first match wins):
 *   pdf → image → video → audio → apple → native → office → none
 */
export type PreviewStrategy = 'pdf' | 'image' | 'video' | 'audio' | 'native' | 'office' | 'apple' | 'none';
export declare const OFFICE_MIMES: Set<string>;
export declare const OFFICE_EXTS: Set<string>;
export declare const APPLE_EXTS: Set<string>;
/** Derive file extension (lowercase, without the dot). Empty string if none or dotfile. */
export declare function fileExt(name: string): string;
/**
 * Determine how to preview a document given its MIME type and filename.
 * Both arguments may be empty strings — the function always returns a strategy.
 *
 * Strategy priority (first match wins):
 *   pdf → image → video → audio → apple → office → native → none
 *
 * Office is checked before the generic text/* catch so that text/rtf
 * (which starts with "text/") is correctly classified as office.
 */
export declare function getPreviewStrategy(mime: string, name: string): PreviewStrategy;
/** Build a Google Docs Viewer embed URL for the given file URL. */
export declare function googleViewerUrl(fileUrl: string): string;
