/**
 * `dbx_model_search` tool.
 *
 * Returns ranked Firebase-model matches keyed by name, identity, modelType,
 * collection prefix, field name, and enum name. Mirrors the form
 * `dbx_form_search` weights so cross-domain calls feel symmetrical.
 *
 * The entry pool combines the build-time upstream catalog (`FIREBASE_MODELS`)
 * with downstream `<x>-firebase` component packages auto-discovered under
 * the caller's workspace at runtime. The `scope` arg restricts the pool to
 * `'upstream'` or `'downstream'`; `componentDirs` overrides discovery for
 * non-standard layouts.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FIREBASE_MODELS, getDownstreamCatalog, type DownstreamCatalog, type FirebaseModel } from '../registry/index.js';
import { ensurePathInsideCwd } from './validate-input.js';
import { runSearchTool, type QueryToken, type SearchHit } from './_search/score.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const SearchArgsType = type({
  query: 'string',
  'limit?': 'number',
  'scope?': "'all' | 'upstream' | 'downstream'",
  'componentDirs?': 'string[]'
});

type SearchScope = 'all' | 'upstream' | 'downstream';

// MARK: Tool advertisement
const DBX_MODEL_SEARCH_TOOL: Tool = {
  name: 'dbx_model_search',
  description: [
    'Search Firebase models by keyword(s) across the upstream `@dereekb/firebase` registry AND any downstream `components/<x>-firebase` packages discovered under the caller workspace. Returns ranked Firebase models — pick one, then call `dbx_model_lookup` with the model name or `dbx_model_decode` to work with a Firestore document.',
    '',
    'Query strategy:',
    '  • Space-separated tokens are ANDed (every token must contribute at least some score).',
    '  • Matches model name, identity const, modelType, collection prefix, fields, and enums.',
    '',
    'Optional inputs:',
    '  • `scope`: `"all"` (default), `"upstream"` (only `@dereekb/firebase`), or `"downstream"` (only component packages).',
    '  • `componentDirs`: explicit downstream package directories (e.g. `["components/advisorey-firebase"]`) — overrides the default `components/*-firebase` discovery.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'One or more space-separated keywords.'
      },
      limit: {
        type: 'number',
        description: `Maximum number of results to return. Defaults to ${DEFAULT_LIMIT}, capped at ${MAX_LIMIT}.`,
        minimum: 1,
        maximum: MAX_LIMIT,
        default: DEFAULT_LIMIT
      },
      scope: {
        type: 'string',
        enum: ['all', 'upstream', 'downstream'],
        description: 'Restrict the search to upstream-only or downstream-only models. Defaults to all.',
        default: 'all'
      },
      componentDirs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional explicit downstream component directories (workspace-relative). Overrides the default `components/*-firebase` discovery.'
      }
    },
    required: ['query']
  }
};

// MARK: Scoring
interface ScoreTokenMatchInput {
  readonly value: string;
  readonly token: string;
  readonly exact: number;
  readonly starts: number;
  readonly includes: number;
}

function scoreTokenMatch(input: ScoreTokenMatchInput): number {
  const { value, token, exact, starts, includes } = input;
  let score = 0;
  if (value === token) score = exact;
  else if (starts > 0 && value.startsWith(token)) score = starts;
  else if (includes > 0 && value.includes(token)) score = includes;
  return score;
}

function scoreFirebaseModelEnumsAgainstToken(model: FirebaseModel, token: string): number {
  let result = 0;
  for (const en of model.enums) {
    const enName = en.name.toLowerCase();
    if (enName === token) {
      result = 5;
      break;
    }
    if (enName.includes(token)) {
      result = 2;
    }
  }
  return result;
}

function scoreFirebaseModelFieldsAgainstToken(model: FirebaseModel, token: string): number {
  let result = 0;
  for (const field of model.fields) {
    if (field.name.toLowerCase() === token) {
      result = 3;
      break;
    }
  }
  return result;
}

function scoreFirebaseModelAgainstToken(model: FirebaseModel, token: string): number {
  const name = model.name.toLowerCase();
  const identity = model.identityConst.toLowerCase();
  const modelType = model.modelType.toLowerCase();
  const prefix = model.collectionPrefix.toLowerCase();

  let score = 0;
  score += scoreTokenMatch({ value: name, token, exact: 20, starts: 14, includes: 8 });
  score += scoreTokenMatch({ value: identity, token, exact: 12, starts: 0, includes: 6 });
  score += scoreTokenMatch({ value: modelType, token, exact: 10, starts: 0, includes: 4 });
  score += scoreTokenMatch({ value: prefix, token, exact: 10, starts: 0, includes: 0 });
  score += scoreFirebaseModelFieldsAgainstToken(model, token);
  score += scoreFirebaseModelEnumsAgainstToken(model, token);
  return score;
}

// MARK: Entry pool
interface BuildEntryPoolInput {
  readonly scope: SearchScope;
  readonly downstream: DownstreamCatalog;
}

interface BuiltEntryPool {
  readonly entries: readonly FirebaseModel[];
  readonly upstreamCount: number;
  readonly downstreamPackages: number;
}

function buildEntryPool(input: BuildEntryPoolInput): BuiltEntryPool {
  let entries: FirebaseModel[] = [];
  let upstreamCount = 0;
  let downstreamPackages = 0;
  if (input.scope === 'upstream') {
    entries = [...FIREBASE_MODELS];
    upstreamCount = FIREBASE_MODELS.length;
  } else if (input.scope === 'downstream') {
    entries = [...input.downstream.models];
    downstreamPackages = input.downstream.packages.length;
  } else {
    entries = [...FIREBASE_MODELS, ...input.downstream.models];
    upstreamCount = FIREBASE_MODELS.length;
    downstreamPackages = input.downstream.packages.length;
  }
  return { entries, upstreamCount, downstreamPackages };
}

// MARK: Formatting
interface FormatInput {
  readonly query: string;
  readonly tokens: readonly QueryToken[];
  readonly hits: readonly SearchHit<FirebaseModel>[];
  readonly scope: SearchScope;
  readonly upstreamCount: number;
  readonly downstreamCatalog: DownstreamCatalog;
  readonly downstreamPackagesScanned: number;
}

function formatSearchResults(input: FormatInput): string {
  const { query, tokens, hits, scope, upstreamCount, downstreamCatalog, downstreamPackagesScanned } = input;
  const tokenDisplay = tokens.map((t) => t.display).join(', ');
  const sourceLine = formatSourceLine(scope, upstreamCount, downstreamPackagesScanned);
  if (hits.length === 0) {
    const lines = [`No Firebase models matched \`${query}\` (tokens: \`${tokenDisplay}\`).`, '', sourceLine, '', 'Try `dbx_model_lookup topic="models"` to browse the catalog or a broader single-word query.'];
    if (scope === 'all' && downstreamCatalog.discoveryUsed && downstreamCatalog.packages.length === 0) {
      lines.push('', 'No downstream packages discovered under `components/*-firebase`. Pass `componentDirs=["path/to/your-firebase"]` to scan a non-standard layout.');
    }
    return lines.join('\n');
  }
  const lines: string[] = [`# Search: \`${query}\``, '', `Tokens: \`${tokenDisplay}\` · ${hits.length} result${hits.length === 1 ? '' : 's'}`, sourceLine, ''];
  for (const hit of hits) {
    const model = hit.entry;
    const parent = model.parentIdentityConst ? ` · subcollection of \`${model.parentIdentityConst}\`` : '';
    lines.push(`## \`${model.name}\` · firebase model · score ${hit.score}`, '', `- **package:** \`${model.sourcePackage}\``, `- **identity:** \`${model.identityConst}\`${parent}`, `- **collection:** \`${model.modelType}\` · prefix \`${model.collectionPrefix}\``);
    const enumsPart = model.enums.length > 0 ? ` · **enums:** ${model.enums.length}` : '';
    lines.push(`- **fields:** ${model.fields.length}${enumsPart}`, `- **matched:** \`${hit.matchedTokens.join(', ')}\``, '', `→ \`dbx_model_lookup topic="${model.name}"\` for full docs, or \`dbx_model_decode\` to decode a raw document.`, '');
  }
  return lines.join('\n').trimEnd();
}

function formatSourceLine(scope: SearchScope, upstreamCount: number, downstreamPackages: number): string {
  let result: string;
  if (scope === 'upstream') {
    result = `Sources scanned: upstream only (${upstreamCount} model${upstreamCount === 1 ? '' : 's'}).`;
  } else if (scope === 'downstream') {
    result = `Sources scanned: ${downstreamPackages} downstream package${downstreamPackages === 1 ? '' : 's'}.`;
  } else {
    result = `Sources scanned: upstream (${upstreamCount} model${upstreamCount === 1 ? '' : 's'}) + ${downstreamPackages} downstream package${downstreamPackages === 1 ? '' : 's'}.`;
  }
  return result;
}

// MARK: Handler
interface ParsedSearchModelArgs {
  readonly query: string;
  readonly limit: number | undefined;
  readonly scope: SearchScope;
  readonly componentDirs: readonly string[] | undefined;
}

function parseArgs(rawArgs: unknown): ParsedSearchModelArgs {
  const parsed = SearchArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  return {
    query: parsed.query,
    limit: parsed.limit,
    scope: (parsed.scope ?? 'all') as SearchScope,
    componentDirs: parsed.componentDirs
  };
}

/**
 * Tool handler for `dbx_model_search`. Validates args, fetches the
 * downstream catalog when `scope` requires it, builds the entry pool, and
 * dispatches to the shared search pipeline.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted search result, or an error result on validation failure
 */
