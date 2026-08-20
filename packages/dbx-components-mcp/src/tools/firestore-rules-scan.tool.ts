/**
 * `dbx_firestore_rules_scan` tool.
 *
 * Reads a `firestore.rules` file off disk and reports, per collection, whether a client can read it
 * at all — `allowed` / `denied` / `unmatched` for both `get` and `list`, plus the derived
 * `serverOnly` verdict (neither op allowed).
 *
 * This is the STATIC routing source behind the model-level server-only gate: a model whose
 * collection has no match block, or whose read grants are all constant-`false`, cannot be read by
 * any client, so both the model API and the CLI's direct-Firestore path must refuse it. The DYNAMIC
 * oracle stays `apps/demo-api/src/test/tests/firestore.rules.spec.ts`, which drives the real rules
 * engine via `@firebase/rules-unit-testing`.
 *
 * The scanner is deliberately not a CEL implementation — it understands match nesting, wildcard
 * segments, and "is this condition literally `false`". Anything more expressive reads as `allowed`,
 * which is the safe direction for a gate whose false-negative is "we let the real rules decide".
 *
 * Pair with `dbx_model_server_only_validate_app` to check that the rules verdict, the
 * `@dbxModelServerOnly` interface tag, and the runtime `serverOnly` service flag all agree.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Tool } from '@modelcontextprotocol/server';
import { type } from 'arktype';
import { ensurePathInsideCwd } from '@dereekb/dbx-cli/validate';
import { scanFirestoreRules, serverOnlyCollections, type FirestoreRulesCollectionEntry, type FirestoreRulesScan } from '@dereekb/dbx-cli/firestore-rules';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Args
const ScanArgsType = type({
  'rulesFile?': 'string',
  'collection?': 'string',
  'serverOnly?': 'boolean',
  'format?': "'markdown' | 'json'"
});

/**
 * Default rules-file path, relative to the server cwd (the workspace root).
 */
export const DEFAULT_FIRESTORE_RULES_FILE = 'firestore.rules';

