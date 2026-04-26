/**
 * Cross-file AST extraction for `dbx_storagefile_m_validate_app`.
 *
 * Every component + API file lands in a single in-memory ts-morph
 * `Project`; extraction resolves spreads and array-binding references
 * by symbol-name lookup inside that project — no language service.
 *
 * External imports (`@dereekb/*`) are tracked in a trust-list so
 * rules can suppress "unresolved" / "orphan" diagnostics for
 * identifiers that cross into upstream packages.
 */

import { Node, SyntaxKind, type ArrayLiteralExpression, type ArrowFunction, type FunctionDeclaration, type FunctionExpression, type ObjectLiteralExpression, type SourceFile, type VariableDeclaration } from 'ts-morph';
import { apiRelPath, asObjectLiteral, buildInMemoryProject, collectTrustedExternalIdentifiers, collectTypeofReferences, componentRelPath, findLocalVariable, findReturnExpression, getPropertyInitializer, readIdentifierProperty, readStringLiteralInitializer, typeAnnotationText, unwrapAsExpressions } from '../_validate/ast.js';
import type { AppStorageFilesInspection, ExtractedAppStorageFiles, ExtractedGroupIdsFunction, ExtractedProcessingConfig, ExtractedProcessingHandlerCall, ExtractedProcessingSubtaskAlias, ExtractedProcessingSubtaskConstant, ExtractedPurposeConstant, ExtractedUploadInitializerEntry, ExtractedUploadServiceCall, ExtractedUploadServiceWiring, ExtractedUploadedFileTypeIdentifierConstant } from './types.js';

const STORAGEFILE_PURPOSE_TYPE = 'StorageFilePurpose';
const UPLOADED_FILE_TYPE_IDENTIFIER_TYPE = 'UploadedFileTypeIdentifier';
const STORAGEFILE_PROCESSING_SUBTASK_TYPE = 'StorageFileProcessingSubtask';
const UPLOAD_SERVICE_INITIALIZER_TYPE = 'StorageFileInitializeFromUploadServiceInitializer';
const PROCESSING_CONFIG_TYPE = 'StorageFileProcessingPurposeSubtaskProcessorConfig';
const UPLOAD_SERVICE_FACTORY = 'storageFileInitializeFromUploadService';
const PROCESSING_HANDLER_FACTORY = 'storageFileProcessingNotificationTaskHandler';
const UPLOAD_SERVICE_PROVIDE_TOKEN = 'StorageFileInitializeFromUploadService';
const PROCESSING_SUBTASK_ALIAS_SUFFIX = 'ProcessingSubtask';
const GROUP_IDS_FUNCTION_SUFFIXES: readonly string[] = ['StorageFileGroupIds', 'FileGroupIds'];

/**
 * Builds a ts-morph project from the prepared inspection and extracts every
 * fact the storage-file rules need — `_PURPOSE` constants, file-type
 * identifiers, group-id helpers, upload service factories, processing handler
 * factories, and reachable bindings — in a single pass so the rules run
 * against a stable snapshot.
 *
 * @param inspection - the prepared component + api file snapshot
 * @returns the structured extraction used by the rules layer
 */
