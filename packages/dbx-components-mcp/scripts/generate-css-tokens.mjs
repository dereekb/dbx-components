#!/usr/bin/env node
/**
 * Generates bundled token-manifest JSON files for `@dereekb/dbx-components-mcp`.
 *
 * Modes (chosen via `--source=...`):
 *   • `--source=dbx-web`   — parse @dereekb/dbx-web SCSS: the central style
 *                            files (`_variables.scss` + `_root-variables.scss`
 *                            + `_config.scss`) plus component-scoped `--dbx-*`
 *                            tokens discovered across the component partials,
 *                            into the bundled
 *                            `dereekb-dbx-web.tokens.mcp.generated.json`.
 *   • `--source=dbx-form`  — discover component-scoped `--dbx-*` tokens across
 *                            @dereekb/dbx-form SCSS partials (skipping tokens
 *                            dbx-web already owns) into the bundled
 *                            `dereekb-dbx-form.tokens.mcp.generated.json`.
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
 * Component-scoped tokens are discovered two ways: custom-property
 * *declarations* (`--dbx-foo: value;` inside a component partial) and pure
 * *override points* — tokens that are never declared anywhere and only appear
 * as `var(--dbx-foo, <fallback>)` consumptions that apps set to override.
 * Both forms reach `dbx_css_token_lookup` so the catalog stays authoritative
 * (see the `dbx__note__component-token-convention` skill).
 *
 * Run from the workspace root (`nx run dbx-components-mcp:generate-css-tokens`
 * ensures the cwd contract).
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, '..');
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const GENERATED_ROOT = resolve(WORKSPACE_ROOT, 'packages/dbx-cli/generated');

const BUNDLED_GENERATED_AT = '1970-01-01T00:00:00.000Z';
const GENERATOR_LABEL = '@dereekb/dbx-components-mcp/scripts/generate-css-tokens.mjs';

const DBX_WEB_LIB_ROOT = 'packages/dbx-web/src/lib';
const DBX_WEB_STYLE_ROOT = 'packages/dbx-web/src/lib/style';
const DBX_FORM_LIB_ROOT = 'packages/dbx-form/src/lib';

// Only run the CLI when executed directly — the helpers below are imported by unit tests.
const isExecutedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isExecutedDirectly) {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.source) {
    let exitCode = 0;
    switch (flags.source) {
      case 'dbx-web':
        exitCode = await runDbxWeb(flags);
        break;
      case 'dbx-form':
        exitCode = await runDbxForm(flags);
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
    process.exitCode = exitCode;
  } else {
    console.error('generate-css-tokens: missing --source flag (dbx-web | dbx-form | mat-sys | mdc | app)');
    process.exitCode = 1;
  }
}

// MARK: Modes
async function runDbxWeb(flags) {
  const outPath = resolve(GENERATED_ROOT, 'dereekb-dbx-web.tokens.mcp.generated.json');

  const centralEntries = extractDbxWebCentralTokens();
  const componentEntries = extractComponentTokens({
    rootDir: resolve(WORKSPACE_ROOT, DBX_WEB_LIB_ROOT),
    excludePaths: [resolve(WORKSPACE_ROOT, DBX_WEB_STYLE_ROOT)],
    knownCssVars: new Set(centralEntries.map((e) => e.cssVariable)),
    source: 'dbx-web'
  });

  const entries = [...centralEntries, ...componentEntries];
  entries.sort((a, b) => a.cssVariable.localeCompare(b.cssVariable));

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

async function runDbxForm(flags) {
  const outPath = resolve(GENERATED_ROOT, 'dereekb-dbx-form.tokens.mcp.generated.json');

  // dbx-form SCSS consumes many dbx-web tokens (padding scale, semantic
  // colors, dbx-web component tokens) — those belong to the dbx-web manifest,
  // so the dbx-form manifest only catalogs tokens dbx-web does not own.
  const centralEntries = extractDbxWebCentralTokens();
  const centralCssVars = new Set(centralEntries.map((e) => e.cssVariable));
  const dbxWebComponentEntries = extractComponentTokens({
    rootDir: resolve(WORKSPACE_ROOT, DBX_WEB_LIB_ROOT),
    excludePaths: [resolve(WORKSPACE_ROOT, DBX_WEB_STYLE_ROOT)],
    knownCssVars: centralCssVars,
    source: 'dbx-web'
  });
  const dbxWebCssVars = new Set([...centralCssVars, ...dbxWebComponentEntries.map((e) => e.cssVariable)]);

  const entries = extractComponentTokens({
    rootDir: resolve(WORKSPACE_ROOT, DBX_FORM_LIB_ROOT),
    knownCssVars: dbxWebCssVars,
    source: 'dbx-form'
  });

  const manifest = {
    version: 1,
    source: 'dereekb-dbx-form',
    module: '@dereekb/dbx-form',
    generatedAt: BUNDLED_GENERATED_AT,
    generator: GENERATOR_LABEL,
    entries
  };
  return writeManifest(outPath, manifest, flags);
}

function extractDbxWebCentralTokens() {
  const variablesPath = resolve(WORKSPACE_ROOT, `${DBX_WEB_STYLE_ROOT}/_variables.scss`);
  const rootVariablesPath = resolve(WORKSPACE_ROOT, `${DBX_WEB_STYLE_ROOT}/_root-variables.scss`);
  const configPath = resolve(WORKSPACE_ROOT, `${DBX_WEB_STYLE_ROOT}/_config.scss`);
  return extractDbxWebTokens({ variablesPath, rootVariablesPath, configPath });
}

async function runCuratedSource(srcName, outName, flags) {
  const srcPath = resolve(WORKSPACE_ROOT, 'packages/dbx-cli/src/lib/mcp-scan/manifest/sources', srcName);
  const outPath = resolve(GENERATED_ROOT, outName);
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
      defaults: lightValue === undefined ? {} : { light: lightValue }
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

function applySassdocBlock(buffer, rawLine, cssToScss, result) {
  const declMatch = /^\s*(\$[A-Za-z0-9_-]+)\s*:\s*(--[A-Za-z0-9_-]+)\s*;/.exec(rawLine);
  if (declMatch !== null) {
    const cssVar = declMatch[2];
    if (cssToScss.has(cssVar)) {
      result.set(cssVar, parseSassdocLines(buffer));
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
      applySassdocBlock(buffer, rawLine, cssToScss, result);
      buffer = [];
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

// MARK: Component-token extractor
/**
 * Discovers component-scoped `--dbx-*` tokens across a package's SCSS
 * partials: both declarations (`--dbx-foo: value;`) and pure override
 * points that only ever appear as `var(--dbx-foo, <fallback>)` consumptions.
 * Tokens in `knownCssVars` (the central/global layer) are skipped.
 */
