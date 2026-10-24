import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCsv, csvEscape, downloadCsv } from './csvDownload';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('csvEscape', () => {
    it('Given a plain value / When escaped / Then it is unchanged', () => {
        expect(csvEscape('PO-001')).toBe('PO-001');
    });
    it('Given null / When escaped / Then it is empty', () => {
        expect(csvEscape(null)).toBe('');
    });
    it('Given a comma and a quote / When escaped / Then it is quoted with doubled quotes', () => {
        expect(csvEscape('a,"b"')).toBe('"a,""b"""');
    });
});

describe('buildCsv', () => {
    it('Given headers and rows / When built / Then it is CRLF separated', () => {
        expect(buildCsv(['A', 'B'], [[1, 'x,y']])).toBe('A,B\r\n1,"x,y"');
    });
});

describe('downloadCsv', () => {
    const setup = () => {
        const createObjectURL = vi.fn(() => 'blob:mock');
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
        let attachedAtClick = false;
        let download = '';
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            attachedAtClick = document.body.contains(this);
            download = this.download;
        });
        return { createObjectURL, revokeObjectURL, state: () => ({ attachedAtClick, download }) };
    };

    it('Given a CSV / When downloaded / Then the anchor is in the DOM when clicked and carries the filename', () => {
        const m = setup();
        downloadCsv('r.csv', 'A\r\n1');
        expect(m.createObjectURL).toHaveBeenCalledTimes(1);
        expect(m.state()).toEqual({ attachedAtClick: true, download: 'r.csv' });
    });

    it('Given a download / When it finishes / Then the anchor is removed from the DOM', () => {
        setup();
        downloadCsv('r.csv', 'A');
        expect(document.querySelector('a[download]')).toBeNull();
    });

    it('Given a download / When clicked / Then the blob URL is revoked only later', () => {
        vi.useFakeTimers();
        const m = setup();
        downloadCsv('r.csv', 'A');
        expect(m.revokeObjectURL).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1000);
        expect(m.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    });
});
