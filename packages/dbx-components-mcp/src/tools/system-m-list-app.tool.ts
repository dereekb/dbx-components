/**
 * `dbx_system_m_list_app` tool.
 *
 * Lists every `<NAME>_SYSTEM_STATE_TYPE` declared in a downstream
 * `-firebase` component's `src/lib/model/system/system.ts`, paired
 * with its matching `<Foo>SystemData` interface, its
 * `<foo>SystemDataConverter`, and whether the type constant is
 * referenced from the aggregate `<app>SystemStateStoredDataConverterMap`.
 *
 * Reuses the validator's filesystem inspector and AST extractor — no
 * duplicate walk. Mirrors `dbx_storagefile_m_list_app` and
 * `dbx_notification_m_list_app` but is component-only (system state is
 * defined entirely on the component side; no API cross-resolution is
 * needed).
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatReportAsJson, formatReportAsMarkdown, listAppSystem } from './system-m-list-app/index.js';

const ListAppArgsType = type({
  componentDir: 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_system_m_list_app',
  description: [
    'List every `<NAME>_SYSTEM_STATE_TYPE` declared in a downstream `-firebase` component, paired with its matching `<Foo>SystemData` interface, `<foo>SystemDataConverter` config, and converter-map membership.',
    '',
    'Walks `<componentDir>/src/lib/model/system/system.ts` and reshapes the same AST extraction that powers `dbx_system_m_validate_folder` — entries flag missing legs of the triplet (interface, converter, map membership) so reviewers can see at a glance which states are fully wired.',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ListAppArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  let result: ToolResult;
  let ensureError: string | undefined;
  try {
    ensurePathInsideCwd(parsed.componentDir, cwd);
  } catch (err) {
    ensureError = err instanceof Error ? err.message : String(err);
  }
  if (ensureError !== undefined) {
    result = toolError(ensureError);
  } else {
    const componentAbs = resolve(cwd, parsed.componentDir);
    let report;
    let listError: string | undefined;
    try {
      report = await listAppSystem(componentAbs, { componentDir: parsed.componentDir });
    } catch (err) {
      listError = `Failed to list system states: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (listError !== undefined || report === undefined) {
      result = toolError(listError ?? 'Failed to list system states.');
    } else {
      const text = parsed.format === 'json' ? formatReportAsJson(report) : formatReportAsMarkdown(report);
      result = { content: [{ type: 'text', text }] };
    }
  }
  return result;
}

export const systemMListAppTool: DbxTool = { definition: TOOL, run };
