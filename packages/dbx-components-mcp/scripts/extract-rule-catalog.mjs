#!/usr/bin/env node
/* eslint-disable import/default */
/**
 * Extracts the rule catalog from per-cluster `codes.ts` enums and emits
 * packages/dbx-components-mcp/generated/rule-catalog.generated.json
 * (consumed at runtime) plus the typed re-export
 * packages/dbx-components-mcp/generated/rule-catalog.generated.ts.
 *
 * Walks every `src/tools/<cluster>/codes.ts` (plus the special-cased
 * `model-fixture-shared/codes.ts`) using ts-morph, reads the JSDoc
 * summary + `@dbxRule*` tags off each enum member, and assembles the
 * `RuleEntry[]` shape declared in `src/tools/rule-catalog/types.ts`.
 *
 * Fails the build (non-zero exit) when:
 *   - A required tag (`@dbxRuleSeverity`, `@dbxRuleApplies`,
 *     `@dbxRuleNotApplies`, `@dbxRuleFix`) is missing.
 *   - `@dbxRuleSeverity` is anything other than `error` / `warning`.
 *   - The cluster folder does not appear in the
 *     CLUSTER_TO_SOURCE map below (an unknown cluster joining the
 *     catalog must be intentionally registered here).
 */

import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { Project } from 'ts-morph';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');
const TOOLS_ROOT = join(WORKSPACE_ROOT, 'packages/dbx-components-mcp/src/tools');
const OUTPUT_JSON = join(WORKSPACE_ROOT, 'packages/dbx-components-mcp/generated/rule-catalog.generated.json');
const OUTPUT_TS = join(WORKSPACE_ROOT, 'packages/dbx-components-mcp/generated/rule-catalog.generated.ts');

/**
 * Maps the cluster folder name (where `codes.ts` lives) to the MCP
 * tool name that emits the violations. New clusters joining the
 * catalog must be added here.
 */
const CLUSTER_TO_SOURCE = {
  'model-validate': 'dbx_model_validate',
  'model-validate-api': 'dbx_model_validate_api',
  'model-validate-folder': 'dbx_model_validate_folder',
  'model-fixture-shared': 'dbx_model_fixture_validate_app',
  'storagefile-m-validate-app': 'dbx_storagefile_m_validate_app',
  'storagefile-m-validate-folder': 'dbx_storagefile_m_validate_folder',
  'notification-m-validate-app': 'dbx_notification_m_validate_app',
  'notification-m-validate-folder': 'dbx_notification_m_validate_folder',
  'system-m-validate-folder': 'dbx_system_m_validate_folder'
};

const REQUIRED_TAGS = ['dbxRuleSeverity', 'dbxRuleApplies', 'dbxRuleNotApplies', 'dbxRuleFix'];

async function main() {
  const codeFiles = findCodesFiles();
  if (codeFiles.length === 0) {
    console.warn('No codes.ts files found — emitting empty catalog.');
  }

  const project = new Project({
    tsConfigFilePath: join(WORKSPACE_ROOT, 'tsconfig.base.json'),
    skipAddingFilesFromTsConfig: true
  });

  const entries = [];
  const errors = [];

  for (const file of codeFiles) {
    const cluster = relative(TOOLS_ROOT, dirname(file)).split(/[\\/]/)[0];
    const source = CLUSTER_TO_SOURCE[cluster];
    if (!source) {
      errors.push(`${relPath(file)}: cluster '${cluster}' is not registered in CLUSTER_TO_SOURCE — add it to the extractor.`);
      continue;
    }
    const sourceFile = project.addSourceFileAtPath(file);
    const enums = sourceFile.getEnums();
    if (enums.length === 0) {
      errors.push(`${relPath(file)}: expected one exported enum, found none.`);
      continue;
    }
    if (enums.length > 1) {
      errors.push(`${relPath(file)}: expected one exported enum, found ${enums.length}.`);
      continue;
    }
    const enumDecl = enums[0];
    if (!enumDecl.isExported()) {
      errors.push(`${relPath(file)}: enum '${enumDecl.getName()}' must be exported.`);
      continue;
    }

    for (const member of enumDecl.getMembers()) {
      const result = buildEntry({ member, source, file });
      if (result.kind === 'error') {
        errors.push(...result.messages);
        continue;
      }
      entries.push(result.entry);
    }
  }

  if (errors.length > 0) {
    console.error('Rule catalog extraction failed:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  // Sort for stable output: source, then code.
  entries.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });

  writeFileSync(OUTPUT_JSON, JSON.stringify(entries, null, 2) + '\n');
  const tsRaw = emitTs(entries);
  const tsFormatted = await formatWithPrettier(tsRaw);
  writeFileSync(OUTPUT_TS, tsFormatted);
  console.log(`Wrote ${entries.length} rule catalog entries to ${relPath(OUTPUT_JSON)} and ${relPath(OUTPUT_TS)}.`);
}

