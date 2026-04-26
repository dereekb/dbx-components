/**
 * AST extraction for the `scan-ui-components` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * top-level exported class declarations tagged with the `@dbxWebComponent`
 * JSDoc marker. Each match is normalised into an {@link ExtractedUiEntry}
 * that {@link buildUiComponentsManifest} will assemble into a
 * `UiComponentManifest` entry.
 *
 * Decorator metadata, signal `input()`/`output()` calls, and `@Input()`/
 * `@Output()` decorated properties are auto-extracted; JSDoc tags only
 * supply registry metadata that can't be derived from source (slug,
 * category, related slugs, skill refs, content projection summary).
 */

import { type } from 'arktype';
import { Node, SyntaxKind, type CallExpression, type ClassDeclaration, type Decorator, type JSDoc, type ObjectLiteralExpression, type Project, type PropertyDeclaration, type SourceFile } from 'ts-morph';
import { type UiComponentEntry, type UiComponentInputEntry, type UiComponentOutputEntry } from '../manifest/ui-components-schema.js';

// MARK: Tag names
const UI_COMPONENT_MARKER = 'dbxWebComponent';
const UI_SLUG_TAG = 'dbxWebSlug';
const UI_CATEGORY_TAG = 'dbxWebCategory';
const UI_KIND_TAG = 'dbxWebKind';
const UI_CONTENT_PROJECTION_TAG = 'dbxWebContentProjection';
const UI_RELATED_TAG = 'dbxWebRelated';
const UI_SKILL_REFS_TAG = 'dbxWebSkillRefs';
const UI_MINIMAL_EXAMPLE_TAG = 'dbxWebMinimalExample';
const UI_INPUT_NAME_TAG = 'dbxWebInputName';
const UI_INPUT_TYPE_TAG = 'dbxWebInputType';
const UI_INPUT_REQUIRED_TAG = 'dbxWebInputRequired';

// MARK: Public types
/**
 * One UI entry extracted from a source file. Mirrors {@link UiComponentEntry}
 * minus `module` (derived from the package being scanned in build-manifest)
 * and `sourcePath` (recomputed against the project root in build-manifest).
 */
