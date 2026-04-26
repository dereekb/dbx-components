/**
 * `dbx_model_lookup` tool.
 *
 * Firebase-model-domain lookup. Accepts a topic (model interface name,
 * identity const, modelType, collection prefix, or the literal `'models'`)
 * and a depth and returns markdown documentation for `@dereekb/firebase`
 * models.
 *
 * Registered via the low-level `server.setRequestHandler(CallToolRequestSchema, ...)`
 * API (not `McpServer.registerTool`) because registerTool requires a zod
 * schema — the workspace standard is arktype. Input validation happens in
 * {@link parseLookupModelArgs} using arktype.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { getFirebaseModel, getFirebaseModelByPrefix, getFirebaseModels, type FirebaseModel } from '../registry/index.js';
import { formatFirebaseModelCatalog, formatFirebaseModelEntry, formatFirebaseStoreShapeTaxonomy } from './firebase-lookup.formatter.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool registry
const DBX_MODEL_LOOKUP_TOOL: Tool = {
  name: 'dbx_model_lookup',
  description: [
    'Look up @dereekb/firebase Firestore models.',
    '',
    'The `topic` accepts:',
    '  • a Firebase model name (`"StorageFile"`);',
    '  • an identity const (`"storageFileIdentity"`);',
    '  • a modelType (`"storageFile"`);',
    '  • a collection prefix (`"sf"`);',
    '  • the literal `"models"` / `"firebase-models"` for the Firebase-model catalog;',
    '  • the literal `"shapes"` / `"store-shapes"` for the consumer-side store-shape taxonomy (root, root-singleton, sub-collection, singleton-sub, system-state).'
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
      }
    },
    required: ['topic']
  }
};

// MARK: Input validation
const LookupModelArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

function parseLookupModelArgs(raw: unknown): { readonly topic: string; readonly depth: 'brief' | 'full' } {
  const parsed = LookupModelArgsType(raw);

  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }

  return {
    topic: parsed.topic,
    depth: parsed.depth ?? ('full' as const)
  };
}

// MARK: Resolution
type LookupModelMatch = { readonly kind: 'single'; readonly model: FirebaseModel } | { readonly kind: 'catalog' } | { readonly kind: 'shapes' } | { readonly kind: 'not-found'; readonly normalized: string };

const FIREBASE_CATALOG_ALIASES = new Set(['list', 'models', 'firebase-models', 'firebase', 'firestore-models', 'catalog', 'all']);
const FIREBASE_SHAPES_ALIASES = new Set(['shapes', 'store-shapes', 'storeshapes', 'shape', 'store-shape', 'storeshape', 'store-shape-taxonomy', 'store-shape-list']);

/**
 * Resolves a topic string to a Firebase model entry by interface name,
 * identity const, modelType, or collection prefix. Falls back to catalog mode
 * for the well-known catalog aliases or the store-shape taxonomy mode for the
 * shape aliases.
 *
 * @param rawTopic - the caller-supplied topic, untrimmed
 * @returns the resolved match describing how to render the response
 */
function resolveTopic(rawTopic: string): LookupModelMatch {
  const lowered = rawTopic.trim().toLowerCase();
  let result: LookupModelMatch;
  if (FIREBASE_CATALOG_ALIASES.has(lowered)) {
    result = { kind: 'catalog' };
  } else if (FIREBASE_SHAPES_ALIASES.has(lowered)) {
    result = { kind: 'shapes' };
  } else {
    const hit = getFirebaseModel(rawTopic) ?? getFirebaseModelByPrefix(rawTopic);
    if (hit) {
      result = { kind: 'single', model: hit };
    } else {
      result = { kind: 'not-found', normalized: lowered };
    }
  }
  return result;
}

// MARK: Formatting
function formatNotFound(normalized: string): string {
  return [`No Firebase model matched \`${normalized}\`.`, '', 'Try `dbx_model_lookup topic="models"` to browse the catalog.'].join('\n');
}

// MARK: Handler
/**
 * Tool handler for `dbx_model_lookup`. Resolves the requested model topic
 * against the Firebase registry and renders the matching catalog, store-shape
 * taxonomy, single entry, or not-found suggestion list.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the rendered match, or an error result when args fail validation
 */
export function runLookupModel(rawArgs: unknown): ToolResult {
  let args: { readonly topic: string; readonly depth: 'brief' | 'full' };
  try {
    args = parseLookupModelArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }

  const match = resolveTopic(args.topic);
  let text: string;
  switch (match.kind) {
    case 'catalog':
      text = formatFirebaseModelCatalog(getFirebaseModels());
      break;
    case 'shapes':
      text = formatFirebaseStoreShapeTaxonomy();
      break;
    case 'single':
      text = formatFirebaseModelEntry(match.model, args.depth);
      break;
    case 'not-found':
      text = formatNotFound(match.normalized);
      break;
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const lookupModelTool: DbxTool = {
  definition: DBX_MODEL_LOOKUP_TOOL,
  run: runLookupModel
};
