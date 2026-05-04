/**
 * AST extraction for the `scan-dbx-docs-ui-examples` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * top-level exported class declarations tagged with the `@dbxDocsUiExample`
 * JSDoc marker. Each match is normalised into an
 * {@link ExtractedDbxDocsUiExampleEntry} that
 * {@link buildDbxDocsUiExamplesManifest} will assemble into a
 * `DbxDocsUiExampleManifest` entry.
 *
 * The extractor parses the example component's `@Component` template to find
 * the well-known `<dbx-docs-ui-example*>` element tree (header attribute,
 * info/content/imports/notes children) and resolves every
 * `@dbxDocsUiExampleUses` tag through the example file's import declarations,
 * lazily loading the referenced source files so each supporting class /
 * interface declaration and (for components) its template body land in the
 * entry's `uses[]` array. The tag accepts either a bare identifier
 * (`@dbxDocsUiExampleUses Foo role`) or a JSDoc link
 * (`@dbxDocsUiExampleUses {@link Foo} role`), so authors get IDE
 * cross-referencing on supporting types.
 */

import { dirname, isAbsolute, resolve } from 'node:path';
import { type } from 'arktype';
import { type ClassDeclaration, type Decorator, type JSDoc, type ObjectLiteralExpression, type Project, type SourceFile, type FunctionDeclaration, type InterfaceDeclaration, type TypeAliasDeclaration, type VariableDeclaration, Node } from 'ts-morph';
import { type DbxDocsUiExampleEntry, type DbxDocsUiExampleUseEntry, type DbxDocsUiExampleUseKind } from '../manifest/dbx-docs-ui-examples-schema.js';
import { type ScanReadFile } from './scan-io.js';
import { readStringProperty, splitListTagText } from './scan-extract-utils.js';

// MARK: Tag names
const MARKER_TAG = 'dbxDocsUiExample';
const SLUG_TAG = 'dbxDocsUiExampleSlug';
const CATEGORY_TAG = 'dbxDocsUiExampleCategory';
const SUMMARY_TAG = 'dbxDocsUiExampleSummary';
const RELATED_TAG = 'dbxDocsUiExampleRelated';
const APP_REF_TAG = 'dbxDocsUiExampleAppRef';
const SKILL_REFS_TAG = 'dbxDocsUiExampleSkillRefs';
const USES_TAG = 'dbxDocsUiExampleUses';

const REQUIRED_TAGS: readonly string[] = [SLUG_TAG, CATEGORY_TAG, SUMMARY_TAG];

// MARK: Public types
/**
 * One example entry extracted from a source file. Mirrors
 * {@link DbxDocsUiExampleEntry} minus `module` and `appRef` (defaulted in
 * build-manifest). The originating `filePath` and `line` are kept so
 * extract warnings can point a developer back to the source file —
 * neither is persisted to the manifest because downstream consumers
 * never have access to the source tree.
 */
export interface ExtractedDbxDocsUiExampleEntry {
  readonly slug: string;
  readonly category: DbxDocsUiExampleEntry['category'];
  readonly summary: string;
  readonly header: string;
  readonly hint?: string;
  readonly className: string;
  readonly selector: string;
  readonly appRef?: string;
  readonly relatedSlugs?: readonly string[];
  readonly skillRefs?: readonly string[];
  readonly info: string;
  readonly snippet: string;
  readonly imports?: string;
  readonly notes?: string;
  readonly uses: readonly DbxDocsUiExampleUseEntry[];
  readonly filePath: string;
  readonly line: number;
}

/**
 * Discriminated union of the non-fatal events the extractor emits. The
 * caller (build-manifest) collates these into a structured warning array
 * so missing/invalid tag combinations surface during generation rather
 * than silently dropping entries.
 */
