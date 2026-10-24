/** Quote a CSV cell when it holds a comma, quote or line break. */
export const csvEscape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const buildCsv = (headers: string[], rows: unknown[][]): string =>
    [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');

/**
 * Trigger a real browser download. The anchor is attached to the DOM before the
 * click (Firefox/Safari ignore detached anchors) and the blob URL is revoked
 * on a later tick, so the download is not cancelled mid-start. A UTF-8 BOM is
 * prefixed so Excel reads non-ASCII text correctly.
 */
export const downloadCsv = (filename: string, csv: string): void => {
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
