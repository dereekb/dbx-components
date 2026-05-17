/**
 * `dbx_model_hierarchy` tool.
 *
 * Walks the parent/child links already captured on every `FirebaseModel`
 * registry entry (via `parentIdentityConst`) and renders the resulting
 * hierarchy as a tree, a flat list, or both — over upstream + downstream
 * Firebase models. Optional `rootModel` and `maxDepth` filters narrow the
 * output to a subtree.
 *
 * Registered via the low-level `server.setRequestHandler(CallToolRequestSchema, ...)`
 * API (not `McpServer.registerTool`) because registerTool requires a zod
 * schema — the workspace standard is arktype.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FIREBASE_MODELS, getDownstreamCatalog, getFirebaseModel, getFirebaseModelByPrefix, type DownstreamCatalog, type FirebaseModel } from '../registry/index.js';
import { buildModelHierarchy, renderModelHierarchy, type HierarchyFormat, type HierarchyOutput } from './model-hierarchy.formatter.js';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DBX_MODEL_HIERARCHY_TOOL: Tool = {
  name: 'dbx_model_hierarchy',
  description: [
    'Render the Firebase model hierarchy — `@dereekb/firebase` upstream catalog plus any `components/<x>-firebase` downstream packages discovered under the caller workspace. Walks `parentIdentityConst` links to build a forest (or a single subtree when `rootModel` is supplied).',
    '',
    'Use this when an agent needs the overall layout of models — which roots exist, which subcollections sit under which parent, and how the tree branches — without chaining N `dbx://model/firebase/subcollections/{parent}` calls.',
    '',
    'Optional inputs:',
    '  • `rootModel`: restrict to one subtree. Accepts a model name (`"NotificationBox"`), identity const (`"notificationBoxIdentity"`), modelType (`"notificationBox"`), or collection prefix (`"nb"`).',
    '  • `maxDepth`: integer ≥ 0. `0` returns only the requested root (or all roots) with no children; omit for the full depth.',
    "  • `format`: `'tree'` (default), `'flat'`, or `'both'`. The flat list is depth-first with each entry carrying its parent identity const.",
    "  • `output`: `'markdown'` (default) or `'json'`.",
    "  • `scope`: `'all'` (default), `'upstream'` (only `@dereekb/firebase`), or `'downstream'` (only component packages).",
    '  • `componentDirs`: explicit downstream package directories — overrides the default `components/*-firebase` discovery.',
    '',
    'Every node carries `name`, `modelType`, `identityConst`, `collectionPrefix`, optional `collectionKind` and `modelGroup` (`@dbxModelGroup`), `sourcePackage`, and `depth`.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      rootModel: {
        type: 'string',
        description: 'Optional starting model: name, identityConst, modelType, or collection prefix.'
      },
      maxDepth: {
        type: 'integer',
        minimum: 0,
        description: 'Optional inclusive max depth from the root. `0` returns only the root(s) with no children.'
      },
      format: {
        type: 'string',
        enum: ['tree', 'flat', 'both'],
        description: "Output representation. Defaults to 'tree'.",
        default: 'tree'
      },
      output: {
        type: 'string',
        enum: ['markdown', 'json'],
        description: "Render format. Defaults to 'markdown'.",
        default: 'markdown'
      },
      scope: {
        type: 'string',
        enum: ['all', 'upstream', 'downstream'],
        description: 'Restrict to upstream-only or downstream-only models. Defaults to all.',
        default: 'all'
      },
      componentDirs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional explicit downstream component directories (workspace-relative).'
      }
    }
  }
};

const HierarchyArgsType = type({
  'rootModel?': 'string',
  'maxDepth?': 'number.integer >= 0',
  'format?': "'tree' | 'flat' | 'both'",
  'output?': "'markdown' | 'json'",
  'scope?': "'all' | 'upstream' | 'downstream'",
  'componentDirs?': 'string[]'
});

type HierarchyScope = 'all' | 'upstream' | 'downstream';

interface ParsedHierarchyArgs {
  readonly rootModel: string | undefined;
  readonly maxDepth: number | undefined;
  readonly format: HierarchyFormat;
  readonly output: HierarchyOutput;
  readonly scope: HierarchyScope;
  readonly componentDirs: readonly string[] | undefined;
}

function parseHierarchyArgs(raw: unknown): ParsedHierarchyArgs {
  const parsed = HierarchyArgsType(raw ?? {});
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  return {
    rootModel: parsed.rootModel,
    maxDepth: parsed.maxDepth,
    format: (parsed.format ?? 'tree') as HierarchyFormat,
    output: (parsed.output ?? 'markdown') as HierarchyOutput,
    scope: (parsed.scope ?? 'all') as HierarchyScope,
    componentDirs: parsed.componentDirs
  };
}

const EMPTY_DOWNSTREAM_CATALOG: DownstreamCatalog = {
  models: [],
  modelGroups: [],
  packages: [],
  errors: [],
  discoveryUsed: false
};

function selectModels(scope: HierarchyScope, downstream: DownstreamCatalog): readonly FirebaseModel[] {
  let result: readonly FirebaseModel[];
  if (scope === 'upstream') {
    result = FIREBASE_MODELS;
  } else if (scope === 'downstream') {
    result = downstream.models;
  } else {
    result = [...FIREBASE_MODELS, ...downstream.models];
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

function resolveRootModel(rawTopic: string, scope: HierarchyScope, downstream: DownstreamCatalog): FirebaseModel | undefined {
  const lowered = rawTopic.trim().toLowerCase();
  const upstream = scope === 'downstream' ? undefined : (getFirebaseModel(rawTopic) ?? getFirebaseModelByPrefix(rawTopic));
  let result: FirebaseModel | undefined = upstream;
  if (!result && scope !== 'upstream') {
    result = findInDownstream(downstream.models, lowered);
  }
  return result;
}

function fuzzyCandidates(pool: readonly FirebaseModel[], lowered: string): readonly FirebaseModel[] {
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

function formatNotFound(rawTopic: string, candidates: readonly FirebaseModel[]): string {
  const lines: string[] = [`No Firebase model matched \`${rawTopic}\`.`];
  if (candidates.length > 0) {
    lines.push('', 'Did you mean:');
    for (const candidate of candidates) {
      lines.push(`- **${candidate.name}** \`[${candidate.sourcePackage}]\` (prefix \`${candidate.collectionPrefix}\`)`);
    }
  }
  lines.push('', 'Drop `rootModel` to render the full forest, or call `dbx_model_lookup topic="models"` to browse the catalog.');
  return lines.join('\n');
}

/**
 * Tool handler for `dbx_model_hierarchy`. Resolves the optional starting
 * model, walks the parent/child index assembled from upstream + downstream
 * registries, and renders the requested representation.
 *
 * @param rawArgs - The unvalidated tool arguments from the MCP runtime.
 * @returns The rendered hierarchy, or an error result when args fail validation.
 */
