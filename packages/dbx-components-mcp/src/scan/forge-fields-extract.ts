/**
 * AST extraction for the `scan-forge-fields` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * top-level exported declarations (function or `const` arrow function) tagged
 * with the `@dbxFormField` JSDoc marker. Each match is normalised into an
 * {@link ExtractedForgeFieldEntry} that {@link buildForgeFieldsManifest}
 * assembles into a `ForgeFieldManifest` entry.
 *
 * Config-interface property auto-extraction lives in this module too — given
 * a tagged factory, the scanner walks the related config interface
 * (`<FactoryName>Config` by convention or `@dbxFormConfigInterface` override)
 * and emits one {@link UiPropertyEntry}-style record per `PropertySignature`.
 * The extractor is intentionally syntactic — no type checker calls — so it
 * runs cheaply on in-memory fixtures.
 */

import { type } from 'arktype';
import { Node, type InterfaceDeclaration, type JSDoc, type Project, type PropertySignature, type SourceFile, type TypeAliasDeclaration, type TypeNode, type TypeReferenceNode, type UnionTypeNode } from 'ts-morph';
import { type ForgeFieldEntry, type ForgeFieldPropertyEntry } from '../manifest/forge-fields-schema.js';
import { splitListTagText, unwrapFenced } from './scan-extract-utils.js';

// MARK: Tag names
const FORM_FIELD_MARKER = 'dbxFormField';
const FORM_SLUG_TAG = 'dbxFormSlug';
const FORM_TIER_TAG = 'dbxFormTier';
const FORM_PRODUCES_TAG = 'dbxFormProduces';
const FORM_ARRAY_OUTPUT_TAG = 'dbxFormArrayOutput';
const FORM_NG_FORM_TYPE_TAG = 'dbxFormNgFormType';
const FORM_WRAPPER_PATTERN_TAG = 'dbxFormWrapperPattern';
const FORM_SUFFIX_TAG = 'dbxFormSuffix';
const FORM_RETURNS_TAG = 'dbxFormReturns';
const FORM_COMPOSES_FROM_TAG = 'dbxFormComposesFrom';
const FORM_CONFIG_INTERFACE_TAG = 'dbxFormConfigInterface';
const FORM_PROPS_INTERFACE_TAG = 'dbxFormPropsInterface';
const FORM_GENERIC_TAG = 'dbxFormGeneric';
const FORM_PROP_NAME_TAG = 'dbxFormPropName';
const FORM_FIELD_DERIVATIVE_TAG = 'dbxFormFieldDerivative';
const FORM_FIELD_TEMPLATE_TAG = 'dbxFormFieldTemplate';

// MARK: Public types
/**
 * One forge entry extracted from a source file. Mirrors {@link ForgeFieldEntry}
 * for the persisted fields. `filePath` and `line` are kept for in-process
 * warnings and never persisted to the manifest.
 */
