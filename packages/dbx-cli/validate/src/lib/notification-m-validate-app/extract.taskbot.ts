/**
 * NotificationTaskBot extraction for `dbx_notification_m_validate_app`.
 *
 * Reads the bot wiring an app declares across both sides — script type constants, script configs and their
 * aggregates, the `notificationTaskBotScriptConfigRecord(...)` registry, the `appNotificationTaskBotScriptConfigService(...)`
 * wiring, the NTBR handler's `processors` and `validate`, the repair sweep call — plus the workspace's `firestore.rules`
 * and `firestore.indexes.json` facts. Pure: works on the in-memory project `extract.ts` builds.
 *
 * Names from `@dereekb/firebase` / `@dereekb/firebase-server` are mirrored as strings, not imported; the drift spec
 * (`taskbot.upstream.spec.ts`) fails when one is renamed upstream. Upstream factory callees resolve `@dereekb/*` import
 * aliases and namespace imports (`readCalleeName`).
 */

import { Node, SyntaxKind, type ArrayLiteralExpression, type CallExpression, type ObjectLiteralExpression, type SourceFile, type VariableDeclaration } from 'ts-morph';
import {
  apiRelPath,
  asArrayLiteral,
  asObjectLiteral,
  findLocalVariable,
  findReturnExpression,
  getPropertyInitializer,
  readBooleanProperty,
  readStringLiteralInitializer,
  readCalleeName,
  readStringProperty,
  resolveArrayLiteralProperty,
  resolveObjectLiteralArgument,
  sourceSideOf,
  typeAnnotationText,
  unwrapAsExpressions,
  type DereekbImportIndex
} from '../_core/_validate/ast.js';
import type { ApiFunctionEntry, ApiFunctionIndex } from './extract.function-index.js';
import type {
  AppNotificationsWorkspaceFiles,
  ExtractedAppNotificationTaskBot,
  ExtractedSourceLocation,
  ExtractedTaskBotFirestoreIndexes,
  ExtractedTaskBotFirestoreRules,
  ExtractedTaskBotProcessor,
  ExtractedTaskBotRegistry,
  ExtractedTaskBotRegistryWiring,
  ExtractedTaskBotRunHandlerCall,
  ExtractedTaskBotScriptConfig,
  ExtractedTaskBotScriptConfigDataTypeSource,
  ExtractedTaskBotScriptTypeConstant,
  ExtractedTaskBotScriptTypeRef,
  ExtractedTaskServiceCall,
  ExtractedTaskServiceValidateStatus
} from './types.js';

// MARK: Upstream names
export const NOTIFICATION_TASK_BOT_SCRIPT_TYPE = 'NotificationTaskBotScriptType';
export const NOTIFICATION_TASK_BOT_SCRIPT_CONFIG = 'NotificationTaskBotScriptConfig';
export const NOTIFICATION_TASK_BOT_SCRIPT_GROUP = 'NotificationTaskBotScriptGroup';
export const NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_GROUP_FIELD = 'group';
export const NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_ALLOW_OWNER_OPT_OUT_FIELD = 'allowOwnerOptOut';
export const NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_DATA_TYPE_FIELD = 'dataType';
export const NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD_FACTORY = 'notificationTaskBotScriptConfigRecord';
export const NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY = 'appNotificationTaskBotScriptConfigService';
export const NOTIFICATION_TASK_BOT_SCRIPT_PROCESSOR_CONFIG = 'NotificationTaskBotScriptProcessorConfig';
export const NOTIFICATION_TASK_BOT_RUN_HANDLER_FACTORY = 'notificationTaskBotRunNotificationTaskHandler';
export const NOTIFICATION_TASK_BOT_RUN_TASK_TYPE = 'NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE';
export const ALL_NOTIFICATION_TASK_BOT_TASK_TYPES = 'ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES';
export const NOTIFICATION_TASK_BOT_GET_ALL_KNOWN_SCRIPT_TYPES = 'getAllKnownScriptTypes';
export const NOTIFICATION_TASK_BOT_REPAIR_METHOD = 'repairAllNotificationTaskBots';
export const NOTIFICATION_TASK_BOT_REPAIR_FACTORY = 'repairAllNotificationTaskBotsFactory';
export const NOTIFICATION_TASK_BOT_COLLECTION = 'ntb';
export const NOTIFICATION_TASK_BOT_NEXT_AT_FIELD = 'nat';

/**
 * Every upstream name the NotificationTaskBot checks mirror. `taskbot.upstream.spec.ts` asserts each still exists.
 */
