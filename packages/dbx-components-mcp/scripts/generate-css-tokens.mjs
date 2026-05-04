#!/usr/bin/env node
/**
 * Generates bundled token-manifest JSON files for `@dereekb/dbx-components-mcp`.
 *
 * Modes (chosen via `--source=...`):
 *   • `--source=dbx-web`   — parse @dereekb/dbx-web SCSS (`_variables.scss` +
 *                            `_root-variables.scss` + `_config.scss`) into the
 *                            bundled `dereekb-dbx-web.tokens.mcp.generated.json`.
 *   • `--source=mat-sys`   — copy the hand-curated source file at
 *                            `src/manifest/sources/angular-material-m3.tokens.source.json`
 *                            to the bundled output, stamping the deterministic
 *                            generatedAt sentinel.
 *   • `--source=mdc`       — same as mat-sys but for the `angular-material-mdc`
 *                            source.
 *   • `--source=app --config=<path>` — read the workspace config's
 *                            `tokens.scan[]` block and emit per-project token
 *                            manifests for each entry's SCSS includes.
 *
 * The SCSS extractor parses `///` sassdoc comments (intent / role / anti-use /
 * utility / see) immediately above each variable declaration. Tokens without
 * doc comments still get an entry; their `role` is inferred from name
 * heuristics (`*-color*` → `color`, `*padding*|*margin*|*gap*` → `spacing`,
 * `*radius*` → `radius`, etc.).
 *
 * Run from the workspace root (`nx run dbx-components-mcp:generate-css-tokens`
 * ensures the cwd contract).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, '..');
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '..', '..');

const BUNDLED_GENERATED_AT = '1970-01-01T00:00:00.000Z';
const GENERATOR_LABEL = '@dereekb/dbx-components-mcp/scripts/generate-css-tokens.mjs';

const argv = process.argv.slice(2);
const flags = parseFlags(argv);

if (!flags.source) {
  console.error('generate-css-tokens: missing --source flag (dbx-web | mat-sys | mdc | app)');
  process.exit(1);
}

let exitCode = 0;
switch (flags.source) {
  case 'dbx-web':
    exitCode = await runDbxWeb(flags);
    break;
  case 'mat-sys':
    exitCode = await runCuratedSource('angular-material-m3.tokens.source.json', 'angular-material-m3.tokens.mcp.generated.json', flags);
    break;
  case 'mdc':
    exitCode = await runCuratedSource('angular-material-mdc.tokens.source.json', 'angular-material-mdc.tokens.mcp.generated.json', flags);
    break;
  case 'app':
    exitCode = await runAppScans(flags);
    break;
  default:
    console.error(`generate-css-tokens: unknown --source value: ${flags.source}`);
    exitCode = 1;
}
process.exit(exitCode);

// MARK: Modes
async function runDbxWeb(flags) {
  const variablesPath = resolve(WORKSPACE_ROOT, 'packages/dbx-web/src/lib/style/_variables.scss');
  const rootVariablesPath = resolve(WORKSPACE_ROOT, 'packages/dbx-web/src/lib/style/_root-variables.scss');
  const configPath = resolve(WORKSPACE_ROOT, 'packages/dbx-web/src/lib/style/_config.scss');
  const outPath = resolve(PACKAGE_ROOT, 'generated/dereekb-dbx-web.tokens.mcp.generated.json');

  const entries = extractDbxWebTokens({ variablesPath, rootVariablesPath, configPath });
  const manifest = {
    version: 1,
    source: 'dereekb-dbx-web',
    module: '@dereekb/dbx-web',
    generatedAt: BUNDLED_GENERATED_AT,
    generator: GENERATOR_LABEL,
    entries
  };
  return writeManifest(outPath, manifest, flags);
}

async function runCuratedSource(srcName, outName, flags) {
  const srcPath = resolve(PACKAGE_ROOT, 'src/manifest/sources', srcName);
  const outPath = resolve(PACKAGE_ROOT, 'generated', outName);
  const raw = readFileSync(srcPath, 'utf-8');
  const parsed = JSON.parse(raw);
  parsed.generatedAt = BUNDLED_GENERATED_AT;
  parsed.generator = GENERATOR_LABEL;
  return writeManifest(outPath, parsed, flags);
}

async function runAppScans(flags) {
  if (!flags.config) {
    console.error('generate-css-tokens --source=app: missing --config flag');
    return 1;
  }
  const configPath = resolve(process.cwd(), flags.config);
  const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
  const scanEntries = cfg.tokens && Array.isArray(cfg.tokens.scan) ? cfg.tokens.scan : [];
  if (scanEntries.length === 0) {
    console.warn('generate-css-tokens --source=app: no `tokens.scan[]` entries declared');
    return 0;
  }
  const baseDir = dirname(configPath);
  let exit = 0;
  for (const scan of scanEntries) {
    const includes = (scan.include ?? []).map((p) => resolve(baseDir, p));
    const entries = [];
    for (const include of includes) {
      try {
        const tokens = parseScssTokens(include);
        for (const t of tokens) entries.push(t);
      } catch (err) {
        console.warn(`generate-css-tokens: skipping unreadable include ${include}: ${err.message}`);
      }
    }
    const outPath = resolve(baseDir, scan.out);
    const manifest = {
      version: 1,
      source: scan.source,
      module: scan.module ?? scan.source,
      generatedAt: new Date().toISOString(),
      generator: GENERATOR_LABEL,
      entries: entries.map((e) => ({ ...e, source: 'app' }))
    };
    if (writeManifest(outPath, manifest, flags) !== 0) {
      exit = 1;
    }
  }
  return exit;
}

// MARK: dbx-web extractor
function extractDbxWebTokens({ variablesPath, rootVariablesPath, configPath }) {
  const variables = readFileSync(variablesPath, 'utf-8');
  const rootVariables = readFileSync(rootVariablesPath, 'utf-8');
  const configRaw = readFileSync(configPath, 'utf-8');

  const cssToScss = new Map();
  const scssToCss = new Map();
  parseVarDecls(variables, cssToScss, scssToCss);

  const sassdocByCss = parseSassdocBlocks(variables, cssToScss);

  const valueByCss = parseRootDefaults(rootVariables, scssToCss);
  applyConfigDefaults(configRaw, valueByCss);

  const entries = [];
  for (const [cssVar, scssVar] of cssToScss.entries()) {
    if (cssVar === '--vh100') continue;
    const doc = sassdocByCss.get(cssVar) ?? {};
    const role = doc.role ?? inferRole(cssVar);
    const fallbackValue = valueByCss.get(cssVar);
    const lightValue = doc.light ?? fallbackValue;
    const description = doc.description ?? defaultDescription(cssVar);
    const intents = doc.intents && doc.intents.length > 0 ? doc.intents : inferIntents(cssVar, role);
    /** @type {Record<string, unknown>} */
    const entry = {
      cssVariable: cssVar,
      scssVariable: scssVar,
      source: 'dbx-web',
      role,
      intents,
      description,
      defaults: lightValue !== undefined ? { light: lightValue } : {}
    };
    if (doc.antiUseNotes !== undefined) entry.antiUseNotes = doc.antiUseNotes;
    if (doc.utilityClasses !== undefined && doc.utilityClasses.length > 0) entry.utilityClasses = doc.utilityClasses;
    if (doc.recommendedPrimitive !== undefined) entry.recommendedPrimitive = doc.recommendedPrimitive;
    if (doc.seeAlso !== undefined && doc.seeAlso.length > 0) entry.seeAlso = doc.seeAlso;
    entries.push(entry);
  }
  entries.sort((a, b) => a.cssVariable.localeCompare(b.cssVariable));
  return entries;
}

