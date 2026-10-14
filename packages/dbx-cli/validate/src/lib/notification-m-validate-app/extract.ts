/**
 * Cross-file AST extraction for `dbx_notification_m_validate_app`.
 *
 * All component + API files land in a single in-memory ts-morph
 * `Project`; extraction resolves spreads and factory-call references by
 * symbol-name lookup inside that project (the handlers trace by binding,
 * below) — no language service.
 *
 * External imports (`@dereekb/*`) are tracked in a trust-list so rules
 * can suppress "unresolved" / "orphan" diagnostics for identifiers that
 * cross into upstream packages. The upstream task handlers in
 * `extract.upstream.ts` are the exception: the handlers trace records
 * their factory calls, called directly, through an `@dereekb/*` import
 * alias, as an `@dereekb/*` namespace member, or through a local `const`
 * holding one of those.
 *
 * The handlers trace resolves an identifier to the local variable
 * declaration in scope where it is used (`resolveLocalVariable`); a name
 * with more than one declaration in scope there is opaque. It follows a
 * call or reference to the API function the name is bound to there
 * (`resolveApiFunctionReference`): a function its file declares, or one it
 * imports from another API file, never a same-named function elsewhere.
 * It records each typed handler config declaration it reaches
 * (`reachedTaskHandlerEntries`), so the rules match declared configs by
 * declaration, not by binding name.
 * It strips parentheses, `!`, `as` / `<T>` casts and `satisfies` around a
 * value (`unwrapOuterExpressions`), and follows a local holding an arrow
 * function or function expression that returns from one place
 * (`findSoleReturnExpression`) like a function declaration.
 *
 * Upstream factory calls (`notificationTemplateTypeInfoRecord`,
 * `appNotificationTemplateTypeInfoRecordService`, `notificationTaskService`,
 * the upstream task handler factories and the NotificationTaskBot factories)
 * are matched by name, through an `@dereekb/*` import alias, as an
 * `@dereekb/*` namespace member, or through a local `const` holding one of
 * those (`readCalleeName`).
 *
 * Declarations are recognized by their `@dereekb/*` type annotation, read
 * with `readTypeReferenceName`: written by name, through an `@dereekb/*`
 * import alias, or as an `@dereekb/*` namespace member
 * (`firebaseModel.NotificationTaskType`). Aggregate arrays are read through
 * `readArrayElementTypeNode` (`T[]`, `readonly T[]`, `Array<T>`,
 * `ReadonlyArray<T>`).
 *
 * A `notificationTaskService({ validate })` that names an aggregate
 * directly instead of an array literal is read as a spread of it
 * (`validate: ALL_NOTIFICATION_TASK_TYPES` as
 * `[...ALL_NOTIFICATION_TASK_TYPES]`). That covers one of the app's component
 * aggregates, or an upstream aggregate from `@dereekb/firebase`
 * (`validate: ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`). It may be imported
 * by name, under an alias or as a namespace member, and written directly or
 * through a local `const` (`readImportedReference`).
 */

import { Node, SyntaxKind, type ArrayLiteralExpression, type ArrowFunction, type FunctionDeclaration, type FunctionExpression, type Identifier, type ObjectLiteralExpression, type SourceFile, type TypeNode, type VariableDeclaration } from 'ts-morph';
import {
  apiRelPath,
  asArrayLiteral,
  asObjectLiteral,
  buildDereekbImportIndex,
  buildInMemoryProject,
  collectTrustedExternalIdentifiers,
  componentRelPath,
  findLocalVariable,
  findReturnExpression,
  findSoleReturnExpression,
  getPropertyInitializer,
  isDereekbModuleSpecifier,
  readArrayElementTypeNode,
  readBooleanProperty,
  readCalleeName,
  readIdentifierProperty,
  readImportedReference,
  readStringLiteralInitializer,
  readStringProperty,
  readTypeReferenceName,
  resolveArrayLiteralProperty,
  resolveLocalVariable,
  unwrapAsExpressions,
  unwrapOuterExpressions,
  type DereekbImportIndex
} from '../_core/_validate/ast.js';
import type {
  AppNotificationsInspection,
  ExtractedAppNotifications,
  ExtractedNestedUpstreamValidateListing,
  ExtractedTaskCheckpointAlias,
  ExtractedTaskDataInterface,
  ExtractedTaskHandlerEntry,
  ExtractedTaskServiceCall,
  ExtractedTaskServiceValidateStatus,
  ExtractedTaskTypeAggregateArray,
  ExtractedTaskTypeConstant,
  ExtractedTemplateConfigsArrayFactory,
  ExtractedTemplateConfigsArrayWiring,
  ExtractedTemplateHandlerEntry,
  ExtractedTemplateInfoAggregateArray,
  ExtractedTemplateInfoRecord,
  ExtractedTemplateInfoRecordWiring,
  ExtractedTemplateTypeConstant,
  ExtractedTemplateTypeInfo,
  ExtractedUpstreamHandlerCall,
  NotificationDeliveryMethodName,
  UserConfigurableDeliveryMethodsSource
} from './types.js';
import { type ApiFunctionIndex, buildApiFunctionIndex, resolveApiFunctionReference } from './extract.function-index.js';
import { extractAppNotificationTaskBot } from './extract.taskbot.js';
import { extractUpstreamHandlerCalls, UPSTREAM_NOTIFICATION_TASK_AGGREGATES, UPSTREAM_NOTIFICATION_TASK_TYPE_CONSTANTS, upstreamHandlerFactoryOf } from './extract.upstream.js';

const NOTIF_TEMPLATE_TYPE = 'NotificationTemplateType';
const NOTIF_TEMPLATE_TYPE_INFO = 'NotificationTemplateTypeInfo';
const NOTIF_TASK_TYPE = 'NotificationTaskType';
const NOTIF_TASK_SERVICE_HANDLER_CONFIG = 'NotificationTaskServiceTaskHandlerConfig';
const TEMPLATE_INFO_SUFFIX = '_NOTIFICATION_TEMPLATE_TYPE_INFO';
const ALL_TEMPLATE_INFO_ARRAY_SUFFIX = '_NOTIFICATION_TEMPLATE_TYPE_INFOS';
const ALL_TASK_TYPES_ARRAY_SUFFIX = '_NOTIFICATION_TASK_TYPES';
const TEMPLATE_INFO_RECORD_FACTORY = 'notificationTemplateTypeInfoRecord';
const TEMPLATE_INFO_RECORD_SERVICE = 'appNotificationTemplateTypeInfoRecordService';
const TASK_SERVICE_FACTORY = 'notificationTaskService';
const TEMPLATE_CONFIGS_ARRAY_FACTORY_SUFFIX = 'NotificationTemplateServiceConfigsArrayFactory';
const TEMPLATE_CONFIGS_ARRAY_TOKEN = 'NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN';
const CHECKPOINT_ALIAS_SUFFIX = 'NotificationTaskCheckpoint';
const TASK_DATA_INTERFACE_SUFFIX = 'NotificationTaskData';
const USER_CONFIGURABLE_DELIVERY_METHODS_PROPERTY = 'userConfigurableDeliveryMethods';
const FORCED_DELIVERY_METHODS_PROPERTY = 'forcedDeliveryMethods';
const ONLY_SEND_TO_EXPLICITLY_ENABLED_RECIPIENTS_PROPERTY = 'onlySendToExplicitlyEnabledRecipients';
const DELIVERY_METHOD_ENUM = 'NotificationDeliveryMethod';

/**
 * `NotificationDeliveryMethod.<MEMBER>` → member name.
 */
const DELIVERY_METHOD_BY_MEMBER: ReadonlyMap<string, NotificationDeliveryMethodName> = new Map([
  ['EMAIL', 'EMAIL'],
  ['TEXT', 'TEXT'],
  ['PUSH', 'PUSH'],
  ['NOTIFICATION_SUMMARY', 'NOTIFICATION_SUMMARY']
]);

/**
 * `NotificationDeliveryMethod` runtime code (`'e'` etc.) → member name.
 */
const DELIVERY_METHOD_BY_CODE: ReadonlyMap<string, NotificationDeliveryMethodName> = new Map([
  ['e', 'EMAIL'],
  ['t', 'TEXT'],
  ['p', 'PUSH'],
  ['n', 'NOTIFICATION_SUMMARY']
]);

/**
 * `NotificationMessage` channel-content property → delivery method, in the order
 * `notificationMessageUnlistedDeliveryMethods` (`@dereekb/firebase`) checks them.
 */
const CONTENT_PROPERTY_DELIVERY_METHODS: ReadonlyMap<string, NotificationDeliveryMethodName> = new Map([
  ['emailContent', 'EMAIL'],
  ['textContent', 'TEXT'],
  ['notificationSummaryContent', 'NOTIFICATION_SUMMARY']
]);

interface ComponentAggregateIndex {
  readonly templateInfos: ReadonlyMap<string, ExtractedTemplateTypeInfo>;
  readonly templateInfoAggregates: ReadonlyMap<string, ExtractedTemplateInfoAggregateArray>;
  readonly templateTypeConstants: ReadonlyMap<string, ExtractedTemplateTypeConstant>;
  readonly taskTypeConstants: ReadonlyMap<string, ExtractedTaskTypeConstant>;
  readonly taskAllTypesAggregates: ReadonlyMap<string, ExtractedTaskTypeAggregateArray>;
}

/**
 * Builds a ts-morph project from the prepared inspection and extracts every
 * fact the notification rules need — template/task type constants, info
 * objects, factories, handlers, aggregator wiring, and trusted external
 * identifiers — in a single pass so the rules run against a stable snapshot.
 *
 * @param inspection - The prepared component + api file snapshot.
 * @returns The structured extraction used by the rules layer.
 */
