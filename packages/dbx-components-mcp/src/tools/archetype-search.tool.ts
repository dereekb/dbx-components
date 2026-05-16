/**
 * `dbx_model_archetype_search` tool.
 *
 * Archetype-filtered model search. Given an archetype slug (or v1/v2 alias)
 * and optional axis filters, returns peer models in scope that already use
 * that archetype. Identical scope semantics to `dbx_model_search`
 * (`scope` / `componentDirs`); archetype filtering is exclusive to this tool
 * — `dbx_model_search` is unchanged.
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
    'Find peer Firebase models already tagged with the given archetype (v3 slug or v1/v2 alias). Pair with `dbx_model_archetype_recommend` to see the matched archetype, then call this tool with the slug to list more peers across upstream + downstream packages.',
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
      archetype: { type: 'string', description: 'v3 archetype slug or any v1/v2 alias.' },
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

function matchesAxes(model: FirebaseModel, axes: { readonly [k: string]: string } | undefined): boolean {
  let ok = true;
  if (axes) {
    for (const [k, v] of Object.entries(axes)) {
      if (model.archetypeAxes?.[k] !== v) {
        ok = false;
        break;
      }
    }
  }
  return ok;
}

/**
 * Handler for `dbx_model_archetype_search`.
 *
 * @param rawArgs - the unvalidated tool arguments
 * @returns the rendered peer-model table
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
  if (args.componentDirs) {
    try {
      for (const dir of args.componentDirs) ensurePathInsideCwd(dir, cwd);
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  }

  const downstream = args.scope === 'upstream' ? EMPTY_DOWNSTREAM_CATALOG : await getDownstreamCatalog({ workspaceRoot: cwd, componentDirs: args.componentDirs });
  const pool: FirebaseModel[] = [];
  if (args.scope !== 'downstream') pool.push(...FIREBASE_MODELS);
  if (args.scope !== 'upstream') pool.push(...downstream.models);

  const slug = resolved.archetype.slug;
  const filtered = pool.filter((m) => m.archetype === slug && matchesAxes(m, args.axes)).slice(0, args.limit);

  const aliasNote = resolved.viaAlias ? ` (alias \`${args.archetype}\` → \`${slug}\`)` : '';
  const lines: string[] = [`# Peer models for \`${slug}\`${aliasNote}`, '', `Scope: \`${args.scope}\` · ${filtered.length} peer${filtered.length === 1 ? '' : 's'}.`, ''];
  if (filtered.length === 0) {
    lines.push(`_No models tagged with \`${slug}\` in this scope._`);
  } else {
    lines.push('| Model | Prefix | modelType | Axes | Source package |', '|---|---|---|---|---|');
    for (const m of filtered) {
      const axesParts: string[] = [];
      if (m.archetypeAxes) {
        for (const [k, v] of Object.entries(m.archetypeAxes)) {
          axesParts.push(`${k}=${v}`);
        }
      }
      const axesText = axesParts.length > 0 ? axesParts.join(', ') : '—';
      lines.push(`| \`${m.name}\` | \`${m.collectionPrefix}\` | \`${m.modelType}\` | ${axesText} | \`${m.sourcePackage}\` |`);
    }
  }
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

export const archetypeSearchTool: DbxTool = {
  definition: DBX_MODEL_ARCHETYPE_SEARCH_TOOL,
  run: runArchetypeSearch
};
