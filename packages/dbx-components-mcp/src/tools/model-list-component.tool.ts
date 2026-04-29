/**
 * `dbx_model_list_component` tool.
 *
 * Lists every Firestore model declared in a downstream `-firebase`
 * component (one entry per direct subfolder of
 * `src/lib/model/` that ships a `firestoreModelIdentity(...)` call),
 * with optional fixture-coverage cross-reference when the caller also
 * supplies an `apiDir`.
 *
 * Pairs with `dbx_model_search` (which only knows the upstream
 * `@dereekb/firebase` registry) — this tool answers the "what models
 * live in this downstream package?" question and reports any models
 * whose API fixture context is missing.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatReportAsJson, formatReportAsMarkdown, listComponentModels } from './model-list-component/index.js';

const ListArgsType = type({
  componentDir: 'string',
  'apiDir?': 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_list_component',
  description: [
    'List every Firestore model declared in a downstream `-firebase` component package, with optional fixture-coverage annotation when an API app is also supplied.',
    '',
    'Each entry reports its identity const, collection name + prefix, parent identity (for subcollections), source file path, and (when `apiDir` is set) whether `<apiDir>/src/test/fixture.ts` declares a TestContext triplet for the model.',
    '',
    'Reserved folders (`system`, `notification`, `storagefile`) are intentionally skipped — those have dedicated `*_m_*` validators.',
    '',
    'Inputs:',
    '- `componentDir`: relative path to the `-firebase` component package.',
    '- `apiDir` (optional): relative path to the API app — enables fixture-coverage cross-reference.',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the component package.' },
      apiDir: { type: 'string', description: 'Optional API app — enables fixture-coverage check.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ListArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.componentDir, cwd);
    if (parsed.apiDir) ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const componentAbs = resolve(cwd, parsed.componentDir);
  const apiAbs = parsed.apiDir ? resolve(cwd, parsed.apiDir) : undefined;
  let report;
  try {
    report = await listComponentModels(componentAbs, { componentDir: parsed.componentDir, apiDir: parsed.apiDir, apiAbs });
  } catch (err) {
    return toolError(`Failed to list component models: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = parsed.format === 'json' ? formatReportAsJson(report) : formatReportAsMarkdown(report);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const modelListComponentTool: DbxTool = { definition: TOOL, run };