export const NOTIFICATION_TASK_BOT_UPSTREAM_NAMES: readonly string[] = [
  NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  NOTIFICATION_TASK_BOT_SCRIPT_CONFIG,
  NOTIFICATION_TASK_BOT_SCRIPT_GROUP,
  NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_GROUP_FIELD,
  NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_ALLOW_OWNER_OPT_OUT_FIELD,
  NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_DATA_TYPE_FIELD,
  NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD_FACTORY,
  NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY,
  NOTIFICATION_TASK_BOT_SCRIPT_PROCESSOR_CONFIG,
  NOTIFICATION_TASK_BOT_RUN_HANDLER_FACTORY,
  NOTIFICATION_TASK_BOT_RUN_TASK_TYPE,
  ALL_NOTIFICATION_TASK_BOT_TASK_TYPES,
  NOTIFICATION_TASK_BOT_GET_ALL_KNOWN_SCRIPT_TYPES,
  NOTIFICATION_TASK_BOT_REPAIR_METHOD,
  NOTIFICATION_TASK_BOT_REPAIR_FACTORY,
  NOTIFICATION_TASK_BOT_COLLECTION,
  NOTIFICATION_TASK_BOT_NEXT_AT_FIELD
];

/**
 * Matches an explicit `match /ntb/{...}` or `match /{path=**}/ntb/{...}` block in comment-stripped rules text.
 */
const NTB_RULE_MATCH_REGEX = /match\s+\/(?:\{[^}]*=\*\*\}\/)?ntb\/\{[^}]+\}/;

/**
 * Hop limit for chasing identifiers through constants, bindings and locals.
 */
const MAX_RESOLVE_DEPTH = 6;

// MARK: Input
/**
 * Input to {@link extractAppNotificationTaskBot}.
 */
export interface ExtractAppNotificationTaskBotInput {
  readonly componentSources: readonly SourceFile[];
  readonly apiSources: readonly SourceFile[];
  readonly functionIndex: ApiFunctionIndex;
  readonly trustedExternalIdentifiers: ReadonlySet<string>;
  /**
   * The per-file `@dereekb/*` import bindings, used to match aliased and namespaced upstream factory calls.
   */
  readonly dereekbImports: DereekbImportIndex;
  readonly taskServiceCalls: readonly ExtractedTaskServiceCall[];
  readonly workspace: AppNotificationsWorkspaceFiles | undefined;
}

interface TaskBotIndex {
  readonly constants: ReadonlyMap<string, ExtractedTaskBotScriptTypeConstant>;
  readonly configs: ReadonlyMap<string, ExtractedTaskBotScriptConfig>;
  readonly aggregates: ReadonlyMap<string, VariableDeclaration>;
  /**
   * The string-literal `key` of every typed `NotificationTaskBotScriptGroup` constant, by name.
   */
  readonly groupKeys: ReadonlyMap<string, string | undefined>;
  readonly functionIndex: ApiFunctionIndex;
  readonly trusted: ReadonlySet<string>;
  readonly imports: DereekbImportIndex;
}

/**
 * Extracts every NotificationTaskBot fact the `NOTIF_TASK_BOT_*` rules need.
 *
 * @param input - The project's sources, the API function index, the trust list, the task service calls and the workspace files.
 * @returns The NotificationTaskBot extraction.
 */
export function extractAppNotificationTaskBot(input: ExtractAppNotificationTaskBotInput): ExtractedAppNotificationTaskBot {
  const { componentSources, apiSources, functionIndex, trustedExternalIdentifiers: trusted, dereekbImports: imports, taskServiceCalls, workspace } = input;
  const allSources = [...componentSources, ...apiSources];

  const scriptTypeConstants = extractScriptTypeConstants(allSources);
  const constants = new Map(scriptTypeConstants.map((c) => [c.symbolName, c]));
  const groupKeys = extractScriptGroupKeys(allSources);
  const partialIndex = { constants, configs: new Map<string, ExtractedTaskBotScriptConfig>(), aggregates: new Map<string, VariableDeclaration>(), groupKeys, functionIndex, trusted, imports };
  const scriptConfigs = extractScriptConfigs(allSources, partialIndex);
  const index: TaskBotIndex = partialIndex;

  const registries = extractRegistries(allSources, index);
  const registryWirings = extractRegistryWirings(apiSources, imports);
  const runHandlerCalls = extractRunHandlerCalls(apiSources, index);
  const repairCalls = extractRepairCalls(apiSources, imports);

  const taskServiceListsTaskBotTypes = taskServiceCalls.some((call) => taskServiceCallListsTaskBotTypes(call));
  const taskBotInUse = scriptConfigs.length > 0 || registries.length > 0 || registryWirings.some((w) => w.kind !== 'empty') || runHandlerCalls.length > 0 || taskServiceListsTaskBotTypes;

  const result: ExtractedAppNotificationTaskBot = {
    taskBotInUse,
    scriptTypeConstants,
    scriptConfigs,
    registries,
    registryWirings,
    runHandlerCalls,
    repairCalls,
    firestoreRules: workspace?.firestoreRules ? readFirestoreRulesFacts(workspace.firestoreRules.path, workspace.firestoreRules.text) : undefined,
    firestoreIndexes: workspace?.firestoreIndexes ? readFirestoreIndexesFacts(workspace.firestoreIndexes.path, workspace.firestoreIndexes.text) : undefined
  };
  return result;
}

/**
 * Whether a `notificationTaskService({ validate })` call lists the NotificationTaskBot task types.
 *
 * @param call - The extracted task service call.
 * @returns `true` when `validate` spreads `ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES` or lists `NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE`.
 */