export function extractAppNotifications(inspection: AppNotificationsInspection): ExtractedAppNotifications {
  const { componentSources, apiSources } = buildInMemoryProject(inspection);
  const trustedExternalIdentifiers = collectTrustedExternalIdentifiers([...componentSources, ...apiSources]);
  const dereekbImports = buildDereekbImportIndex([...componentSources, ...apiSources]);

  // Component pass
  const templateTypeConstants = extractTemplateTypeConstants(componentSources, dereekbImports);
  const templateTypeInfos = extractTemplateTypeInfos(componentSources, dereekbImports);
  const templateInfoAggregates = extractTemplateInfoAggregates(componentSources, dereekbImports);
  const taskTypeConstants = extractTaskTypeConstants(componentSources, dereekbImports);
  const taskAllTypesAggregates = extractTaskAllTypesAggregates(componentSources, dereekbImports);
  const taskCheckpointAliases = extractTaskCheckpointAliases(componentSources);
  const taskDataInterfaces = extractTaskDataInterfaces(componentSources);
  const componentIndex = buildComponentAggregateIndex({ templateTypeConstants, templateTypeInfos, templateInfoAggregates, taskTypeConstants, taskAllTypesAggregates });
  const templateInfoRecord = extractTemplateInfoRecord(componentSources, { index: componentIndex, imports: dereekbImports });

  // API pass
  const templateInfoRecordWiring = extractTemplateInfoRecordWiring(apiSources, dereekbImports);
  const templateConfigsArrayWiring = extractTemplateConfigsArrayWiring(apiSources);
  const apiFunctionIndex = buildApiFunctionIndex(apiSources);
  const templateConfigsArrayFactory = extractTemplateConfigsArrayFactory(apiSources, apiFunctionIndex);
  const templateHandlerEntries = extractTemplateHandlerEntries(templateConfigsArrayFactory, apiFunctionIndex);
  const taskServiceCalls = extractTaskServiceCalls({ sources: apiSources, index: apiFunctionIndex, trustedExternal: trustedExternalIdentifiers, imports: dereekbImports, componentIndex });
  const taskHandlerEntries = extractTaskHandlerEntries(apiSources, dereekbImports);
  const upstreamHandlerCalls = extractUpstreamHandlerCalls(apiSources, dereekbImports);
  const taskBot = extractAppNotificationTaskBot({ componentSources, apiSources, functionIndex: apiFunctionIndex, trustedExternalIdentifiers, dereekbImports, taskServiceCalls, workspace: inspection.workspace });

  const result: ExtractedAppNotifications = {
    templateTypeConstants,
    templateTypeInfos,
    templateInfoAggregates,
    templateInfoRecord,
    taskTypeConstants,
    taskAllTypesAggregates,
    taskCheckpointAliases,
    taskDataInterfaces,
    templateInfoRecordWiring,
    templateConfigsArrayFactory,
    templateConfigsArrayWiring,
    templateHandlerEntries,
    taskServiceCalls,
    taskHandlerEntries,
    upstreamHandlerCalls,
    taskBot,
    trustedExternalIdentifiers
  };
  return result;
}

// MARK: Template type constants
function extractTemplateTypeConstants(sources: readonly SourceFile[], imports: DereekbImportIndex): readonly ExtractedTemplateTypeConstant[] {
  const out: ExtractedTemplateTypeConstant[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        if (readTypeReferenceName(decl.getTypeNode(), imports) !== NOTIF_TEMPLATE_TYPE) continue;
        const name = decl.getName();
        if (name.endsWith(TEMPLATE_INFO_SUFFIX)) continue;
        const entry: ExtractedTemplateTypeConstant = {
          symbolName: name,
          typeCode: readStringLiteralInitializer(decl),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        };
        out.push(entry);
      }
    }
  }
  return out;
}

// MARK: Template type infos
function extractTemplateTypeInfos(sources: readonly SourceFile[], imports: DereekbImportIndex): readonly ExtractedTemplateTypeInfo[] {
  const out: ExtractedTemplateTypeInfo[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const name = decl.getName();
        const nameMatches = name.endsWith(TEMPLATE_INFO_SUFFIX);
        const typeMatches = readTypeReferenceName(decl.getTypeNode(), imports) === NOTIF_TEMPLATE_TYPE_INFO;
        if (!nameMatches && !typeMatches) continue;
        const obj = asObjectLiteral(decl.getInitializer());
        if (!obj) continue;
        const deliveryMethods = readDeliveryMethodsProperty(obj, sf, USER_CONFIGURABLE_DELIVERY_METHODS_PROPERTY);
        const forcedDeliveryMethods = readDeliveryMethodsProperty(obj, sf, FORCED_DELIVERY_METHODS_PROPERTY);
        const entry: ExtractedTemplateTypeInfo = {
          symbolName: name,
          typeConstantName: readIdentifierProperty(obj, 'type'),
          humanName: readStringProperty(obj, 'name'),
          description: readStringProperty(obj, 'description'),
          notificationModelIdentity: readIdentifierProperty(obj, 'notificationModelIdentity'),
          targetModelIdentity: readIdentifierProperty(obj, 'targetModelIdentity'),
          userConfigurableDeliveryMethods: deliveryMethods.methods,
          userConfigurableDeliveryMethodsSource: deliveryMethods.source,
          forcedDeliveryMethods: forcedDeliveryMethods.methods,
          forcedDeliveryMethodsSource: forcedDeliveryMethods.source,
          onlySendToExplicitlyEnabledRecipients: readBooleanProperty(obj, ONLY_SEND_TO_EXPLICITLY_ENABLED_RECIPIENTS_PROPERTY),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        };
        out.push(entry);
      }
    }
  }
  return out;
}

interface ReadDeliveryMethodsResult {
  readonly methods: readonly NotificationDeliveryMethodName[] | undefined;
  readonly source: UserConfigurableDeliveryMethodsSource;
}

/**
 * Reads an info's delivery methods list property (`userConfigurableDeliveryMethods`
 * or `forcedDeliveryMethods`) statically. An absent (or `undefined` / `null`)
 * property means the runtime defaults apply; an array literal — inline, or
 * behind one local identifier — is read element by element; anything else is
 * reported as `unresolved`.
 *
 * @param obj - The `NotificationTemplateTypeInfo` object literal.
 * @param sf - The source file declaring the info, used to resolve a local identifier.
 * @param propertyName - The delivery methods list property to read.
 * @returns The read methods and where they came from.
 */
function readDeliveryMethodsProperty(obj: ObjectLiteralExpression, sf: SourceFile, propertyName: string): ReadDeliveryMethodsResult {
  const value = unwrapAsExpressions(getPropertyInitializer(obj, propertyName));
  let result: ReadDeliveryMethodsResult;
  if (!value || isNullishLiteral(value)) {
    result = { methods: undefined, source: 'default' };
  } else if (Node.isIdentifier(value)) {
    result = readDeliveryMethodsArray(asArrayLiteral(findLocalVariable(sf, value.getText())?.getInitializer()));
  } else {
    result = readDeliveryMethodsArray(asArrayLiteral(value));
  }
  return result;
}

function readDeliveryMethodsArray(arr: ArrayLiteralExpression | undefined): ReadDeliveryMethodsResult {
  const methods: NotificationDeliveryMethodName[] = [];
  let readable = arr !== undefined;
  for (const el of arr?.getElements() ?? []) {
    const method = readDeliveryMethodElement(unwrapAsExpressions(el));
    if (!method) {
      readable = false;
    } else if (!methods.includes(method)) {
      methods.push(method);
    }
  }
  const result: ReadDeliveryMethodsResult = readable ? { methods, source: 'declared' } : { methods: undefined, source: 'unresolved' };
  return result;
}

function readDeliveryMethodElement(el: Node | undefined): NotificationDeliveryMethodName | undefined {
  let result: NotificationDeliveryMethodName | undefined;
  if (el && Node.isPropertyAccessExpression(el) && el.getExpression().getText() === DELIVERY_METHOD_ENUM) {
    result = DELIVERY_METHOD_BY_MEMBER.get(el.getName());
  } else if (el && Node.isStringLiteral(el)) {
    result = DELIVERY_METHOD_BY_CODE.get(el.getLiteralText());
  }
  return result;
}

function isNullishLiteral(node: Node | undefined): boolean {
  return node !== undefined && ((Node.isIdentifier(node) && node.getText() === 'undefined') || node.getKind() === SyntaxKind.NullKeyword);
}

// MARK: Template info aggregates
function extractTemplateInfoAggregates(sources: readonly SourceFile[], imports: DereekbImportIndex): readonly ExtractedTemplateInfoAggregateArray[] {
  const out: ExtractedTemplateInfoAggregateArray[] = [];
  for (const sf of sources) {
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        tryExtractTemplateInfoAggregate(decl, imports, out);
      }
    }
  }
  return out;
}

function tryExtractTemplateInfoAggregate(decl: VariableDeclaration, imports: DereekbImportIndex, out: ExtractedTemplateInfoAggregateArray[]): void {
  const name = decl.getName();
  if (!name.startsWith('ALL_') || !name.endsWith(ALL_TEMPLATE_INFO_ARRAY_SUFFIX)) return;
  if (readTypeReferenceName(readArrayElementTypeNode(decl.getTypeNode()), imports) !== NOTIF_TEMPLATE_TYPE_INFO) return;
  const arr = asArrayLiteral(decl.getInitializer());
  if (!arr) return;
  out.push({ symbolName: name, infoIdentifiers: collectIdentifierElements(arr), sourceFile: componentRelPath(decl.getSourceFile()) });
}

