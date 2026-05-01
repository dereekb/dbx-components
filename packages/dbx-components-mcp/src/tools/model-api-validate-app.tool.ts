/**
 * `dbx_model_api_validate_app` tool.
 *
 * Reconciles CRUD declarations from a firebase-component package
 * (`<model>.api.ts` files) against the handlers wired in the paired API
 * app's `<apiDir>/src/app/function/model/crud.functions.ts`.
 *
 * Issue codes:
 *   - `MISSING_HANDLER` — declared in `<Group>ModelCrudFunctionsConfig`
 *     but no entry under the matching specifier in the app's verb-map.
 *   - `ORPHAN_HANDLER` — handler registered in the app's verb-map but no
 *     firebase-component `*.api.ts` declares this CRUD entry.
 *
 * Mirrors the `dbx_model_fixture_validate_app` / `dbx_storagefile_m_validate_app`
 * pattern: a single tool that walks two sources and reports drift.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatValidationAsJson, formatValidationAsMarkdown, validateAppModelApi } from './model-api-validate-app/index.js';

const ValidateArgsType = type({
  componentDir: 'string',
  apiDir: 'string',
  'model?': 'string',
  'identity?': 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_api_validate_app',
  description: [
    'Cross-check that every CRUD entry declared in a firebase-component package has a matching handler wired in the paired API app, and vice-versa.',
    '',
    'Walks two sources:',
    '- Declarations: `<componentDir>/src/lib/**/*.api.ts` — every CRUD leaf in `<Group>ModelCrudFunctionsConfig` (standalone `FunctionTypeMap` entries are excluded; they are reachable through `allAppFunctions(...)` in the app, not the verb-keyed maps).',
    '- Handlers: `<apiDir>/src/app/function/model/crud.functions.ts` — the `<group><Verb>ModelMap` constants, with bare handler refs and `onCallSpecifierHandler({ ... })` literals expanded to specifier→handler pairs.',
    '',
    'For each `(model, verb, specifier)` cell the tool emits one of:',
    '- matched — declaration and handler agree.',
    '- `MISSING_HANDLER` — declared but the verb-map has no entry.',
    '- `ORPHAN_HANDLER` — handler is wired but no `*.api.ts` declares the entry.',
    '',
    'Inputs:',
    '- `componentDir`: relative path to the firebase-component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the paired API app (e.g. `apps/demo-api`).',
    '- `model` (optional) / `identity` (optional): narrow the reconciliation to one model.',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the firebase-component package.' },
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      model: { type: 'string', description: 'Bare model name (e.g. `Profile`).' },
      identity: { type: 'string', description: 'Identity const (e.g. `profileIdentity`). Alternative to `model`.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir', 'apiDir']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ValidateArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.componentDir, cwd);
    ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const componentAbs = resolve(cwd, parsed.componentDir);
  const apiAbs = resolve(cwd, parsed.apiDir);
  const modelFilter = parsed.model ?? (parsed.identity ? identityToModel(parsed.identity) : undefined);
  let report;
  try {
    report = await validateAppModelApi({ componentAbs, componentDir: parsed.componentDir, apiAbs, apiDir: parsed.apiDir, modelFilter });
  } catch (err) {
    return toolError(`Failed to validate app: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = parsed.format === 'json' ? formatValidationAsJson(report) : formatValidationAsMarkdown(report);
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

export const modelApiValidateAppTool: DbxTool = { definition: TOOL, run };