export function taskServiceCallListsTaskBotTypes(call: ExtractedTaskServiceCall): boolean {
  return call.spreadValidateIdentifiers.includes(ALL_NOTIFICATION_TASK_BOT_TASK_TYPES) || call.validateIdentifiers.includes(NOTIFICATION_TASK_BOT_RUN_TASK_TYPE) || call.validateIdentifiers.includes(ALL_NOTIFICATION_TASK_BOT_TASK_TYPES);
}

/**
 * The matching key of a script type reference: `code:<code>` when the code is known, otherwise `id:<identifier>`.
 *
 * @param ref - The script type reference.
 * @returns The key, or `undefined` when the reference has neither.
 */
export function scriptTypeRefKey(ref: ExtractedTaskBotScriptTypeRef | undefined): string | undefined {
  let result: string | undefined;
  if (ref?.code !== undefined) {
    result = `code:${ref.code}`;
  } else if (ref?.identifier !== undefined) {
    result = `id:${ref.identifier}`;
  }
  return result;
}

/**
 * A readable label for a script type reference: the constant name when there is one, otherwise the quoted code.
 *
 * @param ref - The script type reference.
 * @returns The label.
 */
export function scriptTypeRefLabel(ref: ExtractedTaskBotScriptTypeRef): string {
  return ref.identifier ?? `'${ref.code ?? '?'}'`;
}

// MARK: Locations
function relPathOf(sf: SourceFile): string {
  return apiRelPath(sf);
}

function locationOf(node: Node): ExtractedSourceLocation {
  return { sourceFile: relPathOf(node.getSourceFile()), line: node.getStartLineNumber() };
}

function shortText(node: Node): string {
  const text = node.getText().replaceAll(/\s+/g, ' ');
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

// MARK: Script type constants
function extractScriptTypeConstants(sources: readonly SourceFile[]): ExtractedTaskBotScriptTypeConstant[] {
  const out: ExtractedTaskBotScriptTypeConstant[] = [];
  for (const sf of sources) {
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        if (typeAnnotationText(decl) === NOTIFICATION_TASK_BOT_SCRIPT_TYPE) {
          out.push({ symbolName: decl.getName(), typeCode: readStringLiteralInitializer(decl), side: sourceSideOf(sf), sourceFile: relPathOf(sf), line: decl.getStartLineNumber() });
        }
      }
    }
  }
  return out;
}

// MARK: Script groups
function extractScriptGroupKeys(sources: readonly SourceFile[]): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>();
  for (const sf of sources) {
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const obj = asObjectLiteral(decl.getInitializer());
        if (typeAnnotationText(decl) === NOTIFICATION_TASK_BOT_SCRIPT_GROUP && obj) {
          out.set(decl.getName(), readStringProperty(obj, 'key'));
        }
      }
    }
  }
  return out;
}

// MARK: Script configs
function isConfigArrayType(typeText: string | undefined): boolean {
  const normalized = typeText?.replace(/^readonly\s+/, '');
  return normalized === `${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG}[]` || normalized === `Array<${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG}>` || normalized === `ReadonlyArray<${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG}>`;
}

interface MutableTaskBotIndex extends TaskBotIndex {
  readonly configs: Map<string, ExtractedTaskBotScriptConfig>;
  readonly aggregates: Map<string, VariableDeclaration>;
}

function extractScriptConfigs(sources: readonly SourceFile[], index: MutableTaskBotIndex): ExtractedTaskBotScriptConfig[] {
  const out: ExtractedTaskBotScriptConfig[] = [];
  for (const sf of sources) {
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const typeText = typeAnnotationText(decl);
        const obj = asObjectLiteral(decl.getInitializer());
        if (typeText === NOTIFICATION_TASK_BOT_SCRIPT_CONFIG && obj) {
          const config = readScriptConfig(obj, decl.getName(), index);
          index.configs.set(decl.getName(), config);
          out.push(config);
        } else if (isConfigArrayType(typeText)) {
          index.aggregates.set(decl.getName(), decl);
        }
      }
    }
  }
  return out;
}

function readScriptConfig(obj: ObjectLiteralExpression, symbolName: string | undefined, index: TaskBotIndex): ExtractedTaskBotScriptConfig {
  const scriptTypeNode = getPropertyInitializer(obj, 'scriptType');
  const scriptType = scriptTypeNode ? (resolveScriptTypeExpression(scriptTypeNode, plainScope(obj.getSourceFile(), index), 0).ref ?? undeclaredRef(scriptTypeNode)) : undefined;
  const sf = obj.getSourceFile();
  return {
    symbolName,
    scriptType,
    humanName: readStringProperty(obj, 'name'),
    description: readStringProperty(obj, 'description'),
    groupKey: readScriptGroupKey(obj, index),
    allowOwnerOptOut: readBooleanProperty(obj, NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_ALLOW_OWNER_OPT_OUT_FIELD),
    dataTypeSource: readScriptDataTypeSource(obj),
    side: sourceSideOf(sf),
    sourceFile: relPathOf(sf),
    line: obj.getStartLineNumber()
  };
}

