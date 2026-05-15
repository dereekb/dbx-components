/**
 * `dbx_color_template_list_app` tool.
 *
 * Walks an Angular app's root config, finds the
 * `provideDbxStyleService(...)` call, and lists every
 * `DbxColorConfigTemplate` registered via `dbxColorServiceConfig.templates`.
 * Pairs with `dbx_color_smell_check` — the smell tool cross-references its
 * findings against this list so callers can pick an existing template
 * instead of inventing a new one.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { formatReportAsJson, formatReportAsMarkdown, inspectColorTemplates, listAppColorTemplates } from './dbx-color-template-list-app/index.js';

const DBX_COLOR_TEMPLATE_LIST_APP_TOOL: Tool = {
  name: 'dbx_color_template_list_app',
  description: [
    'List every `DbxColorConfigTemplate` registered through `provideDbxStyleService({ dbxColorServiceConfig: { templates: [...] } })` in an Angular app. Each entry reports its `key`, the resolved `DbxColorConfig` fields (color / contrast / tone / tonal / template), and the source file:line of the literal.',
    '',
    'Pair this with `dbx_color_smell_check` — that tool cross-references duplicate inline literals against the templates returned here so callers can re-use an existing template instead of registering a new one.',
    '',
    'Inputs:',
    '- `apiDir`: relative path to the Angular app (e.g. `apps/demo`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Scope:',
    '- Only inline array literals (or same-file identifier references) are resolved. Templates supplied via cross-file imports or `DbxColorService.register(...)` at runtime are out of scope and surface as warnings.',
    '- Paths that escape the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the Angular app root.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['apiDir']
  }
};

const ColorTemplateListAppArgs = type({
  apiDir: 'string',
  'format?': "'markdown' | 'json'"
});

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ColorTemplateListAppArgs(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }

  const cwd = process.cwd();
  const apiRel = parsed.apiDir;
  try {
    ensurePathInsideCwd(apiRel, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const apiAbs = resolve(cwd, apiRel);
  const inspection = await inspectColorTemplates(apiAbs, apiRel);
  if (!inspection.appExists) {
    return toolError(`App directory not found: \`${apiRel}\`.`);
  }

  const report = listAppColorTemplates(inspection);
  const text = parsed.format === 'json' ? formatReportAsJson(report) : formatReportAsMarkdown(report);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const dbxColorTemplateListAppTool: DbxTool = {
  definition: DBX_COLOR_TEMPLATE_LIST_APP_TOOL,
  run
};