export interface ExtractedUiEntry {
  readonly slug: string;
  readonly category: UiComponentEntry['category'];
  readonly kind: UiComponentEntry['kind'];
  readonly selector: string;
  readonly className: string;
  readonly description: string;
  readonly inputs: readonly UiComponentInputEntry[];
  readonly outputs: readonly UiComponentOutputEntry[];
  readonly contentProjection?: string;
  readonly relatedSlugs?: readonly string[];
  readonly skillRefs?: readonly string[];
  readonly example?: string;
  readonly minimalExample?: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Discriminated union of the non-fatal events the extractor emits when an
 * entry can't be assembled. The caller (build-manifest) collates these
 * into a structured warning array so missing/invalid tag combinations
 * surface during generation rather than silently dropping entries.
 */
export type ExtractWarning = { readonly kind: 'missing-required-tag'; readonly className: string; readonly tag: string; readonly filePath: string; readonly line: number } | { readonly kind: 'unknown-category'; readonly className: string; readonly category: string; readonly filePath: string; readonly line: number } | { readonly kind: 'unknown-kind'; readonly className: string; readonly kindValue: string; readonly filePath: string; readonly line: number };

/**
 * Input to {@link extractUiEntries}. The caller is responsible for adding
 * source files to `project` (either from disk, in-memory fixtures, or a
 * tsconfig).
 */
export interface ExtractUiEntriesInput {
  readonly project: Project;
}

/**
 * Result of {@link extractUiEntries}.
 */
export interface ExtractUiEntriesResult {
  readonly entries: readonly ExtractedUiEntry[];
  readonly warnings: readonly ExtractWarning[];
}

// MARK: Vocabularies
const VALID_CATEGORIES: ReadonlySet<string> = new Set(['layout', 'list', 'button', 'card', 'feedback', 'overlay', 'navigation', 'text', 'screen', 'action', 'router', 'misc']);
const VALID_KINDS: ReadonlySet<string> = new Set(['component', 'directive', 'pipe', 'service']);

// MARK: Entry point
/**
 * Walks the supplied project and returns every class tagged with the
 * `@dbxWebComponent` JSDoc marker. Order is stable: source files in the
 * order ts-morph reports them, declarations within a file in source
 * order.
 *
 * @param input - the ts-morph project to scan
 * @returns the extracted entries plus any non-fatal warnings
 */
export function extractUiEntries(input: ExtractUiEntriesInput): ExtractUiEntriesResult {
  const { project } = input;
  const entries: ExtractedUiEntry[] = [];
  const warnings: ExtractWarning[] = [];

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
interface ParsedUiTags {
  readonly hasMarker: boolean;
  readonly summary: string;
  readonly slug?: string;
  readonly category?: string;
  readonly kind?: string;
  readonly contentProjection?: string;
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly examples: readonly string[];
  readonly minimalExample?: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
}

interface MutableTagState {
  hasMarker: boolean;
  readonly summaries: string[];
  slug: string | undefined;
  category: string | undefined;
  kind: string | undefined;
  contentProjection: string | undefined;
  readonly relatedSlugs: string[];
  readonly skillRefs: string[];
  readonly examples: string[];
  minimalExample: string | undefined;
  deprecated: boolean | string | undefined;
  since: string | undefined;
}

function readJsDocTags(jsDocs: readonly JSDoc[]): ParsedUiTags {
  const state: MutableTagState = {
    hasMarker: false,
    summaries: [],
    slug: undefined,
    category: undefined,
    kind: undefined,
    contentProjection: undefined,
    relatedSlugs: [],
    skillRefs: [],
    examples: [],
    minimalExample: undefined,
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
    kind: state.kind,
    contentProjection: state.contentProjection,
    relatedSlugs: state.relatedSlugs,
    skillRefs: state.skillRefs,
    examples: state.examples,
    minimalExample: state.minimalExample,
    deprecated: state.deprecated,
    since: state.since
  };
}

function applyJsDocTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case UI_COMPONENT_MARKER:
      state.hasMarker = true;
      break;
    case UI_SLUG_TAG:
      state.slug = text;
      break;
    case UI_CATEGORY_TAG:
      state.category = text;
      break;
    case UI_KIND_TAG:
      state.kind = text;
      break;
    case UI_CONTENT_PROJECTION_TAG:
      state.contentProjection = text;
      break;
    case UI_RELATED_TAG:
      for (const slug of splitListTagText(text)) {
        state.relatedSlugs.push(slug);
      }
      break;
    case UI_SKILL_REFS_TAG:
      for (const ref of splitListTagText(text)) {
        state.skillRefs.push(ref);
      }
      break;
    case UI_MINIMAL_EXAMPLE_TAG:
      state.minimalExample = unwrapFenced(text);
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
interface BuildEntryFromClassInput {
  readonly decl: ClassDeclaration;
  readonly tags: ParsedUiTags;
  readonly filePath: string;
  readonly sourceFile: SourceFile;
}

type BuildEntryResult = { readonly kind: 'ok'; readonly entry: ExtractedUiEntry; readonly warnings: readonly ExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly ExtractWarning[] };

function buildEntryFromClass(input: BuildEntryFromClassInput): BuildEntryResult {
  const { decl, tags, filePath } = input;
  const className = decl.getName() ?? '<anonymous>';
  const line = decl.getStartLineNumber();
  const warnings: ExtractWarning[] = [];

  const requiredTagsCheck = checkRequiredTags({ tags, className, filePath, line });
  warnings.push(...requiredTagsCheck.warnings);
  if (requiredTagsCheck.kind === 'fail') {
    return { kind: 'skipped', warnings };
  }
  const { slug, categoryRaw } = requiredTagsCheck;

  if (!VALID_CATEGORIES.has(categoryRaw)) {
    warnings.push({ kind: 'unknown-category', className, category: categoryRaw, filePath, line });
    return { kind: 'skipped', warnings };
  }
  const category = categoryRaw as UiComponentEntry['category'];

  const decoratorInfo = readAngularDecorator(decl);
  const kindRaw = tags.kind ?? decoratorInfo.kind;
  if (kindRaw === undefined) {
    warnings.push({ kind: 'missing-required-tag', className, tag: UI_KIND_TAG, filePath, line });
    return { kind: 'skipped', warnings };
  }
  if (!VALID_KINDS.has(kindRaw)) {
    warnings.push({ kind: 'unknown-kind', className, kindValue: kindRaw, filePath, line });
    return { kind: 'skipped', warnings };
  }
  const kind = kindRaw as UiComponentEntry['kind'];

  const selector = decoratorInfo.selector ?? '';

  const inputs = extractInputs(decl);
  const outputs = extractOutputs(decl);
  const contentProjection = tags.contentProjection ?? decoratorInfo.contentProjectionFromTemplate;
  const example = tags.examples.length > 0 ? tags.examples[0] : undefined;

  const entry: ExtractedUiEntry = {
    slug,
    category,
    kind,
    selector,
    className,
    description: tags.summary,
    inputs,
    outputs,
    ...(contentProjection !== undefined ? { contentProjection } : {}),
    ...(tags.relatedSlugs.length > 0 ? { relatedSlugs: tags.relatedSlugs } : {}),
    ...(tags.skillRefs.length > 0 ? { skillRefs: tags.skillRefs } : {}),
    ...(example !== undefined ? { example } : {}),
    ...(tags.minimalExample !== undefined ? { minimalExample: tags.minimalExample } : {}),
    ...(tags.deprecated !== undefined ? { deprecated: tags.deprecated } : {}),
    ...(tags.since !== undefined ? { since: tags.since } : {}),
    filePath,
    line
  };

  return { kind: 'ok', entry, warnings };
}

interface CheckRequiredTagsInput {
  readonly tags: ParsedUiTags;
  readonly className: string;
  readonly filePath: string;
  readonly line: number;
}

type CheckRequiredTagsResult = { readonly kind: 'ok'; readonly slug: string; readonly categoryRaw: string; readonly warnings: readonly ExtractWarning[] } | { readonly kind: 'fail'; readonly warnings: readonly ExtractWarning[] };

function checkRequiredTags(input: CheckRequiredTagsInput): CheckRequiredTagsResult {
  const { tags, className, filePath, line } = input;
  const warnings: ExtractWarning[] = [];
  if (tags.slug === undefined || tags.slug.length === 0) {
    warnings.push({ kind: 'missing-required-tag', className, tag: UI_SLUG_TAG, filePath, line });
  }
  if (tags.category === undefined || tags.category.length === 0) {
    warnings.push({ kind: 'missing-required-tag', className, tag: UI_CATEGORY_TAG, filePath, line });
  }
  let result: CheckRequiredTagsResult;
  if (tags.slug === undefined || tags.slug.length === 0 || tags.category === undefined || tags.category.length === 0) {
    result = { kind: 'fail', warnings };
  } else {
    result = { kind: 'ok', slug: tags.slug, categoryRaw: tags.category, warnings };
  }
  return result;
}

// MARK: Angular decorator inspection
interface AngularDecoratorInfo {
  readonly kind?: UiComponentEntry['kind'];
  readonly selector?: string;
  readonly contentProjectionFromTemplate?: string;
}

function readAngularDecorator(decl: ClassDeclaration): AngularDecoratorInfo {
  const decorators = decl.getDecorators();
  let info: AngularDecoratorInfo = {};
  for (const decorator of decorators) {
    const name = decorator.getName();
    const inferredKind = mapDecoratorNameToKind(name);
    if (inferredKind === undefined) {
      continue;
    }
    const config = readDecoratorConfig(decorator);
    info = {
      kind: inferredKind,
      selector: config.selector,
      contentProjectionFromTemplate: config.contentProjectionFromTemplate
    };
    break;
  }
  return info;
}

function mapDecoratorNameToKind(name: string): UiComponentEntry['kind'] | undefined {
  let result: UiComponentEntry['kind'] | undefined;
  switch (name) {
    case 'Component':
      result = 'component';
      break;
    case 'Directive':
      result = 'directive';
      break;
    case 'Pipe':
      result = 'pipe';
      break;
    case 'Injectable':
      result = 'service';
      break;
    default:
      result = undefined;
      break;
  }
  return result;
}

interface DecoratorConfig {
  readonly selector?: string;
  readonly contentProjectionFromTemplate?: string;
}

function readDecoratorConfig(decorator: Decorator): DecoratorConfig {
  const callExpr = decorator.getCallExpression();
  if (callExpr === undefined) {
    return {};
  }
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return {};
  }
  const firstArg = args[0];
  if (!Node.isObjectLiteralExpression(firstArg)) {
    return {};
  }
  const config: DecoratorConfig = {
    selector: readStringProperty(firstArg, 'selector') ?? readStringProperty(firstArg, 'name'),
    contentProjectionFromTemplate: detectContentProjection(firstArg)
  };
  return config;
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
  let result: string | undefined;
  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    result = initializer.getLiteralText();
  }
  return result;
}

