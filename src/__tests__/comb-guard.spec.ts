/**
 * Comb guard — enforces the Neonbee Comb UI standard (.claude/comb-page-standard.md)
 * inside the existing unit-test stage. No dependencies beyond node built-ins + vitest.
 *
 * HOW IT WORKS
 *   Scans SCAN_ROOTS for *.ts / *.tsx (tests, specs, stories, mocks, *.d.ts excluded),
 *   line by line, against RULES. Lines that are comments, or carry a
 *   `comb-exception: <reason>` marker, are ignored.
 *
 * RATCHET (comb-guard.allowlist.json, next to this file)
 *   { "src/path/File.tsx": ["rule-id", ...] }  = files still pending conversion.
 *   - A file/rule NOT in the allowlist that violates  -> test fails (no new debt).
 *   - A file/rule IN the allowlist that is now clean  -> test fails (STALE: shrink it).
 *
 * UPDATING THE ALLOWLIST (no node/npm needed)
 *   After converting a page, delete its rule (or the whole file key) from the JSON,
 *   or regenerate it from the repo root:
 *     bash scripts/comb-guard-allowlist.sh . src > src/__tests__/comb-guard.allowlist.json
 *   Never ADD entries to dodge a failure — fix the code, or mark a reviewed
 *   one-off with `// comb-exception: <reason>` on the same line.
 *
 * KEEP IN SYNC: the pattern strings in RULES are character-for-character identical to
 * the $'...' strings in scripts/comb-guard-allowlist.sh (portable ERE/JS subset:
 * no backslashes; literals via [(] [.] [{] [[] etc.). Change both together.
 * Canonical copies: SO360 V.2/scripts/comb-guard/.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ---- Per-repo configuration -------------------------------------------------
/** Directories (relative to the repo root) to scan. Shell: ['src'] only — packages/design-system legitimately defines primitives. */
const SCAN_ROOTS = ['src'];
const REPO_ROOT = path.resolve(__dirname, '../..');
const ALLOWLIST_FILE = path.join(__dirname, 'comb-guard.allowlist.json');
/** Module-home files (repo-relative) that may render a page template WITHOUT a `trail` (the module landing page has no parent). */
const MODULE_HOME_FILES: string[] = [];
// -----------------------------------------------------------------------------

