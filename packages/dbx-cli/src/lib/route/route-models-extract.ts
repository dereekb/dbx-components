/**
 * Parser + extractor for the `@dbxRouteModel` / `@dbxRouteModelList` JSDoc tag
 * grammar that annotates which Firestore models a route renders.
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
 * - (absent, list tag) → `kind: 'list'`.
 *
 * Pure: parsing is string work; extraction reads a ts-morph `SourceFile`.
 */

import type { JSDoc, SourceFile } from 'ts-morph';

/**
 * Whether a route-model entry resolves to a promoted id, a full key, or a
 * keyless list.
 */
export type RouteModelKind = 'id' | 'key' | 'list';

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
const ROUTE_MODEL_TAG = 'dbxRouteModel';
const ROUTE_MODEL_LIST_TAG = 'dbxRouteModelList';

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
      result = { ok: true, model: { modelType: tokens[0], kind: parsedKey.kind, keyTemplate: tokens[1], description, routeParams: parsedKey.routeParams } };
    } else {
      result = { ok: false, message: parsedKey.message };
    }
  } else {
    result = { ok: false, message: `\`@${ROUTE_MODEL_TAG}\` model type \`${tokens[0]}\` is not a valid identifier.` };
  }
  return result;
}

type ParseKeyTemplateResult = { readonly ok: true; readonly kind: 'id' | 'key'; readonly routeParams: readonly string[] } | { readonly ok: false; readonly message: string };

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
  const placeholder = placeholderParam(segment);
  let result: ParseKeyTemplateResult;
  if (placeholder === undefined) {
    result = { ok: false, message: `Single-segment key template \`${keyTemplate}\` must be a placeholder (\`:param\` or \`${AUTH_UID_PLACEHOLDER}\`).` };
  } else {
    result = { ok: true, kind: 'id', routeParams: placeholder.routeParam === undefined ? [] : [placeholder.routeParam] };
  }
  return result;
}

function parseAlternatingKey(segments: readonly string[], keyTemplate: string): ParseKeyTemplateResult {
  const routeParams: string[] = [];
  let message: string | undefined;
  for (const [i, segment] of segments.entries()) {
    if (i % 2 === 0) {
      if (!LITERAL_SEGMENT_RE.test(segment)) {
        message = `Key template \`${keyTemplate}\` segment \`${segment}\` must be a literal collection name.`;
        break;
      }
    } else {
      const placeholder = placeholderParam(segment);
      if (placeholder === undefined) {
        message = `Key template \`${keyTemplate}\` segment \`${segment}\` must be a placeholder (\`:param\` or \`${AUTH_UID_PLACEHOLDER}\`).`;
        break;
      }
      if (placeholder.routeParam !== undefined) {
        routeParams.push(placeholder.routeParam);
      }
    }
  }
  return message === undefined ? { ok: true, kind: 'key', routeParams } : { ok: false, message };
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

// MARK: Component extraction
/**
 * Extracts every `@dbxRouteModel*` tag declared on the named component class in
 * a source file. Returns an empty list when the class is absent or carries no
 * route-model tags.
 *
 * @param sourceFile - The ts-morph source file declaring the component.
 * @param component - The component class name to read tags from.
 * @returns The raw route-model tags found on the class.
 */
export function extractComponentRouteModelTags(sourceFile: SourceFile, component: string): readonly RawRouteModelTag[] {
  const cls = sourceFile.getClass(component);
  return cls === undefined ? [] : collectRouteModelTags(cls.getJsDocs());
}

function collectRouteModelTags(jsDocs: readonly JSDoc[]): readonly RawRouteModelTag[] {
  const out: RawRouteModelTag[] = [];
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      const name = tag.getTagName();
      if (name.startsWith(ROUTE_MODEL_TAG)) {
        out.push({ name, text: tag.getCommentText()?.trim() ?? '' });
      }
    }
  }
  return out;
}
