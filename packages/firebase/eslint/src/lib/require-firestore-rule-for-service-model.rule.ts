import { readFileSync, globSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { parse as parseTypescriptSource } from '@typescript-eslint/parser';
import type { Maybe } from '@dereekb/util';
import { type AstNode, referencedTypeName, resolveInstalledFirebaseModelDir, typeReferenceTypeArguments } from './util';
import { parseFirestoreRules, type ParsedFirestoreMatchBlock } from './firestore-rules-parser';

/**
 * Default file name searched relative to the lint root when `firestoreRulesPath` is omitted.
 */
export const DEFAULT_FIRESTORE_RULES_FILENAME: string = 'firestore.rules';

/**
 * Default call-expression callee name the rule looks for to locate the service.ts
 * model registry. Files without this call are treated as not-a-service.ts and skipped.
 */
export const DEFAULT_REGISTRY_FACTORY_CALL_NAME: string = 'firebaseModelsService';

/**
 * Default call-expression callee name used to discover `firestoreModelIdentity(...)`
 * declarations in the workspace.
 */
export const DEFAULT_IDENTITY_FACTORY_NAME: string = 'firestoreModelIdentity';

/**
 * Default glob patterns (relative to ESLint `cwd`) the rule scans to build the workspace
 * identity registry. Covers shared identities in `@dereekb/firebase` source, local model
 * identities inside `*-firebase` components, and any app-side model files.
 */
export const DEFAULT_MODEL_SEARCH_ROOTS: readonly string[] = ['packages/firebase/src/lib/model/**/*.ts', 'components/*/src/lib/model/**/*.ts', 'apps/*/src/app/**/*.ts'];

/**
 * Inline identity stub used by the rule's spec to bypass workspace globbing.
 */
export interface VirtualModelIdentity {
  readonly modelName: string;
  readonly collectionName: string;
  readonly identityVariableName: string;
  readonly parentIdentityVariableName?: string;
}

/**
 * Identity-type-reference names emitted into `@dereekb/firebase`'s shipped `.d.ts` for the two
 * `firestoreModelIdentity(...)` return shapes. Downstream consumers only have these declaration
 * files (no `firestoreModelIdentity(...)` call expressions), so the rule reads model name +
 * collection name + parent chain from these type annotations — they carry every literal inline,
 * e.g. `FirestoreModelIdentityWithParent<RootFirestoreModelIdentity<"notificationBox","nb">, "notification","nbn">`.
 */
const ROOT_IDENTITY_TYPE_NAME: string = 'RootFirestoreModelIdentity';
const WITH_PARENT_IDENTITY_TYPE_NAME: string = 'FirestoreModelIdentityWithParent';

/**
 * Cheap substring used to skip files that cannot contain an identity type-annotation before paying
 * for a full parse (`RootFirestoreModelIdentity` / `FirestoreModelIdentityWithParent` both contain it).
 */
const IDENTITY_TYPE_SOURCE_MARKER: string = 'FirestoreModelIdentity';

/**
 * Options for the require-firestore-rule-for-service-model rule.
 */
export interface FirebaseRequireFirestoreRuleForServiceModelRuleOptions {
  /**
   * Path to the `firestore.rules` file. Resolved against the ESLint `cwd` when relative.
   * Defaults to `<cwd>/firestore.rules`.
   */
  readonly firestoreRulesPath?: string;
  /**
   * Inline `firestore.rules` source used in tests; bypasses filesystem reads when set.
   */
  readonly virtualFirestoreRules?: string;
  /**
   * Inline `firestoreModelIdentity` registry used in tests; bypasses workspace globbing.
   */
  readonly virtualModelIdentities?: readonly VirtualModelIdentity[];
  /**
   * Call-expression callee name that marks a file as the app's service.ts. Defaults to
   * {@link DEFAULT_REGISTRY_FACTORY_CALL_NAME}.
   */
  readonly registryFactoryCallName?: string;
  /**
   * Call-expression callee name treated as the model-identity factory. Defaults to
   * {@link DEFAULT_IDENTITY_FACTORY_NAME}.
   */
  readonly identityFactoryName?: string;
  /**
   * Glob patterns (relative to ESLint `cwd`) used to discover identity declarations.
   * Defaults to {@link DEFAULT_MODEL_SEARCH_ROOTS}.
   */
  readonly modelSearchRoots?: readonly string[];
  /**
   * Model names that are intentionally registered in service.ts without a matching block
   * in firestore.rules. Suppresses the missing-match warning for each name.
   */
  readonly allowedMissingCollectionNames?: readonly string[];
}

/**
 * ESLint rule definition for require-firestore-rule-for-service-model.
 */
export interface FirebaseRequireFirestoreRuleForServiceModelRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: RuleContext): Record<string, (node: AstNode) => void>;
}

interface RuleContext {
  readonly options: FirebaseRequireFirestoreRuleForServiceModelRuleOptions[];
  readonly cwd?: string;
  readonly report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void;
}

