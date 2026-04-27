/**
 * AST extraction for the `scan-semantic-types` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * top-level exported type aliases and interfaces tagged with the
 * `@semanticType` JSDoc marker. Each match is normalised into an
 * {@link ExtractedEntry} that {@link buildManifest} will assemble into a
 * `SemanticTypeManifest` entry.
 *
 * Topic validation is **not** performed here. The generator emits whatever
 * the source code declares; the loader (Step 1) handles core/namespaced
 * topic enforcement at consumption time. That separation keeps this
 * module purely syntactic.
 */

import { type } from 'arktype';
import { Node, SyntaxKind, type InterfaceDeclaration, type JSDoc, type Project, type SourceFile, type TypeAliasDeclaration, type TypeNode } from 'ts-morph';
import { type SemanticTypeEntry } from '../manifest/semantic-types-schema.js';

// MARK: Types
/**
 * One semantic-type extracted from a source file. Mirrors the
 * {@link SemanticTypeEntry} shape minus `package` and `module` (which are
 * derived in {@link buildManifest}). Topic strings are passed through
 * verbatim — the loader applies vocabulary rules at consumption time.
 */
export interface ExtractedEntry {
  readonly name: string;
  readonly kind: 'semantic-type' | 'type-alias';
  readonly definition: string;
  readonly baseType: SemanticTypeEntry['baseType'];
  readonly topics: readonly string[];
  readonly unionValues?: readonly string[];
  readonly typeParameters?: readonly string[];
  readonly guards: readonly string[];
  readonly factories: readonly string[];
  readonly examples: readonly { readonly caption?: string; readonly code: string }[];
  readonly notes?: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Input to {@link extractEntries}. The caller is responsible for adding
 * source files to `project` (either from disk, in-memory fixtures, or
 * a tsconfig).
 */
export interface ExtractEntriesInput {
  readonly project: Project;
}

const SEMANTIC_TYPE_MARKER = 'semanticType';
const SEMANTIC_TOPIC_TAG = 'semanticTopic';
const SEMANTIC_GUARD_TAG = 'semanticGuard';
const SEMANTIC_FACTORY_TAG = 'semanticFactory';

// MARK: Entry point
/**
 * Walks the supplied project and returns every type tagged with the
 * `@semanticType` JSDoc marker. Order is stable: source files in the
 * order ts-morph reports them, declarations within a file in source
 * order.
 *
 * @param input - the ts-morph project to scan
 * @returns the extracted entries; empty when no source declares `@semanticType`
 */
interface SourceFileContext {
  readonly filePath: string;
  readonly sameFileExports: ReadonlySet<string>;
}

function collectFromTypeAliases(sourceFile: SourceFile, context: SourceFileContext, entries: ExtractedEntry[]): void {
  for (const decl of sourceFile.getTypeAliases()) {
    if (!decl.isExported()) {
      continue;
    }
    const tags = readJsDocTags(decl.getJsDocs());
    if (!tags.hasMarker) {
      continue;
    }
    entries.push(buildEntryFromTypeAlias({ decl, tags, filePath: context.filePath, sameFileExports: context.sameFileExports }));
  }
}

function collectFromInterfaces(sourceFile: SourceFile, context: SourceFileContext, entries: ExtractedEntry[]): void {
  for (const decl of sourceFile.getInterfaces()) {
    if (!decl.isExported()) {
      continue;
    }
    const tags = readJsDocTags(decl.getJsDocs());
    if (!tags.hasMarker) {
      continue;
    }
    entries.push(buildEntryFromInterface({ decl, tags, filePath: context.filePath, sameFileExports: context.sameFileExports }));
  }
}

export function extractEntries(input: ExtractEntriesInput): readonly ExtractedEntry[] {
  const { project } = input;
  const entries: ExtractedEntry[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const context: SourceFileContext = {
      filePath: sourceFile.getFilePath(),
      sameFileExports: collectSameFileExports(sourceFile)
    };
    collectFromTypeAliases(sourceFile, context, entries);
    collectFromInterfaces(sourceFile, context, entries);
  }

  return entries;
}

// MARK: JSDoc extraction
interface ParsedJsDocTags {
  readonly hasMarker: boolean;
  readonly summary: string;
  readonly topics: readonly string[];
  readonly guardNames: readonly string[];
  readonly factoryNames: readonly string[];
  readonly examples: readonly { readonly caption?: string; readonly code: string }[];
  readonly deprecated?: boolean | string;
  readonly since?: string;
}

/**
 * Consolidates JSDoc tags across all leading JSDoc blocks on a
 * declaration into a single normalized record. Multiple `@semanticTopic`,
 * `@semanticGuard`, `@semanticFactory`, and `@example` blocks accumulate;
 * `@deprecated` and `@since` use last-wins semantics if repeated.
 *
 * @param jsDocs - the JSDoc blocks attached to a declaration
 * @returns the parsed tag set
 */
interface MutableTagState {
  hasMarker: boolean;
  readonly summaries: string[];
  readonly topics: string[];
  readonly guardNames: string[];
  readonly factoryNames: string[];
  readonly examples: { caption?: string; code: string }[];
  deprecated: boolean | string | undefined;
  since: string | undefined;
}

function readJsDocTags(jsDocs: readonly JSDoc[]): ParsedJsDocTags {
  const state: MutableTagState = {
    hasMarker: false,
    summaries: [],
    topics: [],
    guardNames: [],
    factoryNames: [],
    examples: [],
    deprecated: undefined,
    since: undefined
  };

  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription().trim();
    if (description.length > 0) {
      state.summaries.push(description);
    }
    for (const tag of jsDoc.getTags()) {
      applyJsDocTag(state, tag.getTagName(), tag.getCommentText()?.trim() ?? '');
    }
  }

