/**
 * `dbx_model_fixture_list_app` tool.
 *
 * Reads `<apiDir>/src/test/fixture.ts` and emits one summary row per
 * declared `<Prefix><Model>TestContext{Fixture,Instance,Params}` triplet
 * — with archetype, factory metadata, method counts, and line ranges.
 *
 * Backed by `inspectAppFixtures()` and the markdown / JSON formatters
 * from `model-fixture-shared/`. The same parse is reused by the lookup
 * and validate tools.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatListAsJson, formatListAsMarkdown, inspectAppFixtures } from './model-fixture-shared/index.js';

const ListArgsType = type({
  apiDir: 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_fixture_list_app',
  description: [
    "List every `<Prefix><Model>TestContext{Fixture,Instance,Params}` triplet declared in a downstream API app's `src/test/fixture.ts`.",
    '',
    'Each row reports the model name, archetype (`top-level-simple` / `top-level-with-deps` / `sub-collection` / `sub-collection-traversal`), Fixture and Instance class names, Params type, factory + singleton, fixture/instance method counts, and start/end lines.',
    '',
    'Provide:',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the API app (e.g. `apps/demo-api`).' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['apiDir']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ListArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const apiAbs = resolve(cwd, parsed.apiDir);
  let extraction;
  try {
    extraction = await inspectAppFixtures(apiAbs, parsed.apiDir);
  } catch (err) {
    return toolError(`Failed to read fixture file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = parsed.format === 'json' ? formatListAsJson(extraction) : formatListAsMarkdown(extraction);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const modelFixtureListAppTool: DbxTool = { definition: TOOL, run };
