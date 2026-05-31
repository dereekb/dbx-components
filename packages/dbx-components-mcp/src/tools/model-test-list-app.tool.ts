/**
 * `dbx_model_test_list_app` tool.
 *
 * Walks an API app's `src/app/function/<group>/` tree and returns every
 * `*.spec.ts` grouped by model group, classified against the spec-file
 * naming convention (`<group>.crud[.<sub>].spec.ts` /
 * `<group>.scenario[.<sub>].spec.ts`). Each group is followed by a
 * "where to add a new test" block with the two canonical paths, plus a
 * consolidated drift report at the end.
 *
 * Inventory + drift audit for an entire API app. Companion tools answer
 * narrower variants of the same question:
 *  - `dbx_model_test_convention` — pure-data lookup of the canonical path
 *    for a single group (no disk walk).
 *  - `dbx_model_test_validate_app` — enforces the convention with
 *    severity-tagged violations + remediation; this tool only surfaces
 *    drift as a footer block.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { discoverSpecFilesByGroup, formatListAppAsJson, formatListAppAsMarkdown, type DiscoveredSpecCatalog } from './model-test-shared/index.js';

const ListAppArgsType = type({
  apiDir: 'string',
  'group?': 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_test_list_app',
  description: [
    'Walk an API app\'s `src/app/function/<group>/` tree and list every `*.spec.ts`, grouped by model group and classified against the spec-file naming convention. Use this for an **inventory + drift audit** of an entire API app — each group is followed by a `Where to add a new test` block, and any files off-convention surface in a consolidated drift report. For the focused **"where does a new test for model X go?"** question, prefer `dbx_model_test_convention` (no disk walk). For severity-tagged violations + CI-style enforcement, use `dbx_model_test_validate_app`.',
    '',
    'Canonical naming:',
    '- `<group>.crud.spec.ts` — non-scenario CRUD tests for the function map.',
    '- `<group>.crud.<sub>[.<sub>...].spec.ts` — focused CRUD sub-test.',
    '- `<group>.scenario.spec.ts` — generic multi-step scenario tests.',
    '- `<group>.scenario.<sub>[.<sub>...].spec.ts` — focused scenario sub-bucket.',
    '',
    'Drift detected:',
    '- `<group>.<sub>.scenario.spec.ts` → suggests `<group>.scenario.<sub>.spec.ts`.',
    '- `<group>.<sub>.crud.spec.ts` → suggests `<group>.crud.<sub>.spec.ts`.',
    '- `<group>.<rest>.spec.ts` (no `crud` / `scenario` segment) → defaults to a `scenario` rename suggestion.',
    '',
    'Provide:',
    '- `apiDir`: relative path to the API app (e.g. `apps/hellosubs-api`).',
    '- `group` (optional): restrict the listing to a single model group.',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected. For navigating a specific spec file\'s structure, follow up with `dbx_model_test_tree` / `dbx_model_test_search`. For just "give me the canonical path for model X", use `dbx_model_test_convention`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the API app (e.g. `apps/hellosubs-api`).' },
      group: { type: 'string', description: 'Restrict the listing to one model-group folder name.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['apiDir']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ListAppArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  let ensureError: string | undefined;
  try {
    ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    ensureError = err instanceof Error ? err.message : String(err);
  }
  let result: ToolResult;
  if (ensureError === undefined) {
    const apiAbs = resolve(cwd, parsed.apiDir);
    let catalog: DiscoveredSpecCatalog | undefined;
    let discoveryError: string | undefined;
    try {
      catalog = await discoverSpecFilesByGroup({ apiAbs, apiRel: parsed.apiDir });
    } catch (err) {
      discoveryError = `Failed to walk \`${parsed.apiDir}/src/app/function\`: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (catalog !== undefined && discoveryError === undefined) {
      const filtered = parsed.group === undefined ? catalog : filterCatalogByGroup(catalog, parsed.group);
      const text = parsed.format === 'json' ? formatListAppAsJson(filtered) : formatListAppAsMarkdown(filtered, { group: parsed.group });
      result = { content: [{ type: 'text', text }] };
    } else {
      result = toolError(discoveryError ?? 'Failed to discover spec files.');
    }
  } else {
    result = toolError(ensureError);
  }
  return result;
}

function filterCatalogByGroup(catalog: DiscoveredSpecCatalog, group: string): DiscoveredSpecCatalog {
  const groups = catalog.groups.filter((g) => g.group === group);
  const totalSpecFiles = groups.reduce((sum, g) => sum + g.files.length, 0);
  const totalDriftFiles = groups.reduce((sum, g) => sum + g.files.filter((f) => !f.classification.isCanonical && f.classification.kind !== 'non-spec' && f.classification.kind !== 'non-group').length, 0);
  return {
    apiRel: catalog.apiRel,
    functionDirRel: catalog.functionDirRel,
    groups,
    totalSpecFiles,
    totalDriftFiles
  };
}

export const MODEL_TEST_LIST_APP_TOOL: DbxTool = { definition: TOOL, run };