export async function runModelHierarchy(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedHierarchyArgs;
  try {
    args = parseHierarchyArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }

  const cwd = process.cwd();
  if (args.componentDirs) {
    try {
      for (const dir of args.componentDirs) ensurePathInsideCwd(dir, cwd);
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  }

  const downstream = args.scope === 'upstream' ? EMPTY_DOWNSTREAM_CATALOG : await getDownstreamCatalog({ workspaceRoot: cwd, componentDirs: args.componentDirs });
  const models = selectModels(args.scope, downstream);

  let rootModel: FirebaseModel | undefined;
  if (args.rootModel !== undefined) {
    rootModel = resolveRootModel(args.rootModel, args.scope, downstream);
    if (!rootModel) {
      const candidates = fuzzyCandidates(models, args.rootModel.trim().toLowerCase());
      return toolError(formatNotFound(args.rootModel, candidates));
    }
  }

  const result = buildModelHierarchy({
    models,
    rootModel,
    maxDepth: args.maxDepth,
    format: args.format
  });
  const text = renderModelHierarchy(result, args.output, {
    scope: args.scope,
    rootModel: rootModel?.identityConst,
    maxDepth: args.maxDepth
  });
  return { content: [{ type: 'text', text }] };
}

export const modelHierarchyTool: DbxTool = {
  definition: DBX_MODEL_HIERARCHY_TOOL,
  run: runModelHierarchy
};
