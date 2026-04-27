/**
 * AST extraction for the `scan-filters` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * two entry shapes:
 *
 *   - Classes with `@Directive()` decorator and `@dbxFilter` JSDoc marker → directive entries
 *   - Interfaces with `@dbxFilter` JSDoc marker → pattern entries
 *
 * The kind discriminator is inferred from the AST shape — classes produce
 * `directive` entries, interfaces produce `pattern` entries — so callers
 * don't need to repeat that fact in JSDoc. JSDoc tags only supply registry
 * metadata that can't be derived from source (slug, related slugs, skill
 * refs).
 */

import { Node, SyntaxKind, type ClassDeclaration, type Decorator, type InterfaceDeclaration, type JSDoc, type ObjectLiteralExpression, type Project, type PropertyDeclaration } from 'ts-morph';
import type { FilterInputEntry } from '../manifest/filters-schema.js';

// MARK: Tag names
const FILTER_MARKER = 'dbxFilter';
const FILTER_SLUG_TAG = 'dbxFilterSlug';
const FILTER_RELATED_TAG = 'dbxFilterRelated';
const FILTER_SKILL_REFS_TAG = 'dbxFilterSkillRefs';

// MARK: Public types
/**
 * One directive entry extracted from a source file. `module`, `sourcePath`,
 * and `sourceLocation.file` are recomputed by the build phase.
 */