export type DbxDocsUiExamplesExtractWarning =
  | { readonly kind: 'missing-required-tag'; readonly className: string; readonly tag: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-category'; readonly className: string; readonly category: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-component-decorator'; readonly className: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-template'; readonly className: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-example-root'; readonly className: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-example-content'; readonly className: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'template-url-unreadable'; readonly className: string; readonly templatePath: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'uses-unresolved'; readonly className: string; readonly identifier: string; readonly filePath: string; readonly line: number };

/**
 * Input to {@link extractDbxDocsUiExampleEntries}. The caller is responsible
 * for adding example source files to `project`; the extractor will lazily
 * pull in additional source files referenced by `@dbxDocsUiExampleUses` tags
 * via the supplied `readFile` injection.
 */
export interface ExtractDbxDocsUiExampleEntriesInput {
  readonly project: Project;
  readonly readFile: ScanReadFile;
}

/**
 * Result of {@link extractDbxDocsUiExampleEntries}.
 */
export interface ExtractDbxDocsUiExampleEntriesResult {
  readonly entries: readonly ExtractedDbxDocsUiExampleEntry[];
  readonly warnings: readonly DbxDocsUiExamplesExtractWarning[];
}

// MARK: Vocabulary
const VALID_CATEGORIES: ReadonlySet<string> = new Set(['layout', 'list', 'button', 'card', 'feedback', 'overlay', 'navigation', 'text', 'screen', 'action', 'router', 'misc']);

// MARK: Entry point
/**
 * Walks the supplied project and returns every class tagged with the
 * `@dbxDocsUiExample` JSDoc marker. Order is stable: source files in the
 * order ts-morph reports them, declarations within a file in source
 * order.
 *
 * @param input - the ts-morph project plus a readFile for resolving
 *   supporting sources referenced by `@dbxDocsUiExampleUses` tags
 * @returns the extracted entries plus any non-fatal warnings
 */
export async function extractDbxDocsUiExampleEntries(input: ExtractDbxDocsUiExampleEntriesInput): Promise<ExtractDbxDocsUiExampleEntriesResult> {
  const { project, readFile } = input;
  const entries: ExtractedDbxDocsUiExampleEntry[] = [];
  const warnings: DbxDocsUiExamplesExtractWarning[] = [];
  const sourceFileCache = new Map<string, SourceFile | null>();

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
      const built = await buildEntryFromClass({ decl, tags, filePath, sourceFile, project, readFile, sourceFileCache });
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
interface ParsedTags {
  readonly hasMarker: boolean;
  readonly slug?: string;
  readonly category?: string;
  readonly summary?: string;
  readonly relatedSlugs: readonly string[];
  readonly appRef?: string;
  readonly skillRefs: readonly string[];
  readonly uses: readonly UsesTagInput[];
}

interface UsesTagInput {
  readonly identifier: string;
  readonly role?: string;
}

interface MutableTagState {
  hasMarker: boolean;
  slug: string | undefined;
  category: string | undefined;
  summary: string | undefined;
  relatedSlugs: string[];
  appRef: string | undefined;
  skillRefs: string[];
  uses: UsesTagInput[];
}

function readJsDocTags(jsDocs: readonly JSDoc[]): ParsedTags {
  const state: MutableTagState = {
    hasMarker: false,
    slug: undefined,
    category: undefined,
    summary: undefined,
    relatedSlugs: [],
    appRef: undefined,
    skillRefs: [],
    uses: []
  };

  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      applyJsDocTag(state, tag.getTagName(), tag.getCommentText()?.trim() ?? '');
    }
  }

  return {
    hasMarker: state.hasMarker,
    slug: state.slug,
    category: state.category,
    summary: state.summary,
    relatedSlugs: state.relatedSlugs,
    appRef: state.appRef,
    skillRefs: state.skillRefs,
    uses: state.uses
  };
}

function applyJsDocTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case MARKER_TAG:
      state.hasMarker = true;
      break;
    case SLUG_TAG:
      state.slug = text;
      break;
    case CATEGORY_TAG:
      state.category = text;
      break;
    case SUMMARY_TAG:
      state.summary = text;
      break;
    case RELATED_TAG:
      for (const slug of splitListTagText(text)) {
        state.relatedSlugs.push(slug);
      }
      break;
    case APP_REF_TAG:
      if (text.length > 0) {
        state.appRef = text;
      }
      break;
    case SKILL_REFS_TAG:
      for (const ref of splitListTagText(text)) {
        state.skillRefs.push(ref);
      }
      break;
    case USES_TAG: {
      const parsed = parseUsesTag(text);
      if (parsed !== undefined) {
        state.uses.push(parsed);
      }
      break;
    }
    default:
      break;
  }
}

