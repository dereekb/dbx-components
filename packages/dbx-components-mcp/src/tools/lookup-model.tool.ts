/**
 * `dbx_model_lookup` tool.
 *
 * Firebase-model-domain lookup. Accepts a topic (model interface name,
 * identity const, modelType, collection prefix, or the literal `'models'`)
 * and a depth and returns markdown documentation for `@dereekb/firebase`
 * models — plus any downstream `<x>-firebase` packages discovered under
 * the caller's workspace.
 *
 * Registered via the low-level `server.setRequestHandler(CallToolRequestSchema, ...)`
 * API (not `McpServer.registerTool`) because registerTool requires a zod
 * schema — the workspace standard is arktype. Input validation happens in
 * {@link parseLookupModelArgs} using arktype.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FIREBASE_MODELS, getDownstreamCatalog, getFirebaseModel, getFirebaseModelByPrefix, type DownstreamCatalog, type FirebaseModel } from '../registry/index.js';
import { formatFirebaseModelCatalog, formatFirebaseModelEntry, formatFirebaseStoreShapeTaxonomy } from './firebase-lookup.formatter.js';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool registry
const DBX_MODEL_LOOKUP_TOOL: Tool = {
  name: 'dbx_model_lookup',
  description: [
    'Look up Firebase Firestore models — `@dereekb/firebase` upstream catalog plus any `components/<x>-firebase` downstream packages discovered under the caller workspace.',
    '',
    'The `topic` accepts:',
    '  • a Firebase model name (`"StorageFile"`, `"Guestbook"`);',
    '  • an identity const (`"storageFileIdentity"`, `"guestbookIdentity"`);',
    '  • a modelType (`"storageFile"`, `"guestbook"`);',
    '  • a collection prefix (`"sf"`, `"gb"`);',
    '  • the literal `"models"` / `"firebase-models"` for the Firebase-model catalog;',
    '  • the literal `"shapes"` / `"store-shapes"` for the consumer-side store-shape taxonomy (root, root-singleton, sub-collection, singleton-sub, system-state).',
    '',
    'Optional inputs:',
    '  • `scope`: `"all"` (default), `"upstream"` (only `@dereekb/firebase`), or `"downstream"` (only component packages).',
    '  • `componentDirs`: explicit downstream package directories — overrides the default `components/*-firebase` discovery.',
    '  • `fields`: when the topic resolves to a single model, restrict the rendered fields table to those whose persisted name (e.g. `"fs"`) or longName (e.g. `"fileState"`) appears in the list (case-insensitive). Enums prune to only those referenced by the kept fields. Ignored on catalog/shapes/not-found responses.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Model name, identity const, modelType, prefix, or "models".'
      },
      depth: {
        type: 'string',
        enum: ['brief', 'full'],
        description: "Detail level for single-entry hits. Defaults to 'full'.",
        default: 'full'
      },
      scope: {
        type: 'string',
        enum: ['all', 'upstream', 'downstream'],
        description: 'Restrict the lookup to upstream-only or downstream-only models. Defaults to all.',
        default: 'all'
      },
      componentDirs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional explicit downstream component directories (workspace-relative).'
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Restrict single-entry output to fields whose persisted name or longName matches an entry in this list (case-insensitive). Enums prune to only those referenced by the kept fields.'
      }
    },
    required: ['topic']
  }
};

// MARK: Input validation
const LookupModelArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'",
  'scope?': "'all' | 'upstream' | 'downstream'",
  'componentDirs?': 'string[]',
  'fields?': 'string[]'
});

type LookupScope = 'all' | 'upstream' | 'downstream';

interface ParsedLookupModelArgs {
  readonly topic: string;
  readonly depth: 'brief' | 'full';
  readonly scope: LookupScope;
  readonly componentDirs: readonly string[] | undefined;
  readonly fields: readonly string[] | undefined;
}

function normalizeFieldsFilter(raw: readonly string[] | undefined): readonly string[] | undefined {
  let result: readonly string[] | undefined;
  if (raw !== undefined) {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const entry of raw) {
      const trimmed = entry.trim().toLowerCase();
      if (trimmed.length > 0 && !seen.has(trimmed)) {
        seen.add(trimmed);
        cleaned.push(trimmed);
      }
    }
    if (cleaned.length > 0) {
      result = cleaned;
    }
  }
  return result;
}

function parseLookupModelArgs(raw: unknown): ParsedLookupModelArgs {
  const parsed = LookupModelArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  return {
    topic: parsed.topic,
    depth: parsed.depth ?? ('full' as const),
    scope: (parsed.scope ?? 'all') as LookupScope,
    componentDirs: parsed.componentDirs,
    fields: normalizeFieldsFilter(parsed.fields)
  };
}

// MARK: Resolution
type LookupModelMatch = { readonly kind: 'single'; readonly model: FirebaseModel } | { readonly kind: 'catalog' } | { readonly kind: 'shapes' } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly FirebaseModel[] };

const FIREBASE_CATALOG_ALIASES = new Set(['list', 'models', 'firebase-models', 'firebase', 'firestore-models', 'catalog', 'all']);
const FIREBASE_SHAPES_ALIASES = new Set(['shapes', 'store-shapes', 'storeshapes', 'shape', 'store-shape', 'storeshape', 'store-shape-taxonomy', 'store-shape-list']);

interface ResolveTopicInput {
  readonly rawTopic: string;
  readonly scope: LookupScope;
  readonly downstream: DownstreamCatalog;
}

function resolveTopic(input: ResolveTopicInput): LookupModelMatch {
  const lowered = input.rawTopic.trim().toLowerCase();
  let result: LookupModelMatch;
  if (FIREBASE_CATALOG_ALIASES.has(lowered)) {
    result = { kind: 'catalog' };
  } else if (FIREBASE_SHAPES_ALIASES.has(lowered)) {
    result = { kind: 'shapes' };
  } else {
    const upstream = input.scope === 'downstream' ? undefined : (getFirebaseModel(input.rawTopic) ?? getFirebaseModelByPrefix(input.rawTopic));
    const shouldCheckDownstream = !upstream && input.scope !== 'upstream';
    const downstream = shouldCheckDownstream ? findInDownstream(input.downstream.models, lowered) : undefined;
    const hit = upstream ?? downstream;
    if (hit) {
      result = { kind: 'single', model: hit };
    } else {
      result = { kind: 'not-found', normalized: lowered, candidates: fuzzyCandidates(input.scope, input.downstream.models, lowered) };
    }
  }
  return result;
}

function findInDownstream(models: readonly FirebaseModel[], lowered: string): FirebaseModel | undefined {
  let result: FirebaseModel | undefined;
  for (const m of models) {
    if (m.name.toLowerCase() === lowered || m.identityConst.toLowerCase() === lowered || m.modelType.toLowerCase() === lowered || m.collectionPrefix.toLowerCase() === lowered) {
      result = m;
      break;
    }
  }
  return result;
}

function fuzzyCandidatesPool(scope: LookupScope, downstream: readonly FirebaseModel[]): readonly FirebaseModel[] {
  if (scope === 'upstream') return FIREBASE_MODELS;
  if (scope === 'downstream') return downstream;
  return [...FIREBASE_MODELS, ...downstream];
}

function fuzzyCandidates(scope: LookupScope, downstream: readonly FirebaseModel[], lowered: string): readonly FirebaseModel[] {
  const pool = fuzzyCandidatesPool(scope, downstream);
  const scored: { readonly model: FirebaseModel; readonly score: number }[] = [];
  for (const model of pool) {
    let score = 0;
    if (model.name.toLowerCase().includes(lowered)) score += 3;
    if (model.identityConst.toLowerCase().includes(lowered)) score += 2;
    if (model.modelType.toLowerCase().includes(lowered)) score += 2;
    if (model.collectionPrefix.toLowerCase().includes(lowered)) score += 1;
    if (score > 0) scored.push({ model, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.model);
}

// MARK: Formatting
function formatNotFound(normalized: string, candidates: readonly FirebaseModel[]): string {
  const lines: string[] = [`No Firebase model matched \`${normalized}\`.`];
  if (candidates.length > 0) {
    lines.push('', 'Did you mean:');
    for (const candidate of candidates) {
      lines.push(`- **${candidate.name}** \`[${candidate.sourcePackage}]\` (prefix \`${candidate.collectionPrefix}\`)`);
    }
  }
  lines.push('', 'Try `dbx_model_lookup topic="models"` to browse the catalog.');
  return lines.join('\n');
}

// MARK: Handler
const EMPTY_DOWNSTREAM_CATALOG: DownstreamCatalog = {
  models: [],
  modelGroups: [],
  packages: [],
  errors: [],
  discoveryUsed: false
};

/**
 * Tool handler for `dbx_model_lookup`. Resolves the requested model topic
 * against the upstream registry and the runtime downstream catalog and
 * renders the matching catalog, store-shape taxonomy, single entry, or
 * not-found suggestion list.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the rendered match, or an error result when args fail validation
 */
export async function runLookupModel(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedLookupModelArgs;
  try {
    args = parseLookupModelArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
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
  const match = resolveTopic({ rawTopic: args.topic, scope: args.scope, downstream });
  let text: string;
  switch (match.kind) {
    case 'catalog':
      text = formatFirebaseModelCatalog(args.scope === 'downstream' ? [] : FIREBASE_MODELS, args.scope === 'upstream' ? [] : downstream.models);
      break;
    case 'shapes':
      text = formatFirebaseStoreShapeTaxonomy();
      break;
    case 'single':
      text = formatFirebaseModelEntry(match.model, args.depth, { fields: args.fields });
      break;
    case 'not-found':
      text = formatNotFound(match.normalized, match.candidates);
      break;
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const lookupModelTool: DbxTool = {
  definition: DBX_MODEL_LOOKUP_TOOL,
  run: runLookupModel
};