interface IdentityEntry {
  readonly modelName: string;
  readonly collectionName: string;
  readonly identityVariableName: string;
  readonly parentIdentityVariableName?: string;
}

interface IdentityRegistry {
  readonly byIdentityVariable: ReadonlyMap<string, IdentityEntry>;
  readonly byModelName: ReadonlyMap<string, IdentityEntry>;
}

interface RegistryDiscovery {
  readonly modelKeys: readonly { readonly name: string; readonly node: AstNode }[];
  readonly registryCallNode: AstNode;
}

const firestoreRulesFileCache: Map<string, ParsedFirestoreMatchBlock[]> = new Map();
const identityRegistryCache: Map<string, IdentityRegistry> = new Map();

/**
 * Reads + parses a `firestore.rules` file, caching by absolute path so repeated rule
 * activations don't re-read disk.
 *
 * @param absolutePath - Absolute path to the rules file.
 * @returns The parsed tree, or null when the file cannot be read.
 */
function loadParsedFirestoreRulesFromPath(absolutePath: string): Maybe<ParsedFirestoreMatchBlock[]> {
  let result: Maybe<ParsedFirestoreMatchBlock[]> = null;
  const cached: Maybe<ParsedFirestoreMatchBlock[]> = firestoreRulesFileCache.get(absolutePath);
  if (cached) {
    result = cached;
  } else {
    try {
      const source: string = readFileSync(absolutePath, 'utf8');
      const parsed: ParsedFirestoreMatchBlock[] = parseFirestoreRules(source);
      firestoreRulesFileCache.set(absolutePath, parsed);
      result = parsed;
    } catch {
      result = null;
    }
  }
  return result;
}

/**
 * Resolves the absolute path to the firestore.rules file from the rule options and ESLint cwd.
 *
 * @param options - Rule options.
 * @param cwd - ESLint working directory.
 * @returns The absolute rules file path.
 */
function resolveFirestoreRulesPath(options: FirebaseRequireFirestoreRuleForServiceModelRuleOptions, cwd: string): string {
  let result: string;
  if (options.firestoreRulesPath) {
    result = isAbsolute(options.firestoreRulesPath) ? options.firestoreRulesPath : resolve(cwd, options.firestoreRulesPath);
  } else {
    result = resolve(cwd, DEFAULT_FIRESTORE_RULES_FILENAME);
  }
  return result;
}

/**
 * Walks a parsed file's Program body searching for top-level
 * `firestoreModelIdentity(<args>)` initializers and records each as an `IdentityEntry`.
 * Both arities are handled: root `(modelName, collectionName)` and child
 * `(parentIdentity, modelName, collectionName)`.
 *
 * @param programNode - The Program AST node.
 * @param identityFactoryName - The call-expression name to match.
 * @param accumulator - Map keyed by identity variable name; later collisions are ignored.
 */
function collectIdentityCallsFromProgram(programNode: AstNode, identityFactoryName: string, accumulator: Map<string, IdentityEntry>): void {
  const declarators: AstNode[] = collectTopLevelDeclarators(programNode);
  for (const declarator of declarators) {
    const id: AstNode = declarator.id;
    if (id?.type !== 'Identifier' || !declarator.init) continue;
    let init: AstNode = declarator.init;
    while (init?.type === 'TSAsExpression') {
      init = init.expression;
    }
    if (init?.type !== 'CallExpression') continue;
    const callee: AstNode = init.callee;
    if (callee?.type !== 'Identifier' || callee.name !== identityFactoryName) continue;
    const args: readonly AstNode[] = init.arguments ?? [];
    const entry: Maybe<IdentityEntry> = extractIdentityEntryFromArguments(id.name, args);
    if (entry && !accumulator.has(entry.identityVariableName)) {
      accumulator.set(entry.identityVariableName, entry);
    }
  }
}

/**
 * Reduces the call-expression argument list of a `firestoreModelIdentity(...)` to an
 * `IdentityEntry`. Returns null for argument shapes the rule does not understand.
 *
 * @param identityVariableName - The `const <name> = firestoreModelIdentity(...)` binding name.
 * @param args - The call-expression arguments.
 * @returns The identity entry, or null when arguments cannot be resolved.
 */
function extractIdentityEntryFromArguments(identityVariableName: string, args: readonly AstNode[]): Maybe<IdentityEntry> {
  let result: Maybe<IdentityEntry> = null;
  if (args.length === 2 && isStringLiteralNode(args[0]) && isStringLiteralNode(args[1])) {
    result = {
      modelName: args[0].value as string,
      collectionName: args[1].value as string,
      identityVariableName
    };
  } else if (args.length === 3 && args[0]?.type === 'Identifier' && isStringLiteralNode(args[1]) && isStringLiteralNode(args[2])) {
    result = {
      modelName: args[1].value as string,
      collectionName: args[2].value as string,
      identityVariableName,
      parentIdentityVariableName: args[0].name as string
    };
  }
  return result;
}