// Matches a leading {@link Name}, {@linkcode Name}, or {@linkplain Name},
// optionally followed by a `| display` segment. ts-morph emits the link as
// `{@link Name }` (note the trailing space before `}`), so the closing brace
// allows surrounding whitespace.
const LINK_TAG_PATTERN = /^\{@(?:link|linkcode|linkplain)\s+([^|}\s]+)\s*(?:\|[^}]*)?\}/;

function parseUsesTag(text: string): UsesTagInput | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const linkMatch = LINK_TAG_PATTERN.exec(trimmed);
  if (linkMatch !== null) {
    const identifier = linkMatch[1];
    const role = trimmed.slice(linkMatch[0].length).trim();
    return role.length === 0 ? { identifier } : { identifier, role };
  }
  const parts = trimmed.split(/\s+/);
  const identifier = parts[0];
  const role = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  return role === undefined ? { identifier } : { identifier, role };
}

// MARK: Entry construction
interface BuildEntryFromClassInput {
  readonly decl: ClassDeclaration;
  readonly tags: ParsedTags;
  readonly filePath: string;
  readonly sourceFile: SourceFile;
  readonly project: Project;
  readonly readFile: ScanReadFile;
  readonly sourceFileCache: Map<string, SourceFile | null>;
}

type BuildEntryResult = { readonly kind: 'ok'; readonly entry: ExtractedDbxDocsUiExampleEntry; readonly warnings: readonly DbxDocsUiExamplesExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly DbxDocsUiExamplesExtractWarning[] };

async function buildEntryFromClass(input: BuildEntryFromClassInput): Promise<BuildEntryResult> {
  const { decl, tags, filePath, sourceFile, project, readFile, sourceFileCache } = input;
  const className = decl.getName() ?? '<anonymous>';
  const line = decl.getStartLineNumber();
  const warnings: DbxDocsUiExamplesExtractWarning[] = [];

  for (const tagName of REQUIRED_TAGS) {
    const value = tagName === SLUG_TAG ? tags.slug : tagName === CATEGORY_TAG ? tags.category : tags.summary;
    if (value === undefined || value.length === 0) {
      warnings.push({ kind: 'missing-required-tag', className, tag: tagName, filePath, line });
    }
  }
  if (tags.slug === undefined || tags.slug.length === 0 || tags.category === undefined || tags.category.length === 0 || tags.summary === undefined || tags.summary.length === 0) {
    return { kind: 'skipped', warnings };
  }
  if (!VALID_CATEGORIES.has(tags.category)) {
    warnings.push({ kind: 'unknown-category', className, category: tags.category, filePath, line });
    return { kind: 'skipped', warnings };
  }
  const category = tags.category as DbxDocsUiExampleEntry['category'];

  const decoratorInfo = readComponentDecorator(decl);
  if (decoratorInfo === undefined) {
    warnings.push({ kind: 'missing-component-decorator', className, filePath, line });
    return { kind: 'skipped', warnings };
  }
  const selector = decoratorInfo.selector ?? '';

  let template: string | undefined = decoratorInfo.template;
  if (template === undefined && decoratorInfo.templateUrl !== undefined) {
    const templateAbs = resolve(dirname(filePath), decoratorInfo.templateUrl);
    try {
      template = await readFile(templateAbs);
    } catch {
      warnings.push({ kind: 'template-url-unreadable', className, templatePath: templateAbs, filePath, line });
      return { kind: 'skipped', warnings };
    }
  }
  if (template === undefined) {
    warnings.push({ kind: 'missing-template', className, filePath, line });
    return { kind: 'skipped', warnings };
  }

  const parsedTemplate = parseExampleTemplate(template);
  if (parsedTemplate === undefined) {
    warnings.push({ kind: 'missing-example-root', className, filePath, line });
    return { kind: 'skipped', warnings };
  }
  if (parsedTemplate.snippet === undefined) {
    warnings.push({ kind: 'missing-example-content', className, filePath, line });
    return { kind: 'skipped', warnings };
  }

  const usesEntries: DbxDocsUiExampleUseEntry[] = [];
  for (const useTag of tags.uses) {
    const resolved = await resolveUseEntry({ tag: useTag, sourceFile, filePath, project, readFile, sourceFileCache });
    if (resolved === undefined) {
      warnings.push({ kind: 'uses-unresolved', className, identifier: useTag.identifier, filePath, line });
      continue;
    }
    usesEntries.push(resolved);
  }

  const entry: ExtractedDbxDocsUiExampleEntry = {
    slug: tags.slug,
    category,
    summary: tags.summary,
    header: parsedTemplate.header,
    ...(parsedTemplate.hint === undefined ? {} : { hint: parsedTemplate.hint }),
    className,
    selector,
    ...(tags.appRef === undefined ? {} : { appRef: tags.appRef }),
    ...(tags.relatedSlugs.length > 0 ? { relatedSlugs: tags.relatedSlugs } : {}),
    ...(tags.skillRefs.length > 0 ? { skillRefs: tags.skillRefs } : {}),
    info: parsedTemplate.info ?? '',
    snippet: parsedTemplate.snippet,
    ...(parsedTemplate.imports === undefined ? {} : { imports: parsedTemplate.imports }),
    ...(parsedTemplate.notes === undefined ? {} : { notes: parsedTemplate.notes }),
    uses: usesEntries,
    filePath,
    line
  };
  return { kind: 'ok', entry, warnings };
}

