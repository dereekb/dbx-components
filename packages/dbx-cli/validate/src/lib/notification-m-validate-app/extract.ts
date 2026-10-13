/**
 * Cross-file AST extraction for `dbx_notification_m_validate_app`.
 *
 * All component + API files land in a single in-memory ts-morph
 * `Project`; extraction resolves spreads and factory-call references by
 * symbol-name lookup inside that project — no language service.
 *
 * External imports (`@dereekb/*`) are tracked in a trust-list so rules
 * can suppress "unresolved" / "orphan" diagnostics for identifiers that
 * cross into upstream packages. The upstream task handlers in
 * `extract.upstream.ts` are the exception: the handlers trace records
 * their factory calls, called directly, through an `@dereekb/*` import
 * alias, as an `@dereekb/*` namespace member, or through a local `const`
 * holding one of those.
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
 * A `notificationTaskService({ validate })` that names one of the app's
 * component aggregates directly (`validate: ALL_NOTIFICATION_TASK_TYPES`,
 * imported by name from the component) is read as
 * `[...ALL_NOTIFICATION_TASK_TYPES]`.
 */

import { Node, SyntaxKind, type ArrayLiteralExpression, type ObjectLiteralExpression, type SourceFile, type TypeNode, type VariableDeclaration } from 'ts-morph';
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
  getPropertyInitializer,
  isDereekbModuleSpecifier,
  readArrayElementTypeNode,
  readBooleanProperty,
  readCalleeName,
  readIdentifierProperty,
  readImportedIdentifier,
  readStringLiteralInitializer,
  readStringProperty,
  readTypeReferenceName,
  resolveArrayLiteralProperty,
  unwrapAsExpressions,
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
import { type ApiFunctionIndex, buildApiFunctionIndex } from './extract.function-index.js';
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
      const validateAggregate = validateArr ? undefined : readValidateComponentAggregate(first, componentIndex);
      const handlersArr = resolveArrayLiteralProperty(first, 'handlers', sf);
      // `validate: ALL_NOTIFICATION_TASK_TYPES` reads as `validate: [...ALL_NOTIFICATION_TASK_TYPES]`
      const validate: TaskTypeListElements = validateAggregate ? { ids: [], spreads: [validateAggregate.symbolName], opaque: [] } : collectTaskTypeListElements(validateArr);
      const handlers = collectHandlersArrayElements({ handlersArr, sf, index, trustedExternal, imports });
      const validateStatus = validateAggregate ? 'resolved' : readTaskServiceListStatus(first, 'validate', validateArr);
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
        validateAggregate,
        opaqueValidateValues: validate.opaque,
        nestedValidateIdentifiers: nested.identifiers,
        nestedUpstreamValidateListings: nested.listings,
        opaqueNestedValidateValues: nested.opaque,
        reachedUpstreamHandlerCalls: handlers.reachedUpstreamHandlerCalls,
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
 * Reads a `notificationTaskService({ validate })` value that is not an array literal as one of the app's component
 * task-type aggregates, as in `validate: ALL_NOTIFICATION_TASK_TYPES`. The caller then reads it as
 * `[...ALL_NOTIFICATION_TASK_TYPES]`. Every condition must hold. Otherwise `validate` stays `unresolved`: a miss, never a
 * false finding.
 * - The value (after `as` casts) is an identifier the call's file imports by name: unaliased, not type-only, and declared
 *   nowhere else in the file (`readImportedIdentifier`).
 * - The import is a package outside `@dereekb/*` (in practice the app's `-firebase` component), not a relative path. So an
 *   upstream aggregate, or an API-side array of the same name, is never mistaken for the component's.
 * - The name is not an upstream aggregate name. A component aggregate that reuses one would be matched as the upstream
 *   aggregate by the name-based `validate` checks.
 * - The component declares an `ALL_*_NOTIFICATION_TASK_TYPES` / `NotificationTaskType[]` array literal of that name.
 *
 * @param config - The `notificationTaskService(...)` config object literal.
 * @param componentIndex - The component index.
 * @returns The component aggregate `validate` names, or `undefined`.
 */
function readValidateComponentAggregate(config: ObjectLiteralExpression, componentIndex: ComponentAggregateIndex): ExtractedTaskTypeAggregateArray | undefined {
  const imported = readImportedIdentifier(getPropertyInitializer(config, 'validate'));
  const isPinned = imported !== undefined && !isDereekbModuleSpecifier(imported.moduleSpecifier) && !imported.moduleSpecifier.startsWith('.') && !UPSTREAM_NOTIFICATION_TASK_AGGREGATES.has(imported.name);
  return isPinned ? componentIndex.taskAllTypesAggregates.get(imported.name) : undefined;
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
   * Identifiers the call's `validate` spreads, or the component aggregate it names directly.
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
  readonly sf: SourceFile;
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
 * @param options - The array literal, source file, function index, and
 *   trust-listed identifier set.
 * @returns The per-call buckets used to populate the task-service-call record.
 */
function collectHandlersArrayElements(options: CollectHandlersArrayElementsOptions): HandlersArrayElements {
  const { handlersArr, sf, index, trustedExternal, imports } = options;
  const handlerTypes: string[] = [];
  const unresolvedSpreads: string[] = [];
  const resolvedBindings: string[] = [];
  const unresolvedBindings: string[] = [];
  const reachedUpstreamHandlerCalls: ExtractedUpstreamHandlerCall[] = [];
  const opaqueHandlerValues: string[] = [];
  if (handlersArr) {
    const visited = new Set<string>();
    for (const el of handlersArr.getElements()) {
      consumeHandlersArrayElement(el, { sf, index, trustedExternal, imports, unresolvedSpreads, resolvedBindings, unresolvedBindings, reachedUpstreamHandlerCalls, opaqueHandlerValues, visited });
    }
  }
  return { handlerTypes, unresolvedSpreads, resolvedBindings, unresolvedBindings, reachedUpstreamHandlerCalls, opaqueHandlerValues };
}

function consumeHandlersArrayElement(el: Node, options: Omit<ConsumeHandlersSpreadElementOptions, 'inner'>): void {
  if (Node.isSpreadElement(el)) {
    consumeHandlersSpreadElement({ ...options, inner: el.getExpression() });
    return;
  }
  const inner = unwrapAsExpressions(el);
  if (!inner) return;
  if (noteUpstreamHandlerCall(inner, options)) return;
  const identifierName = readHandlerEntryIdentifierName(inner);
  if (identifierName === undefined) {
    // An inline handler config can't be an upstream handler.
    if (!Node.isObjectLiteralExpression(inner)) {
      options.opaqueHandlerValues.push(opaqueSnippet(inner));
    }
    return;
  }
  const { sf, index, trustedExternal, imports, resolvedBindings, unresolvedBindings, reachedUpstreamHandlerCalls, opaqueHandlerValues, visited } = options;
  collectHandlerBindingsFromIdentifier({ name: identifierName, sf, index, trustedExternal, imports, resolved: resolvedBindings, unresolved: unresolvedBindings, reachedUpstreamHandlerCalls, opaqueHandlerValues, visited });
}

function readHandlerEntryIdentifierName(inner: Node): string | undefined {
  let result: string | undefined;
  if (Node.isIdentifier(inner)) {
    result = inner.getText();
  } else if (Node.isCallExpression(inner)) {
    const callee = inner.getExpression();
    if (Node.isIdentifier(callee)) {
      result = callee.getText();
    }
  }
  return result;
}

interface ConsumeHandlersSpreadElementOptions {
  readonly inner: Node;
  readonly sf: SourceFile;
  readonly index: ApiFunctionIndex;
  readonly trustedExternal: ReadonlySet<string>;
  readonly imports: DereekbImportIndex;
  readonly unresolvedSpreads: string[];
  readonly resolvedBindings: string[];
  readonly unresolvedBindings: string[];
  readonly reachedUpstreamHandlerCalls: ExtractedUpstreamHandlerCall[];
  readonly opaqueHandlerValues: string[];
  readonly visited: Set<string>;
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
  const { inner, sf, index, trustedExternal, imports, unresolvedSpreads, resolvedBindings, unresolvedBindings, reachedUpstreamHandlerCalls, opaqueHandlerValues, visited } = options;
  const name = readHandlerEntryIdentifierName(inner);
  if (name !== undefined) {
    unresolvedSpreads.push(name);
  }
  if (noteUpstreamHandlerCall(inner, options)) return;
  if (name === undefined) {
    opaqueHandlerValues.push(opaqueSnippet(inner));
    return;
  }
  collectHandlerBindingsFromIdentifier({ name, sf, index, trustedExternal, imports, resolved: resolvedBindings, unresolved: unresolvedBindings, reachedUpstreamHandlerCalls, opaqueHandlerValues, visited });
}

/**
 * Context for collecting notification-task handler bindings reachable from a
 * given identifier or expression.
 */
interface HandlerBindingCollectorContext {
  readonly sf: SourceFile;
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
   * Receives every value the trace can't see through (see `ExtractedTaskServiceCall.opaqueHandlerValues`). Recording one
   * ends that branch of the trace with `true`.
   */
  readonly opaqueHandlerValues: string[];
  readonly visited: Set<string>;
}

/**
 * Options for collecting handler bindings starting from an arbitrary node.
 */
interface CollectHandlerBindingsFromValueOptions extends HandlerBindingCollectorContext {
  readonly node: Node | undefined;
}

/**
 * Walks a value-position node of the `handlers` trace. A typed `NotificationTaskServiceTaskHandlerConfig<...>` object
 * literal reached through a local binding lands in `resolved`, an upstream handler factory call in
 * `reachedUpstreamHandlerCalls`, and a value the trace can't see through in `opaqueHandlerValues`.
 *
 * @param options - The node and the collector context.
 * @returns `true` when the trace ended at a value it recorded: a typed handler config binding, an upstream handler
 *   factory call, or an opaque value. `false` when it reached nothing it could record: an identifier it can't follow
 *   (which lists itself in `unresolved`), an object literal that isn't a typed binding, or an array with no recorded
 *   element. The identifier that led to a `false` lists its own name in `unresolved` as well.
 */
function collectHandlerBindingsFromValue(options: CollectHandlerBindingsFromValueOptions): boolean {
  const inner = unwrapAsExpressions(options.node);
  let result = false;
  if (inner) {
    if (Node.isCallExpression(inner)) {
      result = collectHandlerBindingsFromCallExpression(inner, options);
    } else if (Node.isIdentifier(inner)) {
      result = collectHandlerBindingsFromIdentifier({ ...options, name: inner.getText() });
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
    result = collectHandlerBindingsFromIdentifier({ ...options, name: callee.getText() });
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
  readonly name: string;
}

function collectHandlerBindingsFromIdentifier(options: CollectHandlerBindingsFromIdentifierOptions): boolean {
  const { name, trustedExternal, unresolved } = options;
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
    unresolved.push(name);
    result = false;
  }
  return result;
}

function tryResolveLocalHandlerBinding(options: CollectHandlerBindingsFromIdentifierOptions): boolean {
  const { name, sf, visited, resolved } = options;
  const localKey = `${sf.getFilePath()}::${name}`;
  if (visited.has(localKey)) return false;
  visited.add(localKey);
  const localDecl = findLocalVariable(sf, name);
  if (!localDecl) return false;
  if (isHandlerConfigLeafDecl(localDecl, options.imports)) {
    resolved.push(localDecl.getName());
    return true;
  }
  const declInit = unwrapAsExpressions(localDecl.getInitializer());
  if (!declInit) return false;
  return collectHandlerBindingsFromValue({ ...options, node: declInit });
}

function isHandlerConfigLeafDecl(decl: VariableDeclaration, imports: DereekbImportIndex): boolean {
  const declInit = unwrapAsExpressions(decl.getInitializer());
  return readTypeReferenceName(decl.getTypeNode(), imports) === NOTIF_TASK_SERVICE_HANDLER_CONFIG && declInit !== undefined && Node.isObjectLiteralExpression(declInit);
}

function tryResolveFunctionHandlerBinding(options: CollectHandlerBindingsFromIdentifierOptions): boolean {
  const { name, index, visited } = options;
  const fnKey = `fn::${name}`;
  if (visited.has(fnKey)) return false;
  visited.add(fnKey);
  const fnEntry = index.functionsByName.get(name);
  if (!fnEntry) return false;
  const ret = findReturnExpression(fnEntry.node);
  if (!ret) return false;
  return collectHandlerBindingsFromValue({ ...options, node: ret, sf: fnEntry.sourceFile });
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
function extractTaskHandlerEntries(sources: readonly SourceFile[], imports: DereekbImportIndex): readonly ExtractedTaskHandlerEntry[] {
  const out: ExtractedTaskHandlerEntry[] = [];
  const seenSymbols = new Set<string>();
  for (const sf of sources) {
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const entry = tryReadTaskHandlerEntry(decl, imports, seenSymbols);
      if (entry) {
        out.push(entry);
      }
    }
  }
  return out;
}

function tryReadTaskHandlerEntry(decl: VariableDeclaration, imports: DereekbImportIndex, seenSymbols: Set<string>): ExtractedTaskHandlerEntry | undefined {
  const typeNode = decl.getTypeNode();
  if (!typeNode || readTypeReferenceName(typeNode, imports) !== NOTIF_TASK_SERVICE_HANDLER_CONFIG) return undefined;
  const obj = asObjectLiteral(decl.getInitializer());
  if (!obj) return undefined;
  const typeIdent = readIdentifierProperty(obj, 'type');
  if (!typeIdent) return undefined;
  const sourceFile = apiRelPath(decl.getSourceFile());
  const key = `${sourceFile}::${decl.getName()}`;
  if (seenSymbols.has(key)) return undefined;
  seenSymbols.add(key);
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