function collectIdentifierElements(arr: ArrayLiteralExpression): string[] {
  const ids: string[] = [];
  for (const el of arr.getElements()) {
    const inner = unwrapAsExpressions(el);
    if (inner && Node.isIdentifier(inner)) {
      ids.push(inner.getText());
    }
  }
  return ids;
}

// MARK: Task type constants
function extractTaskTypeConstants(sources: readonly SourceFile[], imports: DereekbImportIndex): readonly ExtractedTaskTypeConstant[] {
  const out: ExtractedTaskTypeConstant[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        if (readTypeReferenceName(decl.getTypeNode(), imports) !== NOTIF_TASK_TYPE) continue;
        const name = decl.getName();
        out.push({
          symbolName: name,
          typeCode: readStringLiteralInitializer(decl),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        });
      }
    }
  }
  return out;
}

function extractTaskAllTypesAggregates(sources: readonly SourceFile[], imports: DereekbImportIndex): readonly ExtractedTaskTypeAggregateArray[] {
  const out: ExtractedTaskTypeAggregateArray[] = [];
  for (const sf of sources) {
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        tryExtractTaskAllTypesAggregate(decl, imports, out);
      }
    }
  }
  return out;
}

function tryExtractTaskAllTypesAggregate(decl: VariableDeclaration, imports: DereekbImportIndex, out: ExtractedTaskTypeAggregateArray[]): void {
  const name = decl.getName();
  const nameMatches = name.startsWith('ALL_') && name.endsWith(ALL_TASK_TYPES_ARRAY_SUFFIX);
  const typeMatches = readTypeReferenceName(readArrayElementTypeNode(decl.getTypeNode()), imports) === NOTIF_TASK_TYPE;
  if (!nameMatches && !typeMatches) return;
  const arr = asArrayLiteral(decl.getInitializer());
  if (!arr) return;
  const { ids, spreads, opaque } = collectTaskTypeListElements(arr);
  out.push({ symbolName: name, taskTypeIdentifiers: ids, spreadIdentifiers: spreads, opaqueValues: opaque, sourceFile: componentRelPath(decl.getSourceFile()), line: decl.getStartLineNumber() });
}

// MARK: Checkpoint aliases + data interfaces
function extractTaskCheckpointAliases(sources: readonly SourceFile[]): readonly ExtractedTaskCheckpointAlias[] {
  const out: ExtractedTaskCheckpointAlias[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const alias of sf.getTypeAliases()) {
      const name = alias.getName();
      if (!name.endsWith(CHECKPOINT_ALIAS_SUFFIX)) continue;
      const typeNode = alias.getTypeNode();
      const checkpoints: string[] = [];
      if (typeNode) {
        collectStringLiterals(typeNode, checkpoints);
      }
      out.push({ symbolName: name, checkpoints, sourceFile: rel });
    }
  }
  return out;
}

function collectStringLiterals(node: TypeNode, out: string[]): void {
  if (Node.isLiteralTypeNode(node)) {
    const lit = node.getLiteral();
    if (Node.isStringLiteral(lit)) {
      out.push(lit.getLiteralText());
    }
    return;
  }
  if (Node.isUnionTypeNode(node)) {
    for (const child of node.getTypeNodes()) {
      collectStringLiterals(child, out);
    }
  }
}

function extractTaskDataInterfaces(sources: readonly SourceFile[]): readonly ExtractedTaskDataInterface[] {
  const out: ExtractedTaskDataInterface[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const iface of sf.getInterfaces()) {
      const name = iface.getName();
      if (!name.endsWith(TASK_DATA_INTERFACE_SUFFIX)) continue;
      out.push({ symbolName: name, sourceFile: rel });
    }
  }
  return out;
}

// MARK: Template info record
function buildComponentAggregateIndex(parts: {
  readonly templateTypeConstants: readonly ExtractedTemplateTypeConstant[];
  readonly templateTypeInfos: readonly ExtractedTemplateTypeInfo[];
  readonly templateInfoAggregates: readonly ExtractedTemplateInfoAggregateArray[];
  readonly taskTypeConstants: readonly ExtractedTaskTypeConstant[];
  readonly taskAllTypesAggregates: readonly ExtractedTaskTypeAggregateArray[];
}): ComponentAggregateIndex {
  const infoMap = new Map<string, ExtractedTemplateTypeInfo>();
  for (const info of parts.templateTypeInfos) infoMap.set(info.symbolName, info);
  const aggMap = new Map<string, ExtractedTemplateInfoAggregateArray>();
  for (const agg of parts.templateInfoAggregates) aggMap.set(agg.symbolName, agg);
  const typeConstMap = new Map<string, ExtractedTemplateTypeConstant>();
  for (const c of parts.templateTypeConstants) typeConstMap.set(c.symbolName, c);
  const taskConstMap = new Map<string, ExtractedTaskTypeConstant>();
  for (const c of parts.taskTypeConstants) taskConstMap.set(c.symbolName, c);
  const taskAggMap = new Map<string, ExtractedTaskTypeAggregateArray>();
  for (const a of parts.taskAllTypesAggregates) taskAggMap.set(a.symbolName, a);
  const result: ComponentAggregateIndex = {
    templateInfos: infoMap,
    templateInfoAggregates: aggMap,
    templateTypeConstants: typeConstMap,
    taskTypeConstants: taskConstMap,
    taskAllTypesAggregates: taskAggMap
  };
  return result;
}

interface TemplateInfoRecordContext {
  readonly index: ComponentAggregateIndex;
  /**
   * The per-file `@dereekb/*` import bindings, used to match an aliased or namespaced `notificationTemplateTypeInfoRecord(...)`.
   */
  readonly imports: DereekbImportIndex;
}

function extractTemplateInfoRecord(sources: readonly SourceFile[], context: TemplateInfoRecordContext): ExtractedTemplateInfoRecord | undefined {
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const record = tryReadTemplateInfoRecord(decl, rel, context);
        if (record) {
          return record;
        }
      }
    }
  }
  return undefined;
}

/**
 * Inspects a single variable declaration and returns a populated
 * {@link ExtractedTemplateInfoRecord} when the initializer is a call to the
 * `notificationTemplateTypeInfoRecord` factory (called directly, through an
 * `@dereekb/*` import alias, or as an `@dereekb/*` namespace member);
 * otherwise `undefined`.
 *
 * @param decl - The variable declaration to inspect.
 * @param rel - The relative source file path used in the result record.
 * @param context - The component aggregate index used to resolve spread aggregates, and the import bindings used to match the factory.
 * @returns The extracted record or `undefined` when this declaration is not the factory call.
 */
function tryReadTemplateInfoRecord(decl: VariableDeclaration, rel: string, context: TemplateInfoRecordContext): ExtractedTemplateInfoRecord | undefined {
  const { index, imports } = context;
  const initializer = unwrapAsExpressions(decl.getInitializer());
  if (!initializer || !Node.isCallExpression(initializer)) return undefined;
  if (readCalleeName(initializer, imports) !== TEMPLATE_INFO_RECORD_FACTORY) return undefined;
  const args = initializer.getArguments();
  const arr = args[0] ? asArrayLiteral(args[0]) : undefined;
  const direct: string[] = [];
  const spreads: string[] = [];
  if (arr) {
    classifyInfoRecordArrayElements(arr, direct, spreads);
  }
  const { resolved, unresolved } = resolveTemplateInfoSpreads(direct, spreads, index);
  return {
    symbolName: decl.getName(),
    directInfoIdentifiers: direct,
    spreadAggregateIdentifiers: spreads,
    resolvedInfoIdentifiers: Array.from(resolved),
    unresolvedSpreadIdentifiers: unresolved,
    sourceFile: rel
  };
}

/**
 * Splits the elements of the `notificationTemplateTypeInfoRecord([...])`
 * array argument into direct identifier and spread-identifier buckets.
 *
 * @param arr - The array literal argument.
 * @param direct - Mutable buffer for direct identifier names.
 * @param spreads - Mutable buffer for spread-aggregate identifier names.
 */
function classifyInfoRecordArrayElements(arr: ArrayLiteralExpression, direct: string[], spreads: string[]): void {
  for (const el of arr.getElements()) {
    if (Node.isSpreadElement(el)) {
      const inner = el.getExpression();
      if (Node.isIdentifier(inner)) {
        spreads.push(inner.getText());
      }
      continue;
    }
    const inner = unwrapAsExpressions(el);
    if (inner && Node.isIdentifier(inner)) {
      direct.push(inner.getText());
    }
  }
}

/**
 * Walks each spread aggregate, expanding it into its info identifiers when it
 * resolves locally and recording it as unresolved otherwise.
 *
 * @param direct - Directly referenced info identifiers (seed for `resolved`)
 * @param spreads - Spread-aggregate identifier names to resolve.
 * @param index - The component aggregate index used to look up aggregates.
 * @returns The resolved info identifier set and unresolved spread list.
 */
function resolveTemplateInfoSpreads(direct: readonly string[], spreads: readonly string[], index: ComponentAggregateIndex): { readonly resolved: Set<string>; readonly unresolved: string[] } {
  const resolved = new Set<string>(direct);
  const unresolved: string[] = [];
  for (const spread of spreads) {
    const agg = index.templateInfoAggregates.get(spread);
    if (!agg) {
      unresolved.push(spread);
      continue;
    }
    for (const id of agg.infoIdentifiers) resolved.add(id);
  }
  return { resolved, unresolved };
}