// MARK: @Component decorator inspection
interface ComponentDecoratorInfo {
  readonly selector?: string;
  readonly template?: string;
  readonly templateUrl?: string;
}

function readComponentDecorator(decl: ClassDeclaration): ComponentDecoratorInfo | undefined {
  for (const decorator of decl.getDecorators()) {
    if (decorator.getName() !== 'Component') {
      continue;
    }
    return readDecoratorConfig(decorator);
  }
  return undefined;
}

function readDecoratorConfig(decorator: Decorator): ComponentDecoratorInfo {
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
  return {
    selector: readStringProperty(firstArg, 'selector'),
    template: readStringProperty(firstArg, 'template'),
    templateUrl: readStringProperty(firstArg, 'templateUrl')
  };
}

// MARK: Template parsing
interface ParsedExampleTemplate {
  readonly header: string;
  readonly hint?: string;
  readonly info?: string;
  readonly snippet?: string;
  readonly imports?: string;
  readonly notes?: string;
}

function parseExampleTemplate(template: string): ParsedExampleTemplate | undefined {
  const root = matchSingleElement(template, 'dbx-docs-ui-example');
  if (root === undefined) {
    return undefined;
  }
  const header = extractAttr(root.openTag, 'header') ?? '';
  const hint = extractAttr(root.openTag, 'hint');
  const info = extractInnerText(root.body, 'dbx-docs-ui-example-info');
  const snippet = extractInnerText(root.body, 'dbx-docs-ui-example-content');
  const imports = extractInnerText(root.body, 'dbx-docs-ui-example-imports');
  const notes = extractInnerText(root.body, 'dbx-docs-ui-example-notes');
  return {
    header,
    ...(hint === undefined ? {} : { hint }),
    ...(info === undefined ? {} : { info }),
    ...(snippet === undefined ? {} : { snippet }),
    ...(imports === undefined ? {} : { imports }),
    ...(notes === undefined ? {} : { notes })
  };
}

interface MatchedElement {
  readonly openTag: string;
  readonly body: string;
}

function matchSingleElement(text: string, tagName: string): MatchedElement | undefined {
  const escaped = tagName.replace(/[-]/g, '\\-');
  const regex = new RegExp(`<${escaped}(\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`);
  const match = regex.exec(text);
  if (match === null) {
    return undefined;
  }
  return { openTag: match[0].slice(0, match[0].indexOf('>') + 1), body: match[2] };
}

function extractInnerText(text: string, tagName: string): string | undefined {
  const matched = matchSingleElement(text, tagName);
  if (matched === undefined) {
    return undefined;
  }
  return collapseTemplateWhitespace(matched.body);
}

function extractAttr(openTag: string, attrName: string): string | undefined {
  const regex = new RegExp(`\\s${attrName}=("([^"]*)"|'([^']*)')`);
  const match = regex.exec(openTag);
  if (match === null) {
    return undefined;
  }
  return match[2] ?? match[3] ?? undefined;
}

function collapseTemplateWhitespace(body: string): string {
  // Strip a single leading and trailing newline only — preserve indentation
  // inside the body so the rendered snippet keeps its original shape.
  const trimmed = body.replace(/^\n+/, '').replace(/\n+\s*$/, '');
  // Detect minimum leading-whitespace common prefix and dedent.
  const lines = trimmed.split('\n');
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    const match = /^([ \t]*)/.exec(line);
    if (match !== null && match[1].length < minIndent) {
      minIndent = match[1].length;
    }
  }
  if (!Number.isFinite(minIndent) || minIndent === 0) {
    return trimmed;
  }
  return lines.map((line) => (line.length >= minIndent ? line.slice(minIndent) : line)).join('\n');
}