function parseVarDecls(scss, cssToScss, scssToCss) {
  const re = /^\s*(\$[A-Za-z0-9_-]+)\s*:\s*(--[A-Za-z0-9_-]+)\s*;/gm;
  let match;
  while ((match = re.exec(scss)) !== null) {
    const scssVar = match[1];
    const cssVar = match[2];
    if (scssVar.endsWith('-var')) {
      cssToScss.set(cssVar, scssVar);
      scssToCss.set(scssVar, cssVar);
    }
  }
}

function parseSassdocBlocks(scss, cssToScss) {
  const result = new Map();
  const lines = scss.split(/\r?\n/);
  let buffer = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('///')) {
      buffer.push(line.replace(/^\/{3}\s?/, ''));
      continue;
    }
    if (buffer.length > 0) {
      const declMatch = /^\s*(\$[A-Za-z0-9_-]+)\s*:\s*(--[A-Za-z0-9_-]+)\s*;/.exec(rawLine);
      if (declMatch !== null) {
        const cssVar = declMatch[2];
        if (cssToScss.has(cssVar)) {
          result.set(cssVar, parseSassdocLines(buffer));
        }
      } else if (line.length > 0) {
        // non-blank, non-decl line — drop the buffer
      }
      // blank line or matched decl — reset
      if (declMatch !== null || line.length === 0 || !line.startsWith('///')) {
        buffer = [];
      }
    }
  }
  return result;
}

