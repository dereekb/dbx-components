/**
 * `dbx_route_search` tool.
 *
 * Keyword search across UIRouter state names, URLs, component class names,
 * resolve keys, and source-file paths. Returns the top 10 matches with
 * one-line summaries.
 *
 * `scope` narrows the search to one axis. Default `'all'` scores across all
 * axes and returns the union.
 *
 * Scoring (matches score additively when scope='all'):
 *   • state name token: 5
 *   • URL segment match: 4
 *   • component class:   3
 *   • resolve key:       2
 *   • file path:         1
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { type RouteTreeNode } from './route/index.js';
import { loadRouteContext } from './route/load-context.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool definition
const DBX_ROUTE_SEARCH_TOOL: Tool = {
  name: 'dbx_route_search',
  description: ['Search the UIRouter state tree of a dbx-components app. Matches against state names, full URLs, component class names, resolve keys, and source-file paths. Returns the top 10 results with state name, URL, component, and source location.', '', 'Provide at least one of `sources` / `paths` / `glob` plus a `query`. `scope` narrows to a single axis (`name`, `url`, `component`, `resolve`).'].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query.' },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, text: { type: 'string' } },
          required: ['name', 'text']
        }
      },
      paths: { type: 'array', items: { type: 'string' } },
      glob: { type: 'string' },
      scope: { type: 'string', enum: ['name', 'url', 'component', 'resolve', 'all'], default: 'all' },
      cwd: { type: 'string' }
    },
    required: ['query']
  }
};

// MARK: Input validation
const SearchArgsType = type({
  query: 'string',
  'sources?': type({ name: 'string', text: 'string' }).array(),
  'paths?': 'string[]',
  'glob?': 'string',
  'scope?': "'name' | 'url' | 'component' | 'resolve' | 'all'",
  'cwd?': 'string'
});

type SearchScope = 'name' | 'url' | 'component' | 'resolve' | 'all';

interface ParsedSearchArgs {
  readonly query: string;
  readonly sources: readonly { readonly name: string; readonly text: string }[] | undefined;
  readonly paths: readonly string[] | undefined;
  readonly glob: string | undefined;
  readonly scope: SearchScope;
  readonly cwd: string | undefined;
}

function parseArgs(raw: unknown): ParsedSearchArgs {
  const parsed = SearchArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedSearchArgs = {
    query: parsed.query,
    sources: parsed.sources,
    paths: parsed.paths,
    glob: parsed.glob,
    scope: parsed.scope ?? 'all',
    cwd: parsed.cwd
  };
  return result;
}

// MARK: Scoring
interface ScoredHit {
  readonly node: RouteTreeNode;
  readonly score: number;
  readonly matchedOn: readonly string[];
}

interface ScopeCheck {
  readonly scopes: readonly SearchScope[];
  readonly match: boolean;
  readonly label: string;
  readonly score: number;
}

function scoreHit(node: RouteTreeNode, query: string, scope: SearchScope): ScoredHit | undefined {
  const q = query.toLowerCase();
  const checks: readonly ScopeCheck[] = [
    { scopes: ['all', 'name'], match: node.data.name.toLowerCase().includes(q), label: 'name', score: 5 },
    { scopes: ['all', 'url'], match: Boolean(node.fullUrl?.toLowerCase().includes(q) || node.data.url?.toLowerCase().includes(q)), label: 'url', score: 4 },
    { scopes: ['all', 'component'], match: Boolean(node.data.component?.toLowerCase().includes(q)), label: 'component', score: 3 },
    { scopes: ['all', 'resolve'], match: node.data.resolveKeys.some((key) => key.toLowerCase().includes(q)), label: 'resolve', score: 2 },
    { scopes: ['all'], match: node.data.file.toLowerCase().includes(q), label: 'file', score: 1 }
  ];

  let score = 0;
  const matchedOn: string[] = [];
  for (const check of checks) {
    if (check.scopes.includes(scope) && check.match) {
      score += check.score;
      matchedOn.push(check.label);
    }
  }

  return score === 0 ? undefined : { node, score, matchedOn };
}

/**
 * Options for formatting route-search hits as markdown.
 */
interface FormatHitsOptions {
  readonly query: string;
  readonly scope: SearchScope;
  readonly hits: readonly ScoredHit[];
  readonly totalNodes: number;
}

// MARK: Formatting
function formatHits(options: FormatHitsOptions): string {
  const { query, scope, hits, totalNodes } = options;
  const lines: string[] = [];
  lines.push(`# Route search — \`${query}\` (scope: ${scope})`);
  lines.push('');
  if (hits.length === 0) {
    lines.push(`No matches across ${totalNodes} state(s).`);
    return lines.join('\n');
  }
  lines.push(`${hits.length} match(es) of ${totalNodes} state(s) — top 10 shown.`);
  lines.push('');
  for (const hit of hits) {
    const node = hit.node;
    const url = node.fullUrl !== undefined ? `\`${node.fullUrl}\`` : '';
    const component = node.data.component !== undefined ? ` → \`${node.data.component}\`` : '';
    const matched = hit.matchedOn.length > 0 ? ` _(matched: ${hit.matchedOn.join(', ')})_` : '';
    lines.push(`- \`${node.data.name}\` ${url}${component} _(${node.data.file}:${node.data.line})_${matched}`);
  }
  return lines.join('\n');
}

// MARK: Handler
/**
 * Tool handler for `dbx_route_search`. Indexes the resolved UIRouter sources
 * and ranks states by query, returning the top hits with matched-on metadata
 * for callers exploring an unfamiliar app.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted search results, or an error result when args fail validation
 */
export async function runRouteSearch(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedSearchArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const ctx = await loadRouteContext(args);
  if (ctx.kind === 'error') {
    return ctx.result;
  }

  const { tree } = ctx;
  const hits: ScoredHit[] = [];
  for (const node of tree.byName.values()) {
    const hit = scoreHit(node, args.query, args.scope);
    if (hit) {
      hits.push(hit);
    }
  }
  hits.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.node.data.name < b.node.data.name) {
      return -1;
    }
    if (a.node.data.name > b.node.data.name) {
      return 1;
    }
    return 0;
  });
  const top = hits.slice(0, 10);
  const text = formatHits({ query: args.query, scope: args.scope, hits: top, totalNodes: tree.nodeCount });
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const routeSearchTool: DbxTool = {
  definition: DBX_ROUTE_SEARCH_TOOL,
  run: runRouteSearch
};