export function extractAppStorageFiles(inspection: AppStorageFilesInspection): ExtractedAppStorageFiles {
  const { componentSources, apiSources } = buildInMemoryProject(inspection);
  const trustedExternalIdentifiers = collectTrustedExternalIdentifiers([...componentSources, ...apiSources]);

  // Component pass
  const purposeConstants = extractPurposeConstants(componentSources);
  const fileTypeIdentifierConstants = extractFileTypeIdentifierConstants(componentSources);
  const processingSubtaskConstants = extractProcessingSubtaskConstants(componentSources);
  const processingSubtaskAliases = extractProcessingSubtaskAliases(componentSources);
  const groupIdsFunctions = extractGroupIdsFunctions(componentSources);

  // API pass
  const uploadInitializerEntries = extractUploadInitializerEntries(apiSources);
  const apiFunctionIndex = buildApiFunctionIndex(apiSources);
  const uploadServiceCalls = extractUploadServiceCalls(apiSources, apiFunctionIndex);
  const uploadServiceWirings = extractUploadServiceWirings(apiSources);
  const processingConfigs = extractProcessingConfigs(apiSources);
  const processingHandlerCalls = extractProcessingHandlerCalls(apiSources);

  const result: ExtractedAppStorageFiles = {
    purposeConstants,
    fileTypeIdentifierConstants,
    processingSubtaskConstants,
    processingSubtaskAliases,
    groupIdsFunctions,
    uploadInitializerEntries,
    uploadServiceCalls,
    uploadServiceWirings,
    processingConfigs,
    processingHandlerCalls,
    trustedExternalIdentifiers
  };
  return result;
}

// MARK: Component — purpose constants
function extractPurposeConstants(sources: readonly SourceFile[]): readonly ExtractedPurposeConstant[] {
  const out: ExtractedPurposeConstant[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const typeText = typeAnnotationText(decl);
        if (typeText !== STORAGEFILE_PURPOSE_TYPE) continue;
        out.push({
          symbolName: decl.getName(),
          purposeCode: readStringLiteralInitializer(decl),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        });
      }
    }
  }
  return out;
}

// MARK: Component — file type identifier constants
function extractFileTypeIdentifierConstants(sources: readonly SourceFile[]): readonly ExtractedUploadedFileTypeIdentifierConstant[] {
  const out: ExtractedUploadedFileTypeIdentifierConstant[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const typeText = typeAnnotationText(decl);
        if (typeText !== UPLOADED_FILE_TYPE_IDENTIFIER_TYPE) continue;
        out.push({
          symbolName: decl.getName(),
          typeCode: readStringLiteralInitializer(decl),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        });
      }
    }
  }
  return out;
}

// MARK: Component — processing subtask constants
function extractProcessingSubtaskConstants(sources: readonly SourceFile[]): readonly ExtractedProcessingSubtaskConstant[] {
  const out: ExtractedProcessingSubtaskConstant[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const typeText = typeAnnotationText(decl);
        if (typeText !== STORAGEFILE_PROCESSING_SUBTASK_TYPE) continue;
        out.push({
          symbolName: decl.getName(),
          subtaskCode: readStringLiteralInitializer(decl),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        });
      }
    }
  }
  return out;
}

// MARK: Component — processing subtask aliases
function extractProcessingSubtaskAliases(sources: readonly SourceFile[]): readonly ExtractedProcessingSubtaskAlias[] {
  const out: ExtractedProcessingSubtaskAlias[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const alias of sf.getTypeAliases()) {
      const name = alias.getName();
      if (!name.endsWith(PROCESSING_SUBTASK_ALIAS_SUFFIX)) continue;
      const typeNode = alias.getTypeNode();
      const refs: string[] = [];
      if (typeNode) {
        collectTypeofReferences(typeNode, refs);
      }
      out.push({ symbolName: name, subtaskConstantNames: refs, sourceFile: rel });
    }
  }
  return out;
}

// MARK: Component — group-ids functions
function extractGroupIdsFunctions(sources: readonly SourceFile[]): readonly ExtractedGroupIdsFunction[] {
  const out: ExtractedGroupIdsFunction[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      if (!name) continue;
      if (!hasGroupIdsSuffix(name)) continue;
      out.push({ symbolName: name, sourceFile: rel });
    }
  }
  return out;
}

function hasGroupIdsSuffix(name: string): boolean {
  for (const suffix of GROUP_IDS_FUNCTION_SUFFIXES) {
    if (name.endsWith(suffix)) return true;
  }
  return false;
}