/**
 * Whether a script config sets `dataType`. See {@link ExtractedTaskBotScriptConfigDataTypeSource}.
 *
 * @param obj - The script config object literal.
 * @returns How the config's `dataType` was read.
 */
function readScriptDataTypeSource(obj: ObjectLiteralExpression): ExtractedTaskBotScriptConfigDataTypeSource {
  const prop = obj.getProperty(NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_DATA_TYPE_FIELD);
  let result: ExtractedTaskBotScriptConfigDataTypeSource;
  if (prop) {
    const init = unwrapAsExpressions(getPropertyInitializer(obj, NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_DATA_TYPE_FIELD));
    const isNullish = init !== undefined && (init.getKind() === SyntaxKind.NullKeyword || (Node.isIdentifier(init) && init.getText() === 'undefined'));
    result = isNullish ? 'none' : 'declared';
  } else {
    result = obj.getProperties().some((p) => Node.isSpreadAssignment(p)) ? 'unresolved' : 'none';
  }
  return result;
}

/**
 * The `key` of a script config's `group`: an object literal, or a `NotificationTaskBotScriptGroup` constant (indexed, or
 * local to the config's file), with a string-literal `key`.
 *
 * @param obj - The script config object literal.
 * @param index - The extraction index.
 * @returns The group key, or `undefined` when it can't be read.
 */
function readScriptGroupKey(obj: ObjectLiteralExpression, index: TaskBotIndex): string | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_GROUP_FIELD));
  let result: string | undefined;
  if (init && Node.isObjectLiteralExpression(init)) {
    result = readStringProperty(init, 'key');
  } else if (init && Node.isIdentifier(init)) {
    const name = init.getText();
    const localGroup = index.groupKeys.has(name) ? undefined : asObjectLiteral(findLocalVariable(obj.getSourceFile(), name)?.getInitializer());
    result = index.groupKeys.get(name) ?? (localGroup ? readStringProperty(localGroup, 'key') : undefined);
  }
  return result;
}

function undeclaredRef(node: Node): ExtractedTaskBotScriptTypeRef {
  const inner = unwrapAsExpressions(node);
  return { identifier: inner && Node.isIdentifier(inner) ? inner.getText() : shortText(node), declared: false };
}

// MARK: Config lists (registries, aggregates)
interface ConfigListResult {
  readonly configs: ExtractedTaskBotScriptConfig[];
  readonly unresolved: string[];
  readonly trusted: string[];
}

interface ConfigListContext {
  readonly index: TaskBotIndex;
  readonly visited: Set<string>;
  readonly out: ConfigListResult;
}

function resolveConfigList(node: Node | undefined, index: TaskBotIndex, visited: Set<string>): ConfigListResult {
  const result: ConfigListResult = { configs: [], unresolved: [], trusted: [] };
  collectConfigListValue(node, { index, visited, out: result });
  return result;
}

function collectConfigListValue(node: Node | undefined, ctx: ConfigListContext): void {
  const { out } = ctx;
  const inner = unwrapAsExpressions(node);
  if (!inner) {
    return;
  }
  if (Node.isArrayLiteralExpression(inner)) {
    for (const el of inner.getElements()) {
      collectConfigListElement(Node.isSpreadElement(el) ? el.getExpression() : el, ctx);
    }
  } else if (Node.isIdentifier(inner)) {
    collectConfigListIdentifier(inner.getText(), ctx);
  } else {
    out.unresolved.push(shortText(inner));
  }
}

function collectConfigListElement(node: Node, ctx: ConfigListContext): void {
  const { index, out } = ctx;
  const inner = unwrapAsExpressions(node);
  if (inner && Node.isObjectLiteralExpression(inner)) {
    out.configs.push(readScriptConfig(inner, undefined, index));
  } else if (inner && Node.isArrayLiteralExpression(inner)) {
    collectConfigListValue(inner, ctx);
  } else if (inner && Node.isIdentifier(inner)) {
    collectConfigListIdentifier(inner.getText(), ctx);
  } else if (inner) {
    out.unresolved.push(shortText(inner));
  }
}

function collectConfigListIdentifier(name: string, ctx: ConfigListContext): void {
  const { index, visited, out } = ctx;
  const config = index.configs.get(name);
  const aggregate = index.aggregates.get(name);
  if (config) {
    out.configs.push(config);
  } else if (aggregate) {
    if (!visited.has(name)) {
      visited.add(name);
      collectConfigListValue(aggregate.getInitializer(), ctx);
    }
  } else if (index.trusted.has(name)) {
    out.trusted.push(name);
  } else {
    out.unresolved.push(name);
  }
}

// MARK: Registries
function extractRegistries(sources: readonly SourceFile[], index: TaskBotIndex): ExtractedTaskBotRegistry[] {
  const out: ExtractedTaskBotRegistry[] = [];
  for (const sf of sources) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (readCalleeName(call, index.imports) === NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD_FACTORY) {
        out.push(readRegistry(call, index));
      }
    }
  }
  return out;
}

