/**
 * `dbx_model_decode` tool.
 *
 * Two complementary modes:
 *
 *  1. **Document mode** — pass a raw Firestore document (`data`) as a JSON
 *     string or already-parsed object. Identifies the @dereekb/firebase model
 *     it matches and explains every abbreviated field — mapping enum integers
 *     back to their names and calling out foreign-key strings that reference
 *     other models. Model identification falls back through three strategies:
 *       1. explicit `model` hint (interface name, identity const, model type, or prefix);
 *       2. `key`, `_key`, or `id` field on the document that starts with a known
 *          collection prefix (`sf/abc123` → StorageFile);
 *       3. detection-hint scoring — whichever registered model has the most of
 *          its distinctive field names present on the document wins.
 *
 *  2. **Key mode** — pass just a Firestore key string (`key`) like
 *     `"jwr/hkzQa9W6MpaP99RTlQJcImbWdZm2"`. Splits on `/`, looks each prefix
 *     up via the model registry, and returns the leaf model + id plus any
 *     ancestor chain for subcollection paths (e.g.
 *     `"nb/abc/nbn/def"` → NotificationBoxNotification under NotificationBox).
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
    'Decode a @dereekb/firebase Firestore document or model key.',
    '',
    'Document mode — pass `data` as a JSON string (copied straight from the Firestore console) or an already-parsed object to identify the model, expand abbreviated field names, decode enum integer values, and surface foreign-key relationships. Optionally pass `model` to skip detection and target a specific model by interface name (`"StorageFile"`), identity constant (`"storageFileIdentity"`), `modelType` (`"storageFile"`), or collection prefix (`"sf"`).',
    '',
    'Key mode — pass just `key` (e.g. `"jwr/hkzQa9W6MpaP99RTlQJcImbWdZm2"`) to resolve the model identity and id from the collection prefix alone, no document required. Subcollection paths like `"nb/abc/nbn/def"` are walked end-to-end so the leaf model is reported alongside its parent chain.',
    '',
    'At least one of `data` or `key` is required.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      data: {
        description: 'Raw Firestore document — JSON string or already-parsed object. Required for document mode.',
        oneOf: [{ type: 'string' }, { type: 'object' }]
      },
      key: {
        type: 'string',
        description: 'Firestore model key (e.g. `"sf/abc123"` or subcollection path `"nb/abc/nbn/def"`). Used as the sole input in key mode, or as an extra detection hint when paired with `data`.'
      },
      model: {
        type: 'string',
        description: 'Optional model hint — interface name, identity const, model type, or collection prefix.'
      }
    }
  }
};

// MARK: Input validation
const DecodeArgsType = type({
  'data?': 'string | object',
  'key?': 'string',
  'model?': 'string'
});

interface ParsedDecodeArgs {
  readonly data?: unknown;
  readonly key?: string;
  readonly model?: string;
}

function parseDecodeArgs(raw: unknown): ParsedDecodeArgs {
  const parsed = DecodeArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedDecodeArgs = {
    data: parsed.data,
    key: parsed.key,
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

// MARK: Key-only decode
interface DecodedSegment {
  readonly prefix: string;
  readonly id: string;
  readonly model?: FirebaseModel;
}

interface DecodedKeyPath {
  readonly leaf: DecodedSegment;
  readonly ancestors: readonly DecodedSegment[];
  readonly unresolvedPrefixes: readonly string[];
}

function decodeKeyPath(key: string, hint: string | undefined): DecodedKeyPath | { readonly error: string } {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return { error: 'Key is empty. Provide a Firestore key like `sf/abc123`.' };
  }
  const segments = trimmed.split('/').filter((s) => s.length > 0);
  if (segments.length < 2 || segments.length % 2 !== 0) {
    return {
      error: `Invalid Firestore key '${trimmed}'. Expected an even number of segments (\`prefix/id\` pairs). Got ${segments.length} segment(s).`
    };
  }

  const decoded: DecodedSegment[] = [];
  const unresolved: string[] = [];
  for (let i = 0; i < segments.length; i += 2) {
    const prefix = segments[i];
    const id = segments[i + 1];
    const model = getFirebaseModelByPrefix(prefix);
    if (!model) {
      unresolved.push(prefix);
    }
    decoded.push({ prefix, id, model });
  }

  let leaf = decoded[decoded.length - 1];
  if (!leaf.model && hint) {
    const fromHint = getFirebaseModel(hint) ?? getFirebaseModelByPrefix(hint);
    if (fromHint) {
      leaf = { prefix: leaf.prefix, id: leaf.id, model: fromHint };
    }
  }
  const ancestors = decoded.slice(0, -1);
  return { leaf, ancestors, unresolvedPrefixes: unresolved };
}

function formatKeyDecode(input: DecodedKeyPath, rawKey: string): string {
  const lines: string[] = [];
  lines.push('_Model decoded from key prefix._', '');

  const leaf = input.leaf;
  if (leaf.model) {
    lines.push(`**Leaf:** ${leaf.model.name}`);
    lines.push(`- identityConst: \`${leaf.model.identityConst}\``);
    lines.push(`- modelType: \`${leaf.model.modelType}\``);
    lines.push(`- prefix: \`${leaf.prefix}\``);
    lines.push(`- id: \`${leaf.id}\``);
    if (leaf.model.modelGroup) {
      lines.push(`- modelGroup: ${leaf.model.modelGroup}`);
    }
    if (leaf.model.parentIdentityConst) {
      lines.push(`- parentIdentityConst: \`${leaf.model.parentIdentityConst}\``);
    }
    lines.push(`- source: \`${leaf.model.sourcePackage}\` (${leaf.model.sourceFile})`);
  } else {
    lines.push(`**Leaf:** _unknown_ — no model registered for prefix \`${leaf.prefix}\``);
    lines.push(`- prefix: \`${leaf.prefix}\``);
    lines.push(`- id: \`${leaf.id}\``);
  }

  if (input.ancestors.length > 0) {
    lines.push('', '**Parent chain:**');
    for (const ancestor of input.ancestors) {
      if (ancestor.model) {
        lines.push(`- ${ancestor.model.name} — prefix \`${ancestor.prefix}\`, id \`${ancestor.id}\``);
      } else {
        lines.push(`- _unknown_ — prefix \`${ancestor.prefix}\` (id \`${ancestor.id}\`)`);
      }
    }
  }

  if (input.unresolvedPrefixes.length > 0) {
    const label = input.unresolvedPrefixes.length === 1 ? 'prefix' : 'prefixes';
    const list = input.unresolvedPrefixes.map((p) => `\`${p}\``).join(', ');
    lines.push('', `_Unresolved ${label}: ${list}. Run \`dbx_model_lookup\` to browse known models._`);
  }

  lines.push('', `_Key:_ \`${rawKey}\``);
  return lines.join('\n');
}

// MARK: Handler
/**
 * Executes a decode request against the firebase-models registry. Exported so
 * it can be tested without the MCP transport.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted decode, or an error result when args fail validation
 */