// MARK: API wiring
function extractTemplateInfoRecordWiring(sources: readonly SourceFile[], imports: DereekbImportIndex): ExtractedTemplateInfoRecordWiring | undefined {
  let result: ExtractedTemplateInfoRecordWiring | undefined;
  outer: for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (readCalleeName(call, imports) !== TEMPLATE_INFO_RECORD_SERVICE) continue;
      const args = call.getArguments();
      const first = args[0];
      if (!first) continue;
      const inner = unwrapAsExpressions(first);
      if (!inner || !Node.isIdentifier(inner)) continue;
      result = {
        recordIdentifier: inner.getText(),
        sourceFile: rel
      };
      break outer;
    }
  }
  return result;
}

function extractTemplateConfigsArrayWiring(sources: readonly SourceFile[]): ExtractedTemplateConfigsArrayWiring | undefined {
  let result: ExtractedTemplateConfigsArrayWiring | undefined;
  outer: for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
      const provideIdent = readIdentifierProperty(obj, 'provide');
      if (provideIdent !== TEMPLATE_CONFIGS_ARRAY_TOKEN) continue;
      const useFactoryIdent = readIdentifierProperty(obj, 'useFactory');
      if (!useFactoryIdent) continue;
      result = { useFactoryIdentifier: useFactoryIdent, sourceFile: rel };
      break outer;
    }
  }
  return result;
}

function extractTemplateConfigsArrayFactory(sources: readonly SourceFile[], index: ApiFunctionIndex): ExtractedTemplateConfigsArrayFactory | undefined {
  let result: ExtractedTemplateConfigsArrayFactory | undefined;
  for (const sf of sources) {
    if (result) break;
    const rel = apiRelPath(sf);
    result = findFactoryInVariableStatements(sf, rel, index);
    if (result) break;
    result = findFactoryInFunctions(sf, rel, index);
  }
  return result;
}

function findFactoryInVariableStatements(sf: SourceFile, rel: string, index: ApiFunctionIndex): ExtractedTemplateConfigsArrayFactory | undefined {
  let result: ExtractedTemplateConfigsArrayFactory | undefined;
  outer: for (const stmt of sf.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      if (!name.endsWith(TEMPLATE_CONFIGS_ARRAY_FACTORY_SUFFIX)) continue;
      const body = unwrapAsExpressions(decl.getInitializer());
      if (!body) continue;
      result = buildTemplateConfigsFactorySummary({ symbolName: name, fnNode: body, sourceFile: rel, index });
      break outer;
    }
  }
  return result;
}

function findFactoryInFunctions(sf: SourceFile, rel: string, index: ApiFunctionIndex): ExtractedTemplateConfigsArrayFactory | undefined {
  let result: ExtractedTemplateConfigsArrayFactory | undefined;
  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (!name?.endsWith(TEMPLATE_CONFIGS_ARRAY_FACTORY_SUFFIX)) continue;
    result = buildTemplateConfigsFactorySummary({ symbolName: name, fnNode: fn, sourceFile: rel, index });
    break;
  }
  return result;
}

interface FactorySummaryBuckets {
  readonly directCalls: string[];
  readonly spreadCalls: string[];
  readonly unresolved: string[];
}

interface BuildTemplateConfigsFactorySummaryOptions {
  readonly symbolName: string;
  readonly fnNode: Node;
  readonly sourceFile: string;
  readonly index: ApiFunctionIndex;
}

function buildTemplateConfigsFactorySummary(options: BuildTemplateConfigsFactorySummaryOptions): ExtractedTemplateConfigsArrayFactory {
  const { symbolName, fnNode, sourceFile, index } = options;
  const buckets: FactorySummaryBuckets = { directCalls: [], spreadCalls: [], unresolved: [] };
  const returnExpr = findReturnExpression(fnNode);
  const arr = returnExpr ? asArrayLiteral(returnExpr) : undefined;
  if (arr) {
    for (const el of arr.getElements()) {
      collectFactoryArrayElement(el, buckets, index);
    }
  }
  const result: ExtractedTemplateConfigsArrayFactory = {
    symbolName,
    directFactoryCalls: buckets.directCalls,
    spreadFactoryCalls: buckets.spreadCalls,
    unresolvedSpreadIdentifiers: buckets.unresolved,
    sourceFile
  };
  return result;
}

function collectFactoryArrayElement(el: Node, buckets: FactorySummaryBuckets, index: ApiFunctionIndex): void {
  if (Node.isSpreadElement(el)) {
    recordFactorySpreadCall(el.getExpression(), buckets, index);
    return;
  }
  recordFactoryDirectCall(unwrapAsExpressions(el), buckets);
}

function recordFactorySpreadCall(inner: Node, buckets: FactorySummaryBuckets, index: ApiFunctionIndex): void {
  if (!Node.isCallExpression(inner)) return;
  const callee = inner.getExpression();
  if (!Node.isIdentifier(callee)) return;
  const callName = callee.getText();
  buckets.spreadCalls.push(callName);
  if (!index.functionsByName.has(callName)) {
    buckets.unresolved.push(callName);
  }
}

function recordFactoryDirectCall(inner: Node | undefined, buckets: FactorySummaryBuckets): void {
  if (!inner || !Node.isCallExpression(inner)) return;
  const callee = inner.getExpression();
  if (Node.isIdentifier(callee)) {
    buckets.directCalls.push(callee.getText());
  }
}

// MARK: Template handler entries
function extractTemplateHandlerEntries(factory: ExtractedTemplateConfigsArrayFactory | undefined, index: ApiFunctionIndex): readonly ExtractedTemplateHandlerEntry[] {
  if (!factory) return [];
  const out: ExtractedTemplateHandlerEntry[] = [];
  for (const direct of factory.directFactoryCalls) {
    collectFromSingleEntryFactory(direct, out, index);
  }
  for (const spread of factory.spreadFactoryCalls) {
    collectFromArrayEntryFactory(spread, out, index);
  }
  return out;
}

function collectFromSingleEntryFactory(name: string, out: ExtractedTemplateHandlerEntry[], index: ApiFunctionIndex): void {
  const fn = index.functionsByName.get(name);
  if (!fn) return;
  const returnExpr = findReturnExpression(fn.node);
  const obj = asObjectLiteral(returnExpr);
  if (!obj) return;
  const typeIdent = readIdentifierProperty(obj, 'type');
  if (!typeIdent) return;
  out.push({
    typeIdentifier: typeIdent,
    factoryFunctionName: name,
    contentDeliveryMethods: collectContentDeliveryMethods([fn.node, factoryPropertyFunctionNode(obj, index)]),
    sourceFile: fn.relPath,
    line: obj.getStartLineNumber()
  });
}

function collectFromArrayEntryFactory(name: string, out: ExtractedTemplateHandlerEntry[], index: ApiFunctionIndex): void {
  const fn = index.functionsByName.get(name);
  if (!fn) return;
  const returnExpr = findReturnExpression(fn.node);
  const arr = asArrayLiteral(returnExpr);
  if (!arr) return;
  for (const el of arr.getElements()) {
    consumeArrayEntryFactoryElement({ el, factoryName: name, relPath: fn.relPath, out, index });
  }
}

interface ConsumeArrayEntryFactoryElementOptions {
  readonly el: Node;
  readonly factoryName: string;
  readonly relPath: string;
  readonly out: ExtractedTemplateHandlerEntry[];
  readonly index: ApiFunctionIndex;
}

function consumeArrayEntryFactoryElement(options: ConsumeArrayEntryFactoryElementOptions): void {
  const { el, factoryName, relPath, out, index } = options;
  if (Node.isSpreadElement(el)) {
    chaseSpreadEntryFactoryCall(el.getExpression(), out, index);
    return;
  }
  const inner = unwrapAsExpressions(el);
  if (!inner) return;
  if (Node.isCallExpression(inner)) {
    chaseDirectSingleEntryFactoryCall(inner, out, index);
    return;
  }
  recordInlineEntryFactoryObject({ inner, factoryName, relPath, out, index });
}

function chaseSpreadEntryFactoryCall(inner: Node, out: ExtractedTemplateHandlerEntry[], index: ApiFunctionIndex): void {
  if (!Node.isCallExpression(inner)) return;
  const callee = inner.getExpression();
  if (Node.isIdentifier(callee)) {
    collectFromArrayEntryFactory(callee.getText(), out, index);
  }
}

function chaseDirectSingleEntryFactoryCall(inner: Node, out: ExtractedTemplateHandlerEntry[], index: ApiFunctionIndex): void {
  if (!Node.isCallExpression(inner)) return;
  const callee = inner.getExpression();
  if (Node.isIdentifier(callee)) {
    collectFromSingleEntryFactory(callee.getText(), out, index);
  }
}

interface RecordInlineEntryFactoryObjectOptions {
  readonly inner: Node;
  readonly factoryName: string;
  readonly relPath: string;
  readonly out: ExtractedTemplateHandlerEntry[];
  readonly index: ApiFunctionIndex;
}

function recordInlineEntryFactoryObject(options: RecordInlineEntryFactoryObjectOptions): void {
  const { inner, factoryName, relPath, out, index } = options;
  const obj = asObjectLiteral(inner);
  if (!obj) return;
  const typeIdent = readIdentifierProperty(obj, 'type');
  if (!typeIdent) return;
  // only the inline config is scanned: the enclosing function returns several configs
  const contentDeliveryMethods = collectContentDeliveryMethods([obj, factoryPropertyFunctionNode(obj, index)]);
  out.push({ typeIdentifier: typeIdent, factoryFunctionName: factoryName, contentDeliveryMethods, sourceFile: relPath, line: obj.getStartLineNumber() });
}