export interface ExtractedForgeFieldEntry {
  readonly slug: string;
  readonly factoryName: string;
  readonly tier: ForgeFieldEntry['tier'];
  readonly produces: string;
  readonly arrayOutput: ForgeFieldEntry['arrayOutput'];
  readonly description: string;
  readonly example: string;
  readonly properties: readonly ForgeFieldPropertyEntry[];
  readonly wrapperPattern?: ForgeFieldEntry['wrapperPattern'];
  readonly ngFormType?: string;
  readonly generic?: string;
  readonly suffix?: ForgeFieldEntry['suffix'];
  readonly composesFromSlugs?: readonly string[];
  readonly returns?: string;
  readonly configInterface?: string;
  readonly propsInterface?: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Discriminated union of the non-fatal events the extractor emits when an
 * entry can't be assembled. Build-manifest collates these into a structured
 * warning array so missing/invalid tag combinations surface during generation
 * rather than silently dropping entries.
 */
export type ForgeExtractWarning =
  | { readonly kind: 'missing-required-tag'; readonly factoryName: string; readonly tag: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-tier'; readonly factoryName: string; readonly tier: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-array-output'; readonly factoryName: string; readonly arrayOutput: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-wrapper-pattern'; readonly factoryName: string; readonly wrapperPattern: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-suffix'; readonly factoryName: string; readonly suffix: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'config-interface-not-found'; readonly factoryName: string; readonly configInterfaceName: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'derivative-missing-base'; readonly factoryName: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'derivative-multiple-bases'; readonly factoryName: string; readonly providedCount: number; readonly filePath: string; readonly line: number }
  | { readonly kind: 'template-missing-slugs'; readonly factoryName: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'union-config-not-walked'; readonly factoryName: string; readonly configInterfaceName: string; readonly filePath: string; readonly line: number };

/**
 * Input to {@link extractForgeFieldEntries}. The caller is responsible for
 * adding source files to `project` (either from disk, in-memory fixtures, or
 * a tsconfig).
 */
export interface ExtractForgeFieldEntriesInput {
  readonly project: Project;
}

/**
 * Result of {@link extractForgeFieldEntries}.
 */
export interface ExtractForgeFieldEntriesResult {
  readonly entries: readonly ExtractedForgeFieldEntry[];
  readonly warnings: readonly ForgeExtractWarning[];
}

// MARK: Vocabularies
const VALID_TIERS: ReadonlySet<string> = new Set(['field-factory', 'field-derivative', 'composite-builder', 'template-builder', 'primitive']);
const VALID_ARRAY_OUTPUTS: ReadonlySet<string> = new Set(['yes', 'no', 'optional']);
const VALID_WRAPPER_PATTERNS: ReadonlySet<string> = new Set(['unwrapped', 'material-form-field-wrapped']);
const VALID_SUFFIXES: ReadonlySet<string> = new Set(['Row', 'Group', 'Fields', 'Field', 'Wrapper', 'Layout']);

// MARK: Entry point
/**
 * Walks the supplied project and returns every export tagged with the
 * `@dbxFormField` JSDoc marker. Order is stable: source files in the order
 * ts-morph reports them, declarations within a file in source order.
 *
 * @param input - the ts-morph project to scan
 * @returns the extracted entries plus any non-fatal warnings
 */
export function extractForgeFieldEntries(input: ExtractForgeFieldEntriesInput): ExtractForgeFieldEntriesResult {
  const { project } = input;
  const interfaceLookup = buildInterfaceLookup(project);
  const entries: ExtractedForgeFieldEntry[] = [];
  const warnings: ForgeExtractWarning[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const fileEntries = collectTaggedExports(sourceFile);
    for (const candidate of fileEntries) {
      const built = buildEntryFromCandidate({ candidate, filePath, interfaceLookup });
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

// MARK: Candidate collection
interface TaggedCandidate {
  readonly factoryName: string;
  readonly jsDocs: readonly JSDoc[];
  readonly line: number;
  readonly fileSourceFile: SourceFile;
}

function collectTaggedExports(sourceFile: SourceFile): readonly TaggedCandidate[] {
  const out: TaggedCandidate[] = [];
  for (const decl of sourceFile.getFunctions()) {
    if (!decl.isExported()) {
      continue;
    }
    const taggedDoc = findTaggedDocs(decl);
    const declName = decl.getName();
    if (taggedDoc.length > 0 && declName !== undefined) {
      out.push({ factoryName: declName, jsDocs: taggedDoc, line: decl.getStartLineNumber(), fileSourceFile: sourceFile });
    }
  }
  for (const stmt of sourceFile.getVariableStatements()) {
    if (!stmt.isExported()) {
      continue;
    }
    const taggedDoc = findTaggedDocs(stmt);
    if (taggedDoc.length === 0) {
      continue;
    }
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      out.push({ factoryName: name, jsDocs: taggedDoc, line: decl.getStartLineNumber(), fileSourceFile: sourceFile });
    }
  }
  return out;
}

interface NodeWithJsDocs {
  getJsDocs(): JSDoc[];
}

function findTaggedDocs(decl: NodeWithJsDocs): readonly JSDoc[] {
  const docs = decl.getJsDocs();
  let hasMarker = false;
  for (const doc of docs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === FORM_FIELD_MARKER) {
        hasMarker = true;
      }
    }
  }
  return hasMarker ? docs : [];
}

// MARK: JSDoc parsing
interface ParsedFormTags {
  readonly summary: string;
  readonly slug?: string;
  readonly tier?: string;
  readonly produces?: string;
  readonly arrayOutput?: string;
  readonly wrapperPattern?: string;
  readonly ngFormType?: string;
  readonly suffix?: string;
  readonly composesFromSlugs: readonly string[];
  readonly returns?: string;
  readonly configInterface?: string;
  readonly propsInterface?: string;
  readonly generic?: string;
  readonly examples: readonly string[];
  readonly deprecated?: boolean | string;
  readonly since?: string;
}

interface MutableTagState {
  readonly summaries: string[];
  slug: string | undefined;
  tier: string | undefined;
  produces: string | undefined;
  arrayOutput: string | undefined;
  wrapperPattern: string | undefined;
  ngFormType: string | undefined;
  suffix: string | undefined;
  readonly composesFromSlugs: string[];
  returns: string | undefined;
  configInterface: string | undefined;
  propsInterface: string | undefined;
  generic: string | undefined;
  readonly examples: string[];
  deprecated: boolean | string | undefined;
  since: string | undefined;
}

function readJsDocTags(jsDocs: readonly JSDoc[]): ParsedFormTags {
  const state: MutableTagState = {
    summaries: [],
    slug: undefined,
    tier: undefined,
    produces: undefined,
    arrayOutput: undefined,
    wrapperPattern: undefined,
    ngFormType: undefined,
    suffix: undefined,
    composesFromSlugs: [],
    returns: undefined,
    configInterface: undefined,
    propsInterface: undefined,
    generic: undefined,
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
    summary: state.summaries.join('\n\n'),
    slug: state.slug,
    tier: state.tier,
    produces: state.produces,
    arrayOutput: state.arrayOutput,
    wrapperPattern: state.wrapperPattern,
    ngFormType: state.ngFormType,
    suffix: state.suffix,
    composesFromSlugs: state.composesFromSlugs,
    returns: state.returns,
    configInterface: state.configInterface,
    propsInterface: state.propsInterface,
    generic: state.generic,
    examples: state.examples,
    deprecated: state.deprecated,
    since: state.since
  };
}

function applyJsDocTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case FORM_FIELD_MARKER:
      break;
    case FORM_SLUG_TAG:
      state.slug = text;
      break;
    case FORM_TIER_TAG:
      state.tier = text;
      break;
    case FORM_PRODUCES_TAG:
      state.produces = text;
      break;
    case FORM_ARRAY_OUTPUT_TAG:
      state.arrayOutput = text;
      break;
    case FORM_NG_FORM_TYPE_TAG:
      state.ngFormType = text;
      break;
    case FORM_WRAPPER_PATTERN_TAG:
      state.wrapperPattern = text;
      break;
    case FORM_SUFFIX_TAG:
      state.suffix = text;
      break;
    case FORM_RETURNS_TAG:
      state.returns = text;
      break;
    case FORM_COMPOSES_FROM_TAG:
      for (const slug of splitListTagText(text)) {
        state.composesFromSlugs.push(slug);
      }
      break;
    case FORM_FIELD_DERIVATIVE_TAG:
      state.tier = 'field-derivative';
      for (const slug of splitListTagText(text)) {
        state.composesFromSlugs.push(slug);
      }
      break;
    case FORM_FIELD_TEMPLATE_TAG:
      state.tier = 'template-builder';
      for (const slug of splitListTagText(text)) {
        state.composesFromSlugs.push(slug);
      }
      break;
    case FORM_CONFIG_INTERFACE_TAG:
      state.configInterface = text;
      break;
    case FORM_PROPS_INTERFACE_TAG:
      state.propsInterface = text;
      break;
    case FORM_GENERIC_TAG:
      state.generic = text;
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

// MARK: Entry construction
interface BuildEntryFromCandidateInput {
  readonly candidate: TaggedCandidate;
  readonly filePath: string;
  readonly interfaceLookup: InterfaceLookup;
}

type BuildEntryResult = { readonly kind: 'ok'; readonly entry: ExtractedForgeFieldEntry; readonly warnings: readonly ForgeExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly ForgeExtractWarning[] };

function buildEntryFromCandidate(input: BuildEntryFromCandidateInput): BuildEntryResult {
  const { candidate, filePath, interfaceLookup } = input;
  const factoryName = candidate.factoryName;
  const line = candidate.line;
  const tags = readJsDocTags(candidate.jsDocs);
  const warnings: ForgeExtractWarning[] = [];

  const requiredCheck = checkRequiredTags({ tags, factoryName, filePath, line });
  warnings.push(...requiredCheck.warnings);
  if (requiredCheck.kind === 'fail') {
    return { kind: 'skipped', warnings };
  }
  const { slug, tier, produces, arrayOutput } = requiredCheck;

  const tierSpecific = readTierSpecificTags({ tags, tier, factoryName, filePath, line });
  warnings.push(...tierSpecific.warnings);
  if (tierSpecific.kind === 'fail') {
    return { kind: 'skipped', warnings };
  }

  const configInterfaceName = tags.configInterface ?? defaultConfigInterfaceName(factoryName);
  const propsInterfaceName = tags.propsInterface ?? defaultPropsInterfaceName(factoryName);
  const properties = readConfigProperties({ configInterfaceName, propsInterfaceName, propsExplicit: tags.propsInterface !== undefined, factoryName, filePath, line, interfaceLookup, warnings });

  const example = tags.examples.length > 0 ? tags.examples[0] : '';

  const entry: ExtractedForgeFieldEntry = {
    slug,
    factoryName,
    tier,
    produces,
    arrayOutput,
    description: tags.summary,
    example,
    properties,
    ...(tierSpecific.wrapperPattern === undefined ? {} : { wrapperPattern: tierSpecific.wrapperPattern }),
    ...(tierSpecific.ngFormType === undefined ? {} : { ngFormType: tierSpecific.ngFormType }),
    ...(tags.generic === undefined ? {} : { generic: tags.generic }),
    ...(tierSpecific.suffix === undefined ? {} : { suffix: tierSpecific.suffix }),
    ...(tags.composesFromSlugs.length > 0 ? { composesFromSlugs: tags.composesFromSlugs } : {}),
    ...(tierSpecific.returns === undefined ? {} : { returns: tierSpecific.returns }),
    ...(tier === 'primitive' && tags.configInterface === undefined ? {} : { configInterface: configInterfaceName }),
    ...(tags.propsInterface === undefined ? {} : { propsInterface: tags.propsInterface }),
    ...(tags.deprecated === undefined ? {} : { deprecated: tags.deprecated }),
    ...(tags.since === undefined ? {} : { since: tags.since }),
    filePath,
    line
  };

  return { kind: 'ok', entry, warnings };
}

interface CheckRequiredTagsInput {
  readonly tags: ParsedFormTags;
  readonly factoryName: string;
  readonly filePath: string;
  readonly line: number;
}

type CheckRequiredTagsResult =
  | {
      readonly kind: 'ok';
      readonly slug: string;
      readonly tier: ForgeFieldEntry['tier'];
      readonly produces: string;
      readonly arrayOutput: ForgeFieldEntry['arrayOutput'];
      readonly warnings: readonly ForgeExtractWarning[];
    }
  | { readonly kind: 'fail'; readonly warnings: readonly ForgeExtractWarning[] };

function checkRequiredTags(input: CheckRequiredTagsInput): CheckRequiredTagsResult {
  const { tags, factoryName, filePath, line } = input;
  const warnings: ForgeExtractWarning[] = [];

  if (tags.slug === undefined || tags.slug.length === 0) {
    warnings.push({ kind: 'missing-required-tag', factoryName, tag: FORM_SLUG_TAG, filePath, line });
  }
  if (tags.tier === undefined || tags.tier.length === 0) {
    warnings.push({ kind: 'missing-required-tag', factoryName, tag: FORM_TIER_TAG, filePath, line });
  }
  if (tags.produces === undefined || tags.produces.length === 0) {
    warnings.push({ kind: 'missing-required-tag', factoryName, tag: FORM_PRODUCES_TAG, filePath, line });
  }
  if (tags.arrayOutput === undefined || tags.arrayOutput.length === 0) {
    warnings.push({ kind: 'missing-required-tag', factoryName, tag: FORM_ARRAY_OUTPUT_TAG, filePath, line });
  }

  let result: CheckRequiredTagsResult;
  if (tags.slug === undefined || tags.tier === undefined || tags.produces === undefined || tags.arrayOutput === undefined || tags.slug.length === 0 || tags.tier.length === 0 || tags.produces.length === 0 || tags.arrayOutput.length === 0) {
    result = { kind: 'fail', warnings };
  } else if (VALID_TIERS.has(tags.tier)) {
    if (VALID_ARRAY_OUTPUTS.has(tags.arrayOutput)) {
      result = {
        kind: 'ok',
        slug: tags.slug,
        tier: tags.tier as ForgeFieldEntry['tier'],
        produces: tags.produces,
        arrayOutput: tags.arrayOutput as ForgeFieldEntry['arrayOutput'],
        warnings
      };
    } else {
      warnings.push({ kind: 'unknown-array-output', factoryName, arrayOutput: tags.arrayOutput, filePath, line });
      result = { kind: 'fail', warnings };
    }
  } else {
    warnings.push({ kind: 'unknown-tier', factoryName, tier: tags.tier, filePath, line });
    result = { kind: 'fail', warnings };
  }
  return result;
}

interface ReadTierSpecificInput {
  readonly tags: ParsedFormTags;
  readonly tier: ForgeFieldEntry['tier'];
  readonly factoryName: string;
  readonly filePath: string;
  readonly line: number;
}

type ReadTierSpecificResult =
  | {
      readonly kind: 'ok';
      readonly wrapperPattern?: ForgeFieldEntry['wrapperPattern'];
      readonly ngFormType?: string;
      readonly suffix?: ForgeFieldEntry['suffix'];
      readonly returns?: string;
      readonly warnings: readonly ForgeExtractWarning[];
    }
  | { readonly kind: 'fail'; readonly warnings: readonly ForgeExtractWarning[] };

interface TierEvaluation {
  readonly failed: boolean;
  readonly warnings: readonly ForgeExtractWarning[];
  readonly wrapperPattern?: ForgeFieldEntry['wrapperPattern'];
  readonly ngFormType?: string;
  readonly suffix?: ForgeFieldEntry['suffix'];
  readonly returns?: string;
}

function readTierSpecificTags(input: ReadTierSpecificInput): ReadTierSpecificResult {
  const { tags, tier } = input;

  let evaluation: TierEvaluation;
  if (tier === 'field-factory') {
    evaluation = evaluateFieldFactoryTier(input);
  } else if (tier === 'composite-builder') {
    evaluation = evaluateCompositeBuilderTier(input);
  } else if (tier === 'field-derivative') {
    evaluation = evaluateFieldDerivativeTier(input);
  } else if (tier === 'template-builder') {
    evaluation = evaluateTemplateBuilderTier(input);
  } else {
    evaluation = { failed: false, warnings: [], returns: tags.returns ?? tags.produces };
  }

  let result: ReadTierSpecificResult;
  if (evaluation.failed) {
    result = { kind: 'fail', warnings: evaluation.warnings };
  } else {
    result = {
      kind: 'ok',
      ...(evaluation.wrapperPattern === undefined ? {} : { wrapperPattern: evaluation.wrapperPattern }),
      ...(evaluation.ngFormType === undefined ? {} : { ngFormType: evaluation.ngFormType }),
      ...(evaluation.suffix === undefined ? {} : { suffix: evaluation.suffix }),
      ...(evaluation.returns === undefined ? {} : { returns: evaluation.returns }),
      warnings: evaluation.warnings
    };
  }
  return result;
}

function evaluateFieldFactoryTier(input: ReadTierSpecificInput): TierEvaluation {
  const { tags, factoryName, filePath, line } = input;
  const warnings: ForgeExtractWarning[] = [];
  let wrapperPattern: ForgeFieldEntry['wrapperPattern'] | undefined;
  let ngFormType: string | undefined;
  let failed = false;

  if (tags.wrapperPattern === undefined || tags.wrapperPattern.length === 0) {
    warnings.push({ kind: 'missing-required-tag', factoryName, tag: FORM_WRAPPER_PATTERN_TAG, filePath, line });
    failed = true;
  } else if (VALID_WRAPPER_PATTERNS.has(tags.wrapperPattern)) {
    wrapperPattern = tags.wrapperPattern as ForgeFieldEntry['wrapperPattern'];
  } else {
    warnings.push({ kind: 'unknown-wrapper-pattern', factoryName, wrapperPattern: tags.wrapperPattern, filePath, line });
    failed = true;
  }
  if (tags.ngFormType === undefined || tags.ngFormType.length === 0) {
    warnings.push({ kind: 'missing-required-tag', factoryName, tag: FORM_NG_FORM_TYPE_TAG, filePath, line });
    failed = true;
  } else {
    ngFormType = tags.ngFormType;
  }

  return { failed, warnings, wrapperPattern, ngFormType };
}

function evaluateCompositeBuilderTier(input: ReadTierSpecificInput): TierEvaluation {
  const { tags, factoryName, filePath, line } = input;
  const warnings: ForgeExtractWarning[] = [];
  let suffix: ForgeFieldEntry['suffix'] | undefined;
  let failed = false;

  if (tags.suffix === undefined || tags.suffix.length === 0) {
    warnings.push({ kind: 'missing-required-tag', factoryName, tag: FORM_SUFFIX_TAG, filePath, line });
    failed = true;
  } else if (VALID_SUFFIXES.has(tags.suffix)) {
    suffix = tags.suffix as ForgeFieldEntry['suffix'];
  } else {
    warnings.push({ kind: 'unknown-suffix', factoryName, suffix: tags.suffix, filePath, line });
    failed = true;
  }

  return { failed, warnings, suffix };
}

function evaluateFieldDerivativeTier(input: ReadTierSpecificInput): TierEvaluation {
  const { tags, factoryName, filePath, line } = input;
  const warnings: ForgeExtractWarning[] = [];
  let failed = false;

  if (tags.composesFromSlugs.length === 0) {
    warnings.push({ kind: 'derivative-missing-base', factoryName, filePath, line });
    failed = true;
  } else if (tags.composesFromSlugs.length > 1) {
    warnings.push({ kind: 'derivative-multiple-bases', factoryName, providedCount: tags.composesFromSlugs.length, filePath, line });
  }

  return { failed, warnings };
}

function evaluateTemplateBuilderTier(input: ReadTierSpecificInput): TierEvaluation {
  const { tags, factoryName, filePath, line } = input;
  const warnings: ForgeExtractWarning[] = [];
  let failed = false;

  if (tags.composesFromSlugs.length === 0) {
    warnings.push({ kind: 'template-missing-slugs', factoryName, filePath, line });
    failed = true;
  }

  return { failed, warnings };
}

// MARK: Config interface lookup
type InterfaceLookup = ReadonlyMap<string, InterfaceDeclaration | TypeAliasDeclaration>;

function buildInterfaceLookup(project: Project): InterfaceLookup {
  const out = new Map<string, InterfaceDeclaration | TypeAliasDeclaration>();
  for (const sourceFile of project.getSourceFiles()) {
    for (const iface of sourceFile.getInterfaces()) {
      const name = iface.getName();
      if (!out.has(name)) {
        out.set(name, iface);
      }
    }
    for (const alias of sourceFile.getTypeAliases()) {
      const name = alias.getName();
      if (!out.has(name)) {
        out.set(name, alias);
      }
    }
  }
  return out;
}

interface ReadConfigPropertiesInput {
  readonly configInterfaceName: string;
  readonly propsInterfaceName?: string;
  readonly propsExplicit?: boolean;
  readonly factoryName: string;
  readonly filePath: string;
  readonly line: number;
  readonly interfaceLookup: InterfaceLookup;
  readonly warnings: ForgeExtractWarning[];
}

function readConfigProperties(input: ReadConfigPropertiesInput): readonly ForgeFieldPropertyEntry[] {
  const { configInterfaceName, propsInterfaceName, propsExplicit, factoryName, filePath, line, interfaceLookup, warnings } = input;
  const configBase = stripGenericArgs(configInterfaceName);

  const configFound = interfaceLookup.has(configBase);
  if (!configFound && configInterfaceName.length > 0) {
    warnings.push({ kind: 'config-interface-not-found', factoryName, configInterfaceName: configBase, filePath, line });
  }

  const baseSink: CollectWarningSink = { warnings, factoryName, configInterfaceName: configBase, filePath, line };
  const baseContext: CollectContext = { interfaceLookup, visited: new Set(), omit: new Set(), pick: null, forceOptional: false, warningSink: baseSink };
  const configProperties = collectFromInterfaceName(configBase, baseContext);

  // Look up Props interface and merge with " (props)" suffix on the name.
  // When propsExplicit is true, warn if the named interface isn't found.
  // When auto-detecting (convention default), silently skip missing interfaces.
  let propsProperties: readonly ForgeFieldPropertyEntry[] = [];
  if (propsInterfaceName !== undefined && propsInterfaceName.length > 0) {
    const propsBase = stripGenericArgs(propsInterfaceName);
    if (interfaceLookup.has(propsBase)) {
      const propsSink: CollectWarningSink = { warnings, factoryName, configInterfaceName: propsBase, filePath, line };
      const propsContext: CollectContext = { interfaceLookup, visited: new Set(), omit: new Set(), pick: null, forceOptional: false, warningSink: propsSink };
      const collected = collectFromInterfaceName(propsBase, propsContext);
      propsProperties = collected.map((p) => ({ ...p, name: `${p.name} (props)` }));
    } else if (propsExplicit) {
      warnings.push({ kind: 'config-interface-not-found', factoryName, configInterfaceName: propsBase, filePath, line });
    }
  }

  return [...configProperties, ...propsProperties];
}

function stripGenericArgs(name: string): string {
  const open = name.indexOf('<');
  return open < 0 ? name : name.slice(0, open);
}

// MARK: Recursive interface walker
/**
 * Mutable warning sink shared by the recursive walker so deeply-nested
 * type-alias resolution (e.g. union types whose members are all primitive
 * literals) can attach a warning to the originating factory entry.
 */
interface CollectWarningSink {
  readonly warnings: ForgeExtractWarning[];
  readonly factoryName: string;
  readonly configInterfaceName: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Mutable context threaded through the recursive interface walker. Tracks
 * visited names (cycle protection), omitted/picked keys (from `Omit<X, K>` /
 * `Pick<X, K>`), and `forceOptional` (from `Partial<X>`).
 */
interface CollectContext {
  readonly interfaceLookup: InterfaceLookup;
  readonly visited: Set<string>;
  readonly omit: ReadonlySet<string>;
  readonly pick: ReadonlySet<string> | null;
  readonly forceOptional: boolean;
  readonly warningSink?: CollectWarningSink;
}

function collectFromInterfaceName(baseName: string, context: CollectContext): readonly ForgeFieldPropertyEntry[] {
  if (baseName.length === 0 || context.visited.has(baseName)) {
    return [];
  }
  const decl = context.interfaceLookup.get(baseName);
  if (decl === undefined) {
    return [];
  }
  const nextContext: CollectContext = { ...context, visited: addToSet(context.visited, baseName) };
  return Node.isInterfaceDeclaration(decl) ? collectFromInterface(decl, nextContext) : collectFromTypeAlias(decl, nextContext);
}

function collectFromInterface(decl: InterfaceDeclaration, context: CollectContext): readonly ForgeFieldPropertyEntry[] {
  const accumulator = new PropertyAccumulator(context);
  for (const ext of decl.getExtends()) {
    const expr = ext.getExpression();
    const refName = Node.isIdentifier(expr) ? expr.getText() : ext.getText();
    const inherited = collectFromInterfaceName(stripGenericArgs(refName), context);
    accumulator.addAll(inherited);
  }
  for (const propSig of decl.getProperties()) {
    const entry = propertyToEntry(propSig);
    if (entry !== undefined) {
      accumulator.add(entry);
    }
  }
  return accumulator.toArray();
}

function collectFromTypeAlias(decl: TypeAliasDeclaration, context: CollectContext): readonly ForgeFieldPropertyEntry[] {
  const typeNode = decl.getTypeNode();
  return typeNode === undefined ? [] : collectFromTypeNode(typeNode, context);
}

function collectFromTypeNode(typeNode: TypeNode, context: CollectContext): readonly ForgeFieldPropertyEntry[] {
  let result: readonly ForgeFieldPropertyEntry[];
  if (Node.isTypeLiteral(typeNode)) {
    const accumulator = new PropertyAccumulator(context);
    for (const propSig of typeNode.getProperties()) {
      const entry = propertyToEntry(propSig);
      if (entry !== undefined) {
        accumulator.add(entry);
      }
    }
    result = accumulator.toArray();
  } else if (Node.isIntersectionTypeNode(typeNode)) {
    const accumulator = new PropertyAccumulator(context);
    for (const member of typeNode.getTypeNodes()) {
      accumulator.addAll(collectFromTypeNode(member, context));
    }
    result = accumulator.toArray();
  } else if (Node.isUnionTypeNode(typeNode)) {
    result = collectFromUnionTypeNode(typeNode, context);
  } else if (Node.isTypeReference(typeNode)) {
    result = collectFromTypeReference(typeNode, context);
  } else {
    result = [];
  }
  return result;
}

/**
 * Walks a union type's members and merges object-branch properties into a
 * single accumulator. Primitive literal members (e.g. `'email' | 'username'`)
 * are skipped because they're preset values, not config properties.
 *
 * All merged properties are forced optional, since any branch may be the one
 * the caller chose. When every member is a primitive literal — meaning there's
 * nothing structured to walk — a `union-config-not-walked` warning is emitted
 * via the context's warning sink.
 *
 * @param typeNode - the union type node whose members should be merged
 * @param context - the active walker context (warning sink + visited / omit / pick / forceOptional state)
 * @returns merged properties from all object/reference members, with primitives skipped
 */
function collectFromUnionTypeNode(typeNode: UnionTypeNode, context: CollectContext): readonly ForgeFieldPropertyEntry[] {
  const memberContext: CollectContext = { ...context, forceOptional: true };
  const accumulator = new PropertyAccumulator(memberContext);
  let walkedStructuredMember = false;
  for (const member of typeNode.getTypeNodes()) {
    if (Node.isLiteralTypeNode(member)) {
      continue;
    }
    accumulator.addAll(collectFromTypeNode(member, memberContext));
    walkedStructuredMember = true;
  }
  if (!walkedStructuredMember && context.warningSink !== undefined) {
    const sink = context.warningSink;
    sink.warnings.push({ kind: 'union-config-not-walked', factoryName: sink.factoryName, configInterfaceName: sink.configInterfaceName, filePath: sink.filePath, line: sink.line });
  }
  return accumulator.toArray();
}

function collectFromTypeReference(ref: TypeReferenceNode, context: CollectContext): readonly ForgeFieldPropertyEntry[] {
  const refNameNode = ref.getTypeName();
  const refName = refNameNode.getText();
  const args = ref.getTypeArguments();

  let result: readonly ForgeFieldPropertyEntry[];
  if ((refName === 'Partial' || refName === 'Readonly') && args.length === 1) {
    const innerContext: CollectContext = refName === 'Partial' ? { ...context, forceOptional: true } : context;
    result = collectFromTypeNode(args[0], innerContext);
  } else if (refName === 'Required' && args.length === 1) {
    result = collectFromTypeNode(args[0], { ...context, forceOptional: false }).map((p) => ({ ...p, required: true }));
  } else if (refName === 'Omit' && args.length === 2) {
    const keys = parseKeyUnion(args[1]);
    const merged = new Set([...context.omit, ...keys]);
    result = collectFromTypeNode(args[0], { ...context, omit: merged });
  } else if (refName === 'Pick' && args.length === 2) {
    const keys = parseKeyUnion(args[1]);
    result = collectFromTypeNode(args[0], { ...context, pick: keys });
  } else {
    result = collectFromInterfaceName(stripGenericArgs(refName), context);
  }
  return result;
}

function parseKeyUnion(typeNode: TypeNode): ReadonlySet<string> {
  const out = new Set<string>();
  if (Node.isLiteralTypeNode(typeNode)) {
    const literal = typeNode.getLiteral();
    if (Node.isStringLiteral(literal) || Node.isNoSubstitutionTemplateLiteral(literal)) {
      out.add(literal.getLiteralText());
    }
  } else if (Node.isUnionTypeNode(typeNode)) {
    for (const member of typeNode.getTypeNodes()) {
      for (const key of parseKeyUnion(member)) {
        out.add(key);
      }
    }
  }
  return out;
}

function addToSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  next.add(value);
  return next;
}

/**
 * Accumulates property entries respecting the active {@link CollectContext} —
 * applies `omit`/`pick` filters, `forceOptional`, and dedupes by name with
 * later entries overriding earlier ones (so own properties win over inherited).
 */
class PropertyAccumulator {
  private readonly entries: ForgeFieldPropertyEntry[] = [];
  private readonly index = new Map<string, number>();

