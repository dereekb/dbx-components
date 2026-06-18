/**
 * Pure parser for the `@dbxRouteModel` / `@dbxRouteModelList` JSDoc tag grammar
 * that annotates which Firestore models a route renders.
 *
 * Grammar:
 *
 * ```
 * @dbxRouteModel <modelType> <keyTemplate> [- <description>]
 * @dbxRouteModelList <modelType> [- <description>]
 * ```
 *
 * `keyTemplate` shapes:
 * - `:param` / `{authUid}` — single placeholder → `kind: 'id'` (the value is
 *   promoted to `<collectionName>/<id>` at runtime via the model identity).
 * - `gb/:id/gbe/{authUid}` — alternating literal / placeholder segments (even
 *   count) → `kind: 'key'` (a full FirestoreModelKey for a subcollection model).
 *   An odd (id) segment may also be a `{const:<id>}` token for a fixed/singleton
 *   id (e.g. `wk/:uid/wkn/{const:0}`); it is normalized to the bare literal in
 *   the parsed `keyTemplate` so the runtime emits it verbatim, while a forgotten
 *   `:` (a bare `note`) still fails as malformed.
 * - `{flatKey:<param>}` — single token → `kind: 'flatKey'`: the `<param>` URL
 *   value IS a whole two-way-flat FirestoreModelKey (`r_<id>_cs_<id>_d_<id>`),
 *   un-flattened at runtime. For pages that pack a full key into one URL segment.
 * - (absent, list tag) → `kind: 'list'`.
 *
 * This module is deliberately runtime-dependency-free (no ts-morph): the same
 * grammar is reused by the build-time manifest builder, the dev MCP route tools,
 * and the `@dereekb/dbx-cli/eslint` rule so they can never disagree about what a
 * valid tag is. The ts-morph consumer (`extractComponentRouteModelTags`) lives in
 * `./route-models-extract.ts` and re-exports these symbols for existing importers.
 */

/**
 * Whether a route-model entry resolves to a promoted id, a full key, a
 * single-param flattened key, or a keyless list.
 */
export type RouteModelKind = 'id' | 'key' | 'flatKey' | 'list';

/**
 * A successfully parsed `@dbxRouteModel*` tag.
 */
export interface ParsedRouteModel {
  readonly modelType: string;
  readonly kind: RouteModelKind;
  /**
   * The verbatim key template (`:uid`, `{authUid}`, `gb/:id/gbe/{authUid}`).
   * Absent for `list` entries.
   */
  readonly keyTemplate?: string;
  readonly description?: string;
  /**
   * Route param names (`:name` → `name`) referenced by the key template, for
   * `unknown-route-param` validation against the state's URL params.
   */
  readonly routeParams: readonly string[];
}

/**
 * Result of parsing one route-model tag: the parsed model or a malformed-tag
 * message describing why it could not be parsed.
 */
export type ParseRouteModelTagResult = { readonly ok: true; readonly model: ParsedRouteModel } | { readonly ok: false; readonly message: string };

/**
 * One raw `@dbxRouteModel*` tag — the tag name (without `@`) plus its trimmed
 * comment text.
 */
export interface RawRouteModelTag {
  readonly name: string;
  readonly text: string;
}

const MODEL_TYPE_RE = /^[a-zA-Z][a-zA-Z0-9]*$/u;
const LITERAL_SEGMENT_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u;
const AUTH_UID_PLACEHOLDER = '{authUid}';
/**
 * Matches a `{const:<id>}` fixed-id token (e.g. `{const:0}`), capturing the
 * literal id. The id obeys the same shape as a literal collection segment.
 */
const CONST_TOKEN_RE = /^\{const:([a-zA-Z0-9][a-zA-Z0-9_-]*)\}$/u;
/**
 * Matches a `{flatKey:<param>}` token (e.g. `{flatKey:region}`), capturing the
 * route param name whose URL value holds a whole two-way-flat FirestoreModelKey.
 */
const FLAT_KEY_TOKEN_RE = /^\{flatKey:([a-zA-Z_][a-zA-Z0-9_]*)\}$/u;

/**
 * The bare `@dbxRouteModel` tag name (without the leading `@`).
 */
export const ROUTE_MODEL_TAG = 'dbxRouteModel';