/**
 * Returns true when the node is a string literal (handles both `Literal` and the older
 * `StringLiteral` shapes).
 *
 * @param node - The AST node.
 * @returns True for string literal nodes.
 */
function isStringLiteralNode(node: AstNode): boolean {
  return node?.type === 'Literal' && typeof node.value === 'string';
}

/**
 * Walks a parsed file's Program body for top-level `export declare const <name>: <IdentityType>`
 * declarations and records each resolvable identity. This is the downstream path: a consumer only
 * has `@dereekb/firebase`'s shipped `.d.ts`, which carries no `firestoreModelIdentity(...)` calls —
 * only the identity *type annotation* on each exported const. The parent chain is embedded inline in
 * the type arguments, so the parent's model name is captured here and linked to its declaring
 * variable in a later pass ({@link resolveTypeAnnotationParents}).
 *
 * @param programNode - The Program AST node.
 * @param state - The scan state whose accumulator + pending-parent map are populated.
 */
function collectIdentityTypeAnnotationsFromProgram(programNode: AstNode, state: IdentityScanState): void {
  const declarators: AstNode[] = collectTopLevelDeclarators(programNode);
  for (const declarator of declarators) {
    const id: AstNode = declarator.id;
    if (id?.type !== 'Identifier' || state.accumulator.has(id.name)) continue;
    const typeNode: Maybe<AstNode> = id.typeAnnotation?.typeAnnotation;
    if (!typeNode) continue;
    const parsed: Maybe<{ readonly modelName: string; readonly collectionName: string; readonly parentModelName?: string }> = parseIdentityTypeAnnotation(typeNode);
    if (parsed) {
      state.accumulator.set(id.name, { modelName: parsed.modelName, collectionName: parsed.collectionName, identityVariableName: id.name });
      if (parsed.parentModelName != null) {
        state.pendingParentModelNameByVariable.set(id.name, parsed.parentModelName);
      }
    }
  }
}

/**
 * Reduces an identity type annotation (`RootFirestoreModelIdentity<M, C>` or
 * `FirestoreModelIdentityWithParent<<ParentType>, M, C>`, whether written as a `TSTypeReference` or
 * the `import("…").X<…>` `TSImportType` shape the compiler emits in `.d.ts`) to its model name,
 * collection name, and — for the nested form — its parent's model name.
 *
 * @param typeNode - The type-annotation node.
 * @returns The resolved identity, or null when the type is not a recognized identity shape.
 */
function parseIdentityTypeAnnotation(typeNode: AstNode): Maybe<{ readonly modelName: string; readonly collectionName: string; readonly parentModelName?: string }> {
  let result: Maybe<{ modelName: string; collectionName: string; parentModelName?: string }> = null;
  const name: Maybe<string> = referencedTypeName(typeNode);
  const args: Maybe<AstNode[]> = typeReferenceTypeArguments(typeNode);
  if (name === ROOT_IDENTITY_TYPE_NAME && args && args.length >= 2) {
    const modelName: Maybe<string> = tsLiteralStringValue(args[0]);
    const collectionName: Maybe<string> = tsLiteralStringValue(args[1]);
    if (modelName != null && collectionName != null) {
      result = { modelName, collectionName };
    }
  } else if (name === WITH_PARENT_IDENTITY_TYPE_NAME && args && args.length >= 3) {
    const modelName: Maybe<string> = tsLiteralStringValue(args[1]);
    const collectionName: Maybe<string> = tsLiteralStringValue(args[2]);
    const parentModelName: Maybe<string> = identityTypeAnnotationModelName(args[0]);
    if (modelName != null && collectionName != null) {
      result = { modelName, collectionName, ...(parentModelName == null ? {} : { parentModelName }) };
    }
  }
  return result;
}

/**
 * Resolves just the model name from an identity type annotation node (root or with-parent shape),
 * used to recover a parent identity's model name from its embedded type.
 *
 * @param typeNode - The type-annotation node.
 * @returns The model name, or null when the type is not a recognized identity shape.
 */
function identityTypeAnnotationModelName(typeNode: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  const name: Maybe<string> = referencedTypeName(typeNode);
  const args: Maybe<AstNode[]> = typeReferenceTypeArguments(typeNode);
  if (name === ROOT_IDENTITY_TYPE_NAME && args && args.length >= 1) {
    result = tsLiteralStringValue(args[0]);
  } else if (name === WITH_PARENT_IDENTITY_TYPE_NAME && args && args.length >= 2) {
    result = tsLiteralStringValue(args[1]);
  }
  return result;
}

/**
 * Returns the string value of a `TSLiteralType` wrapping a string literal (e.g. the `"nu"` in
 * `RootFirestoreModelIdentity<"notificationUser", "nu">`).
 *
 * @param node - The type-argument node.
 * @returns The literal string, or null when the node is not a string-literal type.
 */
