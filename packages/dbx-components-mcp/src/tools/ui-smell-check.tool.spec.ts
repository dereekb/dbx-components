import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTokenManifests } from '../manifest/tokens-loader.js';
import { loadUiComponentManifests } from '../manifest/ui-components-loader.js';
import { createTokenRegistry, EMPTY_TOKEN_REGISTRY } from '../registry/tokens-runtime.js';
import { createUiComponentRegistry, EMPTY_UI_COMPONENT_REGISTRY } from '../registry/ui-components-runtime.js';
import { detectSmells, detectSmellsDetailed } from './ui-smell-check/index.js';
import { createUiSmellCheckTool } from './ui-smell-check.tool.js';

const PACKAGE_ROOT = resolve(__dirname, '..', '..');
const MANIFESTS_DIR = resolve(PACKAGE_ROOT, 'generated');

async function buildTokenRegistry() {
  const loaded = await loadTokenManifests({
    sources: [
      { origin: 'bundled', path: resolve(MANIFESTS_DIR, 'dereekb-dbx-web.tokens.mcp.generated.json') },
      { origin: 'bundled', path: resolve(MANIFESTS_DIR, 'angular-material-m3.tokens.mcp.generated.json') },
      { origin: 'bundled', path: resolve(MANIFESTS_DIR, 'angular-material-mdc.tokens.mcp.generated.json') }
    ]
  });
  return createTokenRegistry(loaded);
}

async function buildUiRegistry() {
  const loaded = await loadUiComponentManifests({
    sources: [{ origin: 'bundled', path: resolve(MANIFESTS_DIR, 'dereekb-dbx-web.ui-components.mcp.generated.json') }]
  });
  return createUiComponentRegistry(loaded);
}

