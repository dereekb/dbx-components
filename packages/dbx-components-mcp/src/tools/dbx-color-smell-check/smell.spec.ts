import { describe, expect, it } from 'vitest';
import { extractHtmlLiterals, extractTsLiterals, formatResultAsJson, formatResultAsMarkdown, groupColorSmells } from './index.js';
import type { ColorTemplateEntry } from '../dbx-color-template-list-app/index.js';

const TS_WITH_LITERALS = `import type { DbxColorConfig, DbxColorInput } from '@dereekb/dbx-web';

const A: DbxColorConfig = { color: '#1F9B59', contrast: 'white', tone: 18 };

const B: DbxColorInput = { color: '#1f9b59', contrast: 'white', tone: 18 };

export const chip = { dbxColor: { color: '#FFF', tone: 50 } };

export const skipped = { template: 'brand-positive' };

export const notAColor = { backgroundColor: 'red' };
`;

const HTML_WITH_LITERALS = `<div [dbxColor]="{ color: '#1f9b59', contrast: 'white', tone: 18 }">a</div>
<span [dbxTextColor]="{ color: '#fff', tone: 50 }">b</span>
<div [dbxColor]="{ template: 'brand-positive' }">c</div>
<div [dbxColor]="{ color: '#1f9b59', contrast: 'white', tone: 18 }">d</div>
`;

describe('extractTsLiterals', () => {
  it('picks up DbxColorConfig literals and skips template-only or non-color objects', () => {
    const literals = extractTsLiterals('apps/demo/foo.ts', TS_WITH_LITERALS);
    expect(literals.map((l) => l.raw)).toEqual([
      { color: '#1F9B59', contrast: 'white', tone: 18 },
      { color: '#1f9b59', contrast: 'white', tone: 18 },
      { color: '#FFF', tone: 50 }
    ]);
    expect(literals.every((l) => !l.hasTemplate && !l.dynamic)).toBe(true);
  });
});

describe('extractHtmlLiterals', () => {
  it('picks up Angular property bindings and skips template-only literals', () => {
    const literals = extractHtmlLiterals('apps/demo/foo.html', HTML_WITH_LITERALS);
    expect(literals).toHaveLength(3);
    expect(literals[0].raw).toEqual({ color: '#1f9b59', contrast: 'white', tone: 18 });
    expect(literals[1].raw).toEqual({ color: '#fff', tone: 50 });
    expect(literals[2].raw).toEqual({ color: '#1f9b59', contrast: 'white', tone: 18 });
    expect(literals.every((l) => l.source === 'html')).toBe(true);
  });
});

describe('groupColorSmells', () => {
  it('collapses normalized-equivalent literals across TS and HTML into one finding', () => {
    const ts = extractTsLiterals('apps/demo/foo.ts', TS_WITH_LITERALS);
    const html = extractHtmlLiterals('apps/demo/foo.html', HTML_WITH_LITERALS);
    const result = groupColorSmells({
      literals: [...ts, ...html],
      equivalenceMode: 'normalized',
      minDuplicates: 2,
      filesScanned: 2
    });
    expect(result.summary.literalsFound).toBe(6);
    expect(result.findings).toHaveLength(2);
    const greenFinding = result.findings.find((f) => f.signature.includes('#1f9b59'));
    expect(greenFinding).toBeDefined();
    expect(greenFinding?.equivalent.length).toBe(4);
    const whiteFinding = result.findings.find((f) => f.signature.includes('#ffffff'));
    expect(whiteFinding).toBeDefined();
    expect(whiteFinding?.equivalent.length).toBe(2);
  });

  it('matches an existing template signature and surfaces its key', () => {
    const ts = extractTsLiterals('apps/demo/foo.ts', TS_WITH_LITERALS);
    const html = extractHtmlLiterals('apps/demo/foo.html', HTML_WITH_LITERALS);
    const templates: ColorTemplateEntry[] = [
      {
        key: 'brand-positive',
        config: { color: '#1f9b59', contrast: 'white', tone: 18 },
        sourceFile: 'apps/demo/src/root.app.config.ts',
        sourceLine: 12
      }
    ];
    const result = groupColorSmells({
      literals: [...ts, ...html],
      equivalenceMode: 'normalized',
      minDuplicates: 2,
      filesScanned: 2,
      templates
    });
    const greenFinding = result.findings.find((f) => f.signature.includes('#1f9b59'));
    expect(greenFinding?.suggestion.existingTemplateKey).toBe('brand-positive');
    const whiteFinding = result.findings.find((f) => f.signature.includes('#ffffff'));
    expect(whiteFinding?.suggestion.existingTemplateKey).toBeUndefined();
    expect(whiteFinding?.suggestion.proposedTemplateKey).toMatch(/^brand-/);
  });

  it('respects exact equivalence mode (case differences become distinct groups)', () => {
    const ts = extractTsLiterals('apps/demo/foo.ts', TS_WITH_LITERALS);
    const result = groupColorSmells({
      literals: ts,
      equivalenceMode: 'exact',
      minDuplicates: 2,
      filesScanned: 1
    });
    // In exact mode, `#1F9B59` and `#1f9b59` are distinct — neither group has 2 occurrences.
    expect(result.findings).toHaveLength(0);
  });

  it('respects minDuplicates threshold', () => {
    const ts = extractTsLiterals('apps/demo/foo.ts', TS_WITH_LITERALS);
    const result = groupColorSmells({
      literals: ts,
      equivalenceMode: 'normalized',
      minDuplicates: 3,
      filesScanned: 1
    });
    // With minDuplicates=3 and only 2 normalized matches for #1f9b59 in TS alone, no findings fire.
    expect(result.findings).toHaveLength(0);
  });

  it('renders markdown and JSON outputs', () => {
    const ts = extractTsLiterals('apps/demo/foo.ts', TS_WITH_LITERALS);
    const html = extractHtmlLiterals('apps/demo/foo.html', HTML_WITH_LITERALS);
    const result = groupColorSmells({
      literals: [...ts, ...html],
      equivalenceMode: 'normalized',
      minDuplicates: 2,
      filesScanned: 2
    });
    const md = formatResultAsMarkdown(result);
    expect(md).toContain('# Color smell check');
    expect(md).toContain('Findings (2)');
    const parsed = JSON.parse(formatResultAsJson(result)) as { readonly findings: readonly { readonly signature: string }[] };
    const byLocale = (a: string, b: string) => a.localeCompare(b);
    expect(parsed.findings.map((f) => f.signature).sort(byLocale)).toEqual(['color=#1f9b59|contrast=white|tone=18|tonal=false', 'color=#ffffff|tone=50|tonal=false'].sort(byLocale));
  });
});