function readRegistry(call: CallExpression, index: TaskBotIndex): ExtractedTaskBotRegistry {
  let declaration: Node | undefined = call.getParent();
  while (declaration && Node.isAsExpression(declaration)) {
    declaration = declaration.getParent();
  }
  const symbolName = declaration && Node.isVariableDeclaration(declaration) ? declaration.getName() : undefined;
  const list = resolveConfigList(call.getArguments()[0], index, new Set());
  const sf = call.getSourceFile();
  return { symbolName, configs: list.configs, unresolvedReferences: list.unresolved, trustedReferences: list.trusted, side: sourceSideOf(sf), sourceFile: relPathOf(sf), line: call.getStartLineNumber() };
}

function calleeName(call: CallExpression): string | undefined {
  const callee = call.getExpression();
  return Node.isIdentifier(callee) ? callee.getText() : undefined;
}

// MARK: Registry wirings
function extractRegistryWirings(sources: readonly SourceFile[], imports: DereekbImportIndex): ExtractedTaskBotRegistryWiring[] {
  const out: ExtractedTaskBotRegistryWiring[] = [];
  for (const sf of sources) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (readCalleeName(call, imports) === NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY) {
        out.push({ ...readRegistryWiringArgument(call.getArguments()[0], imports), ...locationOf(call) });
      }
    }
  }
  return out;
}

function readRegistryWiringArgument(arg: Node | undefined, imports: DereekbImportIndex): Pick<ExtractedTaskBotRegistryWiring, 'kind' | 'recordIdentifier'> {
  const inner = unwrapAsExpressions(arg);
  let result: Pick<ExtractedTaskBotRegistryWiring, 'kind' | 'recordIdentifier'>;
  if (!inner) {
    result = { kind: 'empty', recordIdentifier: undefined };
  } else if (Node.isIdentifier(inner)) {
    result = { kind: 'identifier', recordIdentifier: inner.getText() };
  } else if (Node.isCallExpression(inner) && readCalleeName(inner, imports) === NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD_FACTORY) {
    result = { kind: 'inline', recordIdentifier: undefined };
  } else {
    result = { kind: 'other', recordIdentifier: undefined };
  }
  return result;
}

// MARK: Script type expressions
interface Binding {
  readonly node: Node;
  readonly sf: SourceFile;
}

interface ResolveScope {
  readonly sf: SourceFile;
  readonly bindings: ReadonlyMap<string, Binding>;
  readonly fnNode: Node | undefined;
  readonly index: TaskBotIndex;
}

function plainScope(sf: SourceFile, index: TaskBotIndex): ResolveScope {
  return { sf, bindings: new Map(), fnNode: undefined, index };
}

interface ScriptTypeResolution {
  readonly ref?: ExtractedTaskBotScriptTypeRef;
  readonly reason?: string;
}

function resolveScriptTypeExpression(node: Node, scope: ResolveScope, depth: number): ScriptTypeResolution {
  const { index } = scope;
  const inner = unwrapAsExpressions(node);
  let result: ScriptTypeResolution;
  if (!inner || depth > MAX_RESOLVE_DEPTH) {
    result = { reason: `\`${shortText(node)}\` could not be followed` };
  } else if (Node.isStringLiteral(inner) || Node.isNoSubstitutionTemplateLiteral(inner)) {
    result = { ref: { code: inner.getLiteralText(), declared: true } };
  } else if (Node.isIdentifier(inner)) {
    result = resolveScriptTypeIdentifier(inner.getText(), scope, depth);
  } else if (Node.isPropertyAccessExpression(inner) && inner.getName() === 'scriptType') {
    const owner = unwrapAsExpressions(inner.getExpression());
    const config = owner && Node.isIdentifier(owner) ? index.configs.get(owner.getText()) : undefined;
    result = config?.scriptType ? { ref: config.scriptType } : { reason: `\`${shortText(inner)}\` does not name a declared NotificationTaskBotScriptConfig` };
  } else {
    result = { reason: `\`${shortText(inner)}\` can't be read statically` };
  }
  return result;
}

function resolveScriptTypeIdentifier(name: string, scope: ResolveScope, depth: number): ScriptTypeResolution {
  const { index } = scope;
  const binding = scope.bindings.get(name);
  const constant = index.constants.get(name);
  let result: ScriptTypeResolution | undefined;
  if (binding) {
    result = resolveScriptTypeExpression(binding.node, plainScope(binding.sf, index), depth + 1);
  } else if (constant) {
    result = { ref: { identifier: name, code: constant.typeCode, declared: true } };
  } else {
    const local = (scope.fnNode ? findVariableInside(scope.fnNode, name) : undefined) ?? findLocalVariable(scope.sf, name);
    const localInit = local?.getInitializer();
    if (localInit) {
      result = resolveScriptTypeExpression(localInit, plainScope(localInit.getSourceFile(), index), depth + 1);
    } else if (index.trusted.has(name)) {
      result = { ref: { identifier: name, declared: true } };
    }
  }
  return result ?? { reason: `\`${name}\` is not a declared NotificationTaskBotScriptType constant` };
}

function findVariableInside(node: Node, name: string): VariableDeclaration | undefined {
  return node.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((d) => d.getName() === name);
}

