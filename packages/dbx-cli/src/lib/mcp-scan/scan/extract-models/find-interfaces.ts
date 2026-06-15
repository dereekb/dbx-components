/**
 * Walks every `export interface` declaration in a ts-morph source file and
 * captures the JSDoc tag flags (`@dbxModel`), `extends` references, and
 * per-property metadata (TS type, optionality, JSDoc description, and the
 * `@dbxModelVariable` long-name tag).
 *
 * Mirrors the regex-based extractor's `findInterfaces` + `parseInterfaceBody`
 * pair from `scripts/extract-firebase-models.mjs`, but the AST drops the
 * cumbersome property-by-property regex.
 */

import { type InterfaceDeclaration, type JSDoc, type SourceFile } from 'ts-morph';
import { resolveExtendsName } from '../../../scan-helpers/firestore-model-extract-utils.js';
import type { DbxModelReadLevel, ExtractedArchetypeTag, ExtractedCompositeKeyTag, ExtractedInterface, ExtractedInterfaceProp, ExtractedInterfaceTags } from './types.js';

/**
 * Allowed `@dbxModelRead` values. Mirrors the ESLint rule's `READ_LEVEL_VALUES`. Invalid tag
 * values are silently dropped at scan time — the ESLint rule is the user-facing gate.
 */
const READ_LEVEL_VALUES: ReadonlySet<DbxModelReadLevel> = new Set<DbxModelReadLevel>(['system', 'owner', 'admin-only', 'permissions']);

/**
 * Returns every exported interface in the source file with the metadata the
 * model assembler needs. Non-exported interfaces are skipped because the
 * upstream registry only considers exported model interfaces (matching the
 * `.mjs` extractor's `export interface` regex).
 *
 * @param sf - The parsed source file to inspect.
 * @returns The interfaces in source order.
 */
export function findInterfaces(sf: SourceFile): readonly ExtractedInterface[] {
  const out: ExtractedInterface[] = [];
  for (const decl of sf.getInterfaces()) {
    if (!decl.isExported()) continue;
    out.push(buildInterface(decl));
  }
  return out;
}

function buildInterface(decl: InterfaceDeclaration): ExtractedInterface {
  const tags = readInterfaceTags(decl.getJsDocs());
  const description = readDescription(decl.getJsDocs());
  const extendsNames = decl.getExtends().map(resolveExtendsName);
  const props: ExtractedInterfaceProp[] = [];
  for (const prop of decl.getProperties()) {
    const propJsDocs = prop.getJsDocs();
    const propTags = readPropertyTags(propJsDocs);
    const tsType = (prop.getTypeNode()?.getText() ?? '').replaceAll(/\s+/g, ' ').trim();
    const isOptional = prop.hasQuestionToken() || tsType.startsWith('Maybe<');
    props.push({
      name: prop.getName(),
      tsType,
      optional: isOptional,
      description: readDescription(propJsDocs),
      longName: propTags.dbxModelVariable,
      syncFlag: propTags.dbxModelVariableSyncFlag
    });
  }
  return {
    name: decl.getName(),
    description,
    tags,
    extendsNames,
    props
  };
}

interface MutableInterfaceTagState {
  dbxModel: boolean;
  dbxModelSubObject: boolean;
  dbxModelOrganizationalGroupRoot: boolean;
  dbxModelCompositeKey: ExtractedCompositeKeyTag | undefined;
  dbxModelRead: DbxModelReadLevel | undefined;
  readonly dbxModelArchetypes: ExtractedArchetypeTag[];
  readonly dbxModelAggregatesFrom: string[];
}

function readInterfaceTags(jsDocs: readonly JSDoc[]): ExtractedInterfaceTags {
  const state: MutableInterfaceTagState = {
    dbxModel: false,
    dbxModelSubObject: false,
    dbxModelOrganizationalGroupRoot: false,
    dbxModelCompositeKey: undefined,
    dbxModelRead: undefined,
    dbxModelArchetypes: [],
    dbxModelAggregatesFrom: []
  };
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      applyInterfaceTag(state, tag.getTagName(), tag.getCommentText()?.trim());
    }
  }
  return {
    dbxModel: state.dbxModel,
    dbxModelSubObject: state.dbxModelSubObject,
    dbxModelArchetypes: state.dbxModelArchetypes,
    dbxModelAggregatesFrom: state.dbxModelAggregatesFrom,
    dbxModelOrganizationalGroupRoot: state.dbxModelOrganizationalGroupRoot,
    ...(state.dbxModelCompositeKey ? { dbxModelCompositeKey: state.dbxModelCompositeKey } : {}),
    ...(state.dbxModelRead ? { dbxModelRead: state.dbxModelRead } : {})
  };
}

