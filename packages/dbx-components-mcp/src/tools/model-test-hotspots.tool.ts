/**
 * `dbx_model_test_hotspots` tool.
 *
 * Given a model, finds the existing API integration `.spec.ts` files that
 * reference the model's test fixture (or its parent fixtures), classified
 * crud-vs-scenario — and, when none exist, the canonical default spec files to
 * create. Answers "is there already a spec I should extend for this model?"
 * directly, countering the failure mode of concluding none exists from a
 * filename search (API specs are grouped by model **group**, not named
 * per-model).
 *
 * Companion tools answer narrower variants:
 *  - `dbx_model_test_list_app` — full inventory + drift audit (not model-scoped).
 *  - `dbx_model_test_convention` — pure-data canonical path for a group.
 *  - `dbx_model_test_tree` / `dbx_model_test_search` — drill into one spec file.
 *  - `dbx_model_fixture_lookup` — the fixture/instance triplet for a model.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from '@dereekb/dbx-cli/validate';
import { findModelTestHotspots, formatHotspotsAsJson, formatHotspotsAsMarkdown, type ModelTestHotspotsResult } from '@dereekb/dbx-cli/model-test';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const HotspotsArgsType = type({
  apiDir: 'string',
  model: 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_test_hotspots',
  description: [
    "Given a model, find the existing API integration `.spec.ts` files that reference the model's test fixture (or its parent fixtures), classified **crud vs scenario** — and, if none exist, the canonical default spec files to create.",
    '',
    'Use this **before concluding a model has no spec to extend**: API integration specs are grouped by model **group** (`<group>.crud[.<sub>].spec.ts` / `<group>.scenario[.<sub>].spec.ts`) and reuse the group fixture chain, so they are *not* named per-model and a filename search for a sub-model finds nothing even when its behaviour is already tested under the parent group.',
    '',
    "It resolves the model's fixture + parent fixtures from `src/test/fixture.ts`, then scans every spec for fixture-context calls referencing the model or a parent, ranking files with the model's own fixture first.",
    '',
    'Provide:',
    '- `apiDir`: relative path to the API app (e.g. `apps/hellosubs-api`).',
    '- `model`: bare PascalCase model name with the workspace prefix stripped (e.g. `JobFeedback`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    "Paths escaping the server cwd are rejected. To drill into a returned hotspot file use `dbx_model_test_tree` / `dbx_model_test_search`; for the model's fixture shape use `dbx_model_fixture_lookup`."
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the API app (e.g. `apps/hellosubs-api`).' },
      model: { type: 'string', description: 'Bare PascalCase model name (e.g. `JobFeedback`).' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['apiDir', 'model']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = HotspotsArgsType(rawArgs);
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
    let hotspots: ModelTestHotspotsResult | undefined;
    let lookupError: string | undefined;
    try {
      hotspots = await findModelTestHotspots({ apiAbs, apiRel: parsed.apiDir, model: parsed.model });
    } catch (err) {
      lookupError = `Failed to scan \`${parsed.apiDir}\` for \`${parsed.model}\` hotspots: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (hotspots !== undefined && lookupError === undefined) {
      const text = parsed.format === 'json' ? formatHotspotsAsJson(hotspots) : formatHotspotsAsMarkdown(hotspots);
      result = { content: [{ type: 'text', text }] };
    } else {
      result = toolError(lookupError ?? 'Failed to find model-test hotspots.');
    }
  } else {
    result = toolError(ensureError);
  }
  return result;
}

export const MODEL_TEST_HOTSPOTS_TOOL: DbxTool = { definition: TOOL, run };