/** Path-level exclusions (applied to the repo-relative path). Mirrors EXCLUDE_RE in the bash script. */
const EXCLUDE_RE = /(^|[/])(__tests__|__mocks__|__fixtures__|test|tests|node_modules)[/]|[.](test|spec|stories)[.]tsx?$|[.]d[.]ts$/;
const COMMENT_RE = /^[ \t]*([/][/]|[/][*]|[*]|[{][/][*])/;
const EXCEPTION_MARK = 'comb-exception';

interface Rule {
  id: string;
  /** Only scan files with these extensions. */
  ext: string[];
  patterns: string[];
  message: string;
  fix: string;
  /** The line is NOT a violation when this also matches on the same line. */
  unless?: string;
}

const RULES: Rule[] = [
  {
    id: 'raw-table',
    ext: ['.tsx'],
    patterns: ['<table( |>|$)'],
    message: 'Raw <table> element',
    fix: 'Use DataTable (or the ListDetailTemplate floorplan) from @so360/design-system',
  },
  {
    id: 'raw-palette',
    ext: ['.ts', '.tsx'],
    patterns: [
      '(^|[^a-zA-Z0-9_-])(bg|text|border|border-[xytrbls]|ring|ring-offset|from|to|via|fill|stroke|divide|outline|placeholder|accent|caret|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}',
      '[[]#[0-9a-fA-F]{3,8}]',
      'style=[{][{].*: *[\'"]#[0-9a-fA-F]{3,8}[\'"]',
    ],
    message: 'Raw Tailwind palette class or hex colour',
    fix: 'Use Comb tokens (bg-surface, text-muted, border-subtle, text-danger, ... see style-guide.md)',
  },
  {
    id: 'local-primitive',
    ext: ['.ts', '.tsx'],
    patterns: [
      'export (default )?(async )?(function|const|let|class) (Button|IconButton|Card|Modal|Dialog|Drawer|Badge|Tabs|Table|Select|Input|Spinner|Tooltip)([^a-zA-Z0-9_]|$)',
    ],
    message: 'Local re-implementation of a Comb primitive',
    fix: 'Import it from @so360/design-system instead of defining it locally',
  },
  {
    id: 'native-dialog',
    ext: ['.ts', '.tsx'],
    patterns: ['window[.](confirm|alert|prompt)[(]', '(^|[^.a-zA-Z0-9_$])(confirm|alert|prompt)[(][`\'"]'],
    message: 'Native browser dialog',
    fix: 'Use useConfirm() for confirmations and Toast for notices',
  },
  {
    id: 'view-action-column',
    ext: ['.ts', '.tsx'],
    patterns: ['label(: *|=[{]?)[\'"]View[\'"]', '>View<'],
    message: 'Separate "View" row action',
    fix: 'Make the whole row clickable via DataTable onRowClick; drop the View action',
  },
  {
    id: 'grid-12-cards',
    ext: ['.ts', '.tsx'],
    patterns: ['(^|[^a-zA-Z0-9_-])grid-cols-12([^0-9]|$)'],
    message: 'Hand-built 12-column grid',
    fix: 'Use Comb <Grid columns="auto"> or <Grid template="repeat(auto-fill,minmax(300px,1fr))">',
  },
  {
    id: 'raw-control',
    ext: ['.tsx'],
    patterns: ['<(button|select|input|textarea)( |>|$)'],
    unless: 'type=[{]?[\'"](file|hidden)[\'"]',
    message: 'Raw form control element',
    fix: 'Use DS Button / IconButton / Select / TextField / Checkbox / SearchField',
  },
  {
    id: 'arbitrary-size',
    ext: ['.ts', '.tsx'],
    patterns: [
      '(^|[^a-zA-Z0-9_-])-?(text|w|min-w|max-w|h|min-h|max-h|size|p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|leading|tracking|top|right|bottom|left|inset|inset-x|inset-y)-[[](-?[0-9.]|calc|min|max|clamp)',
    ],
    message: 'Tailwind arbitrary size/spacing value',
    fix: 'Use Comb spacing / size / type tokens (comb-page-standard.md §3-4)',
  },
];

/**
 * File-level rule `page-trail`: every `<*PageTemplate` / `<RecordPage` opening tag must carry a `trail` prop
 * (the opening tag is read until its closing `>` at depth 0, so multi-line props are covered).
 * Returns the 1-based line numbers of offending tags. A `comb-exception` marker on the tag line skips it.
 * Mirrored in comb-guard-allowlist.sh (awk).
 */
const PAGE_TAG_RE = /<([A-Za-z]*PageTemplate|RecordPage)([^A-Za-z0-9_]|$)/;
function scanPageTrail(source: string): number[] {
  const lines = source.split('\n');
  const out: number[] = [];
  lines.forEach((text, i) => {
    if (COMMENT_RE.test(text) || text.includes(EXCEPTION_MARK) || !PAGE_TAG_RE.test(text)) return;
    let tag = '';
    for (let j = i; j < Math.min(lines.length, i + 60); j++) {
      tag += lines[j] + '\n';
      if (/^[ \t]*\/?>/.test(lines[j]) || (j === i && /\/?>[ \t]*$/.test(lines[j]))) break;
    }
    if (!/(^|[^a-zA-Z0-9_])trail[=]/.test(tag)) out.push(i + 1);
  });
  return out;
}

interface Hit { file: string; line: number; rule: string }

const COMPILED = RULES.map((r) => ({ ...r, res: r.patterns.map((p) => new RegExp(p)), skip: r.unless ? new RegExp(r.unless) : null }));

function scanLine(text: string, ext: string): string[] {
  if (COMMENT_RE.test(text) || text.includes(EXCEPTION_MARK)) return [];
  return COMPILED.filter((r) => r.ext.includes(ext) && r.res.some((re) => re.test(text)) && !r.skip?.test(text)).map((r) => r.id);
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (/[.]tsx?$/.test(e.name)) out.push(abs);
  }
}

function scanRepo(): Hit[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) walk(path.join(REPO_ROOT, root), files);
  const hits: Hit[] = [];
  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
    if (EXCLUDE_RE.test(rel)) continue;
    const ext = path.extname(rel);
    fs.readFileSync(abs, 'utf8').split('\n').forEach((text, i) => {
      for (const rule of scanLine(text, ext)) hits.push({ file: rel, line: i + 1, rule });
    });
    if (ext === '.tsx' && !MODULE_HOME_FILES.includes(rel)) {
      for (const line of scanPageTrail(fs.readFileSync(abs, 'utf8'))) hits.push({ file: rel, line, rule: 'page-trail' });
    }
  }
  return hits;
}

function loadAllowlist(): Record<string, string[]> {
  if (!fs.existsSync(ALLOWLIST_FILE)) return {};
  return JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8')) as Record<string, string[]>;
}

