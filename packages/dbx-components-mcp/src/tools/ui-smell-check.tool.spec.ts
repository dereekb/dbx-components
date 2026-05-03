import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTokenManifests } from '../manifest/tokens-loader.js';
import { loadUiComponentManifests } from '../manifest/ui-components-loader.js';
import { createTokenRegistry, EMPTY_TOKEN_REGISTRY } from '../registry/tokens-runtime.js';
import { createUiComponentRegistry, EMPTY_UI_COMPONENT_REGISTRY } from '../registry/ui-components-runtime.js';
import { detectSmells } from './ui-smell-check/index.js';
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
    expect(hits.map((h) => h.title).sort()).toEqual(['Unused @use namespace `dbx`', 'Unused @use namespace `mat`']);
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