// MARK: Template handler content
/**
 * Resolves a handler config's `factory:` identifier (or shorthand) to a
 * function declared in the API, so its body can be scanned for channel
 * content. One hop only.
 *
 * @param obj - The `NotificationTemplateServiceTypeConfig` object literal.
 * @param index - The API function index.
 * @returns The named function node, or `undefined` when `factory:` is not an identifier naming an API function.
 */
function factoryPropertyFunctionNode(obj: ObjectLiteralExpression, index: ApiFunctionIndex): Node | undefined {
  const name = readIdentifierProperty(obj, 'factory');
  return name ? index.functionsByName.get(name)?.node : undefined;
}

/**
 * Heuristic scan for the channel content a template factory builds: every
 * `emailContent` / `textContent` / `notificationSummaryContent` property
 * assignment (or shorthand) under the given nodes, skipping ones explicitly
 * set to `undefined` / `null`. Content built in a helper outside these nodes
 * is missed; the send pipeline's runtime warning still covers it.
 *
 * @param nodes - The subtrees to scan; `undefined` entries are skipped.
 * @returns The delivery methods found, in canonical order (EMAIL, TEXT, NOTIFICATION_SUMMARY).
 */
function collectContentDeliveryMethods(nodes: readonly (Node | undefined)[]): NotificationDeliveryMethodName[] {
  const found = new Set<NotificationDeliveryMethodName>();
  for (const node of nodes) {
    if (node) {
      scanContentDeliveryMethods(node, found);
    }
  }
  return Array.from(CONTENT_PROPERTY_DELIVERY_METHODS.values()).filter((method) => found.has(method));
}

function scanContentDeliveryMethods(node: Node, found: Set<NotificationDeliveryMethodName>): void {
  for (const prop of node.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    const method = CONTENT_PROPERTY_DELIVERY_METHODS.get(prop.getName());
    if (method && !isNullishLiteral(unwrapAsExpressions(prop.getInitializer()))) {
      found.add(method);
    }
  }
  for (const prop of node.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)) {
    const method = CONTENT_PROPERTY_DELIVERY_METHODS.get(prop.getName());
    if (method) {
      found.add(method);
    }
  }
}

// MARK: Task service calls
interface ExtractTaskServiceCallsInput {
  readonly sources: readonly SourceFile[];
  readonly index: ApiFunctionIndex;
  readonly trustedExternal: ReadonlySet<string>;
  /**
   * The per-file bindings: they match the `notificationTaskService(...)` callee, drive the handlers trace, and follow a
   * `validate` that names an aggregate through an alias, a namespace or a local `const`.
   */
  readonly imports: DereekbImportIndex;
  /**
   * The component index. `validate` spreads of the app's own task-type aggregates are expanded through it, and a
   * `validate` that names one directly is read through it.
   */
  readonly componentIndex: ComponentAggregateIndex;
}

function extractTaskServiceCalls(input: ExtractTaskServiceCallsInput): readonly ExtractedTaskServiceCall[] {
  const { sources, index, trustedExternal, imports, componentIndex } = input;
  const out: ExtractedTaskServiceCall[] = [];
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (readCalleeName(call, imports) !== TASK_SERVICE_FACTORY) continue;
      const args = call.getArguments();
      const first = args[0] ? asObjectLiteral(args[0]) : undefined;
      if (!first) continue;
      const validateArr = resolveArrayLiteralProperty(first, 'validate', sf);
      const named = validateArr ? undefined : readValidateNamedAggregate(first, input);
      const handlersArr = resolveArrayLiteralProperty(first, 'handlers', sf);
      // `validate: ALL_NOTIFICATION_TASK_TYPES` (also `TASK_TYPES`, `ns.ALL_…`, or a local `const`) reads as `validate: [...ALL_NOTIFICATION_TASK_TYPES]`
      const validate: TaskTypeListElements = named ? { ids: [], spreads: [named.symbolName], opaque: [] } : collectTaskTypeListElements(validateArr);
      const handlers = collectHandlersArrayElements({ handlersArr, index, trustedExternal, imports });
      const validateStatus = named ? 'resolved' : readTaskServiceListStatus(first, 'validate', validateArr);
      const handlersStatus = readTaskServiceListStatus(first, 'handlers', handlersArr);
      const nested = expandComponentValidateSpreads({ validateSpreads: validate.spreads, componentIndex, trustedExternal });
      out.push({
        validateIdentifiers: validate.ids,
        spreadValidateIdentifiers: validate.spreads,
        handlerTypeIdentifiers: handlers.handlerTypes,
        unresolvedHandlerSpreadIdentifiers: handlers.unresolvedSpreads,
        resolvedHandlerBindings: handlers.resolvedBindings,
        unresolvedHandlerBindings: handlers.unresolvedBindings,
        validateStatus,
        validateAggregate: named?.component,
        validateUpstreamAggregate: named && !named.component ? named.symbolName : undefined,
        validateReferenceText: named?.referenceText,
        opaqueValidateValues: validate.opaque,
        nestedValidateIdentifiers: nested.identifiers,
        nestedUpstreamValidateListings: nested.listings,
        opaqueNestedValidateValues: nested.opaque,
        reachedUpstreamHandlerCalls: handlers.reachedUpstreamHandlerCalls,
        reachedTaskHandlerEntries: handlers.reachedTaskHandlerEntries,
        handlersStatus,
        opaqueHandlerValues: handlers.opaqueHandlerValues,
        sourceFile: rel
      });
    }
  }
  return out;
}

/**
 * Reads how a `notificationTaskService({ ... })` list property was read: missing, an array literal, or something else.
 *
 * @param config - The `notificationTaskService(...)` config object literal.
 * @param name - The property name (`validate` or `handlers`).
 * @param arr - The array literal the property resolved to, if any.
 * @returns The list status.
 */
function readTaskServiceListStatus(config: ObjectLiteralExpression, name: string, arr: ArrayLiteralExpression | undefined): ExtractedTaskServiceValidateStatus {
  let status: ExtractedTaskServiceValidateStatus = 'unresolved';
  if (getPropertyInitializer(config, name) === undefined) {
    status = 'absent';
  } else if (arr) {
    status = 'resolved';
  }
  return status;
}

/**
 * An aggregate a `notificationTaskService({ validate })` names directly, from {@link readValidateNamedAggregate}.
 */
interface ValidateNamedAggregate {
  /**
   * The aggregate's exported name. The caller reads `validate` as a spread of it.
   */
  readonly symbolName: string;
  /**
   * How the call's file refers to it (`ImportedReference.text`).
   */
  readonly referenceText: string;
  /**
   * The app's component aggregate, or `undefined` for an upstream aggregate.
   */
  readonly component: ExtractedTaskTypeAggregateArray | undefined;
}

/**
 * Reads a `notificationTaskService({ validate })` value that is not an array literal as an aggregate it names directly:
 * one of the app's component aggregates (`validate: ALL_NOTIFICATION_TASK_TYPES`), or an upstream aggregate
 * (`validate: ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`). The caller then reads it as `[...X]`. Every condition must hold.
 * Otherwise `validate` stays `unresolved`: a miss, never a false finding.
 * - The value reads back to a value import of the call's file (`readImportedReference`): by name, under an alias, or as a
 *   namespace member, written directly or through a local `const` that is the only binding of its name in scope, with
 *   the import's local name declared nowhere else in the file.
 * - A component aggregate: the module is a package outside `@dereekb/*` (in practice the app's `-firebase` component), not
 *   a relative path, so an API-side array of the same name is never mistaken for the component's; the name is not an
 *   upstream aggregate name (a component aggregate that reuses one would be matched as the upstream aggregate by the
 *   name-based checks); and the component declares an `ALL_*_NOTIFICATION_TASK_TYPES` / `NotificationTaskType[]` array
 *   literal of that name.
 * - An upstream aggregate: the module is an `@dereekb/*` package, the name is an aggregate from
 *   `UPSTREAM_NOTIFICATION_TASK_HANDLERS`, and the component declares no aggregate of that name (the `validate` expansion
 *   would follow the component's instead).
 *
 * @param config - The `notificationTaskService(...)` config object literal.
 * @param input - The component index and the per-file bindings.
 * @returns The aggregate `validate` names, or `undefined`.
 */
function readValidateNamedAggregate(config: ObjectLiteralExpression, input: Pick<ExtractTaskServiceCallsInput, 'componentIndex' | 'imports'>): ValidateNamedAggregate | undefined {
  const imported = readImportedReference(getPropertyInitializer(config, 'validate'), input.imports);
  let result: ValidateNamedAggregate | undefined;
  if (imported) {
    const { name, moduleSpecifier, text } = imported;
    const component = input.componentIndex.taskAllTypesAggregates.get(name);
    const isUpstreamName = UPSTREAM_NOTIFICATION_TASK_AGGREGATES.has(name);
    const isDereekbModule = isDereekbModuleSpecifier(moduleSpecifier);
    const isUpstreamAggregate = isDereekbModule && isUpstreamName && component === undefined;
    const isComponentAggregate = !isDereekbModule && !moduleSpecifier.startsWith('.') && !isUpstreamName && component !== undefined;
    if (isUpstreamAggregate || isComponentAggregate) {
      result = { symbolName: name, referenceText: text, component };
    }
  }
  return result;
}

interface TaskTypeListElements {
  readonly ids: string[];
  readonly spreads: string[];
  readonly opaque: string[];
}