const AGGREGATES_FROM_NAME_RE = /^[A-Z][A-Za-z0-9_$]*$/;

function applyInterfaceTag(state: MutableInterfaceTagState, tagName: string, value: string | undefined): void {
  switch (tagName) {
    case 'dbxModel':
      state.dbxModel = true;
      break;
    case 'dbxModelSubObject':
      state.dbxModelSubObject = true;
      break;
    case 'dbxModelOrganizationalGroupRoot':
      state.dbxModelOrganizationalGroupRoot = true;
      break;
    case 'dbxModelArchetype':
      applyArchetypeTag(state, value);
      break;
    case 'dbxModelAggregatesFrom':
      applyAggregatesFromTag(state, value);
      break;
    case 'dbxModelCompositeKey':
      applyCompositeKeyTag(state, value);
      break;
    case 'dbxModelRead':
      applyReadTag(state, value);
      break;
    default:
      break;
  }
}

function applyReadTag(state: MutableInterfaceTagState, value: string | undefined): void {
  if (value === undefined || value.length === 0) return;
  if (state.dbxModelRead !== undefined) return;
  const firstToken = value.split(/\s+/)[0] as DbxModelReadLevel;
  if (READ_LEVEL_VALUES.has(firstToken)) {
    state.dbxModelRead = firstToken;
  }
}

function applyArchetypeTag(state: MutableInterfaceTagState, value: string | undefined): void {
  if (value === undefined) return;
  const parsed = parseArchetypeTagValue(value);
  if (parsed) state.dbxModelArchetypes.push(parsed);
}

function applyAggregatesFromTag(state: MutableInterfaceTagState, value: string | undefined): void {
  if (value === undefined || value.length === 0) return;
  const name = value.split(/\s+/)[0];
  if (AGGREGATES_FROM_NAME_RE.test(name)) {
    state.dbxModelAggregatesFrom.push(name);
  }
}

function applyCompositeKeyTag(state: MutableInterfaceTagState, value: string | undefined): void {
  if (state.dbxModelCompositeKey !== undefined) return;
  state.dbxModelCompositeKey = parseCompositeKeyTagValue(value ?? '');
}

const ARCHETYPE_SLUG_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Parses `@dbxModelArchetype <slug>[ axisKey=val,axisKey=val,...]` into
 * `{ slug, axes }`. Mirrors the `.mjs` extractor's `parseArchetypeTagValue`.
 *
 * @param value - Raw tag value text after `@dbxModelArchetype`
 * @returns Parsed override, or `undefined` when the slug is missing or invalid.
 */
function parseArchetypeTagValue(value: string): ExtractedArchetypeTag | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const spaceIdx = trimmed.indexOf(' ');
  const slug = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx).trim() : trimmed;
  if (!ARCHETYPE_SLUG_RE.test(slug)) return undefined;
  const axes: { [key: string]: string } = {};
  if (spaceIdx >= 0) {
    const rest = trimmed.slice(spaceIdx + 1).trim();
    for (const pair of rest.split(',')) {
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const key = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (key.length > 0 && v.length > 0) axes[key] = v;
    }
  }
  return { slug, axes };
}

const COMPOSITE_KEY_MODEL_NAME_RE = /^[A-Za-z][A-Za-z0-9_$]*$/;