const TOOL: Tool = {
  name: 'dbx_firestore_rules_scan',
  description: [
    'Scan a `firestore.rules` file and report, per collection, whether a CLIENT can read it.',
    '',
    'For every collection the file names, reports `get` and `list` as:',
    '  • `allowed` — some `allow` covering the op has a condition that is not constant-`false`.',
    '  • `denied` — the op is covered only by `allow`s whose condition is literally `false`.',
    '  • `unmatched` — no `allow` covers the op, so Firestore default-deny applies.',
    '',
    'A collection with NO match block does not appear in the scan at all — pass `collection` to get the synthesized `unmatched` (and therefore server-only) verdict for it.',
    '',
    '`serverOnly` is true when neither `get` nor `list` is `allowed`: no client can read the model on any path, so the model API must refuse it too (`MODEL_IS_SERVER_ONLY`) rather than authorizing via `roleMapForModel` under the Admin SDK.',
    '',
    'A collection whose `get` is `allowed` but `list` is not is READABLE BY ID BUT NOT QUERYABLE — direct-Firestore queries against it will be rejected by the rules even though single-document reads succeed.',
    '',
    'Provide:',
    '- `rulesFile` (optional): relative path to the rules file. Defaults to `firestore.rules` at the server cwd.',
    '- `collection` (optional): report only this short collection name (e.g. `gb`, `sys`), synthesizing the `unmatched` verdict when the file never names it.',
    '- `serverOnly` (optional): when `true`, report only the server-only collections.',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.',
    '',
    'This scanner is not a CEL evaluator: it reads match nesting, `{var}` / `{path=**}` wildcards, and constant-`false` conditions. Every other condition reads as `allowed`, so the verdict is a lower bound on what the real rules refuse.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      rulesFile: { type: 'string', description: 'Relative path to the `firestore.rules` file. Defaults to `firestore.rules` at the server cwd.' },
      collection: { type: 'string', description: 'Report only this short collection name, synthesizing `unmatched` when absent from the file.' },
      serverOnly: { type: 'boolean', description: 'Report only the server-only collections.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: []
  }
};

/**
 * The report `dbx_firestore_rules_scan` renders.
 */
export interface FirestoreRulesScanReport {
  readonly rulesFile: string;
  readonly collections: readonly FirestoreRulesCollectionEntry[];
  readonly serverOnly: readonly string[];
  /**
   * Collections that can be read by id but not queried — `get` allowed, `list` not. Direct-Firestore
   * queries against these fail at the rules layer even though `firestore-get` succeeds.
   */
  readonly gettableNotListable: readonly string[];
  /**
   * Set when `collection` was supplied and the file never names it, so the entry was synthesized.
   */
  readonly synthesized?: boolean;
}

/**
 * Builds the report for a scanned rules file, applying the optional collection / server-only filters.
 *
 * @param input - The scan, the rules-file label, and the filters.
 * @param input.scan - The parsed rules scan.
 * @param input.rulesFile - The rules-file path to stamp on the report.
 * @param input.collection - Optional single-collection filter.
 * @param input.serverOnly - When `true`, keep only server-only collections.
 * @returns The report.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildFirestoreRulesScanReport(input: { readonly scan: FirestoreRulesScan; readonly rulesFile: string; readonly collection?: string; readonly serverOnly?: boolean }): FirestoreRulesScanReport {
  const { scan, rulesFile, collection, serverOnly } = input;
  let collections: readonly FirestoreRulesCollectionEntry[] = scan.collections;
  let synthesized = false;

  if (collection !== undefined) {
    const found = scan.collections.find((x) => x.collection === collection);

    if (found) {
      collections = [found];
    } else {
      synthesized = true;
      collections = [{ collection, paths: [], get: 'unmatched', list: 'unmatched', collectionGroup: false, serverOnly: true }];
    }
  }

  if (serverOnly === true) {
    collections = collections.filter((x) => x.serverOnly);
  }

  return {
    rulesFile,
    collections,
    serverOnly: collections.filter((x) => x.serverOnly).map((x) => x.collection),
    gettableNotListable: collections.filter((x) => x.get === 'allowed' && x.list !== 'allowed').map((x) => x.collection),
    ...(synthesized ? { synthesized: true } : {})
  };
}

const ACCESS_LABEL = {
  allowed: '✅ allowed',
  denied: '⛔ denied',
  unmatched: '🚫 unmatched'
} as const;

/**
 * Renders the scan report as markdown.
 *
 * @param report - The report to render.
 * @returns The markdown document.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatFirestoreRulesScanReportAsMarkdown(report: FirestoreRulesScanReport): string {
  const lines: string[] = [`# Firestore rules read posture — \`${report.rulesFile}\``, ''];

  if (report.collections.length === 0) {
    lines.push('_No collections matched._');
    return lines.join('\n');
  }

  if (report.synthesized === true) {
    lines.push(`> The rules file has **no match block** for \`${report.collections[0]?.collection}\`. Firestore default-deny applies, so the model is server-only.`, '');
  }

  lines.push('| Collection | get | list | Group | Server-only | Paths |', '| --- | --- | --- | --- | --- | --- |');

  for (const entry of report.collections) {
    const paths = entry.paths.length === 0 ? '_(none)_' : entry.paths.map((p) => `\`${p}\``).join('<br>');
    lines.push(`| \`${entry.collection}\` | ${ACCESS_LABEL[entry.get]} | ${ACCESS_LABEL[entry.list]} | ${entry.collectionGroup ? '✅' : '—'} | ${entry.serverOnly ? '🔒 yes' : 'no'} | ${paths} |`);
  }

  lines.push('');

  if (report.serverOnly.length > 0) {
    lines.push(`**Server-only (${report.serverOnly.length}):** ${report.serverOnly.map((c) => `\`${c}\``).join(', ')}`, '', 'Each of these must carry `@dbxModelServerOnly` on its model interface AND `serverOnly: true` on its `firebaseModelServiceFactory` config, so the model API refuses the read instead of authorizing it via `roleMapForModel`.', '');
  }

  if (report.gettableNotListable.length > 0) {
    lines.push(`**Gettable but not listable (${report.gettableNotListable.length}):** ${report.gettableNotListable.map((c) => `\`${c}\``).join(', ')}`, '', '`firestore-get` works on these; `firestore-query` does not — the rules grant reads by id only.', '');
  }

  lines.push('→ `dbx_model_server_only_validate_app` reconciles this verdict with the `@dbxModelServerOnly` tag and the runtime `serverOnly` flag.');
  return lines.join('\n').trimEnd();
}

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ScanArgsType(rawArgs ?? {});

  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }

  const cwd = process.cwd();
  const rulesFile = parsed.rulesFile ?? DEFAULT_FIRESTORE_RULES_FILE;
  let result: ToolResult;
  let failure: string | undefined;

  try {
    ensurePathInsideCwd(rulesFile, cwd);
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }

  if (failure === undefined) {
    let source: string | undefined;

    try {
      source = await readFile(resolve(cwd, rulesFile), 'utf8');
    } catch (err) {
      failure = `Failed to read ${rulesFile}: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (source === undefined) {
      result = toolError(failure ?? `Failed to read ${rulesFile}.`);
    } else {
      const scan = scanFirestoreRules(source);
      const report = buildFirestoreRulesScanReport({ scan, rulesFile, collection: parsed.collection, serverOnly: parsed.serverOnly });
      // recomputed over the whole scan so the summary is not truncated by a collection filter
      const allServerOnly = serverOnlyCollections(scan);
      const text = parsed.format === 'json' ? JSON.stringify({ ...report, allServerOnly }, null, 2) : formatFirestoreRulesScanReportAsMarkdown(report);
      result = { content: [{ type: 'text', text }] };
    }
  } else {
    result = toolError(failure);
  }

  return result;
}

export const FIRESTORE_RULES_SCAN_TOOL: DbxTool = { definition: TOOL, run };