function detectContentProjection(obj: ObjectLiteralExpression): string | undefined {
  const template = readStringProperty(obj, 'template');
  if (template === undefined) {
    return undefined;
  }
  const slots = collectNgContentSelectors(template);
  let summary: string | undefined;
  if (slots.length > 0) {
    summary = slots.map((slot) => (slot === '' ? '<ng-content></ng-content>' : `<ng-content select="${slot}"></ng-content>`)).join('; ');
  }
  return summary;
}

function collectNgContentSelectors(template: string): readonly string[] {
  const result: string[] = [];
  const regex = /<ng-content(?:\s+select=(?:"([^"]*)"|'([^']*)'))?\s*\/?>(?:<\/ng-content>)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    const selector = match[1] ?? match[2] ?? '';
    result.push(selector);
  }
  return result;
}

// MARK: Inputs
function extractInputs(decl: ClassDeclaration): readonly UiComponentInputEntry[] {
  const inputs: UiComponentInputEntry[] = [];
  const seen = new Set<string>();
  for (const property of collectClassPropertiesWithInheritance(decl)) {
    if (!isVisibleMember(property)) {
      continue;
    }
    if (hasInternalTag(property)) {
      continue;
    }
    const decoratorInput = readDecoratorInput(property);
    const signalInput = decoratorInput === undefined ? readSignalInput(property) : undefined;
    const built = decoratorInput ?? signalInput;
    if (built !== undefined && !seen.has(built.name)) {
      seen.add(built.name);
      inputs.push(built);
    }
  }
  return inputs;
}

