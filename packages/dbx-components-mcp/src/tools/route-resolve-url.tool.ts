/**
 * `dbx_route_resolve_url` tool.
 *
 * Takes a dev-server URL or pathname, picks the owning Angular app from the
 * workspace's `apps/*\/project.json` port map (overridable with `app`), loads
 * that app's UIRouter state tree, and returns the matching state alongside
 * the rendered component's source file.
 *
 * Designed for agents that need to read or modify the component behind a
 * URL — output includes the state's declared identifier, router file:line,
 * resolved component file, ancestor chain, declared params/resolves, and
 * sibling states for context when adding adjacent pages.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { resolveUrlToState, type ResolveUrlMatch, type ResolveUrlMultiple, type ResolveUrlNotFound, type ResolveUrlResult } from './route/resolve-url.js';
import { formatMissingRouteModelLine, formatPageModelLine } from './route/page-models.js';
import type { RouteTreeNode } from '@dereekb/dbx-cli';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool definition
const DBX_ROUTE_RESOLVE_URL_TOOL: Tool = {
  name: 'dbx_route_resolve_url',
  description: [
    'Resolve a dev-server URL or path to the UIRouter state that owns it.',
    "Pass a full URL like `http://localhost:9010/doc/interaction/upload` — the tool reads `apps/*/project.json` to map the port to an app, loads that app's state tree, and returns the matching state.",
    'Bare paths (`/doc/interaction/upload`) are accepted when paired with an `app` override.',
    '',
    'Returns the state name, the `export const` identifier (when declared as a typed const), the component class, the router file:line, the resolved component source file, the ancestor chain, and declared params/resolves — enough for an agent to read or modify the component behind the URL. Pass `includeSiblings: true` to also list peer states under the same parent (useful when adding a new page next to the matched one).'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL or pathname, e.g. "http://localhost:9010/doc/interaction/upload" or "/doc/interaction/upload".' },
      app: { type: 'string', description: 'Optional app name override (e.g. "demo"). Required when the input is a bare path with no port.' },
      cwd: { type: 'string', description: 'Optional cwd override (must stay inside server cwd).' },
      format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown', description: 'Output format.' },
      includeSiblings: { type: 'boolean', default: false, description: 'When true, include sibling states (peers under the same parent) in the output. Off by default to keep the response focused.' }
    },
    required: ['url']
  }
};

// MARK: Input validation
const ResolveUrlArgsType = type({
  url: 'string',
  'app?': 'string',
  'cwd?': 'string',
  'format?': "'markdown' | 'json'",
  'includeSiblings?': 'boolean'
});

interface ParsedResolveUrlArgs {
  readonly url: string;
  readonly app: string | undefined;
  readonly cwd: string | undefined;
  readonly format: 'markdown' | 'json';
  readonly includeSiblings: boolean;
}

function parseArgs(raw: unknown): ParsedResolveUrlArgs {
  const parsed = ResolveUrlArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedResolveUrlArgs = {
    url: parsed.url,
    app: parsed.app,
    cwd: parsed.cwd,
    format: parsed.format ?? 'markdown',
    includeSiblings: parsed.includeSiblings ?? false
  };
  return result;
}

// MARK: Handler
/**
 * Tool handler for `dbx_route_resolve_url`. Parses the URL, resolves the app,
 * loads the state tree, matches the path, and formats the resulting state
 * (with the rendered component's source file) as markdown or JSON.
 *
 * @param rawArgs - The unvalidated tool arguments from the MCP runtime.
 * @returns The formatted resolution, or an error result.
 */
export async function runRouteResolveUrl(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedResolveUrlArgs | undefined;
  let parseError: string | undefined;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }
  let result: ToolResult;
  if (parseError !== undefined || args === undefined) {
    result = toolError(parseError ?? 'Failed to parse arguments.');
  } else {
    const resolution = await resolveUrlToState({ url: args.url, app: args.app, cwd: args.cwd, includeSiblings: args.includeSiblings });
    result = renderResolution(resolution, args.format);
  }
  return result;
}

function renderResolution(resolution: ResolveUrlResult, format: 'markdown' | 'json'): ToolResult {
  let out: ToolResult;
  switch (resolution.kind) {
    case 'error':
      out = toolError(resolution.message);
      break;
    case 'match':
      out = { content: [{ type: 'text', text: format === 'json' ? formatMatchJson(resolution) : formatMatchMarkdown(resolution) }] };
      break;
    case 'multiple':
      out = { content: [{ type: 'text', text: format === 'json' ? formatMultipleJson(resolution) : formatMultipleMarkdown(resolution) }] };
      break;
    case 'not_found':
      out = { content: [{ type: 'text', text: format === 'json' ? formatNotFoundJson(resolution) : formatNotFoundMarkdown(resolution) }], isError: true };
      break;
  }
  return out;
}

// MARK: Markdown
function formatMatchMarkdown(match: ResolveUrlMatch): string {
  const node = match.node;
  const portSuffix = match.app.ports.length > 0 ? ` (port ${match.app.ports.join(', ')})` : '';
  const lines: string[] = [`# ${match.pathname} → ${node.data.name}`, '', `Matched via ${match.via} URL${match.via === 'param' ? ' pattern' : ''}.`, '', `- **App:** \`${match.app.name}\`${portSuffix}`, `- **State name:** \`${node.data.name}\``];
  if (node.data.declaredAs) {
    lines.push(`- **Declared as:** \`${node.data.declaredAs}\``);
  }
  if (node.data.component) {
    lines.push(`- **Component class:** \`${node.data.component}\``);
  }
  lines.push(`- **Composed URL:** \`${match.matchedFullUrl}\``, `- **Router file:** \`${node.data.file}:${node.data.line}\``);
  if (match.componentFile) {
    lines.push(`- **Component file:** \`${match.componentFile.path}\``);
  } else if (node.data.component) {
    lines.push(`- **Component file:** _unresolved (import not found in router file)_`);
  }
  if (node.data.redirectTo) {
    lines.push(`- **Redirects to:** \`${node.data.redirectTo}\``);
  }
  if (node.data.abstract) {
    lines.push('- **Abstract:** yes');
  }
  if (node.data.futureState) {
    lines.push('- **Future state:** yes (lazy-loaded)');
  }

  appendPageModels(lines, match.models);
  appendValidation(lines, match.missingRouteModels);
  appendParams(lines, match);
  appendSearch(lines, match);
  appendKeys(lines, 'URL path params', match.urlParamKeys);
  appendKeys(lines, 'Declared params (state.params)', node.data.paramKeys);
  appendKeys(lines, 'Declared resolves', node.data.resolveKeys);
  appendAncestors(lines, match.ancestors);
  appendSiblings(lines, match.siblings);

  return lines.join('\n');
}