export async function runSearchModel(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedSearchModelArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }

  const cwd = process.cwd();
  const componentDirs = args.componentDirs;
  if (componentDirs) {
    try {
      for (const dir of componentDirs) ensurePathInsideCwd(dir, cwd);
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  }

  const downstream = args.scope === 'upstream' ? EMPTY_DOWNSTREAM_CATALOG : await getDownstreamCatalog({ workspaceRoot: cwd, componentDirs });
  const pool = buildEntryPool({ scope: args.scope, downstream });

  return runSearchTool<FirebaseModel>(
    {
      entries: pool.entries,
      defaultLimit: DEFAULT_LIMIT,
      maxLimit: MAX_LIMIT,
      scoreEntry: scoreFirebaseModelAgainstToken,
      tieBreaker: (model) => model.name,
      formatResults: ({ query, tokens, hits }) =>
        formatSearchResults({
          query,
          tokens,
          hits,
          scope: args.scope,
          upstreamCount: pool.upstreamCount,
          downstreamCatalog: downstream,
          downstreamPackagesScanned: pool.downstreamPackages
        })
    },
    args.limit !== undefined ? { query: args.query, limit: args.limit } : { query: args.query }
  );
}

const EMPTY_DOWNSTREAM_CATALOG: DownstreamCatalog = {
  models: [],
  modelGroups: [],
  packages: [],
  errors: [],
  discoveryUsed: false
};

export const searchModelTool: DbxTool = {
  definition: DBX_MODEL_SEARCH_TOOL,
  run: runSearchModel
};