/**
 * Splits a task-type list — the `validate: [...]` array or an `ALL_*_NOTIFICATION_TASK_TYPES` aggregate — into direct
 * identifier names, spread identifier names, and the values the extractor can't read.
 *
 * @param arr - The array literal, or `undefined` when the property is absent.
 * @returns The identifiers, the spread identifiers and the unreadable values (collapsed and truncated).
 */
function collectTaskTypeListElements(arr: ArrayLiteralExpression | undefined): TaskTypeListElements {
  const ids: string[] = [];
  const spreads: string[] = [];
  const opaque: string[] = [];
  for (const el of arr?.getElements() ?? []) {
    const isSpread = Node.isSpreadElement(el);
    const inner = isSpread ? el.getExpression() : unwrapAsExpressions(el);
    if (inner !== undefined && Node.isIdentifier(inner)) {
      (isSpread ? spreads : ids).push(inner.getText());
    } else {
      opaque.push(opaqueSnippet(el));
    }
  }
  return { ids, spreads, opaque };
}

interface ExpandComponentValidateSpreadsInput {
  /**
   * Identifiers the call's `validate` spreads, or the aggregate it names directly.
   */
  readonly validateSpreads: readonly string[];
  readonly componentIndex: ComponentAggregateIndex;
  readonly trustedExternal: ReadonlySet<string>;
}

interface ExpandedComponentValidateSpreads {
  /**
   * Every element identifier of the aggregates the walk visits.
   */
  readonly identifiers: string[];
  readonly listings: ExtractedNestedUpstreamValidateListing[];
  readonly opaque: string[];
}

/**
 * Follows every component `ALL_*_NOTIFICATION_TASK_TYPES` aggregate a `validate` spreads (or names directly), and every component
 * aggregate those spread in turn. Each aggregate is visited once, which also stops a cycle. For each one it records:
 * - its element identifiers (`identifiers`): the app's task types and any other name written there, for the checks that
 *   read the task types `validate` lists (`NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER`, the list report's `inValidateList`);
 * - each upstream aggregate spread or upstream task-type constant from `UPSTREAM_NOTIFICATION_TASK_HANDLERS` it holds
 *   (`listings`). A name counts only when it is imported from `@dereekb/*` (the trust list) and the component does not
 *   declare it as its own task type, so a look-alike never raises an upstream error.
 *
 * Values the walk can't place are collected as opaque: an unreadable element, a spread of a name that is neither a
 * component aggregate nor a trusted upstream aggregate, and an upstream task-type constant that is not trusted.
 *
 * @param input - The call's `validate` spreads, the component index and the trust list.
 * @returns The element identifiers and the nested listings, both in `validate` order (depth first, an aggregate's
 *   spreads before its own elements), and the opaque values.
 */
function expandComponentValidateSpreads(input: ExpandComponentValidateSpreadsInput): ExpandedComponentValidateSpreads {
  const { validateSpreads, componentIndex, trustedExternal } = input;
  const identifiers: string[] = [];
  const listings: ExtractedNestedUpstreamValidateListing[] = [];
  const opaque: string[] = [];
  const visited = new Set<string>();
  const isOwnTaskType = (name: string) => componentIndex.taskTypeConstants.has(name);
  const visit = (aggregate: ExtractedTaskTypeAggregateArray, via: readonly string[]): void => {
    visited.add(aggregate.symbolName);
    const chain = [...via, aggregate.symbolName];
    const location = { via: chain, sourceFile: aggregate.sourceFile, line: aggregate.line };
    opaque.push(...aggregate.opaqueValues);
    for (const name of aggregate.spreadIdentifiers) {
      const inner = componentIndex.taskAllTypesAggregates.get(name);
      if (inner) {
        if (!visited.has(name)) {
          visit(inner, chain);
        }
      } else if (UPSTREAM_NOTIFICATION_TASK_AGGREGATES.has(name) && trustedExternal.has(name) && !isOwnTaskType(name)) {
        listings.push({ identifier: name, spread: true, ...location });
      } else {
        opaque.push(`...${name}`);
      }
    }
    identifiers.push(...aggregate.taskTypeIdentifiers);
    for (const name of aggregate.taskTypeIdentifiers) {
      if (UPSTREAM_NOTIFICATION_TASK_TYPE_CONSTANTS.has(name) && !isOwnTaskType(name)) {
        if (trustedExternal.has(name)) {
          listings.push({ identifier: name, spread: false, ...location });
        } else {
          opaque.push(name);
        }
      }
    }
  };
  for (const name of validateSpreads) {
    const aggregate = componentIndex.taskAllTypesAggregates.get(name);
    if (aggregate && !visited.has(name)) {
      visit(aggregate, []);
    }
  }
  return { identifiers, listings, opaque };
}

interface CollectHandlersArrayElementsOptions {
  readonly handlersArr: ArrayLiteralExpression | undefined;
  readonly index: ApiFunctionIndex;
  readonly trustedExternal: ReadonlySet<string>;
  readonly imports: DereekbImportIndex;
}

interface HandlersArrayElements {
  readonly handlerTypes: string[];
  readonly unresolvedSpreads: string[];
  readonly resolvedBindings: string[];
  readonly unresolvedBindings: string[];
  readonly reachedUpstreamHandlerCalls: ExtractedUpstreamHandlerCall[];
  readonly reachedTaskHandlerEntries: ExtractedTaskHandlerEntry[];
  readonly opaqueHandlerValues: string[];
}

/**
 * Walks the `handlers: [...]` array, classifying each spread/non-spread
 * element and chasing identifier references through
 * {@link collectHandlerBindingsFromIdentifier}. Spread call/identifier names
 * are recorded as "unresolved spreads" because the runtime expansion lives
 * elsewhere; the binding tracer still walks them so the rules pass can match
 * resolved bindings against the trust list.
 *
 * @param options - The array literal, function index, trust-listed
 *   identifier set and import bindings.
 * @returns The per-call buckets used to populate the task-service-call record.
 */
function collectHandlersArrayElements(options: CollectHandlersArrayElementsOptions): HandlersArrayElements {
  const { handlersArr, index, trustedExternal, imports } = options;
  const handlerTypes: string[] = [];
  const unresolvedSpreads: string[] = [];
  const resolvedBindings: string[] = [];
  const unresolvedBindings: string[] = [];
  const reachedUpstreamHandlerCalls: ExtractedUpstreamHandlerCall[] = [];
  const reachedTaskHandlerEntries: ExtractedTaskHandlerEntry[] = [];
  const opaqueHandlerValues: string[] = [];
  if (handlersArr) {
    const outcomes = new Map<Node, boolean>();
    for (const el of handlersArr.getElements()) {
      consumeHandlersArrayElement(el, { index, trustedExternal, imports, unresolvedSpreads, resolvedBindings, unresolvedBindings, reachedUpstreamHandlerCalls, reachedTaskHandlerEntries, opaqueHandlerValues, outcomes });
    }
  }
  return { handlerTypes, unresolvedSpreads, resolvedBindings, unresolvedBindings, reachedUpstreamHandlerCalls, reachedTaskHandlerEntries, opaqueHandlerValues };
}

function consumeHandlersArrayElement(el: Node, options: Omit<ConsumeHandlersSpreadElementOptions, 'inner'>): void {
  if (Node.isSpreadElement(el)) {
    consumeHandlersSpreadElement({ ...options, inner: unwrapOuterExpressions(el.getExpression()) });
    return;
  }
  const inner = unwrapOuterExpressions(el);
  if (noteUpstreamHandlerCall(inner, options)) return;
  const identifier = readHandlerEntryIdentifier(inner);
  if (identifier === undefined) {
    // An inline handler config can't be an upstream handler.
    if (!Node.isObjectLiteralExpression(inner)) {
      options.opaqueHandlerValues.push(opaqueSnippet(inner));
    }
    return;
  }
  const { index, trustedExternal, imports, resolvedBindings, unresolvedBindings, reachedUpstreamHandlerCalls, reachedTaskHandlerEntries, opaqueHandlerValues, outcomes } = options;
  collectHandlerBindingsFromIdentifier({ identifier, index, trustedExternal, imports, resolved: resolvedBindings, unresolved: unresolvedBindings, reachedUpstreamHandlerCalls, reachedTaskHandlerEntries, opaqueHandlerValues, outcomes });
}

/**
 * Returns the identifier a `handlers` element names: the element itself, or the callee of a call. The trace resolves it
 * where it sits.
 *
 * @param inner - The element or a spread's expression, parentheses, `!`, casts and `satisfies` stripped.
 * @returns The identifier, or `undefined` for any other shape.
 */
function readHandlerEntryIdentifier(inner: Node): Identifier | undefined {
  let result: Identifier | undefined;
  if (Node.isIdentifier(inner)) {
    result = inner;
  } else if (Node.isCallExpression(inner)) {
    const callee = inner.getExpression();
    if (Node.isIdentifier(callee)) {
      result = callee;
    }
  }
  return result;
}

interface ConsumeHandlersSpreadElementOptions {
  readonly inner: Node;
  readonly index: ApiFunctionIndex;
  readonly trustedExternal: ReadonlySet<string>;
  readonly imports: DereekbImportIndex;
  readonly unresolvedSpreads: string[];
  readonly resolvedBindings: string[];
  readonly unresolvedBindings: string[];
  readonly reachedUpstreamHandlerCalls: ExtractedUpstreamHandlerCall[];
  readonly reachedTaskHandlerEntries: ExtractedTaskHandlerEntry[];
  readonly opaqueHandlerValues: string[];
  readonly outcomes: Map<Node, boolean>;
}

