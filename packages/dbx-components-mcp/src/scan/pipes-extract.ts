/**
 * AST extraction for the `scan-pipes` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * top-level exported class declarations tagged with the `@dbxPipe` JSDoc
 * marker. Each match is normalised into an {@link ExtractedPipeEntry} that
 * {@link buildPipesManifest} assembles into a `PipeManifest` entry.
 *
 * `@Pipe({ name, pure })` decorator metadata, the `transform()` method
 * signature, and `@param` JSDoc tags on `transform()` are auto-extracted;
 * JSDoc tags only supply registry metadata that can't be derived from
 * source (slug, category, related slugs, skill refs).
 */

import { Node, type ClassDeclaration, type Decorator, type JSDoc, type MethodDeclaration, type ObjectLiteralExpression, type ParameterDeclaration, type Project, type SourceFile } from 'ts-morph';
import type { PipeArgEntry, PipeEntry } from '../manifest/pipes-schema.js';
import { readStringProperty, splitListTagText, unwrapFenced } from './scan-extract-utils.js';

// MARK: Tag names
const PIPE_MARKER = 'dbxPipe';
const PIPE_SLUG_TAG = 'dbxPipeSlug';
const PIPE_CATEGORY_TAG = 'dbxPipeCategory';
const PIPE_RELATED_TAG = 'dbxPipeRelated';
const PIPE_SKILL_REFS_TAG = 'dbxPipeSkillRefs';
const PIPE_INPUT_TYPE_TAG = 'dbxPipeInputType';
const PIPE_OUTPUT_TYPE_TAG = 'dbxPipeOutputType';

// MARK: Public types
/**
 * One pipe entry extracted from a source file. Mirrors {@link PipeEntry}
 * minus `module` (derived from the package being scanned in build-manifest).
 * `filePath` and `line` are kept for in-process warnings and never persisted.
 */
