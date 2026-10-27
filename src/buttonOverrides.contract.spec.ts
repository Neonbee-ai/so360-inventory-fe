// BDD contract: DS Button joins class strings without tailwind-merge, so layout overrides
// (h-auto, flex-col, justify-start, text-left ...) lose to its base/size classes unless they
// are `!`-prefixed. These files were converted to Comb and carry such overrides.
import { describe, it, expect } from 'vitest';

const sources = import.meta.glob('./**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const FILES = [
  'components/ItemSearchSelector.tsx',
  'components/ProcurementTrace.tsx',
  'components/attributes/ProductTypePicker.tsx',
  'components/categories/CategoryIconLibrary.tsx',
  'components/categories/CategoryPicker.tsx',
  'pages/SettingsPage.tsx',
  'pages/StockMovementRegisterPage.tsx',
  'pages/settings/ProductTypeSettingsPage.tsx',
];

const RISKY = /(?<![!\w:/\-\[])(h-auto|flex-col|whitespace-normal|justify-start|justify-between|items-start|text-left|text-start|px-0|py-0|p-0|rounded-none|rounded-full|h-full)(?![\w\-\]])/g;
const BUTTON_TAG = /<Button\b(?:[^>{]|\{(?:[^{}]|\{[^{}]*\})*\})*>/g;
const CLASS_ATTR = /className=(?:"[^"]*"|\{`[^`]*`\}|\{cn\([^)]*\)\})/g;

function offenders(src: string): string[] {
  const out: string[] = [];
  for (const tag of src.match(BUTTON_TAG) ?? []) {
    for (const attr of tag.match(CLASS_ATTR) ?? []) {
      for (const m of attr.matchAll(RISKY)) out.push(m[1]);
    }
  }
  return out;
}

describe('Given Comb-converted files that use DS Button with layout overrides', () => {
  FILES.forEach((file) => {
    describe(file, () => {
      it('When its Button class overrides are read / Then each layout override is !-prefixed so it beats Button base classes', () => {
        const src = sources['./' + file];
        expect(src, 'source should be loadable').toBeTypeOf('string');
        expect(offenders(src)).toEqual([]);
      });
    });
  });
});
