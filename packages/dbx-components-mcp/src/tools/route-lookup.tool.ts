/**
 * `dbx_route_lookup` tool.
 *
 * Single-state detail view. The `topic` is resolved in this order:
 *   1. Exact state-name match (`'app.home.profile'`).
 *   2. URL path match against the composed full URL (`'/home/profile'`).
 *   3. Component class name match — may match multiple → grouped output.
 *   4. Fuzzy state-name substring → "did you mean…".
 *
 * `depth='full'` lists the parent chain, params, resolves, siblings, and
 * children. `depth='brief'` shows only the headline.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { loadRouteTree, type RouteTreeNode } from './route/index.js';
import { loadRouteSources } from './route/load-sources.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool definition
const DBX_ROUTE_LOOKUP_TOOL: Tool = {
  name: 'dbx_route_lookup',
  description: ["Look up a single UIRouter state by name, full URL, or component class name. Returns the state's URL, component, parent chain, params, resolves, siblings, and children.", '', 'Provide at least one of `sources` / `paths` / `glob` to point the tool at the source set, plus a `topic`.', '', 'Resolution order: exact state name → URL path → component class name → fuzzy substring (returns up to 5 candidates).'].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'State name, URL, or component class name.' },
      sources: {
        type: 'array',
        description: 'File contents to analyze directly.',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, text: { type: 'string' } },
          required: ['name', 'text']
        }
      },
      paths: { type: 'array', items: { type: 'string' } },
      glob: { type: 'string' },
      depth: { type: 'string', enum: ['brief', 'full'], default: 'full' },
      cwd: { type: 'string' }
    },
    required: ['topic']
  }
};

// MARK: Input validation
const LookupArgsType = type({
  topic: 'string',
  'sources?': type({ name: 'string', text: 'string' }).array(),
  'paths?': 'string[]',
  'glob?': 'string',
  'depth?': "'brief' | 'full'",
  'cwd?': 'string'
});

interface ParsedLookupArgs {
  readonly topic: string;
  readonly sources: readonly { readonly name: string; readonly text: string }[] | undefined;
  readonly paths: readonly string[] | undefined;
  readonly glob: string | undefined;
  readonly depth: 'brief' | 'full';
  readonly cwd: string | undefined;
}

function parseArgs(raw: unknown): ParsedLookupArgs {
  const parsed = LookupArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedLookupArgs = {
    topic: parsed.topic,
    sources: parsed.sources,
    paths: parsed.paths,
    glob: parsed.glob,
    depth: parsed.depth ?? 'full',
    cwd: parsed.cwd
  };
  return result;
}

// MARK: Resolution
type LookupMatch = { readonly kind: 'single'; readonly node: RouteTreeNode; readonly via: string } | { readonly kind: 'group'; readonly title: string; readonly nodes: readonly RouteTreeNode[] } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly RouteTreeNode[] };

function resolveTopic(topic: string, byName: ReadonlyMap<string, RouteTreeNode>): LookupMatch {
  const trimmed = topic.trim();
  const exact = byName.get(trimmed);
  if (exact) {
    return { kind: 'single', node: exact, via: 'state name' };
  }

  // URL match
  const urlHit: RouteTreeNode[] = [];
  for (const node of byName.values()) {
    if (node.fullUrl === trimmed) {
      urlHit.push(node);
    }
  }
  if (urlHit.length === 1) {
    return { kind: 'single', node: urlHit[0], via: 'URL' };
  }
  if (urlHit.length > 1) {
    return { kind: 'group', title: `States with URL \`${trimmed}\``, nodes: urlHit };
  }

  // Component class match
  const componentHit: RouteTreeNode[] = [];
  for (const node of byName.values()) {
    if (node.data.component === trimmed) {
      componentHit.push(node);
    }
  }
  if (componentHit.length === 1) {
    return { kind: 'single', node: componentHit[0], via: 'component class' };
  }
  if (componentHit.length > 1) {
    return { kind: 'group', title: `States rendering \`${trimmed}\``, nodes: componentHit };
  }

  // Fuzzy
  return { kind: 'not-found', normalized: trimmed, candidates: fuzzyCandidates(trimmed, byName) };
}

function fuzzyCandidates(query: string, byName: ReadonlyMap<string, RouteTreeNode>): readonly RouteTreeNode[] {
  const q = query.toLowerCase();
  if (q.length === 0) {
    return [];
  }
  const scored: { readonly node: RouteTreeNode; readonly score: number }[] = [];
  for (const node of byName.values()) {
    let score = 0;
    if (node.data.name.toLowerCase().includes(q)) {
      score += 3;
    }
    if (node.fullUrl !== undefined && node.fullUrl.toLowerCase().includes(q)) {
      score += 2;
    }
    if (node.data.component !== undefined && node.data.component.toLowerCase().includes(q)) {
      score += 2;
    }
    if (score > 0) {
      scored.push({ node, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, 5).map((s) => s.node);
  return result;
}

// MARK: Formatting
function formatSingle(node: RouteTreeNode, depth: 'brief' | 'full', via: string): string {
  const lines: string[] = [];
  lines.push(`# ${node.data.name}`);
  lines.push('');
  lines.push(`Matched via ${via}.`);
  lines.push('');
  lines.push(`- **URL:** ${node.fullUrl !== undefined ? `\`${node.fullUrl}\`` : '_no url_'}`);
  lines.push(`- **Component:** ${node.data.component !== undefined ? `\`${node.data.component}\`` : '_no component_'}`);
  lines.push(`- **Defined in:** \`${node.data.file}:${node.data.line}\``);
  if (node.data.redirectTo) {
    lines.push(`- **Redirects to:** \`${node.data.redirectTo}\``);
  }
  if (node.data.abstract) {
    lines.push('- **Abstract:** yes');
  }
  if (node.data.futureState) {
    lines.push('- **Future state:** yes (lazy-loaded)');
  }

  if (depth === 'brief') {
    return lines.join('\n');
  }

  // Parent chain
  lines.push('');
  lines.push('## Parent chain');
  const chain = ancestors(node);
  const chainLine = chain.map((c) => `\`${c.data.name}\``).join(' → ');
  lines.push(chainLine.length > 0 ? chainLine : '_root_');

  // Params
  lines.push('');
  lines.push('## Params');
  if (node.data.paramKeys.length === 0) {
    lines.push('_None._');
  } else {
    for (const key of node.data.paramKeys) {
      lines.push(`- \`${key}\``);
    }
  }

  // Resolves
  lines.push('');
  lines.push('## Resolves');
  if (node.data.resolveKeys.length === 0) {
    lines.push('_None._');
  } else {
    for (const key of node.data.resolveKeys) {
      lines.push(`- \`${key}\``);
    }
  }

  // Siblings
  lines.push('');
  lines.push('## Siblings');
  const siblings = node.parent ? node.parent.children.filter((c) => c.data.name !== node.data.name) : [];
  if (siblings.length === 0) {
    lines.push('_None._');
  } else {
    for (const sib of siblings) {
      lines.push(`- \`${sib.data.name}\` ${sib.fullUrl !== undefined ? `\`${sib.fullUrl}\`` : ''}${sib.data.component ? ` → \`${sib.data.component}\`` : ''}`);
    }
  }

  // Children
  lines.push('');
  lines.push('## Children');
  if (node.children.length === 0) {
    lines.push('_None._');
  } else {
    for (const child of node.children) {
      lines.push(`- \`${child.data.name}\` ${child.fullUrl !== undefined ? `\`${child.fullUrl}\`` : ''}${child.data.component ? ` → \`${child.data.component}\`` : ''}`);
    }
  }

  lines.push('');
  lines.push('→ See skill `dbx__ref__dbx-app-structure` for state composition patterns.');
  return lines.join('\n');
}

function ancestors(node: RouteTreeNode): readonly RouteTreeNode[] {
  const chain: RouteTreeNode[] = [];
  let cursor: RouteTreeNode | undefined = node;
  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parent;
  }
  return chain;
}

function formatGroup(title: string, nodes: readonly RouteTreeNode[]): string {
  const lines: string[] = [`# ${title}`, '', `${nodes.length} match(es).`, ''];
  for (const node of nodes) {
    lines.push(`- \`${node.data.name}\` ${node.fullUrl !== undefined ? `\`${node.fullUrl}\`` : ''}${node.data.component ? ` → \`${node.data.component}\`` : ''} _(${node.data.file}:${node.data.line})_`);
  }
  return lines.join('\n');
}

function formatNotFound(query: string, candidates: readonly RouteTreeNode[]): string {
  const lines: string[] = [`No state matched \`${query}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?');
    lines.push('');
    for (const node of candidates) {
      lines.push(`- \`${node.data.name}\` ${node.fullUrl !== undefined ? `\`${node.fullUrl}\`` : ''}${node.data.component ? ` → \`${node.data.component}\`` : ''}`);
    }
  } else {
    lines.push('Try `dbx_route_tree` to see the full state listing.');
  }
  return lines.join('\n');
}

// MARK: Handler
export async function runRouteLookup(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedLookupArgs;
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
  const match = resolveTopic(args.topic, tree.byName);
  let text: string;
  switch (match.kind) {
    case 'single':
      text = formatSingle(match.node, args.depth, match.via);
      break;
    case 'group':
      text = formatGroup(match.title, match.nodes);
      break;
    case 'not-found':
      text = formatNotFound(match.normalized, match.candidates);
      break;
  }

  const result: ToolResult = {
    content: [{ type: 'text', text }],
    isError: match.kind === 'not-found'
  };
  return result;
}

export const routeLookupTool: DbxTool = {
  definition: DBX_ROUTE_LOOKUP_TOOL,
  run: runRouteLookup
};