// MARK: NTBR handler calls
function extractRunHandlerCalls(sources: readonly SourceFile[], index: TaskBotIndex): ExtractedTaskBotRunHandlerCall[] {
  const out: ExtractedTaskBotRunHandlerCall[] = [];
  for (const sf of sources) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (readCalleeName(call, index.imports) === NOTIFICATION_TASK_BOT_RUN_HANDLER_FACTORY) {
        out.push(readRunHandlerCall(call, index));
      }
    }
  }
  return out;
}

function readRunHandlerCall(call: CallExpression, index: TaskBotIndex): ExtractedTaskBotRunHandlerCall {
  const sf = call.getSourceFile();
  const config = resolveObjectLiteralArgument(call.getArguments()[0], sf);
  const processorsArr = config ? resolveArrayLiteralProperty(config, 'processors', sf) : undefined;
  const processors: ExtractedTaskBotProcessor[] = [];
  if (processorsArr) {
    collectProcessorElements(processorsArr, { scope: plainScope(sf, index), out: processors, depth: 0 });
  }
  const validate = config ? readHandlerValidate(config, index) : { status: 'unresolved' as const, refs: [], usesRegistry: false, reason: 'the handler config is not an object literal' };
  return {
    ...locationOf(call),
    processorsResolved: processorsArr !== undefined,
    processors,
    validateStatus: validate.status,
    validate: validate.refs,
    validateUsesRegistry: validate.usesRegistry,
    validateUnresolvedReason: validate.reason
  };
}

interface ProcessorWalk {
  readonly scope: ResolveScope;
  readonly out: ExtractedTaskBotProcessor[];
  readonly depth: number;
}

function collectProcessorElements(arr: ArrayLiteralExpression, walk: ProcessorWalk): void {
  for (const el of arr.getElements()) {
    if (Node.isSpreadElement(el)) {
      collectProcessorSpread(el.getExpression(), walk);
    } else {
      walk.out.push(readProcessorElement(el, walk.scope, walk.depth));
    }
  }
}

function collectProcessorSpread(node: Node, walk: ProcessorWalk): void {
  const { scope, out, depth } = walk;
  const { index } = scope;
  const inner = unwrapAsExpressions(node);
  let arr: ArrayLiteralExpression | undefined;
  let arrScope: ResolveScope = scope;
  if (inner && Node.isIdentifier(inner)) {
    arr = asArrayLiteral(findLocalVariable(scope.sf, inner.getText())?.getInitializer());
  } else if (inner && Node.isCallExpression(inner)) {
    const fn = functionEntryOf(inner, index);
    const ret = fn ? findReturnExpression(fn.node) : undefined;
    arr = asArrayLiteral(ret);
    if (fn) {
      arrScope = { sf: fn.sourceFile, bindings: bindParameters(fn, inner), fnNode: fn.node, index };
    }
  }
  if (arr && depth < MAX_RESOLVE_DEPTH) {
    collectProcessorElements(arr, { scope: arrScope, out, depth: depth + 1 });
  } else {
    const trusted = inner !== undefined && isTrustedCallOrIdentifier(inner, index);
    out.push({ ...locationOf(node), label: `...${shortText(node)}`, target: undefined, unresolvedReason: trusted ? undefined : `the spread \`...${shortText(node)}\` does not resolve to an array literal`, trusted });
  }
}

function isTrustedCallOrIdentifier(node: Node, index: TaskBotIndex): boolean {
  let name: string | undefined;
  if (Node.isIdentifier(node)) {
    name = node.getText();
  } else if (Node.isCallExpression(node)) {
    name = calleeName(node);
  }
  return name !== undefined && index.trusted.has(name);
}

function functionEntryOf(call: CallExpression, index: TaskBotIndex): ApiFunctionEntry | undefined {
  const name = calleeName(call);
  return name ? index.functionIndex.functionsByName.get(name) : undefined;
}

function readProcessorElement(el: Node, scope: ResolveScope, depth: number): ExtractedTaskBotProcessor {
  const inner = unwrapAsExpressions(el) ?? el;
  const base = { ...locationOf(el), label: shortText(el) };
  let read: ProcessorTargetRead;
  if (Node.isObjectLiteralExpression(inner)) {
    read = readProcessorTarget(inner, scope, depth);
  } else if (Node.isCallExpression(inner)) {
    read = readProcessorCall(inner, scope.index, depth);
  } else if (Node.isIdentifier(inner)) {
    read = readProcessorIdentifier(inner.getText(), scope, depth);
  } else {
    read = { reason: `\`${shortText(inner)}\` is not a processor object, call or variable` };
  }
  return { ...base, target: read.ref, unresolvedReason: read.trusted ? undefined : read.reason, trusted: read.trusted ?? false };
}

interface ProcessorTargetRead extends ScriptTypeResolution {
  readonly trusted?: boolean;
}