function tsLiteralStringValue(node: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (node?.type === 'TSLiteralType' && node.literal?.type === 'Literal' && typeof node.literal.value === 'string') {
    result = node.literal.value;
  }
  return result;
}

/**
 * Links each type-annotation-discovered child identity to its parent's declaring variable by
 * matching the parent's model name (captured from the inline parent type) to an accumulated entry.
 * Entries already carrying a parent reference (e.g. from a call-expression scan) are left untouched.
 *
 * @param state - The scan state; its accumulator is mutated in place using the pending-parent map.
 */
function resolveTypeAnnotationParents(state: IdentityScanState): void {
  const { accumulator, pendingParentModelNameByVariable } = state;
  if (pendingParentModelNameByVariable.size === 0) return;
  const variableByModelName: Map<string, string> = new Map();
  for (const entry of accumulator.values()) {
    if (!variableByModelName.has(entry.modelName)) {
      variableByModelName.set(entry.modelName, entry.identityVariableName);
    }
  }
  for (const [variableName, parentModelName] of pendingParentModelNameByVariable) {
    const entry: Maybe<IdentityEntry> = accumulator.get(variableName);
    if (!entry || entry.parentIdentityVariableName) continue;
    const parentVariableName: Maybe<string> = variableByModelName.get(parentModelName);
    if (parentVariableName) {
      accumulator.set(variableName, { ...entry, parentIdentityVariableName: parentVariableName });
    }
  }
}

/**
 * Collects every `VariableDeclarator` directly under the Program body, looking through
 * `ExportNamedDeclaration` wrappers.
 *
 * @param programNode - The Program AST node.
 * @returns The list of top-level declarators.
 */
function collectTopLevelDeclarators(programNode: AstNode): AstNode[] {
  const declarators: AstNode[] = [];
  for (const statement of programNode.body ?? []) {
    const declaration: Maybe<AstNode> = unwrapVariableDeclaration(statement);
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations ?? []) {
        declarators.push(declarator);
      }
    }
  }
  return declarators;
}

function unwrapVariableDeclaration(statement: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  if (statement.type === 'ExportNamedDeclaration') {
    result = statement.declaration;
  } else if (statement.type === 'VariableDeclaration') {
    result = statement;
  }
  return result;
}

/**
 * Mutable accumulators threaded through the per-file scan. `accumulator` holds the resolved entries
 * keyed by identity variable name; `pendingParentModelNameByVariable` records each type-annotation
 * child's parent model name for linking once every file has been scanned.
 */
interface IdentityScanState {
  readonly accumulator: Map<string, IdentityEntry>;
  readonly pendingParentModelNameByVariable: Map<string, string>;
}

/**
 * Builds the workspace identity registry from two complementary discovery passes that feed one
 * accumulator.
 *
 * 1. The cwd-relative `searchRoots` globs — pick up `firestoreModelIdentity(...)` call expressions
 *    in the in-repo source and in consumer-local `components/*` / `apps/*` model files.
 * 2. The installed `@dereekb/firebase` package's `src/lib/model` directory (resolved from `cwd` via
 *    {@link resolveInstalledFirebaseModelDir}) — picks up framework identities downstream, where the
 *    package ships `.d.ts` declarations (identity type-annotations) rather than scannable call
 *    expressions. No-op inside the monorepo, where pass 1 already covers the framework source.
 *
 * Each file is parsed once and run through both the call-expression and type-annotation extractors;
 * the first writer per identity-variable name wins, so consumer-local declarations always take
 * precedence over framework ones. Results are cached by cwd + factory + roots + framework dir.
 *
 * @param cwd - ESLint working directory.
 * @param searchRoots - Relative glob patterns.
 * @param identityFactoryName - The call-expression name to match.
 * @returns The registry indexed by identity variable name and model name.
 */
function buildIdentityRegistry(cwd: string, searchRoots: readonly string[], identityFactoryName: string): IdentityRegistry {
  const frameworkModelDir: Maybe<string> = resolveInstalledFirebaseModelDir(cwd);
  const cacheKey: string = `${cwd}::${identityFactoryName}::${searchRoots.join('|')}::${frameworkModelDir ?? ''}`;
  const cached: Maybe<IdentityRegistry> = identityRegistryCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const state: IdentityScanState = { accumulator: new Map(), pendingParentModelNameByVariable: new Map() };
  const seenFiles: Set<string> = new Set();
  const scanFiles = (relativeFiles: readonly string[], baseDir: string): void => {
    for (const relativeFile of relativeFiles) {
      const absoluteFile: string = isAbsolute(relativeFile) ? relativeFile : resolve(baseDir, relativeFile);
      if (seenFiles.has(absoluteFile)) continue;
      seenFiles.add(absoluteFile);
      scanIdentityFile(absoluteFile, identityFactoryName, state);
    }
  };
  for (const pattern of searchRoots) {
    scanFiles(safeGlobSync(pattern, cwd), cwd);
  }
  if (frameworkModelDir) {
    scanFiles(safeGlobSync('**/*.ts', frameworkModelDir), frameworkModelDir);
  }
  resolveTypeAnnotationParents(state);
  const registry: IdentityRegistry = finalizeIdentityRegistry(state.accumulator);
  identityRegistryCache.set(cacheKey, registry);
  return registry;
}

