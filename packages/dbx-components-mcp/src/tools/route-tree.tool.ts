/**
 * `dbx_route_tree` tool.
 *
 * Reads source files at call time, walks UIRouter state declarations
 * (`Ng2StateDeclaration` objects, typed `STATES` arrays, `provideStates(...)`,
 * and `UIRouterModule.forChild({ states })`) into a unified state tree, and
 * renders it as markdown / JSON / flat.
 *
 * Inputs (all optional but at least one of `sources`/`paths`/`glob`):
 *   • `sources`  — `{name,text}[]` to validate directly.
 *   • `paths`    — file paths relative to cwd; transitive imports are followed.
 *   • `glob`     — glob pattern resolved against cwd; matches are walked.
 *   • `format`   — `'markdown'` (default), `'json'`, `'flat'`.
 *   • `depth_limit` — max tree depth to render.
 *   • `cwd`      — overrides server cwd; constrained to descend the cwd.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { loadRouteTree } from './route/index.js';
import { loadRouteSources } from './route/load-sources.js';
import { formatRouteTree, type RouteTreeFormat } from './route/format.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool definition
const DBX_ROUTE_TREE_TOOL: Tool = {
  name: 'dbx_route_tree',
  description: [
    'Build the UIRouter state tree of a dbx-components app and render it as markdown / JSON / flat.',
    'Recognized state shapes: `Ng2StateDeclaration` const objects, typed `STATES: Ng2StateDeclaration[]` arrays, `provideStates({ states: [...] })`, and `UIRouterModule.forChild({ states })`.',
    '',
    'Provide at least one of:',
    '- `sources`: array of `{ name, text }` — file contents supplied directly.',
    '- `paths`: file paths (relative to cwd). Transitive relative imports are followed.',
    '- `glob`: glob pattern resolved against cwd.',
    '',
    'Use `format=json` for programmatic consumption. `depth_limit` truncates child levels.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        description: 'File contents to analyze directly.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            text: { type: 'string' }
          },
          required: ['name', 'text']
        }
      },
      paths: { type: 'array', items: { type: 'string' }, description: 'Entry paths (relative to cwd) — transitive imports are followed.' },
      glob: { type: 'string', description: 'Glob pattern resolved against cwd.' },
      format: { type: 'string', enum: ['markdown', 'json', 'flat'], default: 'markdown', description: 'Output format.' },
      depth_limit: { type: 'number', description: 'Max tree depth to render (0-based; 0 = roots only).' },
      cwd: { type: 'string', description: 'Optional override for the working directory; must remain a descendant of the server cwd.' }
    }
  }
};

// MARK: Input validation
const TreeArgsType = type({
  'sources?': type({ name: 'string', text: 'string' }).array(),
  'paths?': 'string[]',
  'glob?': 'string',
  'format?': "'markdown' | 'json' | 'flat'",
  'depth_limit?': 'number',
  'cwd?': 'string'
});

interface ParsedTreeArgs {
  readonly sources: readonly { readonly name: string; readonly text: string }[] | undefined;
  readonly paths: readonly string[] | undefined;
  readonly glob: string | undefined;
  readonly format: RouteTreeFormat;
  readonly depthLimit: number | undefined;
  readonly cwd: string | undefined;
}

function parseArgs(raw: unknown): ParsedTreeArgs {
  const parsed = TreeArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedTreeArgs = {
    sources: parsed.sources,
    paths: parsed.paths,
    glob: parsed.glob,
    format: parsed.format ?? 'markdown',
    depthLimit: parsed.depth_limit,
    cwd: parsed.cwd
  };
  return result;
}

// MARK: Handler
/**
 * Tool handler for `dbx_route_tree`. Builds the UIRouter state tree from the
 * resolved app sources and renders it in markdown or json depending on the
 * requested format.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted tree, or an error result when args fail validation
 */
export async function runRouteTree(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedTreeArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const hasAny = (args.sources && args.sources.length > 0) || (args.paths && args.paths.length > 0) || args.glob;
  if (!hasAny) {
    return toolError('Must provide at least one of `sources`, `paths`, or `glob`.');
  }

  let sources;
  try {
    const loaded = await loadRouteSources({
      sources: args.sources,
      paths: args.paths,
      glob: args.glob,
      cwd: args.cwd,
      walkImports: true
    });
    sources = loaded.sources;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(`Failed to read sources: ${message}`);
  }

  if (sources.length === 0) {
    return toolError('No matching source files found.');
  }

  const tree = loadRouteTree({ sources });
  const title = describeTitle(args);
  const text = formatRouteTree({ tree, format: args.format, depthLimit: args.depthLimit, title });
  const errorCount = tree.issues.filter((i) => i.severity === 'error').length;
  const result: ToolResult = {
    content: [{ type: 'text', text }],
    isError: errorCount > 0
  };
  return result;
}

function describeTitle(args: ParsedTreeArgs): string {
  if (args.paths && args.paths.length > 0) {
    return args.paths.join(', ');
  }
  if (args.glob) {
    return args.glob;
  }
  return 'inline sources';
}

export const routeTreeTool: DbxTool = {
  definition: DBX_ROUTE_TREE_TOOL,
  run: runRouteTree
};
