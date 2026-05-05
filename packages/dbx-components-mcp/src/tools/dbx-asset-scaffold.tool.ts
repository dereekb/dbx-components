/**
 * `dbx_asset_scaffold` tool.
 *
 * Generates the TypeScript fragment, imports, and notes block for a
 * new `AssetPathRef` constant in a component's `src/lib/assets.ts`.
 * Pure synchronous: no I/O, just template + import-list strings.
 *
 * Inputs select one of the four `@dereekb/rxjs` builder shapes:
 *   - `local`        — `localAsset(path)`
 *   - `remote`       — `remoteAsset(url)`
 *   - `folder`       — `assetFolder(folder)` builder bind (also emits
 *     a sibling `.asset(child)` example using the bind)
 *   - `remote-base`  — `remoteAssetBaseUrl(baseUrl)` builder bind
 *     (also emits a sibling `.asset(child)` example)
 *
 * When `builder_var` is supplied for a `local` or `remote` kind, the
 * fragment emits a fluent member call instead of a fresh
 * `localAsset` / `remoteAsset` call.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const ASSET_BUILDERS = [
  { kind: 'local', helper: 'localAsset', signature: '(path: SlashPath)' },
  { kind: 'remote', helper: 'remoteAsset', signature: '(url: WebsiteUrlWithPrefix)' },
  { kind: 'folder', helper: 'assetFolder', signature: '(folder: SlashPath)' },
  { kind: 'remote-base', helper: 'remoteAssetBaseUrl', signature: '(baseUrl: WebsiteUrlWithPrefix)' }
] as const;

type AssetBuilderKind = (typeof ASSET_BUILDERS)[number]['kind'];

const KIND_VALUES: readonly AssetBuilderKind[] = ASSET_BUILDERS.map((b) => b.kind);

const DBX_ASSET_SCAFFOLD_TOOL: Tool = {
  name: 'dbx_asset_scaffold',
  description: [
    "Scaffold a new `AssetPathRef` constant for a downstream `-firebase` component's `src/lib/assets.ts`.",
    '',
    'Inputs:',
    '  • `name` — exported const name (SCREAMING_SNAKE_CASE recommended, e.g. `DEMO_LOGO`).',
    '  • `kind` — `"local"`, `"remote"`, `"folder"`, or `"remote-base"`.',
    '  • `path` — required for `local` (or for a fluent `.asset(...)` call when `builder_var` is set with `kind: "local"`); also the folder argument for `kind: "folder"`.',
    '  • `url` — required for `remote` and `remote-base`. Must start with `http://` or `https://`.',
    '  • `builder_var` — optional. When set with `kind: "local"`, emits `<NAME> = <builder_var>.asset(path)` instead of `localAsset(path)`. Same for `kind: "remote"` (uses the supplied URL as the child path).',
    '  • `aggregator_name` — optional. Adds a "remember to append `<NAME>` to `<aggregator_name>`" note.',
    '',
    'Output: a markdown bundle with the TypeScript fragment, the imports list, and a notes section. The tool does NOT write files — paste the fragment manually.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Exported const name (e.g. `DEMO_LOGO`).' },
      kind: { type: 'string', enum: [...KIND_VALUES], description: 'Builder shape.' },
      path: { type: 'string', description: 'Local path for `local` / `folder` kinds; child path when used with `builder_var`.' },
      url: { type: 'string', description: 'Absolute http/https URL for `remote` / `remote-base` kinds.' },
      builder_var: { type: 'string', description: 'Existing folder/base-URL builder binding to call `.asset(...)` on.' },
      aggregator_name: { type: 'string', description: 'Aggregator constant to remind the caller to update.' }
    },
    required: ['name', 'kind']
  }
};

const ScaffoldArgsType = type({
  name: 'string',
  kind: "'local' | 'remote' | 'folder' | 'remote-base'",
  'path?': 'string',
  'url?': 'string',
  'builder_var?': 'string',
  'aggregator_name?': 'string'
});

interface ParsedScaffoldArgs {
  readonly name: string;
  readonly kind: AssetBuilderKind;
  readonly path: string | undefined;
  readonly url: string | undefined;
  readonly builderVar: string | undefined;
  readonly aggregatorName: string | undefined;
}

function parseScaffoldArgs(raw: unknown): ParsedScaffoldArgs {
  const parsed = ScaffoldArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const name = parsed.name.trim();
  if (name.length === 0) {
    throw new Error('Invalid arguments: name must not be empty.');
  }
  const result: ParsedScaffoldArgs = {
    name,
    kind: parsed.kind,
    path: parsed.path?.trim() || undefined,
    url: parsed.url?.trim() || undefined,
    builderVar: parsed.builder_var?.trim() || undefined,
    aggregatorName: parsed.aggregator_name?.trim() || undefined
  };
  return result;
}

interface ScaffoldOutput {
  readonly fragment: string;
  readonly imports: readonly string[];
  readonly notes: readonly string[];
}

function buildScaffold(args: ParsedScaffoldArgs): ScaffoldOutput {
  if (args.kind === 'local') return buildLocal(args);
  if (args.kind === 'remote') return buildRemote(args);
  if (args.kind === 'folder') return buildFolder(args);
  return buildRemoteBase(args);
}

function buildLocal(args: ParsedScaffoldArgs): ScaffoldOutput {
  if (!args.path) {
    throw new Error('Invalid arguments: `path` is required when kind="local".');
  }
  const importsSet = new Set<string>(['type AssetPathRef']);
  const notes: string[] = [];
  let fragment: string;
  if (args.builderVar) {
    fragment = `export const ${args.name}: AssetPathRef = ${args.builderVar}.asset('${args.path}');`;
    notes.push(`Reuses existing folder builder \`${args.builderVar}\`. Joined path = \`${args.builderVar}.basePath + ${args.path}\`.`);
  } else {
    fragment = `export const ${args.name}: AssetPathRef = localAsset('${args.path}');`;
    importsSet.add('localAsset');
  }
  notes.push(`Place the file at \`<appDir>/src/assets/${args.path}\` so Angular CLI copies it to the build output.`);
  if (args.aggregatorName) {
    notes.push(`Append \`${args.name}\` to \`${args.aggregatorName}\` so the aggregator stays complete.`);
  }
  return { fragment, imports: buildImportLines(importsSet), notes };
}

function buildRemote(args: ParsedScaffoldArgs): ScaffoldOutput {
  if (!args.url) {
    throw new Error('Invalid arguments: `url` is required when kind="remote".');
  }
  const importsSet = new Set<string>(['type AssetPathRef']);
  const notes: string[] = [];
  let fragment: string;
  if (args.builderVar) {
    fragment = `export const ${args.name}: AssetPathRef = ${args.builderVar}.asset('${args.url}');`;
    notes.push(`Reuses existing remote-base builder \`${args.builderVar}\`. Joined URL = \`${args.builderVar}.baseUrl + ${args.url}\`.`);
    if (!args.url.startsWith('/')) {
      notes.push(`Note: the second argument to \`<base>.asset(...)\` is a relative path, not an absolute URL.`);
    }
  } else {
    fragment = `export const ${args.name}: AssetPathRef = remoteAsset('${args.url}');`;
    importsSet.add('remoteAsset');
    if (!isAbsoluteHttpUrl(args.url)) {
      notes.push(`⚠️ \`${args.url}\` does not start with \`http://\` or \`https://\`. \`remoteAsset(...)\` will throw at module load.`);
    }
  }
  if (args.aggregatorName) {
    notes.push(`Append \`${args.name}\` to \`${args.aggregatorName}\` so the aggregator stays complete.`);
  }
  return { fragment, imports: buildImportLines(importsSet), notes };
}

function buildFolder(args: ParsedScaffoldArgs): ScaffoldOutput {
  if (!args.path) {
    throw new Error('Invalid arguments: `path` is required when kind="folder".');
  }
  const fragment = `const ${args.name} = assetFolder('${args.path}');\n// Then declare exports off the builder, e.g.:\n// export const SAMPLE_FILE: AssetPathRef = ${args.name}.asset('sample.json');`;
  const importsSet = new Set<string>(['assetFolder', 'type AssetPathRef']);
  const notes: string[] = [`\`${args.name}\` is a non-exported builder bind. Use \`${args.name}.asset(child)\` to declare each ref.`, `Files referenced via this builder must live under \`<appDir>/src/assets/${args.path.endsWith('/') ? args.path : args.path + '/'}\`.`];
  if (args.aggregatorName) {
    notes.push(`Remember to append each \`<NAME>\` ref to \`${args.aggregatorName}\`.`);
  }
  return { fragment, imports: buildImportLines(importsSet), notes };
}

function buildRemoteBase(args: ParsedScaffoldArgs): ScaffoldOutput {
  if (!args.url) {
    throw new Error('Invalid arguments: `url` is required when kind="remote-base".');
  }
  const fragment = `const ${args.name} = remoteAssetBaseUrl('${args.url}');\n// Then declare exports off the builder, e.g.:\n// export const SAMPLE_FILE: AssetPathRef = ${args.name}.asset('sample.json');`;
  const importsSet = new Set<string>(['remoteAssetBaseUrl', 'type AssetPathRef']);
  const notes: string[] = [`\`${args.name}\` is a non-exported builder bind. Use \`${args.name}.asset(child)\` to declare each ref.`];
  if (!isAbsoluteHttpUrl(args.url)) {
    notes.push(`⚠️ \`${args.url}\` does not start with \`http://\` or \`https://\`. \`remoteAssetBaseUrl(...)\` will throw at module load.`);
  }
  if (args.aggregatorName) {
    notes.push(`Remember to append each \`<NAME>\` ref to \`${args.aggregatorName}\`.`);
  }
  return { fragment, imports: buildImportLines(importsSet), notes };
}

function buildImportLines(symbols: ReadonlySet<string>): readonly string[] {
  const sorted = [...symbols].sort((a, b) => a.localeCompare(b));
  const result: string[] = [`import { ${sorted.join(', ')} } from '@dereekb/rxjs';`];
  return result;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function renderScaffold(args: ParsedScaffoldArgs): string {
  const { fragment, imports, notes } = buildScaffold(args);
  const lines: string[] = [];
  lines.push(`# Asset scaffold — ${args.name}`, '', `Kind: \`${args.kind}\``, '', '## Fragment', '', '```ts', fragment, '```', '', '## Imports', '', '```ts');
  for (const line of imports) {
    lines.push(line);
  }
  lines.push('```', '', '## Notes');
  if (notes.length === 0) {
    lines.push('', '_(none)_');
  } else {
    lines.push('');
    for (const note of notes) {
      lines.push(`- ${note}`);
    }
  }
  lines.push('', `→ Run \`dbx_asset_validate_app\` against the component + app pair after pasting to verify the wiring.`);
  return lines.join('\n');
}

/**
 * Tool handler for `dbx_asset_scaffold`. Validates the request, renders
 * the scaffold output, and packages it as tool content.
 *
 * @param rawArgs - the unvalidated tool arguments object from the MCP runtime
 * @returns the rendered scaffold, or an error result when args fail validation
 */
export function runAssetScaffold(rawArgs: unknown): ToolResult {
  let args: ParsedScaffoldArgs;
  try {
    args = parseScaffoldArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }
  const text = renderScaffold(args);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const dbxAssetScaffoldTool: DbxTool = {
  definition: DBX_ASSET_SCAFFOLD_TOOL,
  run: runAssetScaffold
};
