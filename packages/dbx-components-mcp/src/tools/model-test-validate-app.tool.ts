/**
 * `dbx_model_test_validate_app` tool.
 *
 * Audits a downstream `-firebase` component + API app pair against the
 * spec-file convention codified in `@dereekb/util` (spec-file-conventions):
 *
 *  - Every spec under `<apiDir>/src/app/function/<group>/` must match
 *    `<group>.crud[.<sub>...].spec.ts` or `<group>.scenario[.<sub>...].spec.ts`.
 *  - Every model group declared in the component (`<componentDir>/src/lib/model/<group>/`)
 *    must have a baseline `<group>.crud.spec.ts` on the API side.
 *
 * Violations default to warnings; pass `strict: true` to promote them to
 * errors so CI can fail on drift. Companion tools:
 *
 *  - `dbx_model_test_convention` — pure-data lookup of canonical paths.
 *  - `dbx_model_test_list_app` — heavier inventory + drift report.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { discoverSpecFilesByGroup, type DiscoveredSpecCatalog } from '@dereekb/dbx-cli/model-test';
import { extractComponentModels, type ExtractionOutcome } from './model-list-component/extract.js';
import { formatModelTestValidateAppJson, formatModelTestValidateAppMarkdown, validateModelTestApp } from './model-test-validate-app/index.js';

const ValidateAppArgsType = type({
  componentDir: 'string',
  apiDir: 'string',
  'strict?': 'boolean',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_test_validate_app',
  description: [
    "Audit a `-firebase` component + API app pair against the model-test convention. Flags filename drift (anything that's not `<group>.crud[.<sub>].spec.ts` or `<group>.scenario[.<sub>].spec.ts`) and missing baseline CRUD specs (model groups declared on the component side that have no `<group>.crud.spec.ts` on the API side).",
    '',
    'Emitted codes:',
    '- `TEST_FILE_DRIFT_RENAME` — `crud` / `scenario` segment placed after a subgroup (e.g. `worker.payroll.scenario.spec.ts` → `worker.scenario.payroll.spec.ts`).',
    '- `TEST_FILE_MISSING_BUCKET` — no `crud` / `scenario` segment at all (e.g. `worker.system.spec.ts`).',
    "- `TEST_FILE_NON_GROUP_PLACEMENT` — first filename segment doesn't match the parent folder name.",
    '- `MODEL_GROUP_MISSING_CRUD_SPEC` — model group exists on the component side but has no `<group>.crud.spec.ts`.',
    '',
    'Inputs:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '- `strict` (optional): when `true`, every drift / coverage finding is upgraded to `error` severity so CI fails. Defaults to `false` (warning-only).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'For the canonical path of any rename target, follow up with `dbx_model_test_convention`. For an inventory of every spec file with drift hints in the response footer, use `dbx_model_test_list_app`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      strict: { type: 'boolean', description: 'Promote every finding to error severity. Defaults to false.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir', 'apiDir']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ValidateAppArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  let ensureError: string | undefined;
  try {
    ensurePathInsideCwd(parsed.componentDir, cwd);
    ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    ensureError = err instanceof Error ? err.message : String(err);
  }
  if (ensureError !== undefined) {
    return toolError(ensureError);
  }
  const componentAbs = resolve(cwd, parsed.componentDir);
  const apiAbs = resolve(cwd, parsed.apiDir);
  let catalog: DiscoveredSpecCatalog | undefined;
  let extraction: ExtractionOutcome | undefined;
  let inspectionError: string | undefined;
  try {
    catalog = await discoverSpecFilesByGroup({ apiAbs, apiRel: parsed.apiDir });
    extraction = await extractComponentModels(componentAbs);
  } catch (err) {
    inspectionError = err instanceof Error ? err.message : String(err);
  }
  if (catalog === undefined || extraction === undefined || inspectionError !== undefined) {
    return toolError(inspectionError ?? 'Failed to inspect component / API directories.');
  }
  const result = validateModelTestApp(
    {
      componentDir: parsed.componentDir,
      apiDir: parsed.apiDir,
      specCatalog: catalog,
      componentExtraction: extraction
    },
    { strict: parsed.strict ?? false }
  );
  const text = parsed.format === 'json' ? formatModelTestValidateAppJson(result) : formatModelTestValidateAppMarkdown(result);
  return { content: [{ type: 'text', text }], isError: result.errorCount > 0 };
}

export const MODEL_TEST_VALIDATE_APP_TOOL: DbxTool = { definition: TOOL, run };
