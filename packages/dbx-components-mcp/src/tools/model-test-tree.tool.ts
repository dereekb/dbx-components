/**
 * `dbx_model_test_tree` tool.
 *
 * Reads one `.spec.ts` file and returns its structural skeleton: nested
 * `describe`/`it` calls, `<prefix><Model>Context(...)` fixture chains,
 * locally-defined helper-describe functions, and the wrapper calls between
 * them. Multiple view modes (`all`, `describes`, `fixtures`, `its`,
 * `helpers`) plus optional `filterByModel` / `filterByDescribePath` filters
 * keep the output focused.
 *
 * Backed by the shared parser in `model-test-shared/`. When `apiDir` is
 * supplied the tool reuses `inspectAppFixtures()` to obtain the
 * authoritative workspace prefix and the full fixture-context name set;
 * otherwise the prefix is detected from the spec's own imports off
 * `**\/test/fixture`.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatTreeAsJson, formatTreeAsMarkdown, inspectSpecFile, type SpecTreeView } from './model-test-shared/index.js';

const TreeArgsType = type({
  specFile: 'string',
  'apiDir?': 'string',
  'view?': "'all' | 'describes' | 'fixtures' | 'its' | 'helpers'",
  'filterByModel?': 'string',
  'filterByDescribePath?': 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_test_tree',
  description: [
    'Parse one API `.spec.ts` file and return its structural skeleton — nested `describe`/`it` calls, `<prefix><Model>Context(...)` fixture chains, locally-defined helper-describe functions, and the wrapper calls between them. Each node carries its 1-based line range so callers can navigate by line offset instead of grepping.',
    '',
    'Provide:',
    '- `specFile`: relative path to the `.spec.ts` file (e.g. `apps/hellosubs-api/src/app/function/job/job.crud.instruction.spec.ts`).',
    "- `apiDir` (optional but recommended): relative path to the API app (e.g. `apps/hellosubs-api`). When supplied the tool reuses `inspectAppFixtures()` for the authoritative workspace prefix and the full set of `<prefix><Model>Context` names. When omitted the prefix is detected from the spec's own imports off `**/test/fixture`.",
    '- `view` (optional): `all` (default), `describes` (drop fixtures + wrappers), `fixtures` (only fixture chains, e.g. `Country > CountryState > Region > District > ...`), `its` (flat index of every `it()` with full describe path), or `helpers` (locally-defined helper-describe functions).',
    '- `filterByModel` (optional): keep only subtrees that contain a fixture call resolving to this model (e.g. `Job`).',
    '- `filterByDescribePath` (optional): keep only subtrees rooted at a describe whose `>`-separated path matches (e.g. `admin > job published`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      specFile: { type: 'string', description: 'Relative path to the `.spec.ts` file.' },
      apiDir: { type: 'string', description: 'Optional relative path to the API app. Enables authoritative prefix + fixture-name detection via `inspectAppFixtures()`.' },
      view: { type: 'string', enum: ['all', 'describes', 'fixtures', 'its', 'helpers'], description: 'View mode. Defaults to `all`.' },
      filterByModel: { type: 'string', description: 'Keep only subtrees that contain a fixture call resolving to this model (case-insensitive).' },
      filterByDescribePath: { type: 'string', description: '`>`-separated describe path; keep only subtrees rooted there (case-insensitive substring per segment).' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['specFile']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = TreeArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.specFile, cwd);
    if (parsed.apiDir !== undefined) ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const specAbs = resolve(cwd, parsed.specFile);
  const apiAbs = parsed.apiDir !== undefined ? resolve(cwd, parsed.apiDir) : undefined;
  let tree;
  try {
    tree = await inspectSpecFile({ specAbs, specRel: parsed.specFile, apiAbs, apiRel: parsed.apiDir });
  } catch (err) {
    return toolError(`Failed to read spec file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const view = (parsed.view ?? 'all') as SpecTreeView;
  const filters = { filterByModel: parsed.filterByModel, filterByDescribePath: parsed.filterByDescribePath };
  const text = parsed.format === 'json' ? formatTreeAsJson(tree, view, filters) : formatTreeAsMarkdown(tree, view, filters);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const modelTestTreeTool: DbxTool = { definition: TOOL, run };