/**
 * Converts a {@link VirtualModelIdentity} stub into a registry {@link IdentityEntry}, omitting
 * the optional parent reference when absent.
 *
 * @param virtual - The identity stub.
 * @returns The identity entry.
 */
function virtualModelIdentityToEntry(virtual: VirtualModelIdentity): IdentityEntry {
  return {
    modelName: virtual.modelName,
    collectionName: virtual.collectionName,
    identityVariableName: virtual.identityVariableName,
    ...(virtual.parentIdentityVariableName ? { parentIdentityVariableName: virtual.parentIdentityVariableName } : {})
  };
}

function safeGlobSync(pattern: string, cwd: string): readonly string[] {
  let result: readonly string[];
  try {
    result = globSync(pattern, { cwd });
  } catch {
    result = [];
  }
  return result;
}

function scanIdentityFile(absoluteFile: string, identityFactoryName: string, state: IdentityScanState): void {
  if (absoluteFile.endsWith('.spec.ts') || absoluteFile.endsWith('.test.ts') || absoluteFile.endsWith('.id.ts')) {
    return;
  }
  try {
    const source: string = readFileSync(absoluteFile, 'utf8');
    if (source.includes(identityFactoryName) || source.includes(IDENTITY_TYPE_SOURCE_MARKER)) {
      const programNode: AstNode = parseTypescriptSource(source, { ecmaVersion: 2022, sourceType: 'module', loc: false, range: false, jsx: false });
      collectIdentityCallsFromProgram(programNode, identityFactoryName, state.accumulator);
      collectIdentityTypeAnnotationsFromProgram(programNode, state);
    }
  } catch {
    // Best-effort discovery — unparsable files are skipped silently so the rule does not
    // crash on syntactically-invalid fixtures or generated files.
  }
}

/**
 * Wraps the accumulator into the final {@link IdentityRegistry} with both lookup maps.
 *
 * @param accumulator - Map of identity variable name to entry.
 * @returns The frozen registry.
 */
function finalizeIdentityRegistry(accumulator: ReadonlyMap<string, IdentityEntry>): IdentityRegistry {
  const byIdentityVariable: Map<string, IdentityEntry> = new Map(accumulator);
  const byModelName: Map<string, IdentityEntry> = new Map();
  for (const entry of accumulator.values()) {
    if (!byModelName.has(entry.modelName)) {
      byModelName.set(entry.modelName, entry);
    }
  }
  return { byIdentityVariable, byModelName };
}

/**
 * Builds an in-memory registry from inline {@link VirtualModelIdentity} entries provided
 * via the `virtualModelIdentities` rule option (test-only path).
 *
 * @param virtualIdentities - The inline identity stubs.
 * @returns A registry populated from the stubs.
 */
function buildVirtualIdentityRegistry(virtualIdentities: readonly VirtualModelIdentity[]): IdentityRegistry {
  const accumulator: Map<string, IdentityEntry> = new Map();
  for (const virtual of virtualIdentities) {
    accumulator.set(virtual.identityVariableName, virtualModelIdentityToEntry(virtual));
  }
  return finalizeIdentityRegistry(accumulator);
}

/**
 * Resolves the parent chain of collection names for a model name. The leaf is at the
 * highest index; root is at index 0. Returns null when any ancestor identity cannot be
 * resolved.
 *
 * @param modelName - The registered model name (registry key in service.ts).
 * @param registry - The identity registry.
 * @returns The collection-name chain, or null when unresolvable.
 */
function resolveCollectionChain(modelName: string, registry: IdentityRegistry): Maybe<readonly string[]> {
  const start: Maybe<IdentityEntry> = registry.byModelName.get(modelName);
  if (!start) return null;
  const reversed: string[] = [];
  let current: Maybe<IdentityEntry> = start;
  const visited: Set<string> = new Set();
  while (current) {
    if (visited.has(current.identityVariableName)) {
      return null; // cycle — refuse to resolve
    }
    visited.add(current.identityVariableName);
    reversed.push(current.collectionName);
    if (current.parentIdentityVariableName) {
      current = registry.byIdentityVariable.get(current.parentIdentityVariableName);
      if (!current) {
        return null; // dangling parent reference
      }
    } else {
      current = null;
    }
  }
  return reversed.reverse();
}