// MARK: API — upload initializer entries
function extractUploadInitializerEntries(sources: readonly SourceFile[]): readonly ExtractedUploadInitializerEntry[] {
  const out: ExtractedUploadInitializerEntry[] = [];
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const typeText = typeAnnotationText(decl);
      if (typeText !== UPLOAD_SERVICE_INITIALIZER_TYPE) continue;
      const obj = asObjectLiteral(decl.getInitializer());
      if (!obj) continue;
      const typeIdent = readIdentifierProperty(obj, 'type');
      if (!typeIdent) continue;
      out.push({
        typeIdentifier: typeIdent,
        bindingName: decl.getName(),
        sourceFile: rel,
        line: decl.getStartLineNumber()
      });
    }
  }
  return out;
}

// MARK: API — upload service calls
type ApiFunctionNode = FunctionDeclaration | ArrowFunction | FunctionExpression;

interface ApiFunctionIndex {
  readonly functionsByName: ReadonlyMap<string, { readonly node: ApiFunctionNode; readonly sourceFile: SourceFile }>;
}

function buildApiFunctionIndex(sources: readonly SourceFile[]): ApiFunctionIndex {
  const map = new Map<string, { readonly node: ApiFunctionNode; readonly sourceFile: SourceFile }>();
  for (const sf of sources) {
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      if (name) {
        map.set(name, { node: fn, sourceFile: sf });
      }
    }
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const initializer = unwrapAsExpressions(decl.getInitializer());
        if (!initializer) continue;
        if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
          map.set(decl.getName(), { node: initializer, sourceFile: sf });
        }
      }
    }
  }
  const result: ApiFunctionIndex = { functionsByName: map };
  return result;
}

/**
 * Walk a binding name through local-variable, spread, and cross-file
 * function-call indirection until we find a concrete array literal —
 * collect every identifier that ends up as a member of that array.
 *
 * @param node - the value-position node to inspect
 * @param sf - the source file the node belongs to
 * @param index - the api function lookup index for chasing chained calls
 * @param resolved - mutable buffer that receives in-file resolved binding names
 * @param unresolved - mutable buffer that receives identifiers the trace could not follow locally
 * @param visited - cycle-guard set for recursive identifier traversal
 * @returns `true` when an initializer binding (resolved or unresolved) was recorded
 */
/**
 * Context for tracing storage-file initializer bindings reachable from a node
 * or identifier.
 */
interface InitializerBindingCollectorContext {
  readonly sf: SourceFile;
  readonly index: ApiFunctionIndex;
  readonly resolved: string[];
  readonly unresolved: string[];
  readonly visited: Set<string>;
}

/**
 * Options for collecting initializer bindings from a value-position node.
 */
interface CollectInitializerBindingsFromValueOptions extends InitializerBindingCollectorContext {
  readonly node: Node | undefined;
}

function collectInitializerBindingsFromValue(options: CollectInitializerBindingsFromValueOptions): boolean {
  const { node, sf, index, resolved, unresolved, visited } = options;
  const inner = unwrapAsExpressions(node);
  if (!inner) return false;
  if (Node.isArrayLiteralExpression(inner)) {
    for (const el of inner.getElements()) {
      if (Node.isSpreadElement(el)) {
        const spreadInner = el.getExpression();
        if (Node.isIdentifier(spreadInner)) {
          collectInitializerBindingsFromIdentifier({ name: spreadInner.getText(), sf, index, resolved, unresolved, visited });
        } else if (Node.isCallExpression(spreadInner)) {
          const callee = spreadInner.getExpression();
          if (Node.isIdentifier(callee)) {
            collectInitializerBindingsFromIdentifier({ name: callee.getText(), sf, index, resolved, unresolved, visited });
          }
        }
        continue;
      }
      const elementInner = unwrapAsExpressions(el);
      if (elementInner && Node.isIdentifier(elementInner)) {
        resolved.push(elementInner.getText());
      }
    }
    return true;
  }
  if (Node.isCallExpression(inner)) {
    const callee = inner.getExpression();
    if (Node.isIdentifier(callee)) {
      return collectInitializerBindingsFromIdentifier({ name: callee.getText(), sf, index, resolved, unresolved, visited });
    }
  }
  if (Node.isIdentifier(inner)) {
    return collectInitializerBindingsFromIdentifier({ name: inner.getText(), sf, index, resolved, unresolved, visited });
  }
  return false;
}