export interface ExtractedFilterDirective {
  readonly kind: 'directive';
  readonly slug: string;
  readonly selector: string;
  readonly className: string;
  readonly description: string;
  readonly inputs: readonly FilterInputEntry[];
  readonly outputs: readonly FilterInputEntry[];
  readonly relatedSlugs?: readonly string[];
  readonly skillRefs?: readonly string[];
  readonly example: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * One pattern entry extracted from a source file (interface declaration).
 */
export interface ExtractedFilterPattern {
  readonly kind: 'pattern';
  readonly slug: string;
  readonly className: string;
  readonly description: string;
  readonly relatedSlugs?: readonly string[];
  readonly skillRefs?: readonly string[];
  readonly example: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Discriminated union of every filter entry shape.
 */
export type ExtractedFilterEntry = ExtractedFilterDirective | ExtractedFilterPattern;

/**
 * Discriminated union of the non-fatal events the extractor emits when an
 * entry can't be assembled. Build-manifest collates these into a structured
 * warning array so missing/invalid tag combinations surface during
 * generation rather than silently dropping entries.
 */
export type FilterExtractWarning = { readonly kind: 'missing-required-tag'; readonly className: string; readonly tag: string; readonly filePath: string; readonly line: number } | { readonly kind: 'directive-missing-decorator'; readonly className: string; readonly filePath: string; readonly line: number };

/**
 * Input to {@link extractFilterEntries}. The caller is responsible for adding
 * source files to `project`.
 */
export interface ExtractFilterEntriesInput {
  readonly project: Project;
}

/**
 * Result of {@link extractFilterEntries}.
 */
export interface ExtractFilterEntriesResult {
  readonly entries: readonly ExtractedFilterEntry[];
  readonly warnings: readonly FilterExtractWarning[];
}

// MARK: Entry point
/**
 * Walks the supplied project and returns every entry tagged with the
 * `@dbxFilter` JSDoc marker. Order is stable: source files in the order
 * ts-morph reports them, declarations within a file in source order
 * (classes before interfaces is not guaranteed — both share the file's
 * declaration order through ts-morph's class/interface accessors).
 *
 * @param input - the ts-morph project to scan
 * @returns the extracted entries plus any non-fatal warnings
 */
export function extractFilterEntries(input: ExtractFilterEntriesInput): ExtractFilterEntriesResult {
  const { project } = input;
  const entries: ExtractedFilterEntry[] = [];
  const warnings: FilterExtractWarning[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    for (const decl of sourceFile.getClasses()) {
      if (!decl.isExported()) {
        continue;
      }
      const tags = readEntryTags(decl.getJsDocs());
      if (!tags.hasMarker) {
        continue;
      }
      const built = buildDirectiveEntry({ decl, tags, filePath });
      if (built.kind === 'ok') {
        entries.push(built.entry);
      }
      for (const w of built.warnings) {
        warnings.push(w);
      }
    }
    for (const decl of sourceFile.getInterfaces()) {
      if (!decl.isExported()) {
        continue;
      }
      const tags = readEntryTags(decl.getJsDocs());
      if (!tags.hasMarker) {
        continue;
      }
      const built = buildPatternEntry({ decl, tags, filePath });
      if (built.kind === 'ok') {
        entries.push(built.entry);
      }
      for (const w of built.warnings) {
        warnings.push(w);
      }
    }
  }

  return { entries, warnings };
}

// MARK: JSDoc parsing
interface ParsedFilterTags {
  readonly hasMarker: boolean;
  readonly summary: string;
  readonly slug?: string;
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly examples: readonly string[];
  readonly deprecated?: boolean | string;
  readonly since?: string;
}

interface MutableTagState {
  hasMarker: boolean;
  readonly summaries: string[];
  slug: string | undefined;
  readonly relatedSlugs: string[];
  readonly skillRefs: string[];
  readonly examples: string[];
  deprecated: boolean | string | undefined;
  since: string | undefined;
}

function readEntryTags(jsDocs: readonly JSDoc[]): ParsedFilterTags {
  const state: MutableTagState = {
    hasMarker: false,
    summaries: [],
    slug: undefined,
    relatedSlugs: [],
    skillRefs: [],
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
    slug: state.slug,
    relatedSlugs: state.relatedSlugs,
    skillRefs: state.skillRefs,
    examples: state.examples,
    deprecated: state.deprecated,
    since: state.since
  };
}

function applyJsDocTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case FILTER_MARKER:
      state.hasMarker = true;
      break;
    case FILTER_SLUG_TAG:
      state.slug = text;
      break;
    case FILTER_RELATED_TAG:
      for (const slug of splitListTagText(text)) {
        state.relatedSlugs.push(slug);
      }
      break;
    case FILTER_SKILL_REFS_TAG:
      for (const ref of splitListTagText(text)) {
        state.skillRefs.push(ref);
      }
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

function unwrapFenced(text: string): string {
  const trimmed = text.trim();
  const match = /^```[a-zA-Z]*\n([\s\S]*?)\n```\s*$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

// MARK: Class entry construction
type BuildResult<T> = { readonly kind: 'ok'; readonly entry: T; readonly warnings: readonly FilterExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly FilterExtractWarning[] };

function buildDirectiveEntry(input: { readonly decl: ClassDeclaration; readonly tags: ParsedFilterTags; readonly filePath: string }): BuildResult<ExtractedFilterDirective> {
  const { decl, tags, filePath } = input;
  const className = decl.getName() ?? '<anonymous>';
  const line = decl.getStartLineNumber();
  const warnings: FilterExtractWarning[] = [];

  if (tags.slug === undefined || tags.slug.length === 0) {
    warnings.push({ kind: 'missing-required-tag', className, tag: FILTER_SLUG_TAG, filePath, line });
    return { kind: 'skipped', warnings };
  }

  const directiveInfo = readDirectiveDecorator(decl);
  if (directiveInfo === undefined) {
    warnings.push({ kind: 'directive-missing-decorator', className, filePath, line });
    return { kind: 'skipped', warnings };
  }

  const example = tags.examples.length > 0 ? tags.examples[0] : '';
  const entry: ExtractedFilterDirective = {
    kind: 'directive',
    slug: tags.slug,
    selector: directiveInfo.selector,
    className,
    description: tags.summary,
    inputs: extractInputs(decl),
    outputs: extractOutputs(decl),
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

function buildPatternEntry(input: { readonly decl: InterfaceDeclaration; readonly tags: ParsedFilterTags; readonly filePath: string }): BuildResult<ExtractedFilterPattern> {
  const { decl, tags, filePath } = input;
  const className = decl.getName();
  const line = decl.getStartLineNumber();
  const warnings: FilterExtractWarning[] = [];

  if (tags.slug === undefined || tags.slug.length === 0) {
    warnings.push({ kind: 'missing-required-tag', className, tag: FILTER_SLUG_TAG, filePath, line });
    return { kind: 'skipped', warnings };
  }

  const example = tags.examples.length > 0 ? tags.examples[0] : '';
  const entry: ExtractedFilterPattern = {
    kind: 'pattern',
    slug: tags.slug,
    className,
    description: tags.summary,
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

// MARK: @Directive() decorator
function readDirectiveDecorator(decl: ClassDeclaration): { readonly selector: string } | undefined {
  for (const decorator of decl.getDecorators()) {
    const name = decorator.getName();
    if (name !== 'Directive' && name !== 'Component') {
      continue;
    }
    const selector = readSelector(decorator);
    if (selector !== undefined) {
      return { selector };
    }
  }
  return undefined;
}

function readSelector(decorator: Decorator): string | undefined {
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
  return readStringProperty(firstArg, 'selector');
}

function readStringProperty(obj: ObjectLiteralExpression, propName: string): string | undefined {
  const prop = obj.getProperty(propName);
  if (prop === undefined || !Node.isPropertyAssignment(prop)) {
    return undefined;
  }
  const initializer = prop.getInitializer();
  if (initializer === undefined) {
    return undefined;
  }
  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText();
  }
  return undefined;
}

// MARK: @Input / input() / @Output / output()
function extractInputs(decl: ClassDeclaration): readonly FilterInputEntry[] {
  const out: FilterInputEntry[] = [];
  const seen = new Set<string>();
  for (const property of decl.getProperties()) {
    if (!isVisible(property)) continue;
    const built = readDecoratorInput(property) ?? readSignalInput(property);
    if (built !== undefined && !seen.has(built.name)) {
      seen.add(built.name);
      out.push(built);
    }
  }
  return out;
}

function readDecoratorInput(property: PropertyDeclaration): FilterInputEntry | undefined {
  const decorator = property.getDecorator('Input');
  if (decorator === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const decoratorArg = decorator.getCallExpression()?.getArguments()[0];
  let alias: string | undefined;
  if (decoratorArg !== undefined) {
    if (Node.isStringLiteral(decoratorArg) || Node.isNoSubstitutionTemplateLiteral(decoratorArg)) {
      alias = decoratorArg.getLiteralText();
    } else if (Node.isObjectLiteralExpression(decoratorArg)) {
      alias = readStringProperty(decoratorArg, 'alias');
    }
  }
  const type = property.getTypeNode()?.getText() ?? 'unknown';
  return {
    name: alias ?? propertyName,
    type,
    description: readPropertyDescription(property)
  };
}

function readSignalInput(property: PropertyDeclaration): FilterInputEntry | undefined {
  const initializer = property.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) {
    return undefined;
  }
  const expression = initializer.getExpression();
  let isInput = false;
  if (Node.isIdentifier(expression) && expression.getText() === 'input') {
    isInput = true;
  } else if (Node.isPropertyAccessExpression(expression)) {
    const baseExpr = expression.getExpression();
    if (Node.isIdentifier(baseExpr) && baseExpr.getText() === 'input' && expression.getName() === 'required') {
      isInput = true;
    }
  }
  if (!isInput) return undefined;

  const propertyName = property.getName();
  const typeArgs = initializer.getTypeArguments();
  const inferredType = typeArgs.length > 0 ? typeArgs[0].getText() : 'unknown';
  const args = initializer.getArguments();
  let alias: string | undefined;
  // For `input(default, options)` the alias lives on the second argument's
  // object literal. For `input.required(options)` it lives on the first.
  if (Node.isIdentifier(expression)) {
    if (args.length > 1 && Node.isObjectLiteralExpression(args[1])) {
      alias = readStringProperty(args[1], 'alias');
    }
  } else if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
    alias = readStringProperty(args[0], 'alias');
  }
  return {
    name: alias ?? propertyName,
    type: inferredType,
    description: readPropertyDescription(property)
  };
}

function extractOutputs(decl: ClassDeclaration): readonly FilterInputEntry[] {
  const out: FilterInputEntry[] = [];
  const seen = new Set<string>();
  for (const property of decl.getProperties()) {
    if (!isVisible(property)) continue;
    const built = readDecoratorOutput(property) ?? readSignalOutput(property);
    if (built !== undefined && !seen.has(built.name)) {
      seen.add(built.name);
      out.push(built);
    }
  }
  return out;
}

function readDecoratorOutput(property: PropertyDeclaration): FilterInputEntry | undefined {
  const decorator = property.getDecorator('Output');
  if (decorator === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const decoratorArg = decorator.getCallExpression()?.getArguments()[0];
  let alias: string | undefined;
  if (decoratorArg !== undefined && (Node.isStringLiteral(decoratorArg) || Node.isNoSubstitutionTemplateLiteral(decoratorArg))) {
    alias = decoratorArg.getLiteralText();
  }
  const initializer = property.getInitializer();
  let type = 'unknown';
  if (initializer !== undefined && Node.isNewExpression(initializer)) {
    const typeArgs = initializer.getTypeArguments();
    if (typeArgs.length > 0) type = typeArgs[0].getText();
  } else {
    const explicit = property.getTypeNode()?.getText();
    if (explicit !== undefined) type = explicit;
  }
  return {
    name: alias ?? propertyName,
    type,
    description: readPropertyDescription(property)
  };
}

function readSignalOutput(property: PropertyDeclaration): FilterInputEntry | undefined {
  const initializer = property.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) return undefined;
  const expression = initializer.getExpression();
  if (!Node.isIdentifier(expression) || expression.getText() !== 'output') return undefined;
  const typeArgs = initializer.getTypeArguments();
  const type = typeArgs.length > 0 ? typeArgs[0].getText() : 'void';
  const args = initializer.getArguments();
  let alias: string | undefined;
  if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
    alias = readStringProperty(args[0], 'alias');
  }
  return {
    name: alias ?? property.getName(),
    type,
    description: readPropertyDescription(property)
  };
}

function isVisible(property: PropertyDeclaration): boolean {
  if (property.hasModifier(SyntaxKind.PrivateKeyword) || property.hasModifier(SyntaxKind.ProtectedKeyword)) {
    return false;
  }
  return true;
}

function readPropertyDescription(property: PropertyDeclaration): string {
  const summaries: string[] = [];
  for (const jsDoc of property.getJsDocs()) {
    const desc = jsDoc.getDescription().trim();
    if (desc.length > 0) summaries.push(desc);
  }
  return summaries.join('\n\n');
}
