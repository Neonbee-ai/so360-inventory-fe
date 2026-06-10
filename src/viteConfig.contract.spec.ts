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

const captured = vi.hoisted(() => ({
  federation: undefined as { shared?: Record<string, { singleton?: boolean }> } | undefined,
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
  'lucide-react',
  '@so360/shell-context',
  '@so360/design-system',
  '@so360/event-bus',
  '@so360/cross-link',
  'framer-motion',
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

    it.each(REQUIRED_SHARED_SINGLETONS)('Then %s is shared as a singleton', (dep) => {
      const shared = captured.federation?.shared ?? {};
      expect(shared[dep], `${dep} must be in the federation shared list`).toBeDefined();
      expect(shared[dep]?.singleton, `${dep} must be a singleton`).toBe(true);
    });
  });
});