/**
 * Options for collecting initializer bindings starting from an identifier name.
 */
interface CollectInitializerBindingsFromIdentifierOptions extends InitializerBindingCollectorContext {
  readonly name: string;
}

function collectInitializerBindingsFromIdentifier(options: CollectInitializerBindingsFromIdentifierOptions): boolean {
  const { name, sf, index, resolved, unresolved, visited } = options;
  const localKey = `${sf.getFilePath()}::${name}`;
  let resolvedAny = false;
  if (!visited.has(localKey)) {
    visited.add(localKey);
    const localDecl = findLocalVariable(sf, name);
    if (localDecl) {
      const declInit = localDecl.getInitializer();
      if (declInit && collectInitializerBindingsFromValue({ node: declInit, sf, index, resolved, unresolved, visited })) {
        resolvedAny = true;
      }
    }
  }

  const fnKey = `fn::${name}`;
  if (!visited.has(fnKey)) {
    visited.add(fnKey);
    const fnEntry = index.functionsByName.get(name);
    if (fnEntry) {
      const ret = findReturnExpression(fnEntry.node);
      if (ret && collectInitializerBindingsFromValue({ node: ret, sf: fnEntry.sourceFile, index, resolved, unresolved, visited })) {
        resolvedAny = true;
      }
    }
  }

  if (!resolvedAny) {
    unresolved.push(name);
  }
  return resolvedAny;
}

interface UploadInitializerArrayCollectorOptions {
  readonly initializerArr: ArrayLiteralExpression;
  readonly sf: SourceFile;
  readonly index: ApiFunctionIndex;
  readonly direct: string[];
  readonly spreads: string[];
  readonly unresolved: string[];
  readonly resolved: string[];
}

/**
 * Walks an `initializer` array literal, classifying each element into the
 * direct/spread buckets and chasing identifier references through
 * {@link collectInitializerBindingsFromIdentifier}.
 *
 * @param options - the array literal, source file, function index, and the
 *   mutable bucket arrays to populate
 */
function collectUploadInitializerArray(options: UploadInitializerArrayCollectorOptions): void {
  const { initializerArr, sf, index, direct, spreads, resolved, unresolved } = options;
  const visited = new Set<string>();
  for (const el of initializerArr.getElements()) {
    if (Node.isSpreadElement(el)) {
      const inner = el.getExpression();
      if (Node.isIdentifier(inner)) {
        const name = inner.getText();
        spreads.push(name);
        collectInitializerBindingsFromIdentifier({ name, sf, index, resolved, unresolved, visited });
      } else if (Node.isCallExpression(inner)) {
        const callee = inner.getExpression();
        if (Node.isIdentifier(callee)) {
          const name = callee.getText();
          spreads.push(name);
          collectInitializerBindingsFromIdentifier({ name, sf, index, resolved, unresolved, visited });
        }
      }
      continue;
    }
    const inner = unwrapAsExpressions(el);
    if (inner && Node.isIdentifier(inner)) {
      const name = inner.getText();
      direct.push(name);
      resolved.push(name);
    }
  }
}