  constructor(private readonly context: CollectContext) {}

  add(entry: ForgeFieldPropertyEntry): void {
    if (this.context.omit.has(entry.name)) {
      return;
    }
    if (this.context.pick !== null && !this.context.pick.has(entry.name)) {
      return;
    }
    const finalEntry = this.context.forceOptional ? { ...entry, required: false } : entry;
    const existingIdx = this.index.get(finalEntry.name);
    if (existingIdx === undefined) {
      this.index.set(finalEntry.name, this.entries.length);
      this.entries.push(finalEntry);
    } else {
      this.entries[existingIdx] = finalEntry;
    }
  }

  addAll(entries: readonly ForgeFieldPropertyEntry[]): void {
    for (const entry of entries) {
      this.add(entry);
    }
  }

  toArray(): readonly ForgeFieldPropertyEntry[] {
    return this.entries;
  }
}

function propertyToEntry(property: PropertySignature): ForgeFieldPropertyEntry | undefined {
  const tags = readPropertyTags(property);
  if (tags.skip) {
    return undefined;
  }
  const propertyName = tags.nameOverride ?? property.getName();
  // Drop phantom branding properties (e.g. `__fieldDef` on `DbxForgeFieldFunctionDef`)
  // since they aren't user-facing config and only show up because the walker
  // crawls extends chains.
  if (propertyName.startsWith('__')) {
    return undefined;
  }
  const typeNode = property.getTypeNode();
  const typeText = typeNode === undefined ? 'unknown' : typeNode.getText();
  const required = !property.hasQuestionToken();
  const entry: ForgeFieldPropertyEntry = {
    name: propertyName,
    type: typeText,
    description: tags.description,
    required,
    ...(tags.defaultText === undefined ? {} : { default: tags.defaultText })
  };
  return entry;
}

interface PropertyTagState {
  readonly description: string;
  readonly defaultText?: string;
  readonly nameOverride?: string;
  readonly skip: boolean;
}

function readPropertyTags(property: PropertySignature): PropertyTagState {
  const summaries: string[] = [];
  let defaultText: string | undefined;
  let nameOverride: string | undefined;
  let skip = false;
  for (const jsDoc of property.getJsDocs()) {
    const desc = jsDoc.getDescription().trim();
    if (desc.length > 0) {
      summaries.push(desc);
    }
    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      const text = tag.getCommentText()?.trim() ?? '';
      if (tagName === 'default' && text.length > 0) {
        defaultText = text;
      } else if (tagName === FORM_PROP_NAME_TAG && text.length > 0) {
        nameOverride = text;
      } else if (tagName === 'internal') {
        skip = true;
      }
    }
  }
  return {
    description: summaries.join('\n\n'),
    ...(defaultText === undefined ? {} : { defaultText }),
    ...(nameOverride === undefined ? {} : { nameOverride }),
    skip
  };
}