export interface ExtractedPipeEntry {
  readonly slug: string;
  readonly category: PipeEntry['category'];
  readonly pipeName: string;
  readonly className: string;
  readonly inputType: string;
  readonly outputType: string;
  readonly purity: PipeEntry['purity'];
  readonly description: string;
  readonly args: readonly PipeArgEntry[];
  readonly relatedSlugs?: readonly string[];
  readonly skillRefs?: readonly string[];
  readonly example: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Discriminated union of the non-fatal events the extractor emits when an
 * entry can't be assembled. Build-manifest collates these into a structured
 * warning array so missing/invalid tag combinations surface during
 * generation rather than silently dropping entries.
 */
export type PipeExtractWarning =
  | { readonly kind: 'missing-required-tag'; readonly className: string; readonly tag: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-category'; readonly className: string; readonly category: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-pipe-decorator'; readonly className: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-transform-method'; readonly className: string; readonly filePath: string; readonly line: number };

/**
 * Input to {@link extractPipeEntries}. The caller is responsible for adding
 * source files to `project`.
 */
export interface ExtractPipeEntriesInput {
  readonly project: Project;
}

/**
 * Result of {@link extractPipeEntries}.
 */
export interface ExtractPipeEntriesResult {
  readonly entries: readonly ExtractedPipeEntry[];
  readonly warnings: readonly PipeExtractWarning[];
}

// MARK: Vocabularies
const VALID_CATEGORIES: ReadonlySet<string> = new Set(['value', 'date', 'async', 'misc']);

// MARK: Entry point
/**
 * Walks the supplied project and returns every class tagged with the
 * `@dbxPipe` JSDoc marker. Order is stable: source files in the order
 * ts-morph reports them, declarations within a file in source order.
 *
 * @param input - the ts-morph project to scan
 * @returns the extracted entries plus any non-fatal warnings
 */
export function extractPipeEntries(input: ExtractPipeEntriesInput): ExtractPipeEntriesResult {
  const { project } = input;
  const entries: ExtractedPipeEntry[] = [];
  const warnings: PipeExtractWarning[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    for (const decl of sourceFile.getClasses()) {
      if (!decl.isExported()) {
        continue;
      }
      const tags = readJsDocTags(decl.getJsDocs());
      if (!tags.hasMarker) {
        continue;
      }
      const built = buildEntryFromClass({ decl, tags, filePath, sourceFile });
      if (built.kind === 'ok') {
        entries.push(built.entry);
      }
      for (const warning of built.warnings) {
        warnings.push(warning);
      }
    }
  }

  return { entries, warnings };
}

// MARK: JSDoc parsing
interface ParsedPipeTags {
  readonly hasMarker: boolean;
  readonly summary: string;
  readonly slug?: string;
  readonly category?: string;
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly examples: readonly string[];
  readonly inputTypeOverride?: string;
  readonly outputTypeOverride?: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
}

interface MutableTagState {
  hasMarker: boolean;
  readonly summaries: string[];
  slug: string | undefined;
  category: string | undefined;
  readonly relatedSlugs: string[];
  readonly skillRefs: string[];
  readonly examples: string[];
  inputTypeOverride: string | undefined;
  outputTypeOverride: string | undefined;
  deprecated: boolean | string | undefined;
  since: string | undefined;
}

function readJsDocTags(jsDocs: readonly JSDoc[]): ParsedPipeTags {
  const state: MutableTagState = {
    hasMarker: false,
    summaries: [],
    slug: undefined,
    category: undefined,
    relatedSlugs: [],
    skillRefs: [],
    examples: [],
    inputTypeOverride: undefined,
    outputTypeOverride: undefined,
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
    slug: state.slug,
    category: state.category,
    relatedSlugs: state.relatedSlugs,
    skillRefs: state.skillRefs,
    examples: state.examples,
    inputTypeOverride: state.inputTypeOverride,
    outputTypeOverride: state.outputTypeOverride,
    deprecated: state.deprecated,
    since: state.since
  };
}

function applyJsDocTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case PIPE_MARKER:
      state.hasMarker = true;
      break;
    case PIPE_SLUG_TAG:
      state.slug = text;
      break;
    case PIPE_CATEGORY_TAG:
      state.category = text;
      break;
    case PIPE_RELATED_TAG:
      for (const slug of splitListTagText(text)) {
        state.relatedSlugs.push(slug);
      }
      break;
    case PIPE_SKILL_REFS_TAG:
      for (const ref of splitListTagText(text)) {
        state.skillRefs.push(ref);
      }
      break;
    case PIPE_INPUT_TYPE_TAG:
      state.inputTypeOverride = text;
      break;
    case PIPE_OUTPUT_TYPE_TAG:
      state.outputTypeOverride = text;
      break;
    case 'example':
      state.examples.push(unwrapFenced(text));
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

// MARK: Class entry construction
interface BuildEntryFromClassInput {
  readonly decl: ClassDeclaration;
  readonly tags: ParsedPipeTags;
  readonly filePath: string;
  readonly sourceFile: SourceFile;
}

type BuildEntryResult = { readonly kind: 'ok'; readonly entry: ExtractedPipeEntry; readonly warnings: readonly PipeExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly PipeExtractWarning[] };

function buildEntryFromClass(input: BuildEntryFromClassInput): BuildEntryResult {
  const { decl, tags, filePath } = input;
  const className = decl.getName() ?? '<anonymous>';
  const line = decl.getStartLineNumber();
  const warnings: PipeExtractWarning[] = [];

  if (tags.slug === undefined || tags.slug.length === 0) {
    warnings.push({ kind: 'missing-required-tag', className, tag: PIPE_SLUG_TAG, filePath, line });
    return { kind: 'skipped', warnings };
  }
  if (tags.category === undefined || tags.category.length === 0) {
    warnings.push({ kind: 'missing-required-tag', className, tag: PIPE_CATEGORY_TAG, filePath, line });
    return { kind: 'skipped', warnings };
  }
  if (!VALID_CATEGORIES.has(tags.category)) {
    warnings.push({ kind: 'unknown-category', className, category: tags.category, filePath, line });
    return { kind: 'skipped', warnings };
  }
  const category = tags.category as PipeEntry['category'];

  const decoratorInfo = readPipeDecorator(decl);
  if (decoratorInfo === undefined) {
    warnings.push({ kind: 'missing-pipe-decorator', className, filePath, line });
    return { kind: 'skipped', warnings };
  }

  const transformMethod = decl.getMethod('transform') ?? findFirstMethodNamed(decl, 'transform');
  if (transformMethod === undefined) {
    warnings.push({ kind: 'missing-transform-method', className, filePath, line });
    return { kind: 'skipped', warnings };
  }

  const classParamDescriptions = readParamDescriptionsFromJsDocs(decl.getJsDocs());
  const transformSignature = readTransformSignature(transformMethod, classParamDescriptions);
  const inputType = tags.inputTypeOverride ?? transformSignature.inputType;
  const outputType = tags.outputTypeOverride ?? transformSignature.outputType;
  const example = tags.examples.length > 0 ? tags.examples[0] : '';

  const entry: ExtractedPipeEntry = {
    slug: tags.slug,
    category,
    pipeName: decoratorInfo.name,
    className,
    inputType,
    outputType,
    purity: decoratorInfo.purity,
    description: tags.summary,
    args: transformSignature.args,
    ...(tags.relatedSlugs.length > 0 ? { relatedSlugs: tags.relatedSlugs } : {}),
    ...(tags.skillRefs.length > 0 ? { skillRefs: tags.skillRefs } : {}),
    example,
    ...(tags.deprecated !== undefined ? { deprecated: tags.deprecated } : {}),
    ...(tags.since !== undefined ? { since: tags.since } : {}),
    filePath,
    line
  };

  return { kind: 'ok', entry, warnings };
}

function findFirstMethodNamed(decl: ClassDeclaration, name: string): MethodDeclaration | undefined {
  for (const method of decl.getMethods()) {
    if (method.getName() === name) {
      return method;
    }
  }
  return undefined;
}

// MARK: @Pipe() decorator
interface PipeDecoratorInfo {
  readonly name: string;
  readonly purity: PipeEntry['purity'];
}

function readPipeDecorator(decl: ClassDeclaration): PipeDecoratorInfo | undefined {
  for (const decorator of decl.getDecorators()) {
    if (decorator.getName() !== 'Pipe') {
      continue;
    }
    return readPipeDecoratorConfig(decorator);
  }
  return undefined;
}

function readPipeDecoratorConfig(decorator: Decorator): PipeDecoratorInfo | undefined {
  const callExpr = decorator.getCallExpression();
  if (callExpr === undefined) {
    return undefined;
  }
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return undefined;
  }
  const firstArg = args[0];
  if (!Node.isObjectLiteralExpression(firstArg)) {
    return undefined;
  }
  const name = readStringProperty(firstArg, 'name');
  if (name === undefined) {
    return undefined;
  }
  const pureLiteral = readBooleanProperty(firstArg, 'pure');
  const purity: PipeEntry['purity'] = pureLiteral === false ? 'impure' : 'pure';
  return { name, purity };
}

function readBooleanProperty(obj: ObjectLiteralExpression, propName: string): boolean | undefined {
  const prop = obj.getProperty(propName);
  if (prop === undefined || !Node.isPropertyAssignment(prop)) {
    return undefined;
  }
  const initializer = prop.getInitializer();
  if (initializer === undefined) {
    return undefined;
  }
  const text = initializer.getText();
  let result: boolean | undefined;
  if (text === 'true') {
    result = true;
  } else if (text === 'false') {
    result = false;
  }
  return result;
}

// MARK: transform() signature
interface TransformSignature {
  readonly inputType: string;
  readonly outputType: string;
  readonly args: readonly PipeArgEntry[];
}

function readTransformSignature(method: MethodDeclaration, fallbackParamDescriptions: ReadonlyMap<string, string>): TransformSignature {
  const params = method.getParameters();
  const inputParam = params[0];
  const inputType = inputParam ? readParamType(inputParam) : 'unknown';
  const outputType = method.getReturnTypeNode()?.getText() ?? inferReturnTypeText(method);

  const methodParamDescriptions = readParamDescriptionsFromJsDocs(method.getJsDocs());
  const args: PipeArgEntry[] = [];
  for (let i = 1; i < params.length; i += 1) {
    const param = params[i];
    const name = param.getName();
    const type = readParamType(param);
    const description = methodParamDescriptions.get(name) ?? fallbackParamDescriptions.get(name) ?? '';
    const required = !param.isOptional() && !param.hasInitializer();
    args.push({ name, type, description, required });
  }

  return { inputType, outputType, args };
}

function readParamType(param: ParameterDeclaration): string {
  const explicit = param.getTypeNode()?.getText();
  if (explicit !== undefined && explicit.length > 0) {
    return explicit;
  }
  return param.getType().getText() || 'unknown';
}

function inferReturnTypeText(method: MethodDeclaration): string {
  const inferred = method.getReturnType().getText();
  return inferred.length > 0 ? inferred : 'unknown';
}

function readParamDescriptionsFromJsDocs(jsDocs: readonly JSDoc[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() !== 'param') {
        continue;
      }
      // ts-morph's JSDocParameterTag exposes `getName()`, but the generic JSDocTag
      // surface keeps it on the structure. Fall back to parsing the comment when
      // the typed accessor isn't available on the node.
      const tagText = tag.getCommentText()?.trim() ?? '';
      const tagName = (tag as unknown as { getName?: () => string }).getName?.() ?? extractParamName(tag.getText());
      if (tagName !== undefined && tagName.length > 0) {
        out.set(tagName, tagText);
      }
    }
  }
  return out;
}

function extractParamName(rawTag: string): string | undefined {
  const match = /@param\s+(?:\{[^}]*\}\s+)?(\S+)/.exec(rawTag);
  return match?.[1];
}