function extractUploadServiceCalls(sources: readonly SourceFile[], index: ApiFunctionIndex): readonly ExtractedUploadServiceCall[] {
  const out: ExtractedUploadServiceCall[] = [];
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!Node.isIdentifier(expr) || expr.getText() !== UPLOAD_SERVICE_FACTORY) continue;
      const args = call.getArguments();
      const first = args[0] ? resolveObjectArg(args[0], sf) : undefined;
      if (!first) continue;
      const initializerArr = resolveArrayFromProperty(first, 'initializer', sf);
      const direct: string[] = [];
      const spreads: string[] = [];
      const unresolved: string[] = [];
      const resolved: string[] = [];
      if (initializerArr) {
        collectUploadInitializerArray({ initializerArr, sf, index, direct, spreads, unresolved, resolved });
      }
      const enclosing = enclosingFactoryName(call);
      out.push({
        directBindingNames: direct,
        spreadBindingNames: spreads,
        unresolvedSpreadIdentifiers: unresolved,
        resolvedInitializerBindings: resolved,
        enclosingFactoryName: enclosing,
        sourceFile: rel
      });
    }
  }
  return out;
}

function resolveObjectArg(node: Node, sf: SourceFile): ObjectLiteralExpression | undefined {
  const inner = unwrapAsExpressions(node);
  if (!inner) return undefined;
  if (Node.isObjectLiteralExpression(inner)) return inner;
  if (Node.isIdentifier(inner)) {
    const declNode = findLocalVariable(sf, inner.getText());
    if (declNode) {
      const declInit = unwrapAsExpressions(declNode.getInitializer());
      if (declInit && Node.isObjectLiteralExpression(declInit)) {
        return declInit;
      }
    }
  }
  return undefined;
}

function resolveArrayFromProperty(obj: ObjectLiteralExpression, name: string, sf: SourceFile): ArrayLiteralExpression | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  if (!init) return undefined;
  if (Node.isArrayLiteralExpression(init)) return init;
  if (Node.isIdentifier(init)) {
    const declNode = findLocalVariable(sf, init.getText());
    if (declNode) {
      const declInit = unwrapAsExpressions(declNode.getInitializer());
      if (declInit && Node.isArrayLiteralExpression(declInit)) {
        return declInit;
      }
    }
  }
  return undefined;
}

function enclosingFactoryName(node: Node): string | undefined {
  let current: Node | undefined = node.getParent();
  let result: string | undefined;
  while (current) {
    if (Node.isFunctionDeclaration(current)) {
      result = current.getName() ?? undefined;
      break;
    }
    if (Node.isVariableDeclaration(current)) {
      result = current.getName();
      break;
    }
    current = current.getParent();
  }
  return result;
}

// MARK: API — upload service wirings (NestJS providers)
function extractUploadServiceWirings(sources: readonly SourceFile[]): readonly ExtractedUploadServiceWiring[] {
  const out: ExtractedUploadServiceWiring[] = [];
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
      const provideIdent = readIdentifierProperty(obj, 'provide');
      if (provideIdent !== UPLOAD_SERVICE_PROVIDE_TOKEN) continue;
      const useFactory = readIdentifierProperty(obj, 'useFactory');
      out.push({ useFactoryIdentifier: useFactory, sourceFile: rel });
    }
  }
  return out;
}

// MARK: API — processing configs
function extractProcessingConfigs(sources: readonly SourceFile[]): readonly ExtractedProcessingConfig[] {
  const out: ExtractedProcessingConfig[] = [];
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const config = extractProcessingConfigFromDecl(decl, rel);
      if (config) {
        out.push(config);
      }
    }
  }
  return out;
}

/**
 * Extracts a single {@link ExtractedProcessingConfig} from a variable
 * declaration, returning `undefined` for declarations that aren't typed as a
 * `ProcessingConfig` or that don't carry the required `target` identifier.
 *
 * @param decl - the variable declaration to inspect
 * @param rel - the relative source file path used in the result record
 * @returns the extracted processing config, or `undefined` when the
 *   declaration is not a recognisable processing config
 */
