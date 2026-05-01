/**
 * `dbx_model_api_lookup` tool.
 *
 * Deep-dive view for one model declared in a firebase-component package.
 * Returns every CRUD / standalone entry under that model with:
 *   - Params + result type names, JSDoc, and per-field docs.
 *   - Resolved action method on the matching `*ServerActions` abstract class
 *     (when `apiDir` is provided), with method JSDoc.
 *   - Resolved action factory function (`<X>Factory`) with its richer JSDoc.
 *   - Source citations for every cross-referenced artifact.
 *
 * Companion to `dbx_model_api_list_app` (table view of every model in a
 * component) and the planned `dbx_model_api_validate_app` (declaration ↔
 * handler reconciliation).
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatLookupAsJson, formatLookupAsMarkdown, lookupModelApi } from './model-api-lookup/index.js';

const LookupArgsType = type({
  componentDir: 'string',
  'apiDir?': 'string',
  'model?': 'string',
  'identity?': 'string',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_api_lookup',
  description: [
    'Deep lookup for one model declared in a firebase-component package. Returns every CRUD / standalone entry under that model with rich metadata.',
    '',
    'For each entry the tool surfaces:',
    '- Params + result type names, params/result interface JSDoc, per-field type and doc.',
    '- Action method on the matching `*ServerActions` abstract class (when `apiDir` is provided).',
    '- Action factory function (`<X>Factory`) with its richer JSDoc — usually the most semantic source.',
    '- Source citations (file:line) for every cross-referenced artifact.',
    '',
    'Inputs:',
    '- `componentDir`: relative path to the firebase-component package (e.g. `components/demo-firebase`).',
    '- `apiDir` (optional): relative path to the paired API app (e.g. `apps/demo-api`). When provided, the tool walks `<apiDir>/src/app/common/model/**/*.action.server.ts` to attach action / factory JSDoc.',
    '- `model` (or `identity`): bare model name (e.g. `Profile`) or the matching identity const (e.g. `profileIdentity`).',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the firebase-component package.' },
      apiDir: { type: 'string', description: 'Optional relative path to the API app for action / factory JSDoc enrichment.' },
      model: { type: 'string', description: 'Bare model name (e.g. `Profile`).' },
      identity: { type: 'string', description: 'Identity const string (e.g. `profileIdentity`). Alternative to `model`.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = LookupArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  if (!parsed.model && !parsed.identity) {
    return toolError('Provide either `model` (PascalCase model name) or `identity` (the `<camelName>Identity` const string).');
  }
  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.componentDir, cwd);
    if (parsed.apiDir) {
      ensurePathInsideCwd(parsed.apiDir, cwd);
    }
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const componentAbs = resolve(cwd, parsed.componentDir);
  const apiAbs = parsed.apiDir ? resolve(cwd, parsed.apiDir) : undefined;
  const modelFilter = parsed.model ?? identityToModel(parsed.identity as string);
  let report;
  try {
    report = await lookupModelApi({
      componentAbs,
      componentDir: parsed.componentDir,
      apiAbs,
      apiDir: parsed.apiDir,
      modelFilter
    });
  } catch (err) {
    return toolError(`Failed to lookup model API entries: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!report.sourceFile) {
    return toolError(`No matching \`<model>.api.ts\` source found in \`${parsed.componentDir}\` for filter \`${modelFilter}\`.`);
  }
  const text = parsed.format === 'json' ? formatLookupAsJson(report) : formatLookupAsMarkdown(report);
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

export const modelApiLookupTool: DbxTool = { definition: TOOL, run };