export function runModelDecode(rawArgs: unknown): ToolResult {
  let args: ParsedDecodeArgs;
  try {
    args = parseDecodeArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  if (args.data === undefined && args.key === undefined) {
    return toolError('Provide either `data` (a Firestore document) or `key` (a Firestore model key).');
  }

  // Key-only mode: no document provided, just a key string.
  if (args.data === undefined && typeof args.key === 'string') {
    const decoded = decodeKeyPath(args.key, args.model);
    if ('error' in decoded) {
      return toolError(decoded.error);
    }
    const text = formatKeyDecode(decoded, args.key);
    const result: ToolResult = { content: [{ type: 'text', text }] };
    return result;
  }

  let document: Document;
  try {
    document = coerceToDocument(args.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  // When the caller supplied `key` alongside `data`, use it as an extra detection
  // hint — preferring the explicit argument over a `key`/`_key`/`id` field on the doc.
  const extraKey = args.key ?? document.extraKey;
  const detection = detectModel(document.doc, extraKey, args.model);
  if (!detection) {
    const message = buildUnmatchedMessage(args.model, { ...document, extraKey });
    const result: ToolResult = { content: [{ type: 'text', text: message }] };
    return result;
  }

  const prefixes = buildPrefixMap();
  const header = buildDetectionHeader(detection);
  const body = formatDecode({ model: detection.model, doc: document.doc, prefixes, extraKey });
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
  lines.push('', 'Try passing an explicit `model` argument. Known models:');
  for (const model of FIREBASE_MODELS) {
    lines.push(`- **${model.name}** — prefix \`${model.collectionPrefix}\` (${model.identityConst})`);
  }
  if (document.extraKey) {
    lines.push('', `Document key seen: \`${document.extraKey}\``);
  }
  return lines.join('\n');
}

export const modelDecodeTool: DbxTool = {
  definition: DBX_MODEL_DECODE_TOOL,
  run: runModelDecode
};