/**
 * The `@dbxRouteModelList` tag name (without the leading `@`).
 */
export const ROUTE_MODEL_LIST_TAG = 'dbxRouteModelList';

/**
 * Parses one `@dbxRouteModel` / `@dbxRouteModelList` tag into a structured
 * model, or returns a malformed-tag message. The description (everything after
 * the first ` - `) is split off first; the remaining head is tokenized.
 *
 * @param tag - The raw tag name + comment text.
 * @returns The parsed model on success, else a malformed-tag message.
 *
 * @example
 * ```ts
 * parseRouteModelTag({ name: 'dbxRouteModel', text: 'profile :uid - The profile' });
 * // => { ok: true, model: { modelType: 'profile', kind: 'id', keyTemplate: ':uid', description: 'The profile', routeParams: ['uid'] } }
 * ```
 */
export function parseRouteModelTag(tag: RawRouteModelTag): ParseRouteModelTagResult {
  const dashIdx = tag.text.indexOf(' - ');
  const head = (dashIdx >= 0 ? tag.text.slice(0, dashIdx) : tag.text).trim();
  const description = dashIdx >= 0 ? tag.text.slice(dashIdx + 3).trim() : undefined;
  const tokens = head.split(/\s+/u).filter((t) => t.length > 0);

  let result: ParseRouteModelTagResult;
  if (tag.name === ROUTE_MODEL_LIST_TAG) {
    result = parseListTag(tokens, description);
  } else if (tag.name === ROUTE_MODEL_TAG) {
    result = parseModelTag(tokens, description);
  } else {
    result = { ok: false, message: `Unknown route-model tag \`@${tag.name}\`. Expected \`@${ROUTE_MODEL_TAG}\` or \`@${ROUTE_MODEL_LIST_TAG}\`.` };
  }
  return result;
}

function parseListTag(tokens: readonly string[], description: string | undefined): ParseRouteModelTagResult {
  let result: ParseRouteModelTagResult;
  if (tokens.length !== 1) {
    result = { ok: false, message: `\`@${ROUTE_MODEL_LIST_TAG}\` expects a single \`<modelType>\` token; got ${tokens.length}.` };
  } else if (MODEL_TYPE_RE.test(tokens[0])) {
    result = { ok: true, model: { modelType: tokens[0], kind: 'list', description, routeParams: [] } };
  } else {
    result = { ok: false, message: `\`@${ROUTE_MODEL_LIST_TAG}\` model type \`${tokens[0]}\` is not a valid identifier.` };
  }
  return result;
}

function parseModelTag(tokens: readonly string[], description: string | undefined): ParseRouteModelTagResult {
  let result: ParseRouteModelTagResult;
  if (tokens.length !== 2) {
    result = { ok: false, message: `\`@${ROUTE_MODEL_TAG}\` expects \`<modelType> <keyTemplate>\`; got ${tokens.length} token(s).` };
  } else if (MODEL_TYPE_RE.test(tokens[0])) {
    const parsedKey = parseKeyTemplate(tokens[1]);
    if (parsedKey.ok) {
      result = { ok: true, model: { modelType: tokens[0], kind: parsedKey.kind, keyTemplate: parsedKey.keyTemplate, description, routeParams: parsedKey.routeParams } };
    } else {
      result = { ok: false, message: parsedKey.message };
    }
  } else {
    result = { ok: false, message: `\`@${ROUTE_MODEL_TAG}\` model type \`${tokens[0]}\` is not a valid identifier.` };
  }
  return result;
}

type ParseKeyTemplateResult = { readonly ok: true; readonly kind: 'id' | 'key' | 'flatKey'; readonly keyTemplate: string; readonly routeParams: readonly string[] } | { readonly ok: false; readonly message: string };

function parseKeyTemplate(keyTemplate: string): ParseKeyTemplateResult {
  const segments = keyTemplate.split('/');
  let result: ParseKeyTemplateResult;
  if (segments.length === 1) {
    result = parseSingleSegmentKey(segments[0], keyTemplate);
  } else if (segments.length % 2 === 0) {
    result = parseAlternatingKey(segments, keyTemplate);
  } else {
    result = { ok: false, message: `Key template \`${keyTemplate}\` must be a single placeholder or an even number of literal/placeholder segments.` };
  }
  return result;
}

