import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:3005/',
    plugins: [
        react({
            jsxRuntime: 'automatic',
        }),
        federation({
            name: 'inventory_app',
            filename: 'remoteEntry.js',
            // Access from Shell: import('inventory_app/App')
            exposes: {
                './App': './src/App.tsx',
            },
            shared: {
                react: { singleton: true, requiredVersion: '^19.2.0' },
                'react-dom': { singleton: true, requiredVersion: '^19.2.0' },
                'react-router-dom': { singleton: true, requiredVersion: '^7.12.0' },
                'framer-motion': { singleton: true },
                'lucide-react': { singleton: true },
                '@so360/shell-context': { singleton: true },
                '@so360/design-system': { singleton: true },
                '@so360/event-bus': { singleton: true },
                '@so360/formatters': { singleton: true },
            },
        }),
    ],
    build: {
        target: 'esnext',
        minify: false,
        cssCodeSplit: false,
        emptyOutDir: false,
    },
    server: {
        port: 3005,
        strictPort: true,
        cors: true,
        proxy: {
            '/v1/inventory': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1/procurement': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1/vendors': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1/warehouses': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1/documents': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },

    },

    preview: {
        port: 3005,
        strictPort: true,
        cors: true,
        proxy: {
            '/v1/inventory': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1/procurement': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1/vendors': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1/warehouses': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1/documents': {
                target: 'http://localhost:3006',
                changeOrigin: true,
            },
            '/v1': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
}; });