function appendPageModels(lines: string[], models: ResolveUrlMatch['models']): void {
  lines.push('', '## Page models');
  if (models.length === 0) {
    lines.push('_None declared. Annotate the component class or state with `@dbxRouteModel` / `@dbxRouteModelList`._');
    return;
  }
  for (const model of models) {
    lines.push(formatPageModelLine(model));
  }
}

function appendValidation(lines: string[], missingRouteModels: ResolveUrlMatch['missingRouteModels']): void {
  if (missingRouteModels.length === 0) {
    return;
  }
  lines.push('', '## Validation');
  for (const param of missingRouteModels) {
    lines.push(formatMissingRouteModelLine(param));
  }
}

function appendParams(lines: string[], match: ResolveUrlMatch): void {
  const keys = Object.keys(match.params);
  if (keys.length === 0) {
    return;
  }
  lines.push('', '## URL params (extracted)');
  for (const key of keys) {
    lines.push(`- \`${key}\` = \`${match.params[key]}\``);
  }
}

function appendSearch(lines: string[], match: ResolveUrlMatch): void {
  const keys = Object.keys(match.search);
  if (keys.length === 0) {
    return;
  }
  lines.push('', '## Search params');
  for (const key of keys) {
    lines.push(`- \`${key}\` = \`${match.search[key]}\``);
  }
}

function appendKeys(lines: string[], title: string, keys: readonly string[]): void {
  lines.push('', `## ${title}`);
  if (keys.length === 0) {
    lines.push('_None._');
    return;
  }
  for (const key of keys) {
    lines.push(`- \`${key}\``);
  }
}

function appendAncestors(lines: string[], ancestors: readonly RouteTreeNode[]): void {
  lines.push('', '## Parent chain');
  if (ancestors.length <= 1) {
    lines.push('_root_');
    return;
  }
  for (const ancestor of ancestors) {
    const urlPart = ancestor.fullUrl === undefined ? '' : ` \`${ancestor.fullUrl}\``;
    lines.push(`- \`${ancestor.data.name}\`${urlPart} _(${ancestor.data.file}:${ancestor.data.line})_`);
  }
}