/**
 * Parses `@dbxModelCompositeKey from=<ModelA>,<ModelB>[,<ModelC>...] encoding=<two-way|one-way>`
 * (or the wildcard form `from=* encoding=<...>`) into a structured
 * {@link ExtractedCompositeKeyTag}.
 *
 * The parser is intentionally permissive — it captures whatever the author
 * wrote and lets validators surface specific findings (missing `from=`,
 * unresolved model name, invalid encoding, wildcard mixed with concrete
 * entries). A completely missing `from=` produces `from: []` so the validator
 * can flag `MODEL_COMPOSITE_KEY_MISSING_FROM`. An unrecognised encoding leaves
 * `encoding` undefined for `MODEL_COMPOSITE_KEY_INVALID_ENCODING`.
 *
 * @param value - Raw tag value text after `@dbxModelCompositeKey`
 * @returns Parsed tag — always present, even when malformed; validators
 *   inspect the fields to emit findings.
 */
function parseCompositeKeyTagValue(value: string): ExtractedCompositeKeyTag {
  const trimmed = value.trim();
  let fromValue: readonly string[] | '*' = [];
  let encoding: 'two-way' | 'one-way' | undefined;
  if (trimmed.length === 0) return { from: fromValue, encoding };
  for (const token of trimmed.split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq <= 0) continue;
    const key = token.slice(0, eq).trim();
    const v = token.slice(eq + 1).trim();
    if (key === 'from') {
      const parsedFrom = parseCompositeKeyFromValue(v);
      if (parsedFrom !== undefined) fromValue = parsedFrom;
    } else if (key === 'encoding' && (v === 'two-way' || v === 'one-way')) encoding = v;
  }
  return { from: fromValue, encoding };
}

/**
 * Parses the `from=` value of a `@dbxModelCompositeKey` tag into the wildcard
 * `'*'` or a concrete model-name list. Returns `undefined` for an empty value
 * so the caller leaves any previously-parsed `from` untouched.
 *
 * @param v - The raw text after `from=`.
 * @returns `'*'`, the parsed model-name list, or `undefined` when the value is empty.
 */
function parseCompositeKeyFromValue(v: string): readonly string[] | '*' | undefined {
  let result: readonly string[] | '*' | undefined;
  if (v === '*') {
    result = '*';
  } else if (v.length > 0) {
    // Tolerate the wildcard mixed with concrete entries here; the validator
    // emits MODEL_COMPOSITE_KEY_WILDCARD_MIXED when it sees both.
    const parts = v
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    // Preserve the literal list (incl. `*`) so the validator can flag the mix.
    result = parts.includes('*') ? parts : parts.filter((p) => COMPOSITE_KEY_MODEL_NAME_RE.test(p));
  }
  return result;
}

interface PropertyTags {
  readonly dbxModelVariable: string | undefined;
  readonly dbxModelVariableSyncFlag: string | undefined;
}

function takeFirstTagText(current: string | undefined, tag: { getCommentText: () => string | undefined }): string | undefined {
  if (current !== undefined) return current;
  const text = tag.getCommentText()?.trim();
  return text !== undefined && text.length > 0 ? text : undefined;
}

function readPropertyTags(jsDocs: readonly JSDoc[]): PropertyTags {
  let dbxModelVariable: string | undefined;
  let dbxModelVariableSyncFlag: string | undefined;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      if (tagName === 'dbxModelVariable') {
        dbxModelVariable = takeFirstTagText(dbxModelVariable, tag);
      } else if (tagName === 'dbxModelVariableSyncFlag') {
        dbxModelVariableSyncFlag = takeFirstTagText(dbxModelVariableSyncFlag, tag);
      }
    }
  }
  return { dbxModelVariable, dbxModelVariableSyncFlag };
}

/**
 * Returns the first non-empty paragraph of the leading JSDoc description.
 * Mirrors the `.mjs` `parseJsdocBlock` that splits on the first blank line
 * before the first `@`-tag.
 *
 * @param jsDocs - The JSDoc blocks attached to a declaration.
 * @returns The description paragraph, or `undefined` when none exists.
 */
export function readDescription(jsDocs: readonly JSDoc[]): string | undefined {
  let result: string | undefined;
  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription().trim();
    if (description.length === 0) continue;
    const paragraph = firstParagraph(description);
    if (paragraph.length > 0) {
      result = paragraph;
      break;
    }
  }
  return result;
}

function firstParagraph(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());
  const collected: string[] = [];
  for (const line of lines) {
    if (line.startsWith('@')) break;
    if (line.length === 0) {
      if (collected.length > 0) break;
      continue;
    }
    collected.push(line);
  }
  return collected.join(' ').trim();
}
