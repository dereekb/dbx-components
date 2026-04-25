/**
 * `dbx_list_app_storagefiles` tool.
 *
 * Emits a human-readable report of every `StorageFilePurpose`
 * configured in a downstream `-firebase` component + API app pair.
 * Each entry reports its purpose code, paired
 * `UploadedFileTypeIdentifier`, group-ids helper, processing subtasks,
 * and the two registration flags (`hasUploadInitializer`,
 * `hasProcessingConfig`) so reviewers can see at a glance what's
 * configured and whether it's fully wired.
 *
 * Reuses the cross-file extractor from
 * `dbx_validate_app_storagefiles` — no duplicate AST walk.
 *
 * Accepts the same `componentDir` + `apiDir` as the validator, plus
 * an optional `format: 'markdown' | 'json'` (default markdown).
 */

import { resolve, sep } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { inspectAppStorageFiles } from './validate-app-storagefiles/index.js';
import { formatReportAsJson, formatReportAsMarkdown, listAppStorageFiles } from './list-app-storagefiles/index.js';

// MARK: Tool definition
const DBX_LIST_APP_STORAGEFILES_TOOL: Tool = {
  name: 'dbx_list_app_storagefiles',
  description: [
    'List every `StorageFilePurpose` configured in a downstream `-firebase` component + API app pair. Each entry reports its purpose code, paired `UploadedFileTypeIdentifier` constant, group-ids helper, declared processing subtasks, and registration flags (`hasUploadInitializer`, `hasProcessingConfig`).',
    '',
    'Cross-file resolution mirrors `dbx_validate_app_storagefiles` — initializer arrays and spread-of-call factory composition are traced through every `.ts` file under `src/lib/model/storagefile/` on the component side and `src/app/common/model/storagefile/` + `src/app/common/model/notification/` on the API side.',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir', 'apiDir']
  }
};

// MARK: Input validation
const ListArgsType = type({
  componentDir: 'string',
  apiDir: 'string',
  'format?': "'markdown' | 'json'"
});

interface ParsedArgs {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly format: 'markdown' | 'json';
}

function parseArgs(raw: unknown): ParsedArgs {
  const parsed = ListArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedArgs = {
    componentDir: parsed.componentDir,
    apiDir: parsed.apiDir,
    format: parsed.format ?? 'markdown'
  };
  return result;
}

function ensureInsideCwd(relativePath: string, cwd: string): string {
  const absolute = resolve(cwd, relativePath);
  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!absolute.startsWith(cwdPrefix) && absolute !== cwd) {
    throw new Error(`Path \`${relativePath}\` resolves outside the server cwd and is not allowed.`);
  }
  return absolute;
}

// MARK: Handler
export async function runListAppStorageFiles(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const cwd = process.cwd();
  let componentAbs: string;
  let apiAbs: string;
  try {
    componentAbs = ensureInsideCwd(args.componentDir, cwd);
    apiAbs = ensureInsideCwd(args.apiDir, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const inspection = await inspectAppStorageFiles(componentAbs, apiAbs);
  const report = listAppStorageFiles(inspection, { componentDir: args.componentDir, apiDir: args.apiDir });
  const text = args.format === 'json' ? formatReportAsJson(report) : formatReportAsMarkdown(report);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const listAppStorageFilesTool: DbxTool = {
  definition: DBX_LIST_APP_STORAGEFILES_TOOL,
  run: runListAppStorageFiles
};