function extractComponentTokens({ rootDir, excludePaths = [], knownCssVars, source }) {
  const files = listScssFiles(rootDir, excludePaths);
  const byCssVar = new Map();

  for (const file of files) {
    const scss = readFileSync(file, 'utf-8');
    const { declarations, consumptions } = parseComponentTokensInScss(scss);
    const scssLiterals = parseScssVariableLiterals(scss);
    const relPath = relative(WORKSPACE_ROOT, file);
    const componentScope = componentScopeForFile(file);

    for (const [cssVar, decl] of declarations.entries()) {
      if (knownCssVars.has(cssVar)) continue;
      const existing = byCssVar.get(cssVar);
      if (existing === undefined || existing.declared !== true) {
        byCssVar.set(cssVar, { cssVar, declared: true, value: resolveScssInValue(decl.value, scssLiterals), doc: decl.doc, relPath, componentScope });
      }
    }

    for (const [cssVar, use] of consumptions.entries()) {
      if (knownCssVars.has(cssVar)) continue;
      const fallback = use.fallback === undefined ? undefined : resolveScssInValue(use.fallback, scssLiterals);
      const existing = byCssVar.get(cssVar);
      if (existing === undefined) {
        byCssVar.set(cssVar, { cssVar, declared: false, fallback, relPath, componentScope });
      } else if (existing.declared !== true && existing.fallback === undefined && fallback !== undefined) {
        existing.fallback = fallback;
      }
    }
  }

  const entries = [];
  for (const item of byCssVar.values()) {
    const doc = item.doc ?? {};
    const role = doc.role ?? inferRole(item.cssVar);
    const intents = doc.intents && doc.intents.length > 0 ? doc.intents : inferIntents(item.cssVar, role);
    const description = doc.description ?? defaultComponentDescription(item);
    const defaultValue = item.declared === true ? item.value : item.fallback;
    /** @type {Record<string, unknown>} */
    const entry = {
      cssVariable: item.cssVar,
      source,
      role,
      intents,
      description,
      defaults: defaultValue === undefined ? {} : { light: defaultValue },
      componentScope: item.componentScope
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

/**
 * Parses one SCSS file for component-token declarations (with any `///`
 * sassdoc block immediately above) and `var(--dbx-*)` consumption sites.
 */
function parseComponentTokensInScss(scss) {
  const declarations = new Map();
  const consumptions = new Map();

  const lines = scss.split(/\r?\n/);
  let docBuffer = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('///')) {
      docBuffer.push(trimmed.replace(/^\/{3}\s?/, ''));
      continue;
    }
    const declMatch = /^\s*(--dbx-[A-Za-z0-9_-]+)\s*:\s*([^;]+);/.exec(rawLine);
    if (declMatch !== null && !declarations.has(declMatch[1])) {
      declarations.set(declMatch[1], { value: declMatch[2].trim(), doc: docBuffer.length > 0 ? parseSassdocLines(docBuffer) : undefined });
    }
    docBuffer = [];
  }

  for (const use of findDbxVarUses(scss)) {
    const existing = consumptions.get(use.cssVar);
    if (existing === undefined || (existing.fallback === undefined && use.fallback !== undefined)) {
      consumptions.set(use.cssVar, { fallback: use.fallback });
    }
  }

  return { declarations, consumptions };
}

/**
 * Finds every `var(--dbx-…)` reference in the SCSS, capturing the full
 * (balanced-paren) fallback expression when one is present — fallbacks
 * commonly nest further `var()` chains.
 */
function findDbxVarUses(scss) {
  const uses = [];
  const re = /var\(\s*(--dbx-[A-Za-z0-9_-]+)/g;
  let match;
  while ((match = re.exec(scss)) !== null) {
    const openIndex = scss.indexOf('(', match.index);
    let depth = 0;
    let end = -1;
    for (let i = openIndex; i < scss.length; i += 1) {
      const ch = scss[i];
      if (ch === '(') {
        depth += 1;
      } else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    let fallback;
    if (end !== -1) {
      const inner = scss.slice(openIndex + 1, end);
      const commaIndex = inner.indexOf(',');
      if (commaIndex !== -1) fallback = inner.slice(commaIndex + 1).trim();
    }
    uses.push({ cssVar: match[1], fallback });
  }
  return uses;
}

function listScssFiles(rootDir, excludePaths = []) {
  const out = [];
  const walk = (dir) => {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, dirent.name);
      if (excludePaths.some((p) => full === p || full.startsWith(`${p}/`))) continue;
      if (dirent.isDirectory()) {
        walk(full);
      } else if (dirent.isFile() && dirent.name.endsWith('.scss')) {
        out.push(full);
      }
    }
  };
  walk(rootDir);
  out.sort();
  return out;
}

function componentScopeForFile(filePath) {
  return basename(filePath, '.scss')
    .replace(/^_/, '')
    .replace(/\.(component|directive)$/, '');
}

/**
 * Collects simple `$name: <literal>;` SCSS variable declarations so captured
 * token values can surface resolved literals (`240px`) instead of SCSS-side
 * references (`#{$width}`). Chained `$a: $b;` references resolve through a
 * bounded number of passes; anything unresolvable stays verbatim.
 */
function parseScssVariableLiterals(scss) {
  const map = new Map();
  const re = /^\s*(\$[A-Za-z0-9_-]+)\s*:\s*([^;]+);/gm;
  let match;
  while ((match = re.exec(scss)) !== null) {
    map.set(match[1], match[2].replace(/\s*!default\s*$/, '').trim());
  }
  for (let pass = 0; pass < 3; pass += 1) {
    for (const [name, value] of map.entries()) {
      if (/^\$[A-Za-z0-9_-]+$/.test(value) && map.has(value)) {
        map.set(name, map.get(value));
      }
    }
  }
  return map;
}

/**
 * Replaces `#{$name}` interpolations and bare `$name` references in a captured
 * value with their same-file literal, when one resolved. Namespaced refs
 * (`theming.$x`) and unresolved variables are left verbatim.
 */
function resolveScssInValue(value, scssLiterals) {
  const resolveName = (full, name) => {
    const resolved = scssLiterals.get(name);
    return resolved !== undefined && !resolved.includes('$') ? resolved : full;
  };
  return value.replace(/#\{(\$[A-Za-z0-9_-]+)\}/g, resolveName).replace(/(?<![\w.])(\$[A-Za-z0-9_-]+)(?![\w-])/g, resolveName);
}

function defaultComponentDescription(item) {
  if (item.declared === true) {
    return `Component-scoped token (\`${item.componentScope}\`) declared in \`${item.relPath}\`. Add a sassdoc \`///\` block above the declaration for richer guidance.`;
  }
  return `Component-scoped override point (\`${item.componentScope}\`) read in \`${item.relPath}\` — set it (from an app, or via the owning dbx directive where one exists) to override${item.fallback === undefined ? '' : `; unset, it falls back to \`${item.fallback}\``}.`;
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
      defaults: doc.light === undefined ? {} : { light: doc.light, ...(doc.dark === undefined ? {} : { dark: doc.dark }) }
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
export { parseSassdocLines, parseVarDecls, parseSassdocBlocks, parseRootDefaults, inferRole, inferIntents, parseComponentTokensInScss, findDbxVarUses, componentScopeForFile, extractComponentTokens };