function defaultConfigInterfaceName(factoryName: string): string {
  return `${capitalize(factoryName)}Config`;
}

/**
 * Convention default for the sibling Props interface name. The dbx-form
 * convention is `<FactoryNameCapitalized>Props` — when the factory's own props
 * live in a Props interface that exists in the scanned files, this default
 * picks it up automatically. Factories whose Props interface uses a different
 * name (e.g. `DbxForgeDateTimeFieldComponentProps`) should use the explicit
 * `@dbxFormPropsInterface` JSDoc tag instead.
 *
 * @param factoryName - The factory function name to derive the Props interface from.
 * @returns The conventional Props interface name (`<FactoryNameCapitalized>Props`).
 */
function defaultPropsInterfaceName(factoryName: string): string {
  return `${capitalize(factoryName)}Props`;
}

function capitalize(name: string): string {
  return name.length === 0 ? name : `${name[0].toUpperCase()}${name.slice(1)}`;
}

// MARK: Arktype runtime guard
/**
 * Arktype validator that mirrors {@link ExtractedForgeFieldEntry}. Useful for
 * tests and for runtime-validating fixture entries crafted by hand.
 */
export const ExtractedForgeFieldEntrySchema = type({
  slug: 'string',
  factoryName: 'string',
  tier: '"field-factory" | "field-derivative" | "composite-builder" | "template-builder" | "primitive"',
  produces: 'string',
  arrayOutput: '"yes" | "no" | "optional"',
  description: 'string',
  example: 'string',
  properties: type({ name: 'string', type: 'string', description: 'string', required: 'boolean', 'default?': 'string' }).array(),
  'wrapperPattern?': '"unwrapped" | "material-form-field-wrapped"',
  'ngFormType?': 'string',
  'generic?': 'string',
  'suffix?': '"Row" | "Group" | "Fields" | "Field" | "Wrapper" | "Layout"',
  'composesFromSlugs?': 'string[]',
  'returns?': 'string',
  'configInterface?': 'string',
  'deprecated?': 'boolean | string',
  'since?': 'string',
  filePath: 'string',
  line: 'number'
});