  return {
    hasMarker: state.hasMarker,
    summary: state.summaries.join('\n\n'),
    topics: state.topics,
    guardNames: state.guardNames,
    factoryNames: state.factoryNames,
    examples: state.examples,
    deprecated: state.deprecated,
    since: state.since
  };
}

/**
 * Applies one JSDoc tag's contribution to the running tag-state record.
 * Pulled out of {@link readJsDocTags} so each tag's handling is a
 * single-line case and the outer function's cognitive complexity stays
 * low.
 *
 * @param state - mutable tag-state being accumulated across one declaration
 * @param name - the JSDoc tag name (without the `@`)
 * @param text - the tag's comment text, already trimmed
 */
function applyJsDocTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case SEMANTIC_TYPE_MARKER:
      state.hasMarker = true;
      break;
    case SEMANTIC_TOPIC_TAG:
      for (const topic of splitListTagText(text)) {
        state.topics.push(topic);
      }
      break;
    case SEMANTIC_GUARD_TAG:
      for (const ref of splitListTagText(text)) {
        state.guardNames.push(ref);
      }
      break;
    case SEMANTIC_FACTORY_TAG:
      for (const ref of splitListTagText(text)) {
        state.factoryNames.push(ref);
      }
      break;
    case 'example':
      state.examples.push(parseExampleTag(text));
      break;
    case 'deprecated':
      state.deprecated = text.length > 0 ? text : true;
      break;
    case 'since':
      if (text.length > 0) {
        state.since = text;
      }
      break;
    default:
      break;
  }
}

/**
 * Splits a JSDoc tag's comment text into a list. Accepts comma- or
 * whitespace-separated entries so authors can write `@semanticTopic a, b`
 * or `@semanticTopic a b`.
 *
 * @param text - the raw tag comment text
 * @returns the trimmed, non-empty entries
 */
