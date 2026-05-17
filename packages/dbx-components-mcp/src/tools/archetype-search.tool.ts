/**
 * `dbx_model_archetype_search` tool.
 *
 * Archetype-filtered model search. Given an archetype slug and optional axis
 * filters, returns peer models in scope that already use that archetype.
 * Identical scope semantics to `dbx_model_search` (`scope` / `componentDirs`);
 * archetype filtering is exclusive to this tool — `dbx_model_search` is
 * unchanged.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FIREBASE_MODELS, getDownstreamCatalog, resolveModelArchetype, type DownstreamCatalog, type FirebaseModel } from '../registry/index.js';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

type SearchScope = 'all' | 'upstream' | 'downstream';

const DEFAULT_LIMIT = 25;

const SearchArgsType = type({
  archetype: 'string',
  'axes?': { '[string]': 'string' },
  'scope?': "'all' | 'upstream' | 'downstream'",
  'componentDirs?': 'string[]',
  'limit?': 'number'
});

const DBX_MODEL_ARCHETYPE_SEARCH_TOOL: Tool = {
  name: 'dbx_model_archetype_search',
  description: [
    'Find peer Firebase models already tagged with the given archetype. Pair with `dbx_model_archetype_recommend` to see the matched archetype, then call this tool with the slug to list more peers across upstream + downstream packages.',
    '',
    'Optional inputs:',
    '  • `axes`: tighten the search by axis values (e.g. `{ "keying": "bucket-code", "syncMode": "flag-eventual" }`).',
    '  • `scope`: `"all"` (default), `"upstream"`, or `"downstream"`.',
    '  • `componentDirs`: explicit downstream component directories.',
    '  • `limit`: max peer models to return (default 25).'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      archetype: { type: 'string', description: 'Archetype slug.' },
      axes: {
        type: 'object',
        description: 'Optional axis filter — e.g. `{ "keying": "bucket-code" }`.',
        additionalProperties: { type: 'string' }
      },
      scope: { type: 'string', enum: ['all', 'upstream', 'downstream'], default: 'all' },
      componentDirs: { type: 'array', items: { type: 'string' } },
      limit: { type: 'integer', default: DEFAULT_LIMIT }
    },
    required: ['archetype']
  }
};

interface ParsedSearchArgs {
  readonly archetype: string;
  readonly axes: { readonly [k: string]: string } | undefined;
  readonly scope: SearchScope;
  readonly componentDirs: readonly string[] | undefined;
  readonly limit: number;
}

function parseArgs(raw: unknown): ParsedSearchArgs {
  const parsed = SearchArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  return {
    archetype: parsed.archetype,
    axes: parsed.axes,
    scope: (parsed.scope ?? 'all') as SearchScope,
    componentDirs: parsed.componentDirs,
    limit: parsed.limit ?? DEFAULT_LIMIT
  };
}

const EMPTY_DOWNSTREAM_CATALOG: DownstreamCatalog = {
  models: [],
  modelGroups: [],
  packages: [],
  errors: [],
  discoveryUsed: false
};

function matchesAxes(model: FirebaseModel, slug: string, axes: { readonly [k: string]: string } | undefined): boolean {
  let ok = true;
  if (axes) {
    const slugAxes = model.archetypeAxesBySlug?.[slug];
    for (const [k, v] of Object.entries(axes)) {
      if (slugAxes?.[k] !== v) {
        ok = false;
        break;
      }
    }
  }
  return ok;
}

function validateComponentDirs(componentDirs: readonly string[] | undefined, cwd: string): ToolResult | undefined {
  if (!componentDirs) return undefined;
  let result: ToolResult | undefined;
  try {
    for (const dir of componentDirs) ensurePathInsideCwd(dir, cwd);
  } catch (err) {
    result = toolError(err instanceof Error ? err.message : String(err));
  }
  return result;
}

function buildSearchPool(scope: SearchScope, downstream: DownstreamCatalog): FirebaseModel[] {
  const pool: FirebaseModel[] = [];
  if (scope !== 'downstream') pool.push(...FIREBASE_MODELS);
  if (scope !== 'upstream') pool.push(...downstream.models);
  return pool;
}

function formatPeerAxes(model: FirebaseModel, slug: string): string {
  const slugAxes = model.archetypeAxesBySlug?.[slug];
  if (!slugAxes) return '—';
  const axesParts: string[] = [];
  for (const [k, v] of Object.entries(slugAxes)) {
    axesParts.push(`${k}=${v}`);
  }
  return axesParts.length > 0 ? axesParts.join(', ') : '—';
}

function renderPeerRow(model: FirebaseModel, slug: string): string {
  const name = '`' + model.name + '`';
  const prefix = '`' + model.collectionPrefix + '`';
  const modelType = '`' + model.modelType + '`';
  const axes = formatPeerAxes(model, slug);
  const sourcePackage = '`' + model.sourcePackage + '`';
  return `| ${name} | ${prefix} | ${modelType} | ${axes} | ${sourcePackage} |`;
}

interface RenderSearchOutputInput {
  readonly args: ParsedSearchArgs;
  readonly slug: string;
  readonly filtered: readonly FirebaseModel[];
}

function renderSearchOutput(input: RenderSearchOutputInput): string {
  const { args, slug, filtered } = input;
  const peerSuffix = filtered.length === 1 ? '' : 's';
  const lines: string[] = [`# Peer models for \`${slug}\``, '', `Scope: \`${args.scope}\` · ${filtered.length} peer${peerSuffix}.`, ''];
  if (filtered.length === 0) {
    lines.push(`_No models tagged with \`${slug}\` in this scope._`);
    return lines.join('\n');
  }
  lines.push('| Model | Prefix | modelType | Axes | Source package |', '|---|---|---|---|---|');
  for (const m of filtered) {
    lines.push(renderPeerRow(m, slug));
  }
  return lines.join('\n');
}

/**
 * Handler for `dbx_model_archetype_search`.
 *
 * @param rawArgs - The unvalidated tool arguments.
 * @returns The rendered peer-model table.
 */
export async function runArchetypeSearch(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedSearchArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }

  const resolved = resolveModelArchetype(args.archetype);
  if (!resolved) {
    return toolError(`Unknown archetype slug \`${args.archetype}\`. Try \`dbx_model_archetype_lookup slug="list"\` for the catalog.`);
  }

  const cwd = process.cwd();
  const componentDirsError = validateComponentDirs(args.componentDirs, cwd);
  if (componentDirsError) return componentDirsError;

  const downstream = args.scope === 'upstream' ? EMPTY_DOWNSTREAM_CATALOG : await getDownstreamCatalog({ workspaceRoot: cwd, componentDirs: args.componentDirs });
  const pool = buildSearchPool(args.scope, downstream);

  const slug = resolved.archetype.slug;
  const filtered = pool.filter((m) => m.archetypes?.includes(slug) === true && matchesAxes(m, slug, args.axes)).slice(0, args.limit);

  return { content: [{ type: 'text', text: renderSearchOutput({ args, slug, filtered }) }] };
}

export const archetypeSearchTool: DbxTool = {
  definition: DBX_MODEL_ARCHETYPE_SEARCH_TOOL,
  run: runArchetypeSearch
};
