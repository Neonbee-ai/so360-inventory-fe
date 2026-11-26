/* eslint-disable @typescript-eslint/no-explicit-any */
// BDD contract for the production build performance fixes (P1 + P3).
//
// P1 — bundles must be esbuild-minified. This repo previously shipped
//      `minify: false`, which roughly tripled chunk sizes (slow first load).
// P3 — the module federation shared list must declare every singleton the
//      shell host shares. A missing entry makes this remote silently bundle
//      its own copy of the package — a duplicated @so360/shell-context is
//      what broke the context singleton and forced the window-bridge fallback.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const captured = vi.hoisted(() => ({
  federation: undefined as { shared?: Record<string, { singleton?: boolean }> } | undefined,
}));

// Importing the real `vite` package loads esbuild's JS API, whose
// TextEncoder invariant check fails under jsdom (cross-realm Uint8Array)
// and crashes this spec at load time — so vite + plugin-react are stubbed.
vi.mock('vite', () => ({
  defineConfig: (config: any) => config,
  loadEnv: () => ({}),
}));

vi.mock('@vitejs/plugin-react', () => ({
  default: () => ({ name: 'react-plugin-stub' }),
}));

vi.mock('@originjs/vite-plugin-federation', () => ({
  default: (options: any) => {
    captured.federation = options;
    return { name: 'federation-capture-stub' };
  },
}));

import viteConfig from '../vite.config';

const REQUIRED_SHARED_SINGLETONS = [
  'react',
  'react-dom',
  'react-router-dom',
  '@so360/shell-context',
  '@so360/design-system',
  '@so360/event-bus',
  '@so360/cross-link',
  '@so360/formatters',
];

let config: any;

beforeAll(async () => {
  config =
    typeof viteConfig === 'function'
      ? await (viteConfig as any)({ mode: 'production', command: 'build' })
      : viteConfig;
});

describe('Production build configuration (MFE perf contract)', () => {
  describe('Given the production bundle options', () => {
    it('Then minification is esbuild — never disabled', () => {
      expect(config.build?.minify).toBe('esbuild');
    });

    it('Then CSS code splitting stays disabled (module federation requirement)', () => {
      expect(config.build?.cssCodeSplit).toBe(false);
    });
  });

  describe('Given the module federation shared dependency list', () => {
    it('Then the federation plugin declares a shared map', () => {
      expect(captured.federation).toBeDefined();
      expect(captured.federation?.shared).toBeDefined();
    });

    it('Then lucide-react is not a shared singleton (tree-shaken per remote)', () => {
      const shared = captured.federation?.shared ?? {};
      expect(shared['lucide-react'], 'lucide-react must not be in the federation shared list').toBeUndefined();
    });

    it.each(REQUIRED_SHARED_SINGLETONS)('Then %s is shared as a singleton', (dep) => {
      const shared = captured.federation?.shared ?? {};
      expect(shared[dep], `${dep} must be in the federation shared list`).toBeDefined();
      expect(shared[dep]?.singleton, `${dep} must be a singleton`).toBe(true);
    });
  });

  describe('Given the manual chunk rules', () => {
    it('Given the federation importShared runtime, When chunks are assigned, Then it gets its own chunk (never hoisted into a vendor chunk)', () => {
      const manualChunks = config.build?.rollupOptions?.output?.manualChunks;
      expect(manualChunks('\0virtual:__federation_fn_import')).toBe('__federation_fn_import');
      expect(manualChunks('__federation_fn_import')).toBe('__federation_fn_import');
    });

    it('Given lucide-react icon modules, When chunks are assigned, Then they group into the single icons chunk', () => {
      const manualChunks = config.build?.rollupOptions?.output?.manualChunks;
      expect(manualChunks('/repo/node_modules/lucide-react/dist/esm/icons/plus.js')).toBe('icons');
      expect(manualChunks('/repo/node_modules/lucide-react/dist/esm/createLucideIcon.js')).toBe('icons');
    });

    it('Given ordinary app and node_modules files, When chunks are assigned, Then Rollup default chunking applies', () => {
      const manualChunks = config.build?.rollupOptions?.output?.manualChunks;
      expect(manualChunks('/repo/src/pages/SomePage.tsx')).toBeUndefined();
      expect(manualChunks('/repo/node_modules/react/index.js')).toBeUndefined();
    });
  });

  describe('Given the shared list and the unused framer-motion dependency', () => {
    it('Then framer-motion is not shared (no source imports it; the host owns the design-system copy)', () => {
      const shared = captured.federation?.shared ?? {};
      expect(shared['framer-motion'], 'framer-motion must stay out of the shared list').toBeUndefined();
    });

    it('Then package.json no longer depends on framer-motion', () => {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
      expect(pkg.dependencies?.['framer-motion']).toBeUndefined();
    });
  });

  describe('Given the initial-load performance budget', () => {
    const budget = JSON.parse(readFileSync(resolve(__dirname, '../perf-budget.json'), 'utf8'));

    it('Then the budget caps the initial ./App closure at 20 KB brotli and 10 files', () => {
      expect(budget.initialAppClosure.maxBrotliKB).toBeLessThanOrEqual(20);
      expect(budget.initialAppClosure.maxFiles).toBeLessThanOrEqual(10);
    });
  });
});