function collectClassPropertiesWithInheritance(decl: ClassDeclaration): readonly PropertyDeclaration[] {
  const out: PropertyDeclaration[] = [];
  let current: ClassDeclaration | undefined = decl;
  const visited = new Set<ClassDeclaration>();
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    for (const property of current.getProperties()) {
      out.push(property);
    }
    current = current.getBaseClass();
  }
  return out;
}

function readDecoratorInput(property: PropertyDeclaration): UiComponentInputEntry | undefined {
  const decorator = property.getDecorator('Input');
  if (decorator === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const overrides = readPropertyOverrides(property);

  const decoratorArg = decorator.getCallExpression()?.getArguments()[0];
  let aliasFromDecorator: string | undefined;
  let requiredFromDecorator: boolean | undefined;
  if (decoratorArg !== undefined) {
    if (Node.isStringLiteral(decoratorArg) || Node.isNoSubstitutionTemplateLiteral(decoratorArg)) {
      aliasFromDecorator = decoratorArg.getLiteralText();
    } else if (Node.isObjectLiteralExpression(decoratorArg)) {
      aliasFromDecorator = readStringProperty(decoratorArg, 'alias');
      const requiredProp = decoratorArg.getProperty('required');
      if (requiredProp !== undefined && Node.isPropertyAssignment(requiredProp)) {
        const initializer = requiredProp.getInitializer();
        if (initializer !== undefined) {
          const text = initializer.getText();
          if (text === 'true') {
            requiredFromDecorator = true;
          } else if (text === 'false') {
            requiredFromDecorator = false;
          }
        }
      }
    }
  }

  const explicitType = property.getTypeNode()?.getText();
  const initializer = property.getInitializer();
  const defaultValue = initializer === undefined ? undefined : initializer.getText();
  const required = overrides.requiredOverride ?? requiredFromDecorator ?? !property.hasQuestionToken();

  const entry: UiComponentInputEntry = {
    name: overrides.nameOverride ?? aliasFromDecorator ?? propertyName,
    type: overrides.typeOverride ?? explicitType ?? 'unknown',
    description: overrides.description,
    required,
    ...(defaultValue !== undefined ? { default: defaultValue } : {})
  };
  return entry;
}

function readSignalInput(property: PropertyDeclaration): UiComponentInputEntry | undefined {
  const initializer = property.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) {
    return undefined;
  }
  const callKind = classifySignalInputCall(initializer);
  if (callKind === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const overrides = readPropertyOverrides(property);

  const typeArgs = initializer.getTypeArguments();
  const inferredType = typeArgs.length > 0 ? typeArgs[0].getText() : 'unknown';

  const args = initializer.getArguments();
  const requiredFromCall = callKind === 'required';
  let defaultValue: string | undefined;
  let alias: string | undefined;
  if (callKind === 'plain') {
    if (args.length > 0) {
      defaultValue = args[0].getText();
    }
    if (args.length > 1 && Node.isObjectLiteralExpression(args[1])) {
      alias = readStringProperty(args[1], 'alias');
    }
  } else if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
    alias = readStringProperty(args[0], 'alias');
  }

  const entry: UiComponentInputEntry = {
    name: overrides.nameOverride ?? alias ?? propertyName,
    type: overrides.typeOverride ?? inferredType,
    description: overrides.description,
    required: overrides.requiredOverride ?? requiredFromCall,
    ...(defaultValue !== undefined ? { default: defaultValue } : {})
  };
  return entry;
}