function readProcessorIdentifier(name: string, scope: ResolveScope, depth: number): ProcessorTargetRead {
  const local = (scope.fnNode ? findVariableInside(scope.fnNode, name) : undefined) ?? findLocalVariable(scope.sf, name);
  const init = unwrapAsExpressions(local?.getInitializer());
  let result: ProcessorTargetRead;
  if (init && Node.isObjectLiteralExpression(init)) {
    result = readProcessorTarget(init, plainScope(init.getSourceFile(), scope.index), depth);
  } else if (init && Node.isCallExpression(init)) {
    result = readProcessorCall(init, scope.index, depth);
  } else if (scope.index.trusted.has(name)) {
    result = { trusted: true };
  } else {
    result = { reason: `\`${name}\` is not a local processor object or processor call` };
  }
  return result;
}

function readProcessorCall(call: CallExpression, index: TaskBotIndex, depth: number): ProcessorTargetRead {
  const name = calleeName(call);
  const fn = functionEntryOf(call, index);
  let result: ProcessorTargetRead;
  if (fn) {
    const ret = unwrapAsExpressions(findReturnExpression(fn.node));
    let obj: ObjectLiteralExpression | undefined;
    if (ret && Node.isObjectLiteralExpression(ret)) {
      obj = ret;
    } else if (ret && Node.isIdentifier(ret)) {
      obj = asObjectLiteral(findVariableInside(fn.node, ret.getText())?.getInitializer());
    }
    result = obj ? readProcessorTarget(obj, { sf: fn.sourceFile, bindings: bindParameters(fn, call), fnNode: fn.node, index }, depth) : { reason: `\`${name}\` does not return an object literal` };
  } else {
    result = name !== undefined && index.trusted.has(name) ? { trusted: true } : { reason: `\`${name ?? shortText(call.getExpression())}(...)\` is not a function declared in the scanned API folders` };
  }
  return result;
}

function bindParameters(fn: ApiFunctionEntry, call: CallExpression): ReadonlyMap<string, Binding> {
  const bindings = new Map<string, Binding>();
  const args = call.getArguments();
  fn.node.getParameters().forEach((param, i) => {
    const nameNode = param.getNameNode();
    const arg = args[i];
    const fallback = param.getInitializer();
    if (Node.isIdentifier(nameNode)) {
      if (arg) {
        bindings.set(nameNode.getText(), { node: arg, sf: call.getSourceFile() });
      } else if (fallback) {
        bindings.set(nameNode.getText(), { node: fallback, sf: fn.sourceFile });
      }
    }
  });
  return bindings;
}

function readProcessorTarget(obj: ObjectLiteralExpression, scope: ResolveScope, depth: number): ProcessorTargetRead {
  const target = getPropertyInitializer(obj, 'target');
  return target ? resolveScriptTypeExpression(target, scope, depth) : { reason: 'the processor has no `target`' };
}

// MARK: NTBR handler validate
interface HandlerValidateRead {
  readonly status: ExtractedTaskServiceValidateStatus;
  readonly refs: ExtractedTaskBotScriptTypeRef[];
  readonly usesRegistry: boolean;
  readonly reason: string | undefined;
}

function readHandlerValidate(config: ObjectLiteralExpression, index: TaskBotIndex): HandlerValidateRead {
  const init = getPropertyInitializer(config, 'validate');
  let result: HandlerValidateRead;
  if (init === undefined) {
    result = { status: 'absent', refs: [], usesRegistry: false, reason: undefined };
  } else {
    const refs: ExtractedTaskBotScriptTypeRef[] = [];
    const read = collectValidateValue(init, { scope: plainScope(config.getSourceFile(), index), out: refs }, 0);
    result = { status: read.reason === undefined ? 'resolved' : 'unresolved', refs, usesRegistry: read.usesRegistry, reason: read.reason };
  }
  return result;
}

interface ValidateValueRead {
  readonly usesRegistry: boolean;
  readonly reason?: string;
}

interface ValidateWalk {
  readonly scope: ResolveScope;
  readonly out: ExtractedTaskBotScriptTypeRef[];
}

function collectValidateValue(node: Node, walk: ValidateWalk, depth: number): ValidateValueRead {
  const inner = unwrapAsExpressions(node);
  let result: ValidateValueRead;
  if (!inner || depth > MAX_RESOLVE_DEPTH) {
    result = { usesRegistry: false, reason: `\`${shortText(node)}\` could not be followed` };
  } else if (Node.isArrayLiteralExpression(inner)) {
    result = collectValidateArray(inner, walk, depth);
  } else if (Node.isCallExpression(inner)) {
    result = collectValidateCall(inner, walk);
  } else if (Node.isIdentifier(inner)) {
    const init = findLocalVariable(walk.scope.sf, inner.getText())?.getInitializer();
    result = init ? collectValidateValue(init, walk, depth + 1) : { usesRegistry: false, reason: `\`${inner.getText()}\` is not a local script type list` };
  } else {
    result = { usesRegistry: false, reason: `\`${shortText(inner)}\` can't be read statically` };
  }
  return result;
}

function collectValidateArray(arr: ArrayLiteralExpression, walk: ValidateWalk, depth: number): ValidateValueRead {
  let usesRegistry = false;
  let reason: string | undefined;
  for (const el of arr.getElements()) {
    let read: ValidateValueRead;
    if (Node.isSpreadElement(el)) {
      read = collectValidateValue(el.getExpression(), walk, depth + 1);
    } else {
      const resolved = resolveScriptTypeExpression(el, walk.scope, depth);
      if (resolved.ref) {
        walk.out.push(resolved.ref);
      }
      read = { usesRegistry: false, reason: resolved.reason };
    }
    usesRegistry = usesRegistry || read.usesRegistry;
    reason = reason ?? read.reason;
  }
  return { usesRegistry, reason };
}