function extractProcessingConfigFromDecl(decl: VariableDeclaration, rel: string): ExtractedProcessingConfig | undefined {
  const typeNode = decl.getTypeNode();
  if (!typeNode) return undefined;
  const typeText = typeNode.getText();
  if (!typeText.startsWith(`${PROCESSING_CONFIG_TYPE}<`) && typeText !== PROCESSING_CONFIG_TYPE) return undefined;
  const obj = asObjectLiteral(decl.getInitializer());
  if (!obj) return undefined;
  const target = readIdentifierProperty(obj, 'target');
  if (!target) return undefined;
  const subtasks = readFlowSubtasks(obj);
  return {
    targetIdentifier: target,
    flowSubtaskIdentifiers: subtasks,
    sourceFile: rel,
    line: decl.getStartLineNumber()
  };
}

/**
 * Reads the `subtask` identifiers from a `flow: [{ subtask: ... }, ...]`
 * property of a processing config object literal.
 *
 * @param obj - the processing config object literal
 * @returns the collected subtask identifiers (empty when no `flow` array is
 *   present or no entries declare a `subtask`)
 */
function readFlowSubtasks(obj: ObjectLiteralExpression): string[] {
  const flowInit = unwrapAsExpressions(getPropertyInitializer(obj, 'flow'));
  const subtasks: string[] = [];
  if (flowInit && Node.isArrayLiteralExpression(flowInit)) {
    for (const el of flowInit.getElements()) {
      const inner = unwrapAsExpressions(el);
      if (inner && Node.isObjectLiteralExpression(inner)) {
        const subtask = readIdentifierProperty(inner, 'subtask');
        if (subtask) subtasks.push(subtask);
      }
    }
  }
  return subtasks;
}

// MARK: API — processing handler calls
function extractProcessingHandlerCalls(sources: readonly SourceFile[]): readonly ExtractedProcessingHandlerCall[] {
  const out: ExtractedProcessingHandlerCall[] = [];
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!Node.isIdentifier(expr) || expr.getText() !== PROCESSING_HANDLER_FACTORY) continue;
      const args = call.getArguments();
      const first = args[0] ? resolveObjectArg(args[0], sf) : undefined;
      if (!first) continue;
      const processorsArr = resolveArrayFromProperty(first, 'processors', sf);
      const direct: string[] = [];
      const spreads: string[] = [];
      if (processorsArr) {
        collectProcessorArrayElements(processorsArr, direct, spreads);
      }
      out.push({
        directProcessorReferences: direct,
        spreadProcessorReferences: spreads,
        sourceFile: rel
      });
    }
  }
  return out;
}

/**
 * Splits the elements of a `processors` array literal into direct and spread
 * identifier references, supporting both bare identifiers and call
 * expressions whose callee is an identifier.
 *
 * @param processorsArr - the resolved `processors` array literal
 * @param direct - mutable buffer that receives directly referenced names
 * @param spreads - mutable buffer that receives spread-referenced names
 */
function collectProcessorArrayElements(processorsArr: ArrayLiteralExpression, direct: string[], spreads: string[]): void {
  for (const el of processorsArr.getElements()) {
    if (Node.isSpreadElement(el)) {
      addProcessorIdentifierName(el.getExpression(), spreads);
      continue;
    }
    const inner = unwrapAsExpressions(el);
    if (inner) {
      addProcessorIdentifierName(inner, direct);
    }
  }
}

/**
 * Pushes the identifier name onto `bucket` when `node` is itself an identifier
 * or a call expression whose callee is an identifier; otherwise no-op.
 *
 * @param node - the node to inspect
 * @param bucket - the mutable buffer to push the resolved name into
 */
function addProcessorIdentifierName(node: Node | undefined, bucket: string[]): void {
  if (!node) return;
  if (Node.isIdentifier(node)) {
    bucket.push(node.getText());
    return;
  }
  if (Node.isCallExpression(node)) {
    const callee = node.getExpression();
    if (Node.isIdentifier(callee)) {
      bucket.push(callee.getText());
    }
  }
}