const PAGE_TRAIL_RULE = {
  id: 'page-trail',
  message: 'Page template rendered without a `trail` prop',
  fix: 'Pass trail={[...]} (module home pages go in MODULE_HOME_FILES)',
};

const fmt = (h: Hit): string => {
  const r = h.rule === 'page-trail' ? PAGE_TRAIL_RULE : RULES.find((x) => x.id === h.rule)!;
  return `  ${h.file}:${h.line}  [${h.rule}] ${r.message} -> ${r.fix}`;
};

describe('Comb guard: pages follow the Comb UI standard', () => {
  it('Given rule fixtures / When lines are scanned / Then only true violations match', () => {
    const cases: Array<[string, string, string[]]> = [
      ['<table className="x">', '.tsx', ['raw-table']],
      ['<DataTable rows={r} />', '.tsx', []],
      ['className="hover:bg-slate-100 text-sm"', '.tsx', ['raw-palette']],
      ['className="bg-surface text-muted"', '.tsx', []],
      ['className="bg-[#1a2b3c]"', '.tsx', ['raw-palette']],
      ["style={{ color: '#fff' }}", '.tsx', ['raw-palette']],
      ['export const Button = forwardRef(', '.tsx', ['local-primitive']],
      ['export function ButtonGroup() {', '.tsx', []],
      ["if (window.confirm('Delete?')) {", '.ts', ['native-dialog']],
      ["const ok = await confirm({ title: 'Delete?' });", '.tsx', []],
      ["{ label: 'View', onClick: open }", '.tsx', ['view-action-column']],
      ['<a>View all</a>', '.tsx', []],
      ['<div className="grid grid-cols-12 gap-4">', '.tsx', ['grid-12-cards']],
      ['<button onClick={go}>', '.tsx', ['raw-control']],
      ['<input', '.tsx', ['raw-control']],
      ['<input type="file" hidden />', '.tsx', []],
      ["<input type='hidden' name=\"id\" />", '.tsx', []],
      ['<Button variant="primary">', '.tsx', []],
      ['className="text-[11px] min-w-[120px] -mt-[2px]"', '.tsx', ['arbitrary-size']],
      ['className="w-[calc(100%-2rem)]"', '.tsx', ['arbitrary-size']],
      ['className="text-[var(--x)] grid-cols-[1fr_auto]"', '.tsx', []],
      ['// <table> in a comment', '.tsx', []],
      ['<table> {/* comb-exception: print layout */}', '.tsx', []],
    ];
    for (const [text, ext, expected] of cases) expect(scanLine(text, ext), text).toEqual(expected);
  });

  it('Given page-template tags / When scanned / Then only those without a trail prop are reported', () => {
    const cases: Array<[string, number[]]> = [
      ['<ListPageTemplate trail={[]} title="X">', []],
      ['<ListPageTemplate title="X">', [1]],
      ['<DetailPageTemplate\n  title="X"\n  trail={trail}\n>', []],
      ['<DetailPageTemplate\n  title="X"\n>', [1]],
      ['<RecordPage\n  title="X"\n/>', [1]],
      ['<SettingsPageTemplate trail={t} />', []],
      ['<PageTemplateHelper x />', []],
      ['<ListPageTemplate title="Home"> {/* comb-exception: module home */}', []],
      ['// <ListPageTemplate title="X">', []],
    ];
    for (const [src, expected] of cases) expect(scanPageTrail(src), src).toEqual(expected);
  });

  const hits = scanRepo();
  const allow = loadAllowlist();
  const found = new Set(hits.map((h) => `${h.file}\u0000${h.rule}`));

  it('Given the allowlist / When sources are scanned / Then no new Comb violations exist', () => {
    const fresh = hits.filter((h) => !(allow[h.file] ?? []).includes(h.rule));
    expect(
      fresh.length,
      `\n${fresh.length} Comb violation(s) not in comb-guard.allowlist.json:\n${fresh.map(fmt).join('\n')}\n` +
        'Fix the code (see .claude/comb-page-standard.md). Do not add new allowlist entries.\n',
    ).toBe(0);
  });

  it('Given the allowlist / When a pending file is converted / Then its entry must be removed (no stale entries)', () => {
    const stale: string[] = [];
    for (const [file, rules] of Object.entries(allow)) {
      for (const rule of rules) if (!found.has(`${file}\u0000${rule}`)) stale.push(`  ${file}  [${rule}]`);
    }
    expect(
      stale.length,
      `\n${stale.length} stale allowlist entr(y/ies) — now clean, remove from comb-guard.allowlist.json:\n${stale.join('\n')}\n`,
    ).toBe(0);
  });
});
