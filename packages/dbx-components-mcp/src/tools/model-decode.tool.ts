/**
 * `dbx_model_decode` tool.
 *
 * Takes a raw Firestore document (as JSON string or already-parsed object),
 * identifies the @dereekb/firebase model it matches, and explains every
 * abbreviated field — mapping enum integers back to their names and calling
 * out any foreign-key strings that reference other models.
 *
 * Model identification falls back through three strategies in order:
 *   1. explicit `model` hint (interface name, identity const, model type, or prefix);
 *   2. `key`, `_key`, or `id` field on the document that starts with a known
 *      collection prefix (`sf/abc123` → StorageFile);
 *   3. detection-hint scoring — whichever registered model has the most of
 *      its distinctive field names present on the document wins.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FIREBASE_MODELS, getFirebaseModel, getFirebaseModelByPrefix, type FirebaseModel } from '../registry/index.js';
import { formatDecode } from './decode.formatter.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool registry
const DBX_MODEL_DECODE_TOOL: Tool = {
  name: 'dbx_model_decode',
  description: [
    'Decode a raw @dereekb/firebase Firestore document — identify the model, expand abbreviated field names to their descriptions, decode enum integer values, and surface foreign-key relationships to other models.',
    '',
    'Pass `data` as either a JSON string (copied straight from the Firestore console) or an already-parsed object. Pass `model` to skip detection and target a specific model by interface name (`"StorageFile"`), identity constant (`"storageFileIdentity"`), `modelType` (`"storageFile"`), or collection prefix (`"sf"`).',
    '',
    "Auto-detection uses the document's key field (if any), then falls back to scoring each registered model by how many of its distinctive fields are present."
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        description: 'Raw Firestore document — JSON string or already-parsed object.',
        oneOf: [{ type: 'string' }, { type: 'object' }]
      },
      model: {
        type: 'string',
        description: 'Optional model hint — interface name, identity const, model type, or collection prefix.'
      }
    },
    required: ['data']
  }
};

// MARK: Input validation
const DecodeArgsType = type({
  data: 'string | object',
  'model?': 'string'
});

interface ParsedDecodeArgs {
  readonly data: unknown;
  readonly model?: string;
}

function parseDecodeArgs(raw: unknown): ParsedDecodeArgs {
  const parsed = DecodeArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedDecodeArgs = {
    data: parsed.data,
    model: parsed.model
  };
  return result;
}

interface Document {
  readonly doc: Readonly<Record<string, unknown>>;
  readonly extraKey?: string;
}

function coerceToDocument(data: unknown): Document {
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Input data is a string but not valid JSON: ${message}`);
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Input data must be a JSON object (the Firestore document). Got: ' + (Array.isArray(parsed) ? 'array' : typeof parsed));
  }
  const docRecord = parsed as Record<string, unknown>;
  const rawKey = docRecord.key ?? docRecord._key ?? docRecord.id;
  const extraKey = typeof rawKey === 'string' ? rawKey : undefined;
  const result: Document = { doc: docRecord, extraKey };
  return result;
}

// MARK: Model detection
interface DetectionResult {
  readonly model: FirebaseModel;
  readonly strategy: 'hint' | 'key-prefix' | 'field-score';
  readonly score?: number;
}

function detectModel(doc: Readonly<Record<string, unknown>>, extraKey: string | undefined, hint: string | undefined): DetectionResult | undefined {
  if (hint) {
    const byNameOrIdentity = getFirebaseModel(hint);
    if (byNameOrIdentity) {
      const result: DetectionResult = { model: byNameOrIdentity, strategy: 'hint' };
      return result;
    }
    const byPrefix = getFirebaseModelByPrefix(hint);
    if (byPrefix) {
      const result: DetectionResult = { model: byPrefix, strategy: 'hint' };
      return result;
    }
  }

  if (extraKey) {
    const slashIdx = extraKey.indexOf('/');
    const underscoreIdx = extraKey.indexOf('_');
    const candidates: string[] = [];
    if (slashIdx > 0) candidates.push(extraKey.slice(0, slashIdx));
    if (underscoreIdx > 0) candidates.push(extraKey.slice(0, underscoreIdx));
    for (const candidate of candidates) {
      const model = getFirebaseModelByPrefix(candidate);
      if (model) {
        const result: DetectionResult = { model, strategy: 'key-prefix' };
        return result;
      }
    }
  }

  const docKeys = new Set(Object.keys(doc));
  let best: DetectionResult | undefined;
  for (const model of FIREBASE_MODELS) {
    let matches = 0;
    for (const hint of model.detectionHints) {
      if (docKeys.has(hint)) matches++;
    }
    if (matches === 0) continue;
    const converterCoverage = model.fields.filter((f) => docKeys.has(f.name)).length;
    const score = matches * 10 + converterCoverage;
    if (!best || score > (best.score ?? 0)) {
      best = { model, strategy: 'field-score', score };
    }
  }
  return best;
}

function buildPrefixMap(): Map<string, string> {
  const out = new Map<string, string>();
  for (const model of FIREBASE_MODELS) {
    out.set(model.collectionPrefix, model.name);
  }
  return out;
}

// MARK: Handler
/**
 * Executes a decode request against the firebase-models registry. Exported so
 * it can be tested without the MCP transport.
 */
export function runModelDecode(rawArgs: unknown): ToolResult {
  let args: ParsedDecodeArgs;
  try {
    args = parseDecodeArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  let document: Document;
  try {
    document = coerceToDocument(args.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const detection = detectModel(document.doc, document.extraKey, args.model);
  if (!detection) {
    const message = buildUnmatchedMessage(args.model, document);
    const result: ToolResult = { content: [{ type: 'text', text: message }] };
    return result;
  }

  const prefixes = buildPrefixMap();
  const header = buildDetectionHeader(detection);
  const body = formatDecode({ model: detection.model, doc: document.doc, prefixes, extraKey: document.extraKey });
  const text = `${header}\n\n${body}`;
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

function buildDetectionHeader(detection: DetectionResult): string {
  switch (detection.strategy) {
    case 'hint':
      return `_Model selected from explicit hint._`;
    case 'key-prefix':
      return `_Model detected from document key prefix._`;
    case 'field-score':
      return `_Model detected by field-name match (score ${detection.score ?? 0})._`;
  }
}

function buildUnmatchedMessage(hint: string | undefined, document: Document): string {
  const lines: string[] = [];
  if (hint) {
    lines.push(`No Firebase model matched hint '${hint}'.`);
  } else {
    lines.push('Could not identify the Firebase model from the document data.');
  }
  lines.push('');
  lines.push('Try passing an explicit `model` argument. Known models:');
  for (const model of FIREBASE_MODELS) {
    lines.push(`- **${model.name}** — prefix \`${model.collectionPrefix}\` (${model.identityConst})`);
  }
  if (document.extraKey) {
    lines.push('');
    lines.push(`Document key seen: \`${document.extraKey}\``);
  }
  const result = lines.join('\n');
  return result;
}

export const modelDecodeTool: DbxTool = {
  definition: DBX_MODEL_DECODE_TOOL,
  run: runModelDecode
};