/**
 * Locates the model registry passed to a `firebaseModelsService(<registry>)` call in this
 * file and resolves it to a list of model-name keys. The registry argument may be:.
 *
 * - an `ObjectExpression` inlined at the call site, or
 * - an `Identifier` referring to a top-level `const <name> = { ... }` declaration in the
 *   same file.
 *
 * @param programNode - The Program AST node.
 * @param registryFactoryCallName - The call-expression name to match.
 * @returns The discovery record, or null when no registry can be found.
 */
function discoverServiceRegistry(programNode: AstNode, registryFactoryCallName: string): Maybe<RegistryDiscovery> {
  let result: Maybe<RegistryDiscovery> = null;
  const callNode: Maybe<AstNode> = findRegistryFactoryCall(programNode, registryFactoryCallName);
  if (callNode) {
    const objectLiteral = resolveRegistryObjectLiteral(callNode, programNode);
    if (objectLiteral) {
      const modelKeys = collectRegistryModelKeys(objectLiteral);
      result = { modelKeys, registryCallNode: callNode };
    }
  }
  return result;
}

function resolveRegistryObjectLiteral(callNode: AstNode, programNode: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  const args: readonly AstNode[] = callNode.arguments ?? [];
  if (args.length > 0) {
    let candidate: AstNode = args[0];
    while (candidate?.type === 'TSAsExpression') {
      candidate = candidate.expression;
    }
    if (candidate?.type === 'ObjectExpression') {
      result = candidate;
    } else if (candidate?.type === 'Identifier') {
      result = resolveObjectInitializerForIdentifier(programNode, candidate.name);
    }
  }
  return result;
}

function collectRegistryModelKeys(objectLiteral: AstNode): { name: string; node: AstNode }[] {
  const modelKeys: { name: string; node: AstNode }[] = [];
  for (const property of objectLiteral.properties ?? []) {
    if (property.type === 'Property' && !property.computed) {
      if (property.key?.type === 'Identifier') {
        modelKeys.push({ name: property.key.name, node: property });
      } else if (property.key?.type === 'Literal' && typeof property.key.value === 'string') {
        modelKeys.push({ name: property.key.value, node: property });
      }
    }
  }
  return modelKeys;
}

/**
 * Walks the program body for the first `<registryFactoryCallName>(...)` call expression.
 * Considers three shapes: a `VariableDeclarator.init` initializer (the canonical
 * `export const demoFirebaseModelServices = firebaseModelsService(...)`), a bare
 * `ExpressionStatement` (top-level call), and either wrapped in `ExportNamedDeclaration`.
 *
 * @param programNode - The Program AST node.
 * @param registryFactoryCallName - The call-expression name to match.
 * @returns The matching call expression node, or null.
 */
function findRegistryFactoryCall(programNode: AstNode, registryFactoryCallName: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  for (const statement of programNode.body ?? []) {
    const unwrapped: AstNode = statement.type === 'ExportNamedDeclaration' && statement.declaration ? statement.declaration : statement;
    const candidate: Maybe<AstNode> = extractRegistryFactoryCallFromStatement(unwrapped, registryFactoryCallName);
    if (candidate) {
      result = candidate;
      break;
    }
  }
  return result;
}

/**
 * Returns the matching `<registryFactoryCallName>(...)` call expression for a single
 * top-level statement, or null when this statement does not host one.
 *
 * @param statement - A top-level statement node (after `ExportNamedDeclaration` unwrap).
 * @param registryFactoryCallName - The call-expression name to match.
 * @returns The matching call expression, or null.
 */
function extractRegistryFactoryCallFromStatement(statement: AstNode, registryFactoryCallName: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  if (statement.type === 'VariableDeclaration') {
    for (const declarator of statement.declarations ?? []) {
      const candidate: Maybe<AstNode> = unwrapRegistryFactoryCall(declarator.init, registryFactoryCallName);
      if (candidate) {
        result = candidate;
        break;
      }
    }
  } else if (statement.type === 'ExpressionStatement') {
    result = unwrapRegistryFactoryCall(statement.expression, registryFactoryCallName);
  }
  return result;
}

/**
 * Unwraps `TSAsExpression` layers around an expression and returns it when it is a
 * `<registryFactoryCallName>(...)` call expression, otherwise null.
 *
 * @param expression - The candidate expression node (or null/undefined).
 * @param registryFactoryCallName - The call-expression name to match.
 * @returns The matching call expression, or null.
 */
function unwrapRegistryFactoryCall(expression: Maybe<AstNode>, registryFactoryCallName: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  let current: Maybe<AstNode> = expression;
  while (current?.type === 'TSAsExpression') {
    current = current.expression;
  }
  if (current?.type === 'CallExpression' && current.callee?.type === 'Identifier' && current.callee.name === registryFactoryCallName) {
    result = current;
  }
  return result;
}

/**
 * Resolves an identifier reference to its top-level `const <name> = { ... }` initializer's
 * object literal. Returns null when no matching declaration exists or its initializer is
 * not an object expression.
 *
 * @param programNode - The Program AST node.
 * @param identifierName - The identifier name to resolve.
 * @returns The matching ObjectExpression node, or null.
 */