function parseSingleSegmentKey(segment: string, keyTemplate: string): ParseKeyTemplateResult {
  const flatKeyParam = flatKeyTokenParam(segment);
  const placeholder = placeholderParam(segment);
  let result: ParseKeyTemplateResult;
  if (flatKeyParam !== undefined) {
    // The whole key lives in one URL param; the runtime un-flattens it.
    result = { ok: true, kind: 'flatKey', keyTemplate, routeParams: [flatKeyParam] };
  } else if (placeholder === undefined) {
    result = { ok: false, message: `Single-segment key template \`${keyTemplate}\` must be a placeholder (\`:param\` or \`${AUTH_UID_PLACEHOLDER}\`) or a flattened-key token (\`{flatKey:<param>}\`).` };
  } else {
    result = { ok: true, kind: 'id', keyTemplate, routeParams: placeholder.routeParam === undefined ? [] : [placeholder.routeParam] };
  }
  return result;
}

function parseAlternatingKey(segments: readonly string[], keyTemplate: string): ParseKeyTemplateResult {
  const routeParams: string[] = [];
  // The normalized template substitutes any `{const:<id>}` token back to its
  // bare literal so the runtime `resolveFullKey` (which emits non-placeholder
  // segments verbatim) round-trips without needing to understand the token.
  const normalizedSegments: string[] = [];
  let message: string | undefined;
  for (const [i, segment] of segments.entries()) {
    if (i % 2 === 0) {
      if (!LITERAL_SEGMENT_RE.test(segment)) {
        message = `Key template \`${keyTemplate}\` segment \`${segment}\` must be a literal collection name.`;
        break;
      }
      normalizedSegments.push(segment);
    } else {
      const placeholder = placeholderParam(segment);
      const constId = constTokenId(segment);
      if (placeholder !== undefined) {
        if (placeholder.routeParam !== undefined) {
          routeParams.push(placeholder.routeParam);
        }
        normalizedSegments.push(segment);
      } else if (constId !== undefined) {
        normalizedSegments.push(constId);
      } else {
        message = `Key template \`${keyTemplate}\` segment \`${segment}\` must be a placeholder (\`:param\` or \`${AUTH_UID_PLACEHOLDER}\`) or a fixed id (\`{const:<id>}\`).`;
        break;
      }
    }
  }
  return message === undefined ? { ok: true, kind: 'key', keyTemplate: normalizedSegments.join('/'), routeParams } : { ok: false, message };
}

// MARK: Segment helpers
/**
 * Classifies a key-template segment as a placeholder, returning the referenced
 * route param name (for `:name`) or `undefined` for `{authUid}`. Non-placeholder
 * segments return `undefined` for the whole result.
 *
 * @param segment - The single key-template segment to classify.
 * @returns The placeholder descriptor, or `undefined` when the segment is a literal.
 */
function placeholderParam(segment: string): { readonly routeParam: string | undefined } | undefined {
  let result: { readonly routeParam: string | undefined } | undefined;
  if (segment.startsWith(':') && segment.length > 1) {
    result = { routeParam: segment.slice(1) };
  } else if (segment === AUTH_UID_PLACEHOLDER) {
    result = { routeParam: undefined };
  } else {
    result = undefined;
  }
  return result;
}

/**
 * Extracts the literal id from a `{const:<id>}` fixed-id token, used for a
 * fixed/singleton subcollection id at an odd key-template position. Returns
 * `undefined` for any non-`{const:…}` segment.
 *
 * @param segment - The single key-template segment to classify.
 * @returns The captured literal id, or `undefined` when not a const token.
 */
function constTokenId(segment: string): string | undefined {
  const match = CONST_TOKEN_RE.exec(segment);
  return match === null ? undefined : match[1];
}

/**
 * Extracts the route param name from a `{flatKey:<param>}` token, whose URL
 * value is a whole two-way-flat FirestoreModelKey un-flattened at runtime.
 * Returns `undefined` for any non-`{flatKey:…}` segment.
 *
 * @param segment - The single key-template segment to classify.
 * @returns The captured route param name, or `undefined` when not a flatKey token.
 */
function flatKeyTokenParam(segment: string): string | undefined {
  const match = FLAT_KEY_TOKEN_RE.exec(segment);
  return match === null ? undefined : match[1];
}