function splitListTagText(text: string): readonly string[] {
  const out: string[] = [];
  for (const piece of text.split(/[\s,]+/)) {
    const trimmed = piece.trim();
    if (trimmed.length > 0) {
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * Parses an `@example` tag body into a code+caption pair. The convention
 * is: optional first line is a caption, remaining lines are code. Fenced
 * code blocks (```ts ... ```) are unwrapped if present.
 *
 * @param text - the raw `@example` body
 * @returns the parsed example
 */
function parseExampleTag(text: string): { readonly caption?: string; readonly code: string } {
  const trimmed = text.trim();
  const fenceMatch = /^([^\n]*)\n```[a-zA-Z]*\n([\s\S]*?)\n```\s*$/.exec(trimmed);
  let result: { caption?: string; code: string };
  if (fenceMatch) {
    const caption = fenceMatch[1].trim();
    const code = fenceMatch[2];
    result = caption.length > 0 ? { caption, code } : { code };
  } else {
    const standaloneFence = /^```[a-zA-Z]*\n([\s\S]*?)\n```\s*$/.exec(trimmed);
    if (standaloneFence) {
      result = { code: standaloneFence[1] };
    } else {
      result = { code: trimmed };
    }
  }
  return result;
}

// MARK: Entry construction
interface BuildEntryFromAliasInput {
  readonly decl: TypeAliasDeclaration;
  readonly tags: ParsedJsDocTags;
  readonly filePath: string;
  readonly sameFileExports: ReadonlySet<string>;
}

function buildEntryFromTypeAlias(input: BuildEntryFromAliasInput): ExtractedEntry {
  const { decl, tags, filePath, sameFileExports } = input;
  const typeNode = decl.getTypeNode();
  const baseType = detectBaseType(typeNode);
  const definition = typeNode ? typeNode.getText() : decl.getText();
  const unionValues = baseType === 'union-literal' ? extractUnionValues(typeNode) : undefined;
  const typeParameters = decl.getTypeParameters().map((p) => p.getName());
  const name = decl.getName();
  const guards = resolveGuards({ name, declaredGuardNames: tags.guardNames, sameFileExports });
  const factories = resolveFactories({ declaredFactoryNames: tags.factoryNames, sameFileExports });

  return {
    name,
    kind: 'semantic-type',
    definition,
    baseType,
    topics: tags.topics,
    unionValues,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    guards,
    factories,
    examples: tags.examples,
    notes: tags.summary.length > 0 ? tags.summary : undefined,
    deprecated: tags.deprecated,
    since: tags.since,
    filePath,
    line: decl.getStartLineNumber()
  };
}

interface BuildEntryFromInterfaceInput {
  readonly decl: InterfaceDeclaration;
  readonly tags: ParsedJsDocTags;
  readonly filePath: string;
  readonly sameFileExports: ReadonlySet<string>;
}

function buildEntryFromInterface(input: BuildEntryFromInterfaceInput): ExtractedEntry {
  const { decl, tags, filePath, sameFileExports } = input;
  const name = decl.getName();
  const definition = decl.getText();
  const typeParameters = decl.getTypeParameters().map((p) => p.getName());
  const guards = resolveGuards({ name, declaredGuardNames: tags.guardNames, sameFileExports });
  const factories = resolveFactories({ declaredFactoryNames: tags.factoryNames, sameFileExports });

  return {
    name,
    kind: 'semantic-type',
    definition,
    baseType: 'object',
    topics: tags.topics,
    typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
    guards,
    factories,
    examples: tags.examples,
    notes: tags.summary.length > 0 ? tags.summary : undefined,
    deprecated: tags.deprecated,
    since: tags.since,
    filePath,
    line: decl.getStartLineNumber()
  };
}

// MARK: Companion resolution
interface ResolveGuardsInput {
  readonly name: string;
  readonly declaredGuardNames: readonly string[];
  readonly sameFileExports: ReadonlySet<string>;
}

/**
 * Builds the final guards list. Always honours `@semanticGuard` declarations.
 * Adds the conventional `is<Name>` companion if one is exported from the
 * same file and was not already declared. Result is deduplicated and
 * preserves declaration order with auto-detected entries appended.
 *
 * @param input - the type's name plus the declared guards and same-file exports
 * @returns the merged guards list
 */
function resolveGuards(input: ResolveGuardsInput): readonly string[] {
  const { name, declaredGuardNames, sameFileExports } = input;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const declared of declaredGuardNames) {
    if (!seen.has(declared)) {
      seen.add(declared);
      out.push(declared);
    }
  }
  const conventional = `is${name}`;
  if (!seen.has(conventional) && sameFileExports.has(conventional)) {
    out.push(conventional);
  }
  return out;
}

interface ResolveFactoriesInput {
  readonly declaredFactoryNames: readonly string[];
  readonly sameFileExports: ReadonlySet<string>;
}

/**
 * Builds the final factories list. Only entries explicitly declared with
 * `@semanticFactory` are honoured — the camelCase auto-detection
 * heuristic is too aggressive (every type has a same-file lowercase
 * variable that may or may not be a factory). Same-file exports are
 * still consulted to filter out declared names that don't actually
 * resolve to an export.
 *
 * @param input - the declared factories and same-file exports
 * @returns the resolved factories list
 */
function resolveFactories(input: ResolveFactoriesInput): readonly string[] {
  const { declaredFactoryNames, sameFileExports } = input;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const declared of declaredFactoryNames) {
    if (seen.has(declared)) {
      continue;
    }
    if (sameFileExports.has(declared)) {
      seen.add(declared);
      out.push(declared);
    }
  }
  return out;
}

/**
 * Returns the names of every value-level exported declaration in the
 * source file. Used to filter declared / auto-detected guards and
 * factories down to symbols that actually exist.
 *
 * @param sourceFile - the source file to scan
 * @returns the set of exported binding names
 */
function collectSameFileExports(sourceFile: SourceFile): ReadonlySet<string> {
  const names = new Set<string>();
  for (const [name] of sourceFile.getExportedDeclarations()) {
    names.add(name);
  }
  return names;
}

// MARK: baseType detection
/**
 * Maps a TypeScript type node to one of the manifest's `baseType`
 * categories. Conservative — anything we don't recognise becomes
 * `'other'` rather than guessing.
 *
 * @param typeNode - the type alias's right-hand-side node, or undefined
 * @returns the corresponding manifest baseType
 */
function detectBaseType(typeNode: TypeNode | undefined): SemanticTypeEntry['baseType'] {
  let result: SemanticTypeEntry['baseType'] = 'other';
  if (typeNode) {
    if (Node.isUnionTypeNode(typeNode)) {
      result = isUnionLiteralOnly(typeNode.getTypeNodes()) ? 'union-literal' : 'other';
    } else if (Node.isIntersectionTypeNode(typeNode)) {
      result = isBrandedIntersection(typeNode.getTypeNodes()) ? 'branded' : 'other';
    } else if (Node.isTemplateLiteralTypeNode(typeNode)) {
      result = 'template-literal';
    } else if (Node.isLiteralTypeNode(typeNode)) {
      result = 'union-literal';
    } else {
      const kind = typeNode.getKind();
      if (kind === SyntaxKind.StringKeyword) {
        result = 'string';
      } else if (kind === SyntaxKind.NumberKeyword) {
        result = 'number';
      } else if (kind === SyntaxKind.BooleanKeyword) {
        result = 'boolean';
      } else if (Node.isTypeLiteral(typeNode)) {
        result = 'object';
      }
    }
  }
  return result;
}

function isUnionLiteralOnly(nodes: readonly TypeNode[]): boolean {
  let allLiteral = nodes.length > 0;
  for (const node of nodes) {
    if (!Node.isLiteralTypeNode(node)) {
      allLiteral = false;
      break;
    }
  }
  return allLiteral;
}

function isBrandedIntersection(nodes: readonly TypeNode[]): boolean {
  let branded = false;
  for (const node of nodes) {
    if (Node.isTypeLiteral(node)) {
      const properties = node.getProperties();
      for (const prop of properties) {
        const propName = prop.getName();
        if (propName.startsWith('__brand') || propName.startsWith('_')) {
          branded = true;
          break;
        }
      }
    }
    if (branded) {
      break;
    }
  }
  return branded;
}

function extractUnionValues(typeNode: TypeNode | undefined): readonly string[] | undefined {
  let result: readonly string[] | undefined;
  if (typeNode && Node.isUnionTypeNode(typeNode)) {
    const values: string[] = [];
    for (const member of typeNode.getTypeNodes()) {
      values.push(member.getText());
    }
    result = values;
  } else if (typeNode && Node.isLiteralTypeNode(typeNode)) {
    result = [typeNode.getText()];
  } else {
    result = undefined;
  }
  return result;
}

// MARK: Arktype runtime guard (for re-validating extracted shape if a caller wants it)
/**
 * Arktype validator that mirrors {@link ExtractedEntry}. Useful for
 * tests and for runtime-validating fixture entries crafted by hand.
 */
export const ExtractedEntrySchema = type({
  name: 'string',
  kind: '"semantic-type" | "type-alias"',
  definition: 'string',
  baseType: '"string" | "number" | "boolean" | "object" | "branded" | "union-literal" | "template-literal" | "other"',
  topics: 'string[]',
  'unionValues?': 'string[]',
  'typeParameters?': 'string[]',
  guards: 'string[]',
  factories: 'string[]',
  examples: type({ 'caption?': 'string', code: 'string' }).array(),
  'notes?': 'string',
  'deprecated?': 'boolean | string',
  'since?': 'string',
  filePath: 'string',
  line: 'number'
});