function resolveObjectInitializerForIdentifier(programNode: AstNode, identifierName: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  const declarators: AstNode[] = collectTopLevelDeclarators(programNode);
  for (const declarator of declarators) {
    if (declarator.id?.type === 'Identifier' && declarator.id.name === identifierName && declarator.init) {
      let init: AstNode = declarator.init;
      while (init?.type === 'TSAsExpression') {
        init = init.expression;
      }
      if (init?.type === 'ObjectExpression') {
        result = init;
      }
      break;
    }
  }
  return result;
}

/**
 * Verifies that the given collection chain exists somewhere in the parsed firestore.rules
 * tree. A nested path (`gb -> gbe`) matches when the chain's collections appear in the
 * correct parent-child order along any descent of the tree. A single-segment chain also
 * matches a top-level collection-group block.
 *
 * @param chain - The ordered collection names from root to leaf.
 * @param blocks - The top-level parsed firestore-rules blocks.
 * @returns True when the chain is satisfied.
 */
function chainExistsInTree(chain: readonly string[], blocks: readonly ParsedFirestoreMatchBlock[]): boolean {
  let result: boolean = false;
  if (chain.length === 0) {
    result = true;
  } else if (matchChainAlongDescent(chain, blocks)) {
    result = true;
  } else {
    const leaf = chain.at(-1) as string;
    for (const block of blocks) {
      if (block.isCollectionGroup && block.collectionName === leaf) {
        result = true;
        break;
      }
    }
  }
  return result;
}

/**
 * Returns true when there is a descent through the tree whose `collectionName` sequence
 * exactly matches `chain` (each chain step descending into a child).
 *
 * @param chain - Remaining chain steps.
 * @param blocks - Sibling blocks at the current depth.
 * @returns True when at least one descent matches.
 */
function matchChainAlongDescent(chain: readonly string[], blocks: readonly ParsedFirestoreMatchBlock[]): boolean {
  let result: boolean = false;
  if (chain.length === 0) {
    result = true;
  } else {
    const head: string = chain[0];
    const rest: readonly string[] = chain.slice(1);
    for (const block of blocks) {
      if (block.isCollectionGroup) continue;
      if (block.collectionName === head && matchChainAlongDescent(rest, block.children)) {
        result = true;
        break;
      }
    }
  }
  return result;
}

/**
 * ESLint rule that cross-checks every model registered in an app's `service.ts`
 * (`firebaseModelsService<...>(REGISTRY)`) against the app's `firestore.rules`. Each
 * registered model must have a `match /<collection>/...` block at the correct nesting
 * depth (subcollections nested under their parent collection's match, or matched via a
 * top-level `match /{path=**}/<collection>/...` collection-group rule).
 *
 * Models whose model name appears in `allowedMissingCollectionNames` are exempt — used to
 * document intentional gaps in the rules file.
 *
 * @example
 * ```ts
 * // OK — firestore.rules has `match /gb/{guestbook} { match /gbe/{guestbookEntry} { ... } }`
 * export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
 *   guestbook: guestbookFirebaseModelServiceFactory,
 *   guestbookEntry: guestbookEntryFirebaseModelServiceFactory
 * };
 * export const demoFirebaseModelServices = firebaseModelsService(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);
 * ```
 */