function findCodesFiles() {
  const out = [];
  if (!existsSync(TOOLS_ROOT)) return out;
  for (const entry of readdirSync(TOOLS_ROOT)) {
    const sub = join(TOOLS_ROOT, entry);
    if (!isDir(sub)) continue;
    const candidate = join(sub, 'codes.ts');
    if (existsSync(candidate)) out.push(candidate);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function buildEntry({ member, source, file }) {
  // Use the enum member's runtime value as the catalog code so the
  // string emitted at validator runtime matches what `dbx_explain_rule`
  // surfaces. Falls back to the member name when no initializer is
  // declared (TypeScript would auto-number the member, but our enums
  // always assign explicit string literals).
  const value = member.getValue();
  const code = typeof value === 'string' && value.length > 0 ? value : member.getName();
  const messages = [];
  const jsDocs = member.getJsDocs();
  if (jsDocs.length === 0) {
    messages.push(`${relPath(file)}: enum member '${code}' has no JSDoc; required @dbxRule* tags missing.`);
    return { kind: 'error', messages };
  }
  const raw = readJsDoc(jsDocs[0]);
  for (const tag of REQUIRED_TAGS) {
    if (!raw.tags.has(tag) || raw.tags.get(tag).trim().length === 0) {
      messages.push(`${relPath(file)}: enum member '${code}' is missing required tag @${tag}.`);
    }
  }
  if (messages.length > 0) return { kind: 'error', messages };

  const severity = raw.tags.get('dbxRuleSeverity').trim();
  if (severity !== 'error' && severity !== 'warning') {
    messages.push(`${relPath(file)}: enum member '${code}' has invalid @dbxRuleSeverity '${severity}' (expected 'error' or 'warning').`);
    return { kind: 'error', messages };
  }

  const summary = raw.summary.trim();
  // Title: first line of the summary, with trailing period dropped. The
  // summary may include backtick-quoted code with internal periods, so
  // we deliberately don't sentence-split.
  const firstLine = summary.split('\n', 1)[0].trim();
  const title = firstLine.replace(/\.$/, '') || code;

  const seeAlsoRaw = raw.tagList.get('dbxRuleSeeAlso') ?? [];
  const seeAlso = seeAlsoRaw.map(parseSeeAlso).filter(Boolean);

  const entry = {
    code,
    source,
    severity,
    title,
    whatItFlags: summary,
    whenItApplies: raw.tags.get('dbxRuleApplies').trim(),
    whenItDoesNotApply: raw.tags.get('dbxRuleNotApplies').trim(),
    canonicalFix: raw.tags.get('dbxRuleFix').trim()
  };

  const template = raw.tags.get('dbxRuleTemplate');
  if (template !== undefined && template.trim().length > 0) {
    entry.canonicalFixTemplate = template.trim();
  }
  if (seeAlso.length > 0) {
    entry.seeAlso = seeAlso;
  }
  return { kind: 'ok', entry };
}

/**
 * Reads one JSDoc node into a `{ summary, tags, tagList }` shape.
 *
 * - `summary` is the leading description.
 * - `tags` is `Map<tagName, last-tag-text>`.
 * - `tagList` is `Map<tagName, all-tag-texts>` (for repeatable tags).
 *
 * Body text is preserved verbatim (with leading whitespace stripped from
 * each line) so `@dbxRuleTemplate` fenced code blocks survive intact.
 */
function readJsDoc(jsDoc) {
  const tags = new Map();
  const tagList = new Map();
  const summary = jsDoc.getDescription();
  for (const tag of jsDoc.getTags()) {
    const name = tag.getTagName();
    const text = tag.getCommentText() ?? '';
    tags.set(name, text);
    const list = tagList.get(name);
    if (list === undefined) {
      tagList.set(name, [text]);
    } else {
      list.push(text);
    }
  }
  return { summary, tags, tagList };
}

function parseSeeAlso(raw) {
  const idx = raw.indexOf(':');
  if (idx <= 0) return undefined;
  const kind = raw.slice(0, idx).trim();
  if (kind !== 'artifact' && kind !== 'tool' && kind !== 'doc') return undefined;
  const target = raw.slice(idx + 1).trim();
  if (!target) return undefined;
  return { kind, target };
}

function emitTs(entries) {
  const json = JSON.stringify(entries, null, 2);
  return ['// THIS FILE IS GENERATED by scripts/extract-rule-catalog.mjs.', '// Do not edit by hand. Run `npx nx generate-rule-catalog dbx-components-mcp`.', '', "import type { RuleEntry } from '../src/tools/rule-catalog/types.js';", '', `export const RULE_CATALOG: readonly RuleEntry[] = ${json};`, ''].join('\n');
}

async function formatWithPrettier(source) {
  const config = await prettier.resolveConfig(OUTPUT_TS);
  return prettier.format(source, { ...config, filepath: OUTPUT_TS });
}

function relPath(p) {
  return relative(WORKSPACE_ROOT, p).split('\\').join('/');
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