type SignalInputCallKind = 'plain' | 'required';

function classifySignalInputCall(call: CallExpression): SignalInputCallKind | undefined {
  const expression = call.getExpression();
  let result: SignalInputCallKind | undefined;
  if (Node.isIdentifier(expression) && expression.getText() === 'input') {
    result = 'plain';
  } else if (Node.isPropertyAccessExpression(expression)) {
    const baseExpr = expression.getExpression();
    const propertyName = expression.getName();
    if (Node.isIdentifier(baseExpr) && baseExpr.getText() === 'input' && propertyName === 'required') {
      result = 'required';
    }
  }
  return result;
}

// MARK: Outputs
function extractOutputs(decl: ClassDeclaration): readonly UiComponentOutputEntry[] {
  const outputs: UiComponentOutputEntry[] = [];
  const seen = new Set<string>();
  for (const property of collectClassPropertiesWithInheritance(decl)) {
    if (!isVisibleMember(property)) {
      continue;
    }
    if (hasInternalTag(property)) {
      continue;
    }
    const decoratorOutput = readDecoratorOutput(property);
    const signalOutput = decoratorOutput === undefined ? readSignalOutput(property) : undefined;
    const built = decoratorOutput ?? signalOutput;
    if (built !== undefined && !seen.has(built.name)) {
      seen.add(built.name);
      outputs.push(built);
    }
  }
  return outputs;
}

function readDecoratorOutput(property: PropertyDeclaration): UiComponentOutputEntry | undefined {
  const decorator = property.getDecorator('Output');
  if (decorator === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const description = readPropertyDescription(property);

  const decoratorArg = decorator.getCallExpression()?.getArguments()[0];
  let aliasFromDecorator: string | undefined;
  if (decoratorArg !== undefined && (Node.isStringLiteral(decoratorArg) || Node.isNoSubstitutionTemplateLiteral(decoratorArg))) {
    aliasFromDecorator = decoratorArg.getLiteralText();
  }

  const initializer = property.getInitializer();
  let emits = 'unknown';
  if (initializer !== undefined && Node.isNewExpression(initializer)) {
    const typeArgs = initializer.getTypeArguments();
    if (typeArgs.length > 0) {
      emits = typeArgs[0].getText();
    }
  } else {
    const explicitType = property.getTypeNode()?.getText();
    if (explicitType !== undefined) {
      emits = explicitType;
    }
  }

  const entry: UiComponentOutputEntry = {
    name: aliasFromDecorator ?? propertyName,
    emits,
    description
  };
  return entry;
}

function readSignalOutput(property: PropertyDeclaration): UiComponentOutputEntry | undefined {
  const initializer = property.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) {
    return undefined;
  }
  const expression = initializer.getExpression();
  if (!Node.isIdentifier(expression) || expression.getText() !== 'output') {
    return undefined;
  }
  const typeArgs = initializer.getTypeArguments();
  const emits = typeArgs.length > 0 ? typeArgs[0].getText() : 'void';
  const args = initializer.getArguments();
  let alias: string | undefined;
  if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
    alias = readStringProperty(args[0], 'alias');
  }
  const entry: UiComponentOutputEntry = {
    name: alias ?? property.getName(),
    emits,
    description: readPropertyDescription(property)
  };
  return entry;
}