// MARK: Uses resolution
interface ResolveUseEntryInput {
  readonly tag: UsesTagInput;
  readonly sourceFile: SourceFile;
  readonly filePath: string;
  readonly project: Project;
  readonly readFile: ScanReadFile;
  readonly sourceFileCache: Map<string, SourceFile | null>;
}

async function resolveUseEntry(input: ResolveUseEntryInput): Promise<DbxDocsUiExampleUseEntry | undefined> {
  const { tag, sourceFile, filePath, project, readFile, sourceFileCache } = input;
  // Resolution strategy: walk every import declaration in the example
  // file, try to load each module specifier's source, and check for a
  // named export matching the tag's identifier. This lets authors keep
  // their imports clean — they only need to actually-import the components
  // they use in the template; siblings re-exported from the same source
  // file (or barrel) are picked up automatically.
  const candidatePaths = collectCandidateModulePaths(sourceFile, filePath);
  for (const candidatePath of candidatePaths) {
    const resolvedFile = await loadSourceFile({ absolutePath: candidatePath, project, readFile, sourceFileCache });
    if (resolvedFile === null) {
      continue;
    }
    const declaration = findNamedDeclaration(resolvedFile, tag.identifier);
    if (declaration === undefined) {
      continue;
    }
    const captured = captureDeclaration(declaration, resolvedFile.getFilePath());
    if (captured === undefined) {
      continue;
    }
    const { kind, selector, pipeName } = captured.angular;
    return {
      kind,
      className: tag.identifier,
      ...(tag.role === undefined ? {} : { role: tag.role }),
      ...(selector === undefined ? {} : { selector }),
      ...(pipeName === undefined ? {} : { pipeName }),
      classSource: captured.classSource
    };
  }
  return undefined;
}

function collectCandidateModulePaths(sourceFile: SourceFile, fromFile: string): readonly string[] {
  const paths: string[] = [];
  for (const decl of sourceFile.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (specifier === undefined || !specifier.startsWith('.')) {
      // Path-aliased imports are not resolved — only relative imports.
      continue;
    }
    paths.push(resolveRelativeTsPath(fromFile, specifier));
  }
  return paths;
}

function resolveRelativeTsPath(fromFile: string, specifier: string): string {
  const baseDir = dirname(fromFile);
  const joined = isAbsolute(specifier) ? specifier : resolve(baseDir, specifier);
  if (joined.endsWith('.ts')) {
    return joined;
  }
  return `${joined}.ts`;
}

interface LoadSourceFileInput {
  readonly absolutePath: string;
  readonly project: Project;
  readonly readFile: ScanReadFile;
  readonly sourceFileCache: Map<string, SourceFile | null>;
}

async function loadSourceFile(input: LoadSourceFileInput): Promise<SourceFile | null> {
  const { absolutePath, project, readFile, sourceFileCache } = input;
  const cached = sourceFileCache.get(absolutePath);
  if (cached !== undefined) {
    return cached;
  }
  const existing = project.getSourceFile(absolutePath);
  if (existing !== undefined) {
    sourceFileCache.set(absolutePath, existing);
    return existing;
  }
  let text: string | null = null;
  try {
    text = await readFile(absolutePath);
  } catch {
    text = null;
  }
  if (text === null) {
    sourceFileCache.set(absolutePath, null);
    return null;
  }
  const created = project.createSourceFile(absolutePath, text, { overwrite: true });
  sourceFileCache.set(absolutePath, created);
  return created;
}

type Declaration = ClassDeclaration | InterfaceDeclaration | TypeAliasDeclaration | FunctionDeclaration | VariableDeclaration;

function findNamedDeclaration(sourceFile: SourceFile, name: string): Declaration | undefined {
  return sourceFile.getClass(name) ?? sourceFile.getInterface(name) ?? sourceFile.getTypeAlias(name) ?? sourceFile.getFunction(name) ?? sourceFile.getVariableDeclaration(name);
}

interface CapturedDeclaration {
  readonly classSource: string;
  readonly line: number;
  readonly angular: {
    readonly kind: DbxDocsUiExampleUseKind;
    readonly selector?: string;
    readonly pipeName?: string;
    readonly template?: string;
  };
}

