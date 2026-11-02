import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

// @originjs/vite-plugin-federation builds the remote CSS URL as `${base}${file}`
// (dropping `assets/`), so the shell requests <base>/style-*.css while Vite only
// emits assets/style-*.css → 404 → the MFE renders unstyled. Copy CSS to dist root.
export function federationCssRootCopy(distDir = path.resolve(process.cwd(), 'dist')): Plugin {
  return {
    name: 'federation-css-root-copy',
    apply: 'build',
    closeBundle() {
      const assetsDir = path.join(distDir, 'assets');
      if (!fs.existsSync(assetsDir)) return;
      fs.readdirSync(assetsDir)
        .filter((f) => f.endsWith('.css'))
        .forEach((f) => fs.copyFileSync(path.join(assetsDir, f), path.join(distDir, f)));
    },
  };
}