// MARK: Member-level helpers
function isVisibleMember(property: PropertyDeclaration): boolean {
  if (property.hasModifier(SyntaxKind.PrivateKeyword) || property.hasModifier(SyntaxKind.ProtectedKeyword)) {
    return false;
  }
  return true;
}

function hasInternalTag(property: PropertyDeclaration): boolean {
  for (const jsDoc of property.getJsDocs()) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() === 'internal') {
        return true;
      }
    }
  }
  return false;
}

interface PropertyOverrides {
  readonly description: string;
  readonly nameOverride?: string;
  readonly typeOverride?: string;
  readonly requiredOverride?: boolean;
}

function readPropertyOverrides(property: PropertyDeclaration): PropertyOverrides {
  const summaries: string[] = [];
  let nameOverride: string | undefined;
  let typeOverride: string | undefined;
  let requiredOverride: boolean | undefined;
  let defaultText: string | undefined;
  for (const jsDoc of property.getJsDocs()) {
    const desc = jsDoc.getDescription().trim();
    if (desc.length > 0) {
      summaries.push(desc);
    }
    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      const text = tag.getCommentText()?.trim() ?? '';
      if (tagName === UI_INPUT_NAME_TAG) {
        nameOverride = text;
      } else if (tagName === UI_INPUT_TYPE_TAG) {
        typeOverride = text;
      } else if (tagName === UI_INPUT_REQUIRED_TAG) {
        requiredOverride = true;
      } else if (tagName === 'default' && text.length > 0) {
        defaultText = text;
      }
    }
  }
  // defaultText is used only if no source-level initializer is detected; the
  // call sites that consume PropertyOverrides handle defaults from
  // initializers already, so we reserve `@default` for non-initialised
  // declarations.
  void defaultText;
  return {
    description: summaries.join('\n\n'),
    ...(nameOverride !== undefined ? { nameOverride } : {}),
    ...(typeOverride !== undefined ? { typeOverride } : {}),
    ...(requiredOverride !== undefined ? { requiredOverride } : {})
  };
}

function readPropertyDescription(property: PropertyDeclaration): string {
  const summaries: string[] = [];
  for (const jsDoc of property.getJsDocs()) {
    const desc = jsDoc.getDescription().trim();
    if (desc.length > 0) {
      summaries.push(desc);
    }
  }
  return summaries.join('\n\n');
}

// MARK: Arktype runtime guard
/**
 * Arktype validator that mirrors {@link ExtractedUiEntry}. Useful for tests
 * and for runtime-validating fixture entries crafted by hand.
 */
export const ExtractedUiEntrySchema = type({
  slug: 'string',
  category: '"layout" | "list" | "button" | "card" | "feedback" | "overlay" | "navigation" | "text" | "screen" | "action" | "router" | "misc"',
  kind: '"component" | "directive" | "pipe" | "service"',
  selector: 'string',
  className: 'string',
  description: 'string',
  inputs: type({ name: 'string', type: 'string', description: 'string', required: 'boolean', 'default?': 'string' }).array(),
  outputs: type({ name: 'string', emits: 'string', description: 'string' }).array(),
  'contentProjection?': 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  'example?': 'string',
  'minimalExample?': 'string',
  'deprecated?': 'boolean | string',
  'since?': 'string',
  filePath: 'string',
  line: 'number'
});
