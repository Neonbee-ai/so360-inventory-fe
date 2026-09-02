import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * BDD guard for build-time env substitution.
 *
 * Vite replaces `import.meta.env` and `import.meta.env.VITE_X` only where they
 * appear LITERALLY in source. The TypeScript-friendly-looking
 * `(import.meta as any)?.env` compiles to `import.meta?.env`, which matches
 * neither pattern — so the build-time env is replaced by nothing, the captured
 * object is `{}`, and every origin falls through to its localhost dev port.
 *
 * This is not hypothetical. The deployed procurement chunk contained:
 *
 *   s = e && e.VITE_SO360_INVENTORY_API || t.VITE_SO360_INVENTORY_API
 *       || t.VITE_API_BASE_URL || "http://localhost:3006"
 *
 * with `t` empty, so production Procurement called localhost:3006 on every
 * user's machine. The shell injects a window global for CORE but NOT for
 * INVENTORY, so nothing upstream covered it.
 *
 * The failure is invisible in review — the source reads correctly and only the
 * built artifact is wrong — so it is pinned structurally here.
 */

const srcDir = (() => {
    let dir = __dirname;
    for (;;) {
        if (existsSync(join(dir, 'services', 'inventoryService.ts'))) return dir;
        const parent = dirname(dir);
        if (parent === dir) throw new Error(`inventory-fe src not found above ${__dirname}`);
        dir = parent;
    }
})();

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = join(dir, e.name);
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : sourceFiles(full);
        if (!/\.tsx?$/.test(e.name)) return [];
        if (/\.(spec|test)\.tsx?$/.test(e.name)) return [];
        return [full];
    });

/** Comments discuss the broken form by name; only real code should fail. */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('Given source that reads build-time env', () => {
    it('When every file is scanned / Then none optional-chains off import.meta', () => {
        const offenders = sourceFiles(srcDir).filter((f) =>
            stripComments(readFileSync(f, 'utf8')).includes('as any)?.env'),
        );
        expect(
            offenders,
            `These compile to \`import.meta?.env\`, which Vite never substitutes — ` +
                `the shipped bundle will fall back to localhost:\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('When a key is read through a variable / Then it is not indexed off the env object', () => {
        // `env[someKey]` gives Vite no literal key to match. Cross-service
        // origins are therefore read by full name into an explicit map.
        const src = stripComments(
            readFileSync(join(srcDir, 'services', 'inventoryService.ts'), 'utf8'),
        );
        expect(src).not.toMatch(/\benv\[[a-zA-Z]/);
        expect(src).toContain('CROSS_SERVICE_BUILD_ENV');
    });
});

describe('Given the origins the build is expected to supply', () => {
    it('When .env.production is read / Then it defines the inventory origin the services rely on', () => {
        // The substitution fix is only load-bearing if the build actually
        // defines the value. Without this, the services resolve correctly and
        // still reach nothing.
        const envFile = join(dirname(srcDir), '.env.production');
        if (!existsSync(envFile)) return; // not rsynced into every checkout
        const text = readFileSync(envFile, 'utf8');
        expect(text).toContain('VITE_SO360_INVENTORY_API=');
        expect(text).not.toContain('VITE_SO360_INVENTORY_API=http://localhost');
    });
});

describe('Given a service that resolves an API origin', () => {
    it('When it has no hostname fallback / Then it must still read the literal env key', () => {
        // inventoryService and vendorService self-heal on a *.neonbee.app host.
        // These four do not, so the env read is their ONLY route to a real
        // origin — which is why they were the ones broken in production.
        const noFallback = [
            'procurementService.ts',
            'rfqService.ts',
            'qualityService.ts',
            'procurementInsightsService.ts',
        ];
        for (const file of noFallback) {
            const src = stripComments(readFileSync(join(srcDir, 'services', file), 'utf8'));
            expect(src, `${file} must read env via the substitutable form`).toContain(
                'as any).env',
            );
            expect(src, `${file} must name the key literally`).toContain(
                'env.VITE_SO360_INVENTORY_API',
            );
        }
    });
});