/**
 * Records a spread element from `handlers: [...]`, supporting both
 * `...identifier` and `...callee(...)` forms. The spread name is appended to
 * `unresolvedSpreads` because the array expansion happens at runtime, while
 * the binding tracer still walks it for trust-list matching.
 *
 * @param options - The spread inner expression and the buckets to populate.
 */
function consumeHandlersSpreadElement(options: ConsumeHandlersSpreadElementOptions): void {
  const { inner, index, trustedExternal, imports, unresolvedSpreads, resolvedBindings, unresolvedBindings, reachedUpstreamHandlerCalls, reachedTaskHandlerEntries, opaqueHandlerValues, outcomes } = options;
  const identifier = readHandlerEntryIdentifier(inner);
  if (identifier !== undefined) {
    unresolvedSpreads.push(identifier.getText());
  }
  if (noteUpstreamHandlerCall(inner, options)) return;
  if (identifier === undefined) {
    opaqueHandlerValues.push(opaqueSnippet(inner));
    return;
  }
  collectHandlerBindingsFromIdentifier({ identifier, index, trustedExternal, imports, resolved: resolvedBindings, unresolved: unresolvedBindings, reachedUpstreamHandlerCalls, reachedTaskHandlerEntries, opaqueHandlerValues, outcomes });
}

/**
 * Context for collecting notification-task handler bindings reachable from a
 * given identifier or expression.
 */
interface HandlerBindingCollectorContext {
  readonly index: ApiFunctionIndex;
  readonly trustedExternal: ReadonlySet<string>;
  /**
   * The per-file `@dereekb/*` import bindings, used to match aliased and namespaced upstream handler factory calls.
   */
  readonly imports: DereekbImportIndex;
  readonly resolved: string[];
  readonly unresolved: string[];
  /**
   * Receives every upstream handler-factory call (`UPSTREAM_NOTIFICATION_TASK_HANDLERS`) the trace reaches.
   */
  readonly reachedUpstreamHandlerCalls: ExtractedUpstreamHandlerCall[];
  /**
   * Receives the entry (see `tryReadTaskHandlerEntry`) of every typed handler config declaration the trace reaches, once per
   * declaration. The rules read the task types `handlers` registers from these, not from the names in `resolved`.
   */
  readonly reachedTaskHandlerEntries: ExtractedTaskHandlerEntry[];
  /**
   * Receives every value the trace can't see through (see `ExtractedTaskServiceCall.opaqueHandlerValues`). Recording one
   * ends that branch of the trace with `true`.
   */
  readonly opaqueHandlerValues: string[];
  /**
   * The outcome of every local variable declaration and function the trace has walked, by declaration (see
   * `traceHandlerBindingOnce`). Two declarations of one name are separate entries.
   */
  readonly outcomes: Map<Node, boolean>;
}

/**
 * Options for collecting handler bindings starting from an arbitrary node.
 */
interface CollectHandlerBindingsFromValueOptions extends HandlerBindingCollectorContext {
  readonly node: Node | undefined;
}

/**
 * Walks a value-position node of the `handlers` trace. Parentheses, `!`, `as` / `<T>` casts and `satisfies` around the
 * node are stripped first (`unwrapOuterExpressions`). A typed `NotificationTaskServiceTaskHandlerConfig<...>` object
 * literal reached through a local binding lands in `resolved`, an upstream handler factory call in
 * `reachedUpstreamHandlerCalls`, and a value the trace can't see through in `opaqueHandlerValues`. Each local and
 * function is walked once per trace, and reaching one again returns what that walk returned (`traceHandlerBindingOnce`).
 *
 * @param options - The node and the collector context.
 * @returns `true` when the trace ended at a value it recorded: a typed handler config binding, an upstream handler
 *   factory call, or an opaque value. `false` when it reached nothing it could record: an identifier it can't follow
 *   (which lists itself in `unresolved`), an object literal that isn't a typed binding, or an array with no recorded
 *   element. The identifier that led to a `false` lists its own name in `unresolved` as well.
 */
function collectHandlerBindingsFromValue(options: CollectHandlerBindingsFromValueOptions): boolean {
  const inner = unwrapOuterExpressions(options.node);
  let result = false;
  if (inner) {
    if (Node.isCallExpression(inner)) {
      result = collectHandlerBindingsFromCallExpression(inner, options);
    } else if (Node.isIdentifier(inner)) {
      result = collectHandlerBindingsFromIdentifier({ ...options, identifier: inner });
    } else if (Node.isArrayLiteralExpression(inner)) {
      result = collectHandlerBindingsFromArrayLiteral(inner, options);
    } else if (!Node.isObjectLiteralExpression(inner)) {
      options.opaqueHandlerValues.push(opaqueSnippet(inner));
      result = true;
    }
  }
  return result;
}

function collectHandlerBindingsFromCallExpression(call: Node, options: CollectHandlerBindingsFromValueOptions): boolean {
  if (!Node.isCallExpression(call)) return false;
  const callee = call.getExpression();
  let result = false;
  if (noteUpstreamHandlerCall(call, options)) {
    result = true;
  } else if (Node.isIdentifier(callee)) {
    result = collectHandlerBindingsFromIdentifier({ ...options, identifier: callee });
  } else {
    // An opaque call ends the trace like an upstream factory call: it is recorded once, and the wrapper and local that
    // lead here are not unresolved.
    options.opaqueHandlerValues.push(opaqueSnippet(call));
    result = true;
  }
  return result;
}

// Walk array-literal returns (factory-of-array shape):
//   return [localHandler]
//   return [...subFactoryHandlers(ctx), localHandler]
//   return [innerFactory(), localHandler]
// Each element re-enters this helper so call/identifier/spread cases are
// handled uniformly. Inline object literals are intentionally ignored — the
// surrounding rule check requires a named, typed handler binding.
function collectHandlerBindingsFromArrayLiteral(arr: Node, options: CollectHandlerBindingsFromValueOptions): boolean {
  if (!Node.isArrayLiteralExpression(arr)) return false;
  let any = false;
  for (const el of arr.getElements()) {
    const child = Node.isSpreadElement(el) ? el.getExpression() : el;
    if (collectHandlerBindingsFromValue({ ...options, node: child })) {
      any = true;
    }
  }
  return any;
}

/**
 * Options for collecting handler bindings starting from an identifier name.
 */
interface CollectHandlerBindingsFromIdentifierOptions extends HandlerBindingCollectorContext {
  /**
   * The identifier to follow. Where it sits decides which declaration of its name it means (`resolveLocalVariable`,
   * `resolveApiFunctionReference`).
   */
  readonly identifier: Identifier;
}

function collectHandlerBindingsFromIdentifier(options: CollectHandlerBindingsFromIdentifierOptions): boolean {
  const { identifier, trustedExternal, unresolved } = options;
  const name = identifier.getText();
  const localResolved = tryResolveLocalHandlerBinding(options);
  const fnResolved = tryResolveFunctionHandlerBinding(options);
  const resolvedAny = localResolved || fnResolved;

  // A `@dereekb/*` name reached as a value can't be seen through: a helper
  // can hide a handler in its arguments (`...filterMaybeArrayValues([sfHandler])`),
  // and an upstream handler factory passed along as a value, or held in a
  // variable the scan can't pin to one `const` (a `let`, a parameter, a
  // shadowed name), may be called anywhere. Upstream handler factory calls
  // (direct, aliased, namespaced, or through a local `const`) never get here;
  // they end the trace in `noteUpstreamHandlerCall`.
  let result: boolean;
  if (resolvedAny) {
    result = true;
  } else if (trustedExternal.has(name)) {
    options.opaqueHandlerValues.push(name);
    result = true;
  } else {
    // a name reached again (a cycle, or a local or function its first walk couldn't follow) is listed once
    if (!unresolved.includes(name)) {
      unresolved.push(name);
    }
    result = false;
  }
  return result;
}

/**
 * Follows {@link CollectHandlerBindingsFromIdentifierOptions.identifier} to the local variable declaration in scope where it
 * is used (`resolveLocalVariable`). A typed `NotificationTaskServiceTaskHandlerConfig` object literal lands in `resolved`,
 * and its entry (`tryReadTaskHandlerEntry`) in `reachedTaskHandlerEntries`. An arrow function or function expression that returns from one place (`findSoleReturnExpression`) is a wrapper, like a
 * function declaration: the trace walks the value it returns (`collectHandlerBindingsFromFunction`). Any other initializer
 * is walked as a value, so a function that can return from more than one place stays opaque. A name with more than one declaration in scope there is opaque: the scan can't tell
 * which one it means.
 *
 * @param options - The identifier and the collector context.
 * @returns `true` when the name was opaque, or the declaration's value ended at something the trace recorded. `false` when
 *   no followable declaration is in scope (a parameter, an import, a name only another function declares), the
 *   declaration was already walked and its walk returned `false` (or is still running: a cycle), or its value led
 *   nowhere.
 */
