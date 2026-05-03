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
});