function parseSassdocLines(lines) {
  const intents = [];
  const utilityClasses = [];
  const seeAlso = [];
  const descriptionLines = [];
  let role;
  let antiUseNotes;
  let recommendedPrimitive;
  let light;
  let dark;
  for (const line of lines) {
    if (line.startsWith('@intent ')) {
      const value = line.slice('@intent '.length).trim();
      for (const item of value.split(',')) {
        const trimmed = item.trim();
        if (trimmed.length > 0) intents.push(trimmed);
      }
    } else if (line.startsWith('@role ')) {
      role = line.slice('@role '.length).trim();
    } else if (line.startsWith('@anti-use ')) {
      antiUseNotes = line.slice('@anti-use '.length).trim();
    } else if (line.startsWith('@utility ')) {
      const value = line.slice('@utility '.length).trim();
      for (const item of value.split(',')) {
        const trimmed = item.trim();
        if (trimmed.length > 0) utilityClasses.push(trimmed);
      }
    } else if (line.startsWith('@see ')) {
      const value = line.slice('@see '.length).trim();
      for (const item of value.split(/\s+/)) {
        if (item.length > 0) seeAlso.push(item);
      }
    } else if (line.startsWith('@primitive ')) {
      recommendedPrimitive = line.slice('@primitive '.length).trim();
    } else if (line.startsWith('@light ')) {
      light = line.slice('@light '.length).trim();
    } else if (line.startsWith('@dark ')) {
      dark = line.slice('@dark '.length).trim();
    } else if (line.length > 0) {
      descriptionLines.push(line);
    }
  }
  return {
    description: descriptionLines.join(' ').trim() || undefined,
    intents,
    role,
    antiUseNotes,
    utilityClasses,
    seeAlso,
    recommendedPrimitive,
    light,
    dark
  };
}

function parseRootDefaults(rootScss, scssToCss) {
  const result = new Map();
  // Match #{theming.$x-var}: <value>;
  const re = /#\{theming\.(\$[A-Za-z0-9_-]+)\}\s*:\s*([^;]+?);/g;
  let match;
  while ((match = re.exec(rootScss)) !== null) {
    const scssVar = match[1];
    const value = match[2].trim();
    const cssVar = scssToCss.get(scssVar);
    if (cssVar !== undefined && !result.has(cssVar)) {
      result.set(cssVar, value);
    }
  }
  return result;
}

function applyConfigDefaults(configScss, valueByCss) {
  // Resolve `theming.get-dbx-layout-padding(...)` style refs to literal values
  // by reading `_config.scss`'s default layout map.
  const map = new Map();
  const layoutRe = /'([\w-]+)'\s*:\s*([^,\n]+?)\s*,/g;
  let match;
  while ((match = layoutRe.exec(configScss)) !== null) {
    map.set(match[1], match[2].trim());
  }
  const overrides = [
    ['--dbx-padding-0', map.get('padding-0')],
    ['--dbx-padding-1', map.get('padding-1')],
    ['--dbx-padding-2', map.get('padding-2')],
    ['--dbx-padding-3', map.get('padding-3')],
    ['--dbx-padding-4', map.get('padding-4')],
    ['--dbx-padding-5', map.get('padding-5')],
    ['--dbx-page-navbar-height', map.get('page-navbar-height')],
    ['--dbx-content-navbar-height', map.get('content-navbar-height')],
    ['--dbx-box-max-width', map.get('box-max-width')],
    ['--dbx-content-max-width', map.get('content-max-width')],
    ['--dbx-two-column-left-width', map.get('two-column-left-width')],
    ['--dbx-avatar-size', map.get('dbx-avatar-size')],
    ['--dbx-avatar-large-size', map.get('dbx-avatar-large-size')],
    ['--dbx-avatar-small-size', map.get('dbx-avatar-small-size')]
  ];
  for (const [cssVar, value] of overrides) {
    if (value !== undefined) {
      valueByCss.set(cssVar, value);
    }
  }
}

