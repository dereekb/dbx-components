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

import { Node, type ExpressionWithTypeArguments, type InterfaceDeclaration, type JSDoc, type SourceFile, type TypeNode } from 'ts-morph';
import type { ExtractedArchetypeTag, ExtractedCompositeKeyTag, ExtractedInterface, ExtractedInterfaceProp, ExtractedInterfaceTags } from './types.js';

/**
 * TS utility/structural wrappers that don't change the field surface for
 * inheritance walks — `Partial<T>`, `Required<T>`, `Readonly<T>`,
 * `NonNullable<T>` preserve every property, and `Pick<T, K>` / `Omit<T, K>`
 * leave the original `T` reachable for long-name resolution. `MaybeMap<T>` is
 * the workspace's own pass-through that decorates each prop with `Maybe<…>`
 * without renaming. `extends` walks need to see through these to find the
 * concrete ancestor interface — `getExpression()` alone returns just the
 * leftmost identifier (`Partial`, `Pick`, …) and silently drops the inner
 * model, leaving every inherited `@dbxModelVariable` tag unreachable.
 */
const PASSTHROUGH_TYPE_WRAPPERS: ReadonlySet<string> = new Set(['Partial', 'Required', 'Readonly', 'NonNullable', 'MaybeMap', 'Pick', 'Omit']);

/**
 * Returns every exported interface in the source file with the metadata the
 * model assembler needs. Non-exported interfaces are skipped because the
 * upstream registry only considers exported model interfaces (matching the
 * `.mjs` extractor's `export interface` regex).
 *
 * @param sf - the parsed source file to inspect
 * @returns the interfaces in source order
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

/**
 * Resolves an `extends` clause to the concrete ancestor interface name,
 * peeling any leading {@link PASSTHROUGH_TYPE_WRAPPERS}. Returns the leftmost
 * identifier of the unwrapped expression so the inheritance walker can chain
 * through utility-wrapped declarations like
 * `extends Partial<MaybeMap<Omit<Base, '…'>>>`.
 *
 * @param expr - the `ExpressionWithTypeArguments` produced by `getExtends()`
 * @returns the resolved interface name, or the original leftmost identifier when no inner reference is reachable
 */
function resolveExtendsName(expr: ExpressionWithTypeArguments): string {
  const head = expr.getExpression().getText();
  let result = head;
  if (PASSTHROUGH_TYPE_WRAPPERS.has(head)) {
    const typeArgs = expr.getTypeArguments();
    if (typeArgs.length > 0) {
      const peeled = peelTypeNode(typeArgs[0]);
      if (peeled !== undefined) {
        result = peeled;
      }
    }
  }
  return result;
}

function peelTypeNode(node: TypeNode): string | undefined {
  let current: TypeNode = node;
  while (Node.isParenthesizedTypeNode(current)) {
    current = current.getTypeNode();
  }
  let result: string | undefined;
  if (Node.isTypeReference(current)) {
    const name = current.getTypeName().getText();
    if (PASSTHROUGH_TYPE_WRAPPERS.has(name)) {
      const inner = current.getTypeArguments();
      if (inner.length > 0) {
        result = peelTypeNode(inner[0]);
      }
    } else {
      result = name;
    }
  }
  return result;
}

function readInterfaceTags(jsDocs: readonly JSDoc[]): ExtractedInterfaceTags {
  let dbxModel = false;
  let dbxModelSubObject = false;
  let dbxModelOrganizationalGroupRoot = false;
  let dbxModelCompositeKey: ExtractedCompositeKeyTag | undefined;
  const dbxModelArchetypes: ExtractedArchetypeTag[] = [];
  const dbxModelAggregatesFrom: string[] = [];
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      if (tagName === 'dbxModel') {
        dbxModel = true;
      } else if (tagName === 'dbxModelSubObject') {
        dbxModelSubObject = true;
      } else if (tagName === 'dbxModelOrganizationalGroupRoot') {
        dbxModelOrganizationalGroupRoot = true;
      } else if (tagName === 'dbxModelArchetype') {
        const value = tag.getCommentText()?.trim();
        if (value !== undefined) {
          const parsed = parseArchetypeTagValue(value);
          if (parsed) dbxModelArchetypes.push(parsed);
        }
      } else if (tagName === 'dbxModelAggregatesFrom') {
        const value = tag.getCommentText()?.trim();
        if (value !== undefined && value.length > 0) {
          // Reject comma-separated names — one tag per model name.
          const name = value.split(/\s+/)[0];
          if (/^[A-Z][A-Za-z0-9_$]*$/.test(name)) {
            dbxModelAggregatesFrom.push(name);
          }
        }
      } else if (tagName === 'dbxModelCompositeKey') {
        // At most one tag per interface — only the first captured. Validators
        // surface duplicates as findings using the JSDoc source positions.
        if (dbxModelCompositeKey === undefined) {
          const value = tag.getCommentText()?.trim();
          dbxModelCompositeKey = parseCompositeKeyTagValue(value ?? '');
        }
      }
    }
  }
  const tags: ExtractedInterfaceTags = { dbxModel, dbxModelSubObject, dbxModelArchetypes, dbxModelAggregatesFrom, dbxModelOrganizationalGroupRoot, ...(dbxModelCompositeKey ? { dbxModelCompositeKey } : {}) };
  return tags;
}

const ARCHETYPE_SLUG_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Parses `@dbxModelArchetype <slug>[ axisKey=val,axisKey=val,...]` into
 * `{ slug, axes }`. Mirrors the `.mjs` extractor's `parseArchetypeTagValue`.
 *
 * @param value - raw tag value text after `@dbxModelArchetype`
 * @returns parsed override, or `undefined` when the slug is missing or invalid
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
 * @param value - raw tag value text after `@dbxModelCompositeKey`
 * @returns parsed tag — always present, even when malformed; validators
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
      if (v === '*') {
        fromValue = '*';
      } else if (v.length > 0) {
        // Tolerate the wildcard mixed with concrete entries here; the
        // validator emits MODEL_COMPOSITE_KEY_WILDCARD_MIXED when it sees both.
        const parts = v
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        if (parts.includes('*')) {
          // Preserve the literal list so the validator can flag the mix.
          fromValue = parts;
        } else {
          fromValue = parts.filter((p) => COMPOSITE_KEY_MODEL_NAME_RE.test(p));
        }
      }
    } else if (key === 'encoding') {
      if (v === 'two-way' || v === 'one-way') encoding = v;
    }
  }
  return { from: fromValue, encoding };
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
 * @param jsDocs - the JSDoc blocks attached to a declaration
 * @returns the description paragraph, or `undefined` when none exists
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
