import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const stubs = path.resolve(__dirname, 'src/test/__mocks__');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@so360/shell-context': path.join(stubs, 'shell-context.ts'),
      '@so360/design-system': path.join(stubs, 'design-system.ts'),
      '@so360/formatters': path.join(stubs, 'formatters.ts'),
      '@so360/event-bus': path.join(stubs, 'event-bus.ts'),
      'lucide-react': path.join(stubs, 'lucide-react.tsx'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx', 'src/vite-env.d.ts', 'src/types/**'],
    },
  },
});
