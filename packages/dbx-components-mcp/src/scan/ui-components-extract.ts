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
import { type ClassDeclaration, type Decorator, type JSDoc, type ObjectLiteralExpression, type Project, type PropertyDeclaration, type SourceFile, Node } from 'ts-morph';
import { type UiComponentEntry, type UiComponentInputEntry, type UiComponentOutputEntry } from '../manifest/ui-components-schema.js';
import { isVisibleProperty, readStringProperty, splitListTagText, unwrapFenced } from './scan-extract-utils.js';
import { collectClassPropertiesWithInheritance, extractAngularInputs, extractAngularOutputs } from './scan-angular-io.js';

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
    ...(contentProjection === undefined ? {} : { contentProjection }),
    ...(tags.relatedSlugs.length > 0 ? { relatedSlugs: tags.relatedSlugs } : {}),
    ...(tags.skillRefs.length > 0 ? { skillRefs: tags.skillRefs } : {}),
    ...(example === undefined ? {} : { example }),
    ...(tags.minimalExample === undefined ? {} : { minimalExample: tags.minimalExample }),
    ...(tags.deprecated === undefined ? {} : { deprecated: tags.deprecated }),
    ...(tags.since === undefined ? {} : { since: tags.since }),
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

// MARK: Inputs/outputs
function extractInputs(decl: ClassDeclaration): readonly UiComponentInputEntry[] {
  return extractAngularInputs<UiComponentInputEntry>(decl, {
    propertySource: collectClassPropertiesWithInheritance,
    skipProperty: (property) => !isVisibleProperty(property) || hasInternalTag(property),
    buildEntry: (parsed, property) => {
      const overrides = readPropertyOverrides(property);
      return {
        name: overrides.nameOverride ?? parsed.alias,
        type: overrides.typeOverride ?? parsed.type,
        description: overrides.description,
        required: overrides.requiredOverride ?? parsed.required,
        ...(parsed.defaultValue === undefined ? {} : { default: parsed.defaultValue })
      };
    },
    dedupeBy: (entry) => entry.name
  });
}

function extractOutputs(decl: ClassDeclaration): readonly UiComponentOutputEntry[] {
  return extractAngularOutputs<UiComponentOutputEntry>(decl, {
    propertySource: collectClassPropertiesWithInheritance,
    skipProperty: (property) => !isVisibleProperty(property) || hasInternalTag(property),
    buildEntry: (parsed) => ({
      name: parsed.name,
      emits: parsed.type,
      description: parsed.description
    }),
    dedupeBy: (entry) => entry.name
  });
}

// MARK: Member-level helpers
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
      }
    }
  }
  return {
    description: summaries.join('\n\n'),
    ...(nameOverride === undefined ? {} : { nameOverride }),
    ...(typeOverride === undefined ? {} : { typeOverride }),
    ...(requiredOverride === undefined ? {} : { requiredOverride })
  };
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
