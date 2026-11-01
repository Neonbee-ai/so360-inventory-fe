import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { federationCssRootCopy } from '../../vite-plugins/federation-css-root-copy';

describe('Feature: federation CSS is served at the path the shell requests', () => {
  const run = (dist: string) => (federationCssRootCopy(dist).closeBundle as () => void)();

  it('Given a build with assets/style-*.css / When the bundle closes / Then the CSS is copied to dist root', () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-dist-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'assets', 'style-abc.css'), '.translate-x-full{}');
    fs.writeFileSync(path.join(dist, 'assets', 'index.js'), '');
    run(dist);
    expect(fs.readFileSync(path.join(dist, 'style-abc.css'), 'utf8')).toBe('.translate-x-full{}');
    expect(fs.existsSync(path.join(dist, 'index.js'))).toBe(false);
  });

  it('Given no assets folder / When the bundle closes / Then nothing is thrown', () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-dist-'));
    expect(() => run(dist)).not.toThrow();
  });
});