function captureDeclaration(declaration: Declaration, sourcePath: string): CapturedDeclaration | undefined {
  const line = declaration.getStartLineNumber();
  if (Node.isClassDeclaration(declaration)) {
    const angular = inspectAngularClass(declaration, sourcePath);
    return {
      classSource: declaration.getText(),
      line,
      angular
    };
  }
  if (Node.isInterfaceDeclaration(declaration)) {
    return { classSource: declaration.getText(), line, angular: { kind: 'interface' } };
  }
  if (Node.isTypeAliasDeclaration(declaration)) {
    return { classSource: declaration.getText(), line, angular: { kind: 'typeAlias' } };
  }
  if (Node.isFunctionDeclaration(declaration)) {
    return { classSource: declaration.getText(), line, angular: { kind: 'function' } };
  }
  if (Node.isVariableDeclaration(declaration)) {
    const stmt = declaration.getVariableStatement();
    return { classSource: stmt?.getText() ?? declaration.getText(), line, angular: { kind: 'const' } };
  }
  return undefined;
}

interface AngularClassInspection {
  readonly kind: DbxDocsUiExampleUseKind;
  readonly selector?: string;
  readonly pipeName?: string;
  readonly template?: string;
}

function inspectAngularClass(decl: ClassDeclaration, sourcePath: string): AngularClassInspection {
  for (const decorator of decl.getDecorators()) {
    const name = decorator.getName();
    if (name === 'Component') {
      const config = readDecoratorConfig(decorator);
      let template: string | undefined = config.template;
      if (template === undefined && config.templateUrl !== undefined) {
        // Best-effort: don't synchronously read the templateUrl here; the
        // resolver only handles inline templates for `uses` entries to keep
        // this function pure. Authors are encouraged to use inline templates
        // in supporting components for fullest catalog output.
        template = undefined;
      }
      return {
        kind: 'component',
        ...(config.selector === undefined ? {} : { selector: config.selector }),
        ...(template === undefined ? {} : { template })
      };
    }
    if (name === 'Directive') {
      const callExpr = decorator.getCallExpression();
      let selector: string | undefined;
      if (callExpr !== undefined && callExpr.getArguments().length > 0) {
        const arg = callExpr.getArguments()[0];
        if (Node.isObjectLiteralExpression(arg)) {
          selector = readStringProperty(arg, 'selector');
        }
      }
      return { kind: 'directive', ...(selector === undefined ? {} : { selector }) };
    }
    if (name === 'Pipe') {
      const callExpr = decorator.getCallExpression();
      let pipeName: string | undefined;
      if (callExpr !== undefined && callExpr.getArguments().length > 0) {
        const arg = callExpr.getArguments()[0];
        if (Node.isObjectLiteralExpression(arg)) {
          pipeName = readStringProperty(arg, 'name');
        }
      }
      return { kind: 'pipe', ...(pipeName === undefined ? {} : { pipeName }) };
    }
    if (name === 'Injectable') {
      return { kind: 'service' };
    }
  }
  return { kind: 'class' };
  // sourcePath kept for API symmetry — useful for future enhancements like
  // resolving cross-file inheritance.
  void sourcePath;
}

// MARK: Arktype runtime guard
/**
 * Arktype validator that mirrors {@link ExtractedDbxDocsUiExampleEntry}.
 * Useful for tests that want to runtime-validate hand-crafted fixtures.
 */
export const ExtractedDbxDocsUiExampleEntrySchema = type({
  slug: 'string',
  category: '"layout" | "list" | "button" | "card" | "feedback" | "overlay" | "navigation" | "text" | "screen" | "action" | "router" | "misc"',
  summary: 'string',
  header: 'string',
  'hint?': 'string',
  className: 'string',
  selector: 'string',
  'appRef?': 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  info: 'string',
  snippet: 'string',
  'imports?': 'string',
  'notes?': 'string',
  uses: type({
    kind: '"component" | "directive" | "pipe" | "service" | "interface" | "typeAlias" | "function" | "const" | "class"',
    className: 'string',
    'role?': 'string',
    'selector?': 'string',
    'pipeName?': 'string',
    classSource: 'string'
  }).array(),
  filePath: 'string',
  line: 'number'
});