function collectValidateCall(call: CallExpression, walk: ValidateWalk): ValidateValueRead {
  const callee = call.getExpression();
  let result: ValidateValueRead = { usesRegistry: false, reason: `\`${shortText(call)}\` can't be read statically` };
  if (Node.isPropertyAccessExpression(callee) && callee.getName() === NOTIFICATION_TASK_BOT_GET_ALL_KNOWN_SCRIPT_TYPES) {
    result = { usesRegistry: true };
  } else if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'map' && isScriptTypeMapper(call.getArguments()[0])) {
    const list = resolveConfigList(callee.getExpression(), walk.scope.index, new Set());
    if (list.unresolved.length === 0 && list.trusted.length === 0 && list.configs.every((c) => c.scriptType?.declared)) {
      for (const c of list.configs) {
        walk.out.push(c.scriptType as ExtractedTaskBotScriptTypeRef);
      }
      result = { usesRegistry: false };
    } else {
      result = { usesRegistry: false, reason: `\`${shortText(callee.getExpression())}\` does not resolve to declared NotificationTaskBotScriptConfigs` };
    }
  }
  return result;
}

/**
 * Whether a `.map(...)` argument is `(x) => x.scriptType` (any parameter name).
 *
 * @param node - The `.map` argument.
 * @returns `true` for the script type mapper shape.
 */
function isScriptTypeMapper(node: Node | undefined): boolean {
  let result = false;
  if (node && Node.isArrowFunction(node)) {
    const params = node.getParameters();
    const body = unwrapAsExpressions(node.getBody());
    if (params.length === 1 && body && Node.isPropertyAccessExpression(body) && body.getName() === 'scriptType') {
      const owner = body.getExpression();
      result = Node.isIdentifier(owner) && owner.getText() === params[0].getName();
    }
  }
  return result;
}

// MARK: Repair calls
function extractRepairCalls(sources: readonly SourceFile[], imports: DereekbImportIndex): ExtractedSourceLocation[] {
  const out: ExtractedSourceLocation[] = [];
  for (const sf of sources) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      const isRepairMethod = Node.isPropertyAccessExpression(callee) && callee.getName() === NOTIFICATION_TASK_BOT_REPAIR_METHOD;
      const isRepairFactory = readCalleeName(call, imports) === NOTIFICATION_TASK_BOT_REPAIR_FACTORY;
      if (isRepairMethod || isRepairFactory) {
        out.push(locationOf(call));
      }
    }
  }
  return out;
}

// MARK: Workspace files
/**
 * Reads the `ntb` rule fact from a `firestore.rules` text.
 *
 * @param path - Workspace-relative path of the rules file.
 * @param text - The file's text, or `undefined` when it could not be read.
 * @returns The rules facts.
 */
export function readFirestoreRulesFacts(path: string, text: string | undefined): ExtractedTaskBotFirestoreRules {
  const stripped = text?.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');
  return { path, readable: text !== undefined, hasNotificationTaskBotMatch: stripped !== undefined && NTB_RULE_MATCH_REGEX.test(stripped) };
}

/**
 * Reads the `ntb.nat` index fact from a `firestore.indexes.json` text.
 *
 * @param path - Workspace-relative path of the indexes file.
 * @param text - The file's text, or `undefined` when it could not be read.
 * @returns The indexes facts. `parsed` is `false` when the text is missing or not valid JSON.
 */
export function readFirestoreIndexesFacts(path: string, text: string | undefined): ExtractedTaskBotFirestoreIndexes {
  let parsed: unknown;
  let ok = false;
  if (text !== undefined) {
    try {
      parsed = JSON.parse(text);
      ok = true;
    } catch {
      ok = false;
    }
  }
  const overrides = ok && parsed && typeof parsed === 'object' ? (parsed as { readonly fieldOverrides?: unknown }).fieldOverrides : undefined;
  const natIndexExempted = Array.isArray(overrides) && overrides.some((o) => isExemptingNatOverride(o));
  return { path, parsed: ok, natIndexExempted };
}

function isExemptingNatOverride(override: unknown): boolean {
  let result = false;
  if (override && typeof override === 'object') {
    const { collectionGroup, fieldPath, indexes } = override as { readonly collectionGroup?: unknown; readonly fieldPath?: unknown; readonly indexes?: unknown };
    if (collectionGroup === NOTIFICATION_TASK_BOT_COLLECTION && fieldPath === NOTIFICATION_TASK_BOT_NEXT_AT_FIELD) {
      const list = Array.isArray(indexes) ? (indexes as readonly { readonly queryScope?: unknown; readonly order?: unknown }[]) : [];
      result = !list.some((i) => i?.queryScope === 'COLLECTION' && i.order === 'ASCENDING');
    }
  }
  return result;
}
