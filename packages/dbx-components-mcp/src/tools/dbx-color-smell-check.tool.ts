/**
 * `dbx_color_smell_check` tool.
 *
 * Scans TS + HTML for inline `DbxColorConfig` literals, groups them by
 * normalised signature, and reports duplicate groups along with the
 * recommended fix — re-use an existing `DbxColorConfigTemplate` (when
 * one already matches) or register a new template key.
 *
 * Pairs with `dbx_color_template_list_app`. When `apiDir` is supplied,
 * the smell-check cross-references its findings against the templates
 * declared in that app's root config.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { colorSmellCheck, colorTemplateListApp, ensurePathInsideCwd, resolveValidatorSources } from '@dereekb/dbx-cli/validate';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const { extractHtmlLiterals, extractTsLiterals, formatResultAsJson, formatResultAsMarkdown, groupColorSmells } = colorSmellCheck;
type ColorSmellEquivalenceMode = colorSmellCheck.ColorSmellEquivalenceMode;
const { extractColorTemplates, inspectColorTemplates } = colorTemplateListApp;
type ColorTemplateEntry = colorTemplateListApp.ColorTemplateEntry;

const DBX_COLOR_SMELL_CHECK_TOOL_DEFINITION: Tool = {
  name: 'dbx_color_smell_check',
  description: [
    'Scan TS + HTML for inline `DbxColorConfig` literals, group equivalent ones, and recommend extracting them into a `DbxColorConfigTemplate`.',
    '',
    'Detection:',
    '- TS — object literals in `DbxColorConfig` / `DbxColorInput`-typed positions plus property assignments named `color` / `dbxColor` / `dbxTextColor`.',
    '- HTML — Angular property bindings `[dbxColor]` / `[dbxTextColor]` / `[color]` whose value is an inline `{...}` literal.',
    '',
    'Literals that already set `template` are skipped (already using the service). Equivalence defaults to `normalized` — hex values are lowercased, `#fff` expands to `#ffffff`, and missing `tone` / `tonal` fields are treated as the directive defaults (`tone=100`, `tonal=false`).',
    '',
    'Inputs:',
    '- `paths` and/or `glob` — at least one required. Standard glob globs are resolved relative to the server cwd; absolute paths and paths escaping the cwd are rejected.',
    '- `equivalenceMode` (optional): `normalized` (default) or `exact`.',
    '- `minDuplicates` (optional): minimum group size before a finding fires (default `2`).',
    '- `apiDir` (optional): relative path to an Angular app — when supplied, `dbx_color_template_list_app` runs against it and findings are cross-referenced.',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      paths: { type: 'array', items: { type: 'string' }, description: 'Explicit file paths (TS or HTML) to scan.' },
      glob: { type: 'string', description: 'Glob pattern (resolved against the server cwd).' },
      equivalenceMode: { type: 'string', enum: ['exact', 'normalized'], description: 'How aggressively to collapse literals. Defaults to `normalized`.' },
      minDuplicates: { type: 'number', description: 'Minimum group size before a finding fires. Defaults to 2.' },
      apiDir: { type: 'string', description: 'Optional relative path to an Angular app. When supplied, findings are cross-referenced against `provideDbxStyleService` templates.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    }
  }
};

const ColorSmellCheckArgs = type({
  'paths?': 'string[]',
  'glob?': 'string',
  'equivalenceMode?': "'exact' | 'normalized'",
  'minDuplicates?': 'number',
  'apiDir?': 'string',
  'format?': "'markdown' | 'json'"
});

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ColorSmellCheckArgs(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }

  const hasAny = (parsed.paths && parsed.paths.length > 0) || parsed.glob;
  if (!hasAny) {
    return toolError('Must provide at least one of `paths` or `glob`.');
  }

  const cwd = process.cwd();
  type SourcesResult = { readonly kind: 'value'; readonly value: readonly { readonly name: string; readonly text: string }[] } | { readonly kind: 'error'; readonly error: ToolResult };
  let sourcesResult: SourcesResult;
  try {
    const resolved = await resolveValidatorSources({ sources: undefined, paths: parsed.paths, glob: parsed.glob, cwd });
    sourcesResult = { kind: 'value', value: resolved };
  } catch (err) {
    sourcesResult = { kind: 'error', error: toolError(`Failed to read sources: ${err instanceof Error ? err.message : String(err)}`) };
  }
  if (sourcesResult.kind === 'error') {
    return sourcesResult.error;
  }
  const sources = sourcesResult.value;

  if (sources.length === 0) {
    return toolError('No matching source files found.');
  }

  const templates = await resolveCrossReferenceTemplates({ apiDir: parsed.apiDir, cwd });
  if (templates.kind === 'error') {
    return templates.error;
  }

  const equivalenceMode: ColorSmellEquivalenceMode = parsed.equivalenceMode ?? 'normalized';
  const minDuplicates = parsed.minDuplicates !== undefined && parsed.minDuplicates > 1 ? parsed.minDuplicates : 2;
  const literals = sources.flatMap((source) => extractLiteralsFromSource(source));
  const result = groupColorSmells({ literals, equivalenceMode, minDuplicates, filesScanned: sources.length, templates: templates.value });
  const text = parsed.format === 'json' ? formatResultAsJson(result) : formatResultAsMarkdown(result);
  return { content: [{ type: 'text', text }] };
}

function extractLiteralsFromSource(source: { readonly name: string; readonly text: string }) {
  if (source.name.endsWith('.html')) return extractHtmlLiterals(source.name, source.text);
  return extractTsLiterals(source.name, source.text);
}

interface ResolveTemplatesInput {
  readonly apiDir: string | undefined;
  readonly cwd: string;
}

type ResolveTemplatesResult = { readonly kind: 'value'; readonly value: readonly ColorTemplateEntry[] | undefined } | { readonly kind: 'error'; readonly error: ToolResult };

async function resolveCrossReferenceTemplates(input: ResolveTemplatesInput): Promise<ResolveTemplatesResult> {
  if (input.apiDir === undefined) {
    return { kind: 'value', value: undefined };
  }
  let pathError: string | undefined;
  try {
    ensurePathInsideCwd(input.apiDir, input.cwd);
  } catch (err) {
    pathError = err instanceof Error ? err.message : String(err);
  }

  let result: ResolveTemplatesResult;
  if (pathError === undefined) {
    try {
      const inspection = await inspectColorTemplates(resolve(input.cwd, input.apiDir), input.apiDir);
      if (inspection.appExists) {
        const extracted = extractColorTemplates(inspection);
        result = { kind: 'value', value: extracted.templates };
      } else {
        result = { kind: 'error', error: toolError(`App directory not found: \`${input.apiDir}\`.`) };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = { kind: 'error', error: toolError(`Failed to read templates from \`${input.apiDir}\`: ${message}`) };
    }
  } else {
    result = { kind: 'error', error: toolError(pathError) };
  }
  return result;
}

export const DBX_COLOR_SMELL_CHECK_TOOL: DbxTool = {
  definition: DBX_COLOR_SMELL_CHECK_TOOL_DEFINITION,
  run
};