export const FIREBASE_REQUIRE_FIRESTORE_RULE_FOR_SERVICE_MODEL_RULE: FirebaseRequireFirestoreRuleForServiceModelRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: "Cross-check every model registered in an app's service.ts (firebaseModelsService<...>(REGISTRY)) against firestore.rules so each model has a match block at the correct nesting depth.",
      recommended: true
    },
    messages: {
      missingMatchBlock: "Model '{{model}}' (collection '{{collection}}') is registered in service.ts but has no `match /{{collection}}/...` block in {{path}}. Add a rule for this collection, or add '{{model}}' to `allowedMissingCollectionNames` if the absence is intentional.",
      wrongNestingDepth: "Model '{{model}}' (chain '{{chain}}') is registered in service.ts but its leaf `match /{{collection}}/...` block is not nested under the expected parent chain in {{path}}. Add a nested match or a `match /{{path_wildcard}}/{{collection}}/{var}` collection-group rule.",
      unresolvedModelIdentity: "Model '{{model}}' is registered in service.ts but no `firestoreModelIdentity('{{model}}', ...)` call was found in the workspace search roots. Ensure the identity is declared and the rule's `modelSearchRoots` option covers the file.",
      rulesFileMissing: 'Could not read firestore.rules at {{path}}. Set the rule option `firestoreRulesPath` or place the file at the workspace root.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          firestoreRulesPath: { type: 'string' as const },
          virtualFirestoreRules: { type: 'string' as const },
          virtualModelIdentities: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              additionalProperties: false,
              required: ['modelName', 'collectionName', 'identityVariableName'],
              properties: {
                modelName: { type: 'string' as const },
                collectionName: { type: 'string' as const },
                identityVariableName: { type: 'string' as const },
                parentIdentityVariableName: { type: 'string' as const }
              }
            }
          },
          registryFactoryCallName: { type: 'string' as const },
          identityFactoryName: { type: 'string' as const },
          modelSearchRoots: { type: 'array' as const, items: { type: 'string' as const } },
          allowedMissingCollectionNames: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options: FirebaseRequireFirestoreRuleForServiceModelRuleOptions = context.options[0] ?? {};
    const registryFactoryCallName: string = options.registryFactoryCallName ?? DEFAULT_REGISTRY_FACTORY_CALL_NAME;
    const identityFactoryName: string = options.identityFactoryName ?? DEFAULT_IDENTITY_FACTORY_NAME;
    const modelSearchRoots: readonly string[] = options.modelSearchRoots ?? DEFAULT_MODEL_SEARCH_ROOTS;
    const allowedMissingCollectionNames: ReadonlySet<string> = new Set(options.allowedMissingCollectionNames ?? []);
    const cwd: string = context.cwd ?? process.cwd();

    return {
      Program: (programNode: AstNode) => {
        const discovery: Maybe<RegistryDiscovery> = discoverServiceRegistry(programNode, registryFactoryCallName);
        if (!discovery) return;

        const rulesResolution = loadParsedFirestoreRules(options, cwd);
        if (rulesResolution.error) {
          context.report({ node: discovery.registryCallNode, messageId: 'rulesFileMissing', data: { path: rulesResolution.absolutePath ?? DEFAULT_FIRESTORE_RULES_FILENAME } });
          return;
        }

        const registry: IdentityRegistry = options.virtualModelIdentities ? buildVirtualIdentityRegistry(options.virtualModelIdentities) : buildIdentityRegistry(cwd, modelSearchRoots, identityFactoryName);
        const parsedTree: readonly ParsedFirestoreMatchBlock[] = rulesResolution.blocks ?? [];
        const rulesPath: string = rulesResolution.absolutePath ?? DEFAULT_FIRESTORE_RULES_FILENAME;

        const reportContext: ReportModelKeyContext = { ruleContext: context, registry, parsedTree, rulesPath };
        for (const modelKey of discovery.modelKeys) {
          if (!allowedMissingCollectionNames.has(modelKey.name)) {
            reportModelKey(reportContext, modelKey);
          }
        }
      }
    };
  }
};

interface ReportModelKeyContext {
  readonly ruleContext: RuleContext;
  readonly registry: IdentityRegistry;
  readonly parsedTree: readonly ParsedFirestoreMatchBlock[];
  readonly rulesPath: string;
}

function reportModelKey(context: ReportModelKeyContext, modelKey: { name: string; node: AstNode }): void {
  const chain: Maybe<readonly string[]> = resolveCollectionChain(modelKey.name, context.registry);
  if (!chain) {
    context.ruleContext.report({ node: modelKey.node, messageId: 'unresolvedModelIdentity', data: { model: modelKey.name } });
  } else if (chain.length > 0 && !chainExistsInTree(chain, context.parsedTree)) {
    const leaf = chain.at(-1) as string;
    if (chain.length === 1) {
      context.ruleContext.report({ node: modelKey.node, messageId: 'missingMatchBlock', data: { model: modelKey.name, collection: leaf, path: context.rulesPath } });
    } else {
      context.ruleContext.report({ node: modelKey.node, messageId: 'wrongNestingDepth', data: { model: modelKey.name, chain: chain.join(' / '), collection: leaf, path: context.rulesPath, path_wildcard: 'path=**' } });
    }
  }
}

interface FirestoreRulesResolution {
  readonly blocks?: readonly ParsedFirestoreMatchBlock[];
  readonly absolutePath?: string;
  readonly error?: boolean;
}

/**
 * Loads parsed `firestore.rules` blocks from either the inline `virtualFirestoreRules`
 * option (used by specs) or the resolved rules-file path.
 *
 * @param options - Rule options.
 * @param cwd - ESLint working directory.
 * @returns A resolution record carrying blocks, an absolute path, or an error flag.
 */
function loadParsedFirestoreRules(options: FirebaseRequireFirestoreRuleForServiceModelRuleOptions, cwd: string): FirestoreRulesResolution {
  let result: FirestoreRulesResolution;
  if (typeof options.virtualFirestoreRules === 'string') {
    result = { blocks: parseFirestoreRules(options.virtualFirestoreRules) };
  } else {
    const absolutePath: string = resolveFirestoreRulesPath(options, cwd);
    const blocks: Maybe<readonly ParsedFirestoreMatchBlock[]> = loadParsedFirestoreRulesFromPath(absolutePath);
    if (blocks) {
      result = { blocks, absolutePath };
    } else {
      result = { absolutePath, error: true };
    }
  }
  return result;
}