function tryResolveLocalHandlerBinding(options: CollectHandlerBindingsFromIdentifierOptions): boolean {
  const { identifier, imports, outcomes, resolved, reachedTaskHandlerEntries, opaqueHandlerValues } = options;
  const resolution = resolveLocalVariable(identifier, imports);
  let result = false;
  if (resolution.kind === 'ambiguous') {
    opaqueHandlerValues.push(identifier.getText());
    result = true;
  } else if (resolution.kind === 'variable') {
    const { declaration } = resolution;
    const walk = (): boolean => {
      const init = unwrapOuterExpressions(declaration.getInitializer());
      let walked: boolean;
      if (isHandlerConfigLeafDecl(declaration, imports)) {
        resolved.push(declaration.getName());
        const entry = tryReadTaskHandlerEntry(declaration, imports);
        if (entry) {
          reachedTaskHandlerEntries.push(entry);
        }
        walked = true;
      } else if ((Node.isArrowFunction(init) || Node.isFunctionExpression(init)) && findSoleReturnExpression(init) !== undefined) {
        // a local holding a function that returns from one place is a wrapper, like a function declaration: walk that value
        walked = collectHandlerBindingsFromFunction({ ...options, fn: init });
      } else {
        walked = init !== undefined && collectHandlerBindingsFromValue({ ...options, node: init });
      }
      return walked;
    };
    result = traceHandlerBindingOnce({ outcomes, key: declaration, walk });
  }
  return result;
}

function isHandlerConfigLeafDecl(decl: VariableDeclaration, imports: DereekbImportIndex): boolean {
  const declInit = unwrapOuterExpressions(decl.getInitializer());
  return readTypeReferenceName(decl.getTypeNode(), imports) === NOTIF_TASK_SERVICE_HANDLER_CONFIG && declInit !== undefined && Node.isObjectLiteralExpression(declInit);
}

/**
 * Follows {@link CollectHandlerBindingsFromIdentifierOptions.identifier} to the API function it is bound to where it is
 * used (`resolveApiFunctionReference`) and walks its return value (`collectHandlerBindingsFromFunction`). Each function
 * is walked once per trace, whether this path or a local that holds it reaches it first. A name bound to more than one
 * declaration in scope is the local lookup's to record (`tryResolveLocalHandlerBinding`), so it is not followed here.
 *
 * @param options - The identifier and the collector context.
 * @returns `true` when the function's return value ended at something the trace recorded. `false` when the name is bound
 *   to no API function there (a parameter, a variable that holds no function, an import the scan can't pin to one API
 *   function), or the function's value led nowhere.
 */
function tryResolveFunctionHandlerBinding(options: CollectHandlerBindingsFromIdentifierOptions): boolean {
  const resolution = resolveApiFunctionReference({ reference: options.identifier, index: options.index, imports: options.imports });
  return resolution.kind === 'function' && collectHandlerBindingsFromFunction({ ...options, fn: resolution.entry.node });
}

/**
 * Options for walking a function the handlers trace reached.
 */
interface CollectHandlerBindingsFromFunctionOptions extends HandlerBindingCollectorContext {
  /**
   * The API function a reference is bound to, or one a local variable holds.
   */
  readonly fn: ArrowFunction | FunctionDeclaration | FunctionExpression;
}

/**
 * Walks what {@link CollectHandlerBindingsFromFunctionOptions.fn} returns: a concise arrow body, or the expression of
 * the first `return` statement of its body. Each function is walked once per trace (`traceHandlerBindingOnce`), whichever
 * path reaches it first: the function a reference is bound to (`tryResolveFunctionHandlerBinding`) or a local that holds
 * it (`tryResolveLocalHandlerBinding`).
 *
 * @param options - The function and the collector context.
 * @returns `true` when the function's return value ended at something the trace recorded, or, on a revisit, when the
 *   first walk did.
 */
function collectHandlerBindingsFromFunction(options: CollectHandlerBindingsFromFunctionOptions): boolean {
  const { fn, ...context } = options;
  const walk = (): boolean => {
    const ret = findReturnExpression(fn);
    return ret !== undefined && collectHandlerBindingsFromValue({ ...context, node: ret });
  };
  return traceHandlerBindingOnce({ outcomes: context.outcomes, key: fn, walk });
}

interface TraceHandlerBindingOnceInput {
  readonly outcomes: Map<Node, boolean>;
  /**
   * The local variable declaration or the function the walk reads: the one a reference is bound to, so a revisit can't
   * mean another.
   */
  readonly key: Node;
  /**
   * Walks the local or function and returns its outcome (see `collectHandlerBindingsFromValue`).
   */
  readonly walk: () => boolean;
}

/**
 * Walks the local or function behind a key at most once per `handlers` trace, and returns its outcome. The first visit
 * stores what the walk returned and a revisit returns it: the first walk already recorded everything behind the key, so a
 * wrapper or local reached twice is not listed in `unresolved` the second time. A revisit returns `false` while the walk
 * is still running (a cycle).
 *
 * @param input - The trace's outcomes, the key and the walk.
 * @returns The key's outcome.
 */
function traceHandlerBindingOnce(input: TraceHandlerBindingOnceInput): boolean {
  const { outcomes, key } = input;
  const stored = outcomes.get(key);
  let result: boolean;
  if (stored === undefined) {
    outcomes.set(key, false); // what a revisit reads while the walk runs: a cycle
    result = input.walk();
    outcomes.set(key, result);
  } else {
    result = stored;
  }
  return result;
}

/**
 * Records {@link node} when it calls an upstream handler factory from `UPSTREAM_NOTIFICATION_TASK_HANDLERS` (directly,
 * through an `@dereekb/*` import alias, as an `@dereekb/*` namespace member, or through a local `const` holding one of
 * those), so the rules know which upstream handlers are reachable from `notificationTaskService({ handlers })`. The call
 * ends the trace: it builds exactly one handler config, so there is nothing behind it to follow.
 *
 * @param node - A value-position node the handlers trace visits.
 * @param context - The import bindings and the bucket that receives the call's factory and location.
 * @returns `true` when {@link node} is an upstream handler factory call.
 */
function noteUpstreamHandlerCall(node: Node, context: Pick<HandlerBindingCollectorContext, 'imports' | 'reachedUpstreamHandlerCalls'>): boolean {
  const factory = upstreamHandlerFactoryOf(node, context.imports);
  if (factory !== undefined) {
    context.reachedUpstreamHandlerCalls.push({ factory, sourceFile: apiRelPath(node.getSourceFile()), line: node.getStartLineNumber() });
  }
  return factory !== undefined;
}

const OPAQUE_SNIPPET_MAX_LENGTH = 60;

/**
 * Returns {@link node}'s text with whitespace collapsed, truncated for messages.
 *
 * @param node - The opaque value.
 * @returns The snippet.
 */
function opaqueSnippet(node: Node): string {
  const text = node.getText().replaceAll(/\s+/g, ' ').trim();
  return text.length > OPAQUE_SNIPPET_MAX_LENGTH ? `${text.slice(0, OPAQUE_SNIPPET_MAX_LENGTH)}…` : text;
}

// MARK: Task handler entries
/**
 * Reads every typed handler config in the API files ({@link tryReadTaskHandlerEntry}), one entry per declaration: two
 * configs that share a binding name (in two functions of one file, or in two files) are two entries.
 *
 * @param sources - The API source files.
 * @param imports - The per-file `@dereekb/*` import bindings.
 * @returns The entries, in source order.
 */
function extractTaskHandlerEntries(sources: readonly SourceFile[], imports: DereekbImportIndex): readonly ExtractedTaskHandlerEntry[] {
  const out: ExtractedTaskHandlerEntry[] = [];
  for (const sf of sources) {
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const entry = tryReadTaskHandlerEntry(decl, imports);
      if (entry) {
        out.push(entry);
      }
    }
  }
  return out;
}

/**
 * Reads {@link decl} as a task handler config entry: a `NotificationTaskServiceTaskHandlerConfig<...>`-typed object literal
 * whose `type:` is an identifier. The entries pass and the `handlers` trace both read entries here, so a declaration the
 * trace reaches and its entry agree.
 *
 * @param decl - A variable declaration.
 * @param imports - The per-file `@dereekb/*` import bindings.
 * @returns The entry, or `undefined` when {@link decl} is not such a config.
 */
function tryReadTaskHandlerEntry(decl: VariableDeclaration, imports: DereekbImportIndex): ExtractedTaskHandlerEntry | undefined {
  const typeNode = decl.getTypeNode();
  if (!typeNode || readTypeReferenceName(typeNode, imports) !== NOTIF_TASK_SERVICE_HANDLER_CONFIG) return undefined;
  const obj = asObjectLiteral(decl.getInitializer());
  if (!obj) return undefined;
  const typeIdent = readIdentifierProperty(obj, 'type');
  if (!typeIdent) return undefined;
  const sourceFile = apiRelPath(decl.getSourceFile());
  const flowCount = readFlowStepCount(obj);
  const { dataArg, checkpointArg } = readHandlerTypeArguments(typeNode);
  const entry: ExtractedTaskHandlerEntry = {
    typeIdentifier: typeIdent,
    bindingName: decl.getName(),
    flowStepCount: flowCount,
    dataTypeArgument: dataArg,
    checkpointTypeArgument: checkpointArg,
    sourceFile,
    line: decl.getStartLineNumber()
  };
  return entry;
}

function readFlowStepCount(obj: ObjectLiteralExpression): number | undefined {
  const flowInit = unwrapAsExpressions(getPropertyInitializer(obj, 'flow'));
  let count: number | undefined;
  if (flowInit && Node.isArrayLiteralExpression(flowInit)) {
    count = flowInit.getElements().length;
  }
  return count;
}

function readHandlerTypeArguments(typeNode: Node): { readonly dataArg: string | undefined; readonly checkpointArg: string | undefined } {
  let dataArg: string | undefined;
  let checkpointArg: string | undefined;
  if (Node.isTypeReference(typeNode)) {
    const tArgs = typeNode.getTypeArguments();
    if (tArgs.length >= 1) dataArg = tArgs[0].getText();
    if (tArgs.length >= 2) checkpointArg = tArgs[1].getText();
  }
  return { dataArg, checkpointArg };
}