function inferRole(cssVar) {
  const lower = cssVar.toLowerCase();
  let role = 'misc';
  if (/(color|color-contrast|-bg-)/.test(lower)) {
    role = lower.includes('on-') ? 'text-color' : 'color';
  } else if (/(padding|margin|gap|space)/.test(lower)) {
    role = 'spacing';
  } else if (/(radius|corner)/.test(lower)) {
    role = 'radius';
  } else if (/(shadow)/.test(lower)) {
    role = 'shadow';
  } else if (/(elevation|level)/.test(lower)) {
    role = 'elevation';
  } else if (/(height|width|size|max-height|max-width)/.test(lower)) {
    role = 'size';
  } else if (/(font|typography|text-style)/.test(lower)) {
    role = 'typography';
  } else if (/(motion|duration|easing)/.test(lower)) {
    role = 'motion';
  }
  return role;
}

function inferIntents(cssVar, role) {
  const stripped = cssVar
    .replace(/^--dbx-/, '')
    .replace(/-var$/, '')
    .replaceAll('-', ' ');
  const intents = [stripped];
  if (role === 'text-color') intents.push(`${stripped} text`);
  if (role === 'spacing') intents.push(`${stripped} spacing`);
  if (role === 'radius') intents.push(`${stripped} radius`);
  return intents;
}

function defaultDescription(cssVar) {
  return `Auto-extracted token \`${cssVar}\`. Add a sassdoc \`///\` block above the declaration in dbx-web for richer guidance.`;
}

function parseScssTokens(filePath) {
  const scss = readFileSync(filePath, 'utf-8');
  const cssToScss = new Map();
  const scssToCss = new Map();
  parseVarDecls(scss, cssToScss, scssToCss);
  const docs = parseSassdocBlocks(scss, cssToScss);
  const out = [];
  for (const [cssVar, scssVar] of cssToScss.entries()) {
    const doc = docs.get(cssVar) ?? {};
    const role = doc.role ?? inferRole(cssVar);
    const description = doc.description ?? defaultDescription(cssVar);
    const intents = doc.intents && doc.intents.length > 0 ? doc.intents : inferIntents(cssVar, role);
    const entry = {
      cssVariable: cssVar,
      scssVariable: scssVar,
      role,
      intents,
      description,
      defaults: doc.light !== undefined ? { light: doc.light, ...(doc.dark !== undefined ? { dark: doc.dark } : {}) } : {}
    };
    if (doc.antiUseNotes !== undefined) entry.antiUseNotes = doc.antiUseNotes;
    if (doc.utilityClasses !== undefined && doc.utilityClasses.length > 0) entry.utilityClasses = doc.utilityClasses;
    if (doc.recommendedPrimitive !== undefined) entry.recommendedPrimitive = doc.recommendedPrimitive;
    if (doc.seeAlso !== undefined && doc.seeAlso.length > 0) entry.seeAlso = doc.seeAlso;
    out.push(entry);
  }
  return out;
}

// MARK: I/O
function writeManifest(outPath, manifest, flags) {
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  if (flags.check) {
    let existing;
    try {
      existing = readFileSync(outPath, 'utf-8');
    } catch {
      existing = '';
    }
    if (existing !== json) {
      console.error(`generate-css-tokens: stale manifest at ${relative(WORKSPACE_ROOT, outPath)}`);
      return 1;
    }
    return 0;
  }
  writeFileSync(outPath, json, 'utf-8');
  console.log(`generate-css-tokens: wrote ${relative(WORKSPACE_ROOT, outPath)} (${manifest.entries.length} entries)`);
  return 0;
}

function parseFlags(argv) {
  const flags = {};
  for (const arg of argv) {
    if (arg === '--check') flags.check = true;
    else if (arg.startsWith('--source=')) flags.source = arg.slice('--source='.length);
    else if (arg.startsWith('--config=')) flags.config = arg.slice('--config='.length);
  }
  return flags;
}

// expose helpers for unit tests
export { parseSassdocLines, parseVarDecls, parseSassdocBlocks, parseRootDefaults, inferRole, inferIntents };