function appendSiblings(lines: string[], siblings: readonly RouteTreeNode[] | undefined): void {
  if (siblings === undefined) {
    return;
  }
  lines.push('', '## Siblings');
  if (siblings.length === 0) {
    lines.push('_None._');
    return;
  }
  for (const sib of siblings) {
    const urlPart = sib.fullUrl === undefined ? '' : ` \`${sib.fullUrl}\``;
    const componentPart = sib.data.component ? ` → \`${sib.data.component}\`` : '';
    lines.push(`- \`${sib.data.name}\`${urlPart}${componentPart}`);
  }
}

function formatMultipleMarkdown(multiple: ResolveUrlMultiple): string {
  const lines: string[] = [`# ${multiple.pathname} matched ${multiple.nodes.length} states in \`${multiple.app.name}\``, ''];
  for (const node of multiple.nodes) {
    const urlPart = node.fullUrl === undefined ? '' : ` \`${node.fullUrl}\``;
    const componentPart = node.data.component ? ` → \`${node.data.component}\`` : '';
    lines.push(`- \`${node.data.name}\`${urlPart}${componentPart} _(${node.data.file}:${node.data.line})_`);
  }
  return lines.join('\n');
}

function formatNotFoundMarkdown(notFound: ResolveUrlNotFound): string {
  const lines: string[] = [`No state matched \`${notFound.pathname}\` in app \`${notFound.app.name}\`.`, ''];
  if (notFound.candidates.length > 0) {
    lines.push('Closest candidates:', '');
    for (const cand of notFound.candidates) {
      const urlPart = cand.fullUrl === undefined ? '' : ` \`${cand.fullUrl}\``;
      const componentPart = cand.data.component ? ` → \`${cand.data.component}\`` : '';
      lines.push(`- \`${cand.data.name}\`${urlPart}${componentPart}`);
    }
  } else {
    lines.push('Try `dbx_route_tree` to see the full state listing.');
  }
  return lines.join('\n');
}

// MARK: JSON
function formatMatchJson(match: ResolveUrlMatch): string {
  const payload = {
    kind: 'match' as const,
    app: { name: match.app.name, projectRoot: match.app.projectRoot, ports: match.app.ports },
    via: match.via,
    pathname: match.pathname,
    matchedFullUrl: match.matchedFullUrl,
    params: match.params,
    search: match.search,
    state: serializeNode(match.node),
    componentFile: match.componentFile ?? null,
    urlParamKeys: match.urlParamKeys,
    models: match.models,
    missingRouteModels: match.missingRouteModels,
    ancestors: match.ancestors.map(serializeNode),
    siblings: match.siblings === undefined ? null : match.siblings.map(serializeNode)
  };
  return JSON.stringify(payload, null, 2);
}

function formatMultipleJson(multiple: ResolveUrlMultiple): string {
  const payload = {
    kind: 'multiple' as const,
    app: { name: multiple.app.name, projectRoot: multiple.app.projectRoot, ports: multiple.app.ports },
    pathname: multiple.pathname,
    states: multiple.nodes.map(serializeNode)
  };
  return JSON.stringify(payload, null, 2);
}

function formatNotFoundJson(notFound: ResolveUrlNotFound): string {
  const payload = {
    kind: 'not_found' as const,
    app: { name: notFound.app.name, projectRoot: notFound.app.projectRoot, ports: notFound.app.ports },
    pathname: notFound.pathname,
    candidates: notFound.candidates.map(serializeNode)
  };
  return JSON.stringify(payload, null, 2);
}

function serializeNode(node: RouteTreeNode): unknown {
  return {
    name: node.data.name,
    fullUrl: node.fullUrl ?? null,
    url: node.data.url ?? null,
    component: node.data.component ?? null,
    declaredAs: node.data.declaredAs ?? null,
    file: node.data.file,
    line: node.data.line,
    abstract: node.data.abstract,
    futureState: node.data.futureState,
    redirectTo: node.data.redirectTo ?? null,
    paramKeys: node.data.paramKeys,
    resolveKeys: node.data.resolveKeys
  };
}

export const ROUTE_RESOLVE_URL_TOOL: DbxTool = {
  definition: DBX_ROUTE_RESOLVE_URL_TOOL,
  run: runRouteResolveUrl
};
