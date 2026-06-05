/**
 * `dbx_server_actions_list_app` tool.
 *
 * Enumerates every `*ServerActions` abstract class declared under
 * `<apiDir>/src/app/common/model/**\/*.action.server.ts`, with each
 * entry reporting:
 *
 *   - The sibling `*.module.ts` and whether it lists the class in
 *     `providers` and `exports`.
 *   - Whether the class is re-exported from
 *     `src/app/common/index.ts` (the common barrel).
 *   - Whether the API context interface in `src/test/fixture.ts`
 *     declares the matching getter, and which fixture/instance
 *     classes implement it.
 *
 * Replaces the four-grep dance an agent ran to confirm a server-actions
 * class was wired through DI and surfaced on the test fixture.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd, serverActionsListApp } from '@dereekb/dbx-cli/validate';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const { formatReportAsJson, formatReportAsMarkdown, listAppServerActions } = serverActionsListApp;

const ListArgsType = type({
  apiDir: 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_server_actions_list_app',
  description: [
    'List every `*ServerActions` abstract class declared in an API app, with NestJS module wiring, common-barrel export status, and test-fixture coverage.',
    '',
    'For each class found under `<apiDir>/src/app/common/model/**/*.action.server.ts` the tool reports:',
    '- The sibling `*.module.ts` file (if any) and whether it binds the class via `providers`/`exports`.',
    '- Whether the class is re-exported from `src/app/common/index.ts`.',
    '- Whether the API context interface in `<apiDir>/src/test/fixture.ts` declares the matching getter, and which fixture/instance classes are missing it.',
    '',
    'Inputs:',
    '- `apiDir`: relative path to the API app.',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
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
  let result: ToolResult;
  let ensureError: string | undefined;
  try {
    ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    ensureError = err instanceof Error ? err.message : String(err);
  }
  if (ensureError === undefined) {
    const apiAbs = resolve(cwd, parsed.apiDir);
    let report;
    let listError: string | undefined;
    try {
      report = await listAppServerActions(apiAbs, { apiDir: parsed.apiDir });
    } catch (err) {
      listError = `Failed to list server actions: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (listError !== undefined || report === undefined) {
      result = toolError(listError ?? 'Failed to list server actions.');
    } else {
      const text = parsed.format === 'json' ? formatReportAsJson(report) : formatReportAsMarkdown(report);
      result = { content: [{ type: 'text', text }] };
    }
  } else {
    result = toolError(ensureError);
  }
  return result;
}

export const SERVER_ACTIONS_LIST_APP_TOOL: DbxTool = { definition: TOOL, run };
