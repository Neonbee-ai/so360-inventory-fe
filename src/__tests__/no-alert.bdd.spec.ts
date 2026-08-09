import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('Given the toast-standardized inventory codebase', () => {
    it('When production sources are scanned / Then no native alert() call sites remain', () => {
        const srcDir = path.resolve(__dirname, '..');
        let output = '';
        try {
            output = execFileSync(
                'grep',
                ['-rnE', String.raw`(^|[^.\w])alert\(|window\.alert\(`, '--include=*.ts', '--include=*.tsx', '.'],
                { cwd: srcDir, encoding: 'utf8' },
            );
        } catch {
            // grep exits 1 when nothing matches — the passing case.
        }
        const offenders = output
            .split('\n')
            .filter(Boolean)
            .filter(line => !/\.(spec|test)\.tsx?:/.test(line))
            .filter(line => !line.includes('__tests__'));
        expect(offenders, `alert() found in:\n${offenders.join('\n')}`).toEqual([]);
    });
});