describe('detectSmells — per-rule', () => {
  it('flags hand-rolled card surfaces', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.card { padding: 24px; background: #fff; border-radius: 12px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.some((m) => m.id === 'card-surface-handrolled')).toBe(true);
  });

  it('flags raw mat-stroked-button', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '<button mat-stroked-button>Skip</button>',
      scss: '',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'raw-mat-button');
    expect(hit).toBeDefined();
    expect(hit?.fix).toContain('dbx-button');
  });

  it('flags hardcoded radius and recommends a token', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { border-radius: 12px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'hardcoded-radius');
    expect(hit).toBeDefined();
    expect(hit?.fix).toContain('--mat-sys-corner-medium');
  });

  it('flags hardcoded hint color rgba', async () => {
    const matches = detectSmells({
      html: '',
      scss: '.hint { color: rgba(0, 0, 0, 0.6); }',
      conventions: {},
      tokenRegistry: EMPTY_TOKEN_REGISTRY,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.some((m) => m.id === 'hardcoded-hint-color')).toBe(true);
  });

  it('flags MDC token overrides', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.bar { --mdc-linear-progress-active-indicator-color: #26353f; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.some((m) => m.id === 'mdc-token-override-instead-of-wrapper')).toBe(true);
  });

  it('flags hardcoded paddings that match a dbx-padding token', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { padding: 12px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'hardcoded-padding');
    expect(hit).toBeDefined();
    expect(hit?.fix).toContain('--dbx-padding-3');
  });

  it('returns nothing for clean SCSS', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '<dbx-content-box><dbx-section header="X" hint="Y"></dbx-section></dbx-content-box>',
      scss: '',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.length).toBe(0);
  });

  it('honors projectConventions.cardWrapperClasses in card-surface fix', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.card { padding: 24px; background: #fff; border-radius: 12px; }',
      conventions: { cardWrapperClasses: ['hellosubs-big-round-corner'] },
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'card-surface-handrolled');
    expect(hit?.fix).toContain('hellosubs-big-round-corner');
  });

  it('does not flag hex literals on the RHS of an SCSS variable declaration', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '$github-star-text: #24292f;\n',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.find((m) => m.id === 'hardcoded-hex-brand-color')).toBeUndefined();
  });

  it('still flags hex literals in regular property declarations', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { color: #24292f; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.find((m) => m.id === 'hardcoded-hex-brand-color')).toBeDefined();
  });

  it('flags hardcoded border-radius in em', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { border-radius: 0.25em; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.find((m) => m.id === 'hardcoded-radius')).toBeDefined();
  });

  it('does not flag radius literals on the RHS of an SCSS variable declaration', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '$github-star-border-radius: 0.25em;\n',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.find((m) => m.id === 'hardcoded-radius')).toBeUndefined();
  });

  it('flags empty rule blocks', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.features {}\n.actual { color: red; }\n',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hits = matches.filter((m) => m.id === 'empty-ruleset');
    expect(hits.length).toBe(1);
    expect(hits[0].snippet).toContain('.features');
  });

  it('flags @use namespaces that are never referenced', async () => {
    const matches = detectSmells({
      html: '',
      scss: "@use '@angular/material' as mat;\n@use 'dbx-web/src/index' as dbx;\n.x { color: red; }\n",
      conventions: {},
      tokenRegistry: EMPTY_TOKEN_REGISTRY,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hits = matches.filter((m) => m.id === 'unused-scss-use');
    expect(hits.length).toBe(2);
    expect(hits.map((h) => h.title).sort((a, b) => a.localeCompare(b))).toEqual(['Unused @use namespace `dbx`', 'Unused @use namespace `mat`']);
  });

  it('does not flag @use namespaces that are referenced', async () => {
    const matches = detectSmells({
      html: '',
      scss: "@use '@angular/material' as mat;\n.x { @include mat.elevation(2); }\n",
      conventions: {},
      tokenRegistry: EMPTY_TOKEN_REGISTRY,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.find((m) => m.id === 'unused-scss-use')).toBeUndefined();
  });
});

describe('createUiSmellCheckTool — integration fixtures', () => {
  it('flags every smell in the steps-card SCSS fixture', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const scss = readFileSync(resolve(__dirname, 'ui-smell-check/__fixtures__/steps-card.scss'), 'utf-8');
    const out = (await tool.run({ scss })) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('card-surface-handrolled');
    expect(text).toContain('hardcoded-radius');
    expect(text).toContain('hardcoded-shadow');
    expect(text).toContain('hardcoded-hint-color');
    expect(text).toContain('hardcoded-padding');
    expect(text).toContain('mdc-token-override');
  });

  it('flags raw mat-button usages in the steps-card HTML fixture', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const html = readFileSync(resolve(__dirname, 'ui-smell-check/__fixtures__/steps-card.html'), 'utf-8');
    const out = (await tool.run({ html })) as { content: { text: string }[] };
    expect(out.content[0].text).toContain('raw-mat-button');
  });

  it('errors when neither html nor scss is provided', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const out = (await tool.run({})) as { content: { text: string }[]; isError?: boolean };
    expect(out.isError).toBe(true);
  });

  it('emits Good signals when no smells are detected', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const out = (await tool.run({
      html: '<dbx-button basic></dbx-button><dbx-button basic></dbx-button><dbx-anchor></dbx-anchor>',
      scss: '.x { padding: var(--dbx-padding-3); color: var(--mat-sys-on-surface); }'
    })) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('Good signals');
    expect(text).toContain('dbx-button ×2');
    expect(text).toContain('dbx-anchor ×1');
    expect(text).toContain('1 `--dbx-*` reference');
    expect(text).toContain('1 `--mat-sys-*` reference');
  });

  it('reads scssPath from disk and produces the same result as inline scss', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const fixturePath = resolve(__dirname, 'ui-smell-check/__fixtures__/steps-card.scss');
    const inline = readFileSync(fixturePath, 'utf-8');
    const fromPath = (await tool.run({ scssPath: fixturePath })) as { content: { text: string }[] };
    const fromString = (await tool.run({ scss: inline })) as { content: { text: string }[] };
    expect(fromPath.content[0].text).toBe(fromString.content[0].text);
  });

  it('errors when both scss and scssPath are provided', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const out = (await tool.run({ scss: '.x {}', scssPath: '/tmp/whatever.scss' })) as { content: { text: string }[]; isError?: boolean };
    expect(out.isError).toBe(true);
  });

  it('errors with a clear message when scssPath does not exist', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const out = (await tool.run({ scssPath: '__nonexistent__/missing.scss' })) as { content: { text: string }[]; isError?: boolean };
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('failed to read scssPath');
  });

  it('does NOT recommend a spacing token when the value has no exact match (4px ≠ --dbx-padding-5)', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { margin-top: 4px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.find((m) => m.id === 'hardcoded-padding')).toBeUndefined();
  });

  it('still recommends an exact-match spacing token for 12px → --dbx-padding-3', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { padding: 12px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'hardcoded-padding');
    expect(hit?.fix).toContain('--dbx-padding-3');
    expect(hit?.fix).not.toContain('--dbx-padding-5');
  });

  it('suppresses sub-findings inside a card-surface block (cascade)', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const result = detectSmellsDetailed({
      html: '',
      scss: '.card { padding: 24px; background: #fff; border-radius: 12px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06); color: rgba(0, 0, 0, 0.6); }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(result.matches.find((m) => m.id === 'card-surface-handrolled')).toBeDefined();
    expect(result.matches.find((m) => m.id === 'hardcoded-radius')).toBeUndefined();
    expect(result.matches.find((m) => m.id === 'hardcoded-shadow')).toBeUndefined();
    expect(result.matches.find((m) => m.id === 'hardcoded-padding')).toBeUndefined();
    expect(result.matches.find((m) => m.id === 'hardcoded-hint-color')).toBeUndefined();
    expect(result.suppressedByCascade).toBeGreaterThan(0);
  });

  it('honors // dbx-smell-ignore on the line above a declaration', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const result = detectSmellsDetailed({
      html: '',
      scss: '.x {\n  // dbx-smell-ignore: hardcoded-radius\n  border-radius: 12px;\n}',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(result.matches.find((m) => m.id === 'hardcoded-radius')).toBeUndefined();
    expect(result.suppressedByDirective).toBe(1);
  });

  it('honors a bare // dbx-smell-ignore directive (all rules)', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const result = detectSmellsDetailed({
      html: '',
      scss: '.x {\n  // dbx-smell-ignore\n  border-radius: 12px;\n}',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(result.matches.find((m) => m.id === 'hardcoded-radius')).toBeUndefined();
    expect(result.suppressedByDirective).toBe(1);
  });

  it('consolidates duplicate findings by (id, dedupKey) and counts merges', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const result = detectSmellsDetailed({
      html: '',
      scss: '.a { border-radius: 10px; }\n.b { border-radius: 10px; }\n.c { border-radius: 10px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const radiusHits = result.matches.filter((m) => m.id === 'hardcoded-radius');
    expect(radiusHits.length).toBe(1);
    expect(result.duplicatesMerged).toBe(2);
  });

  it('annotates each match with line numbers', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '\n\n.x { border-radius: 10px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'hardcoded-radius');
    expect(hit?.line).toBe(3);
    expect(hit?.endLine).toBe(3);
    expect(hit?.source).toBe('scss');
  });

  it('does NOT flag flex-column without card-like children (page-level layout)', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.page { display: flex; flex-direction: column; gap: 24px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.find((m) => m.id === 'flex-column-with-gap-as-card-stack')).toBeUndefined();
  });

  it('does NOT flag flex-column on a page-level layout that ALSO has unrelated nested rules (regression)', async () => {
    const tokenRegistry = await buildTokenRegistry();
    // Mirrors onboard.component.scss style: page-level flex-column + gap with non-card child rules.
    const scss = ['.onboard-page {', '  display: flex;', '  flex-direction: column;', '  gap: 24px;', '', '  .header { font-weight: 600; }', '  .footer-cta { padding: 12px; }', '}'].join('\n');
    const matches = detectSmells({ html: '', scss, conventions: {}, tokenRegistry, uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY });
    expect(matches.find((m) => m.id === 'flex-column-with-gap-as-card-stack')).toBeUndefined();
  });

  it('flags flex-column with card-like child selectors', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.stack { display: flex; flex-direction: column; gap: 24px;\n  mat-card { padding: 12px; }\n}',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    expect(matches.find((m) => m.id === 'flex-column-with-gap-as-card-stack')).toBeDefined();
  });

  it('renders Lstart-end and Locations list in formatted output for consolidated radius', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const out = (await tool.run({ scss: '.a { border-radius: 10px; }\n.b { border-radius: 10px; }' })) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toMatch(/L\d+/);
    expect(text).toContain('Locations (×2)');
    expect(text).toContain('duplicate occurrence');
  });

  it('renders the Informational notes section heading (not "No-match notes")', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const out = (await tool.run({ scss: '.x {} ' })) as { content: { text: string }[] };
    expect(out.content[0].text).toContain('## Informational notes');
    expect(out.content[0].text).not.toContain('## No-match notes');
  });

  it('accepts a batch `paths` array and pairs html/scss by basename', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const htmlPath = resolve(__dirname, 'ui-smell-check/__fixtures__/steps-card.html');
    const scssPath = resolve(__dirname, 'ui-smell-check/__fixtures__/steps-card.scss');
    const out = (await tool.run({ paths: [htmlPath, scssPath] })) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('UI smell check (batch)');
    expect(text).toContain('Scanned **1 file**');
    expect(text).toContain('card-surface-handrolled');
    expect(text).toContain('raw-mat-button');
  });

  it('rejects mixing `paths` with `html`/`scss`', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const out = (await tool.run({ paths: ['/tmp/a.scss'], scss: '.x {}' })) as { content: { text: string }[]; isError?: boolean };
    expect(out.isError).toBe(true);
  });

  it('trims the card-surface snippet to surface-defining declarations only', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.video-card {\n  padding: 24px;\n  background: #fff;\n  border-radius: 12px;\n  .play-button { color: red; }\n  .status-badge { font-weight: bold; }\n  .meta { display: flex; }\n}',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'card-surface-handrolled');
    expect(hit?.snippet).toContain('padding: 24px');
    expect(hit?.snippet).toContain('background: #fff');
    expect(hit?.snippet).toContain('border-radius: 12px');
    expect(hit?.snippet).not.toContain('play-button');
    expect(hit?.snippet).not.toContain('status-badge');
  });

  it('maps idiomatic full-radius synonyms (999px, 9999px, 50%, 100%) to --mat-sys-corner-full', async () => {
    const tokenRegistry = await buildTokenRegistry();
    for (const value of ['999px', '9999px', '50%', '100%']) {
      const matches = detectSmells({
        html: '',
        scss: `.pill { border-radius: ${value}; }`,
        conventions: {},
        tokenRegistry,
        uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
      });
      const hit = matches.find((m) => m.id === 'hardcoded-radius');
      expect(hit, `no radius hit for ${value}`).toBeDefined();
      expect(hit?.fix).toContain('--mat-sys-corner-full');
    }
  });

  it('does not match a numeric radius that is not a synonym (e.g. 7px)', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { border-radius: 7px; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'hardcoded-radius');
    expect(hit?.fix).not.toContain('var(--mat-sys-corner-full)');
    expect(hit?.fix).toContain("doesn't match");
  });

  it('strips nested rules from the card-surface snippet', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const scss = '.video-card {\n' + '  padding: 24px;\n' + '  background: #fff;\n' + '  border-radius: 12px;\n' + '  &__player {\n' + '    background: linear-gradient(135deg, #000, #333);\n' + '  }\n' + '  .play-button {\n' + '    background: rgba(255, 255, 255, 0.85);\n' + '  }\n' + '}';
    const matches = detectSmells({ html: '', scss, conventions: {}, tokenRegistry, uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY });
    const hit = matches.find((m) => m.id === 'card-surface-handrolled');
    expect(hit?.snippet).toContain('background: #fff');
    expect(hit?.snippet).not.toContain('linear-gradient');
    expect(hit?.snippet).not.toContain('rgba(255, 255, 255, 0.85)');
    expect(hit?.snippet).not.toContain('play-button');
  });

  it('renders Informational notes as a per-id digest, not a duplicate listing', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    // Empty rule blocks are info-severity. Two different selectors → two findings, but no duplicate full-detail listing in the digest.
    const out = (await tool.run({ scss: '.a {}\n.b {}\n' })) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).toContain('## Informational notes');
    expect(text).toContain('full detail is in **Detected smells** above');
    expect(text).toMatch(/\*\*empty-ruleset\*\* ×2/);
    // The digest line replaces the verbose per-finding bullets.
    const digestSection = text.slice(text.indexOf('## Informational notes'));
    expect(digestSection).not.toMatch(/Empty rule block/);
  });

  it('derives a project-local SCSS variable prefix from apps/<name> in the path', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { color: #c0ffee; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY,
      scssPath: '/repo/apps/hellosubs/src/app/onboard/onboard.component.scss'
    });
    const hit = matches.find((m) => m.id === 'hardcoded-hex-brand-color');
    expect(hit?.fix).toContain('$hellosubs-onboarding-bg');
    expect(hit?.fix).not.toContain('$myapp-');
  });

  it('falls back to $myapp- when the path does not include apps/<name>', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const matches = detectSmells({
      html: '',
      scss: '.x { color: #c0ffee; }',
      conventions: {},
      tokenRegistry,
      uiComponentRegistry: EMPTY_UI_COMPONENT_REGISTRY
    });
    const hit = matches.find((m) => m.id === 'hardcoded-hex-brand-color');
    expect(hit?.fix).toContain('$myapp-onboarding-bg');
  });

  it('handles the demo landing.scss profile end-to-end (regression)', async () => {
    const tokenRegistry = await buildTokenRegistry();
    const uiComponentRegistry = await buildUiRegistry();
    const tool = createUiSmellCheckTool({ tokenRegistry, uiComponentRegistry, cwd: PACKAGE_ROOT });
    const scss = ["@use '@angular/material' as mat;", "@use 'dbx-web/src/index' as dbx;", '', '$github-star-text: #24292f;', '$github-star-bg: #ebf0f4;', '', '.features {}', '', '.star-on-github { border-radius: 0.25em; color: $github-star-text; }'].join('\n');
    const out = (await tool.run({ scss })) as { content: { text: string }[] };
    const text = out.content[0].text;
    expect(text).not.toContain('hardcoded-hex-brand-color');
    expect(text).toContain('hardcoded-radius');
    expect(text).toContain('empty-ruleset');
    expect(text).toContain('unused-scss-use');
  });
});
