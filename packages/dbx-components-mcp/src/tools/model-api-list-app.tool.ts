/**
 * `dbx_model_api_list_app` tool.
 *
 * Enumerates every CRUD entry and standalone callable declared in a
 * firebase-component package's `<model>.api.ts` files. Each row reports
 * (model, verb, specifier, params, result, source line). Optional
 * `model` / `identity` filter narrows the output to one model.
 *
 * Use cases:
 *   - "What API calls does this component expose?" — run with no filter.
 *   - "What calls are available for Profile?" — `model: 'Profile'` or
 *     `identity: 'profileIdentity'`.
 *
 * Companion tools (planned): `dbx_model_api_lookup` for full single-model
 * detail (params/action JSDoc, fixture coverage), `dbx_model_api_validate_app`
 * for declaration ↔ handler reconciliation against the app `callModel` map.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatReportAsJson, formatReportAsMarkdown, listAppModelApi } from './model-api-list-app/index.js';

const ListArgsType = type({
  componentDir: 'string',
  'model?': 'string',
  'identity?': 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_api_list_app',
  description: [
    'List every CRUD / standalone API call declared in a firebase-component package, with per-file summaries.',
    '',
    'For each `<model>.api.ts` file under `<componentDir>/src/lib/**` that calls `callModelFirebaseFunctionMapFactory(...)`, the tool walks the `<Group>ModelCrudFunctionsConfig` type literal and `<Group>FunctionTypeMap` to enumerate every callable leaf:',
    '- `model` — the top-level model key from the CRUD config (e.g. `profile`, `guestbookEntry`); for standalone entries, the firebase function key.',
    '- `verb` — `create` / `read` / `update` / `delete` / `query` / `standalone`.',
    '- `specifier` — sub-key like `username`, `_`, `subscribeToNotifications`, or `—` when the verb has no nested specifier.',
    '- `params` — the bare params type name resolved at the leaf.',
    '- `result` — the result type name when the leaf is a `[Params, Result]` tuple, else `void`.',
    '- `line` — source line of the leaf in the `.api.ts` file.',
    '',
    'Inputs:',
    '- `componentDir`: relative path to the firebase-component package (e.g. `components/demo-firebase`).',
    '- `model` (optional): bare model name, e.g. `Profile` — case-insensitive match against group / model keys.',
    '- `identity` (optional): identity const, e.g. `profileIdentity`. Resolved by stripping the `Identity` suffix.',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the firebase-component package.' },
      model: { type: 'string', description: 'Bare model name (e.g. `Profile`).' },
      identity: { type: 'string', description: 'Identity const string (e.g. `profileIdentity`). Alternative to `model`.' },
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
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const componentAbs = resolve(cwd, parsed.componentDir);
  const modelFilter = parsed.model ?? (parsed.identity ? identityToModel(parsed.identity) : undefined);
  let report;
  try {
    report = await listAppModelApi(componentAbs, { componentDir: parsed.componentDir, modelFilter });
  } catch (err) {
    return toolError(`Failed to list model API entries: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = parsed.format === 'json' ? formatReportAsJson(report) : formatReportAsMarkdown(report);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

/**
 * Maps a `firestoreModelIdentity` const name to the bare PascalCase model
 * name. Strips the trailing `Identity` suffix (case-insensitive).
 *
 * @param identity - the identity const string (e.g. `profileIdentity`)
 * @returns the bare PascalCase model name (e.g. `Profile`)
 */
function identityToModel(identity: string): string {
  const stem = identity.replace(/Identity$/i, '');
  if (stem.length === 0) return identity;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

export const modelApiListAppTool: DbxTool = { definition: TOOL, run };
